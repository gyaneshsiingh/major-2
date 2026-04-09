"""
FastAPI backend for the PL Ensemble Video Analytics Dashboard.
Run with:  python3 -m uvicorn backend.main:app --port 8000 --reload
"""
import os, uuid, tempfile, json
import numpy as np
import pandas as pd
import cv2
import joblib
from datetime import datetime
import scipy.ndimage as ndi
import scipy.signal as signal

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import (RandomForestRegressor, GradientBoostingRegressor,
                               StackingRegressor, ExtraTreesRegressor)
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
from sklearn.neighbors import KNeighborsRegressor
from sklearn.linear_model import Ridge
from sklearn.svm import SVR
from sklearn.metrics import r2_score
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.pipeline import make_pipeline

try:
    from xgboost import XGBRegressor
    XG_AVAILABLE = True
except Exception:
    XG_AVAILABLE = False

# ── Paths ─────────────────────────────────────────────────────
BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(BASE_DIR, "best_ensemble_model.joblib")
DB_URL     = f"sqlite:///{os.path.join(BASE_DIR, 'pl_results.db')}"
PLOTS_DIR  = os.path.join(BASE_DIR, "saved_plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

engine = create_engine(DB_URL)

def find_csv():
    """Locate nm RGB.csv — searched fresh on every call."""
    for p in [
        os.path.join(BASE_DIR, "nm RGB.csv"),
        os.path.join(BASE_DIR, "nm_RGB.csv"),
        os.path.join(BASE_DIR, "backend", "nm RGB.csv"),
        os.path.join(BASE_DIR, "data", "nm RGB.csv"),
    ]:
        if os.path.exists(p):
            return p
    return None

# ── App ──────────────────────────────────────────────────────
app = FastAPI(title="PL Ensemble API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB ───────────────────────────────────────────────────────
def init_db():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS results (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                sample_name TEXT,
                voltage REAL,
                avg_nm REAL,
                peak_nm REAL,
                min_nm REAL,
                max_nm REAL,
                ensemble_type TEXT,
                ensemble_r2 REAL,
                spectrum_x TEXT,
                spectrum_y TEXT
            )
        """))
        conn.commit()

init_db()

# ── Feature Engineering ──────────────────────────────────────
def engineer_features(X_raw):
    """Add derived features: channel ratios, differences, and dominant channel.
    This helps the model distinguish similar colors more precisely."""
    df = pd.DataFrame(X_raw, columns=["Red", "Green", "Blue"]) if not isinstance(X_raw, pd.DataFrame) else X_raw.copy()
    R, G, B = df["Red"].values, df["Green"].values, df["Blue"].values
    total = R + G + B + 1e-6  # avoid division by zero
    
    df["R_ratio"] = R / total
    df["G_ratio"] = G / total
    df["B_ratio"] = B / total
    df["RG_diff"] = R - G
    df["GB_diff"] = G - B
    df["RB_diff"] = R - B
    df["max_ch"]  = np.maximum(R, np.maximum(G, B))
    df["min_ch"]  = np.minimum(R, np.minimum(G, B))
    df["range"]   = df["max_ch"] - df["min_ch"]
    return df


# ── Ensemble ─────────────────────────────────────────────────
_ensemble_cache = None

def get_ensemble():
    global _ensemble_cache
    if _ensemble_cache is not None:
        return _ensemble_cache

    if os.path.exists(MODEL_PATH):
        try:
            _ensemble_cache = joblib.load(MODEL_PATH)
            print(f"[INFO] Loaded model: {_ensemble_cache['type']} R²={_ensemble_cache['r2']:.4f}")
            return _ensemble_cache
        except Exception as e:
            print(f"[WARN] Load failed: {e} — retraining")

    csv_path = find_csv()
    if not csv_path:
        raise HTTPException(
            503,
            f"Training CSV 'nm RGB.csv' not found in {BASE_DIR}. "
            "Place it there or use POST /upload-csv."
        )

    print(f"[INFO] Training on {csv_path}")
    df = pd.read_csv(csv_path)
    X_raw = df.drop(columns=["nm"])
    y = df["nm"].values
    
    # Feature engineering for richer model input
    X = engineer_features(X_raw)
    print(f"[INFO] Features: {list(X.columns)} ({X.shape[1]} total)")
    
    X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    # Build strong base models with StandardScaler pipelines
    kernel = (
        ConstantKernel(1e5, (1e2, 1e8))
        * RBF(np.ones(X.shape[1]), (1e-3, 1e3))
        + WhiteKernel(1, (1e-5, 1e3))
    )
    base = {
        "rf":  make_pipeline(StandardScaler(),
                   RandomForestRegressor(n_estimators=500, max_depth=20,
                                        min_samples_leaf=2, random_state=42)),
        "et":  make_pipeline(StandardScaler(),
                   ExtraTreesRegressor(n_estimators=500, max_depth=20,
                                      min_samples_leaf=2, random_state=42)),
        "gbr": make_pipeline(StandardScaler(),
                   GradientBoostingRegressor(n_estimators=500, learning_rate=0.05,
                                            max_depth=5, subsample=0.8, random_state=42)),
        "knn": make_pipeline(StandardScaler(),
                   KNeighborsRegressor(n_neighbors=3, weights='distance')),
        "svr": make_pipeline(StandardScaler(),
                   SVR(kernel='rbf', C=100, gamma='scale')),
        "gpr": make_pipeline(StandardScaler(),
                   GaussianProcessRegressor(kernel=kernel, normalize_y=True,
                                            n_restarts_optimizer=5, random_state=42)),
    }
    if XG_AVAILABLE:
        base["xgb"] = make_pipeline(StandardScaler(),
                         XGBRegressor(n_estimators=500, learning_rate=0.05,
                                     max_depth=5, subsample=0.8,
                                     colsample_bytree=0.8, random_state=42))

    # Train and evaluate each base model
    scores = {}
    for name, m in base.items():
        m.fit(X_tr, y_tr)
        s = r2_score(y_val, m.predict(X_val))
        scores[name] = s
        print(f"  {name} R²={s:.4f}")

    # ── Strategy 1: R²-weighted ensemble ──
    r2_arr = np.array([max(0, s) for s in scores.values()])
    weights = r2_arr / (r2_arr.sum() or 1)

    def w_pred(Xi):
        return sum(w * m.predict(Xi) for w, m in zip(weights, base.values()))

    w_r2 = r2_score(y_val, w_pred(X_val))
    print(f"  weighted R²={w_r2:.4f}")

    # ── Strategy 2: Stacking (only top performers) ──
    top_names = [n for n, s in scores.items() if s > 0.95]
    if len(top_names) < 3:
        top_names = sorted(scores, key=scores.get, reverse=True)[:4]
    stack = StackingRegressor([(n, base[n]) for n in top_names],
                               final_estimator=Ridge(alpha=1.0), cv=5, n_jobs=-1)
    stack.fit(X_tr, y_tr)
    s_r2 = r2_score(y_val, stack.predict(X_val))
    print(f"  stacking R²={s_r2:.4f}")

    # ── Strategy 3: Best single model ──
    best_single_name = max(scores, key=scores.get)
    b_r2 = scores[best_single_name]
    print(f"  best_single ({best_single_name}) R²={b_r2:.4f}")

    # Pick the best strategy
    r2s = {"stacking": s_r2, "weighted": w_r2, "best_single": b_r2}
    best_type = max(r2s, key=r2s.get)

    if best_type == "stacking":
        obj = {"type": "stacking", "model": stack, "r2": float(s_r2)}
    elif best_type == "weighted":
        obj = {"type": "weighted", "models": base, "weights": weights, "r2": float(w_r2)}
    else:
        obj = {"type": f"single_{best_single_name}", "model": base[best_single_name], "r2": float(b_r2)}

    joblib.dump(obj, MODEL_PATH)
    print(f"[INFO] ✅ Saved {obj['type']} R²={obj['r2']:.4f}")
    _ensemble_cache = obj
    return obj


def ml_predict(obj, X_raw):
    """Apply feature engineering, then predict."""
    X = engineer_features(X_raw)
    if obj["type"] == "stacking" or obj["type"].startswith("single_"):
        return obj["model"].predict(X)
    preds = np.zeros(len(X))
    for w, m in zip(obj["weights"], obj["models"].values()):
        preds += w * m.predict(X)
    return preds


def build_spectrum(wl, inten, x_min=300, x_max=700, step=1.0, sigma=20.0):
    wl = np.asarray(wl, dtype=float)
    inten = np.asarray(inten, dtype=float)
    x_grid = np.arange(x_min, x_max + step, step)
    
    if len(wl) == 0:
        return x_grid.tolist(), np.zeros_like(x_grid).tolist(), float("nan")

    if np.allclose(wl, wl[0]):
        peak_wl = float(wl[0])
        x_s = np.linspace(max(300, peak_wl - 5), min(700, peak_wl + 5), 200)
        y_s = np.exp(-0.5 * ((x_s - peak_wl) / 1.5) ** 2)
        y_s = y_s / np.max(y_s)
        return x_s.tolist(), y_s.tolist(), peak_wl

    wl_min, wl_max = wl.min(), wl.max()
    wl_range = max(1e-6, wl_max - wl_min)
    bins = int(np.clip(wl_range * 2.0, 80, 400))

    hist, bin_edges = np.histogram(wl, bins=bins, range=(wl_min - 0.1*wl_range, wl_max + 0.1*wl_range), weights=inten)
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])

    if hist.max() > 0:
        hist = hist.astype(float) / np.max(hist)
    else:
        hist = hist.astype(float)

    gaussian_sigma = max(1.0, bins / 150.0)
    y_s = ndi.gaussian_filter1d(hist, sigma=gaussian_sigma)
    x_s = bin_centers

    y_s = np.clip(y_s, 0.0, None)
    if y_s.max() > 0:
        y_s = y_s / y_s.max()

    peaks, props = signal.find_peaks(y_s, height=0.2, distance=3)
    if len(peaks) > 0:
        peak_idx = peaks[np.argmax(props["peak_heights"])]
        peak_wl = float(x_s[peak_idx])
    else:
        peak_idx = int(np.argmax(y_s))
        peak_wl = float(x_s[peak_idx])

    return x_s.tolist(), y_s.tolist(), peak_wl

def detect_dynamic_roi(frame, roi_size=50):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (9, 9), 0)
    _, _, _, maxLoc = cv2.minMaxLoc(gray)
    xc, yc = maxLoc
    x1, y1 = max(0, xc - roi_size//2), max(0, yc - roi_size//2)
    x2, y2 = min(frame.shape[1], xc + roi_size//2), min(frame.shape[0], yc + roi_size//2)
    roi = frame[y1:y2, x1:x2]
    return roi


# ── Endpoints ────────────────────────────────────────────────
@app.get("/health")
def health():
    csv_path = find_csv()
    csv_ready = csv_path is not None
    model_ready = os.path.exists(MODEL_PATH)
    if not csv_ready and not model_ready:
        return {
            "status": "needs_csv",
            "csv_ready": False,
            "model_ready": False,
            "message": f"Place 'nm RGB.csv' in {BASE_DIR} or POST to /upload-csv",
        }
    obj = get_ensemble()
    return {
        "status": "ok",
        "model_type": obj["type"],
        "r2": round(obj["r2"], 4),
        "csv_ready": csv_ready,
        "model_ready": True,
    }


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload nm RGB.csv to the project root to bootstrap training."""
    global _ensemble_cache
    dest = os.path.join(BASE_DIR, "nm RGB.csv")
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    _ensemble_cache = None
    if os.path.exists(MODEL_PATH):
        os.remove(MODEL_PATH)
    df = pd.read_csv(dest)
    return {"message": "CSV saved. Model will retrain on next /analyze call.",
            "rows": len(df), "columns": list(df.columns)}


@app.post("/analyze")
async def analyze(
    video: UploadFile = File(...),
    sample_name: str = Form("sample"),
    voltage: float = Form(0.0),
):
    obj = get_ensemble()

    suffix = os.path.splitext(video.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await video.read())
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(400, "Cannot open video file")

        wavelengths, intensities = [], []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Step 1: Crop black background region
            gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray_full, 15, 255, cv2.THRESH_BINARY)
            coords = cv2.findNonZero(thresh)
            if coords is None:
                continue
            bx, by, bw, bh = cv2.boundingRect(coords)
            cropped = frame[by:by+bh, bx:bx+bw]
            
            # Step 2: Remove UV region (mask out deep violet/blue noise)
            hsv = cv2.cvtColor(cropped, cv2.COLOR_BGR2HSV)
            # Mask extremely low-saturation dark noise (grey/black artifacts)
            gray_crop = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
            # Keep pixels that are bright enough to be real emission
            valid_mask = (gray_crop >= 15).astype(np.uint8) * 255
            
            # Step 3: Auto-select ROI (find brightest 50x50 region)
            blurred = cv2.GaussianBlur(gray_crop, (9, 9), 0)
            _, _, _, maxLoc = cv2.minMaxLoc(blurred, mask=valid_mask if cv2.countNonZero(valid_mask) > 0 else None)
            roi_size = 50
            xc, yc = maxLoc
            rx1 = max(0, xc - roi_size // 2)
            ry1 = max(0, yc - roi_size // 2)
            rx2 = min(cropped.shape[1], xc + roi_size // 2)
            ry2 = min(cropped.shape[0], yc + roi_size // 2)
            roi = cropped[ry1:ry2, rx1:rx2]
            
            if roi.size == 0:
                continue
            
            # Step 4: Divide ROI into 8x8 grid
            rh, rw, _ = roi.shape
            grid_size = 8
            ph, pw = max(1, rh // grid_size), max(1, rw // grid_size)
            
            cell_predictions = []
            cell_weights = []
            for i in range(grid_size):
                for j in range(grid_size):
                    y1, y2 = i * ph, (i + 1) * ph
                    x1, x2 = j * pw, (j + 1) * pw
                    cell = roi[y1:y2, x1:x2]
                    if cell.size == 0:
                        continue
                    
                    cell_gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
                    cell_intensity = float(np.mean(cell_gray))
                    
                    # Skip dark/empty cells
                    if cell_intensity < 10:
                        continue
                    
                    # Step 5: Predict each grid cell independently
                    rgb_mean = cv2.resize(cell, (1, 1))[0, 0][::-1].astype(float)
                    pred_nm = float(ml_predict(obj, rgb_mean.reshape(1, -1))[0])
                    
                    cell_predictions.append(pred_nm)
                    cell_weights.append(cell_intensity ** 2)
            
            if not cell_predictions:
                continue
            
            # Step 6: Weighted average of the PREDICTIONS (not the colors)
            cell_weights = np.array(cell_weights)
            cell_weights /= cell_weights.sum()
            frame_nm = float(np.average(cell_predictions, weights=cell_weights))
            frame_intensity = float(np.mean(cell_weights))
            
            wavelengths.append(frame_nm)
            intensities.append(frame_intensity)

        cap.release()
    finally:
        os.remove(tmp_path)

    if not wavelengths:
        raise HTTPException(422, "No valid frames found in video")

    wl = np.array(wavelengths)
    inten = np.array(intensities)
    x_grid, spec, peak_wl = build_spectrum(wl, inten)

    stats = {
        "avg_nm":  round(float(np.mean(wl)), 2),
        "peak_nm": round(float(peak_wl), 2),
        "min_nm":  round(float(wl.min()), 2),
        "max_nm":  round(float(wl.max()), 2),
        "frames":  int(len(wl)),
    }

    record = {
        "id":            str(uuid.uuid4()),
        "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sample_name":   sample_name,
        "voltage":       float(voltage),
        "avg_nm":        stats["avg_nm"],
        "peak_nm":       stats["peak_nm"],
        "min_nm":        stats["min_nm"],
        "max_nm":        stats["max_nm"],
        "ensemble_type": obj["type"],
        "ensemble_r2":   round(obj["r2"], 4),
        "spectrum_x":    json.dumps(x_grid.tolist()),
        "spectrum_y":    json.dumps(spec.tolist()),
    }
    pd.DataFrame([record]).to_sql("results", engine, if_exists="append", index=False)

    stride = max(1, len(wl) // 200)
    return {
        "stats": stats,
        "model": {"type": obj["type"], "r2": round(obj["r2"], 4)},
        "spectrum": {"x": x_grid.tolist(), "y": spec.tolist()},
        "frames": {
            "wavelength": wl[::stride].tolist(),
            "intensity":  (inten / inten.max() if inten.max() > 0 else inten)[::stride].tolist(),
        },
    }


@app.get("/results")
def get_results():
    df = pd.read_sql("SELECT * FROM results ORDER BY timestamp DESC", engine)
    records = []
    for _, row in df.iterrows():
        r = row.to_dict()
        try:
            r["spectrum_x"] = json.loads(r.get("spectrum_x") or "[]")
            r["spectrum_y"] = json.loads(r.get("spectrum_y") or "[]")
        except Exception:
            r["spectrum_x"] = []
            r["spectrum_y"] = []
        records.append(r)
    return records


@app.delete("/results/{result_id}")
def delete_result(result_id: str):
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM results WHERE id = :id"), {"id": result_id})
        conn.commit()
    return {"deleted": result_id}
