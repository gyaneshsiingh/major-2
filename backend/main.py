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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, StackingRegressor, ExtraTreesRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
from sklearn.neighbors import KNeighborsRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score
from sklearn.preprocessing import StandardScaler
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
    X = df.drop(columns=["nm"])
    y = df["nm"].values
    X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    kernel = (
        ConstantKernel(1.0, (1e-3, 1e3))
        * RBF(np.ones(X.shape[1]), (1e-2, 1e2))
        + WhiteKernel(0.1, (1e-5, 1e1))
    )
    gpr = GaussianProcessRegressor(kernel=kernel, normalize_y=True,
                                   n_restarts_optimizer=5, random_state=42)
    base = {
        "rf":  make_pipeline(StandardScaler(), RandomForestRegressor(n_estimators=300, max_depth=15, random_state=42)),
        "et":  make_pipeline(StandardScaler(), ExtraTreesRegressor(n_estimators=300, max_depth=15, random_state=42)),
        "gbr": make_pipeline(StandardScaler(), GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=5, random_state=42)),
        "knn": make_pipeline(StandardScaler(), KNeighborsRegressor(n_neighbors=4, weights='distance')),
        "gpr": make_pipeline(StandardScaler(), gpr),
    }
    if XG_AVAILABLE:
        base["xgb"] = make_pipeline(StandardScaler(), XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=5, subsample=0.8, random_state=42))

    scores = {}
    for name, m in base.items():
        m.fit(X_tr, y_tr)
        scores[name] = r2_score(y_val, m.predict(X_val))
        print(f"  {name} R²={scores[name]:.4f}")

    r2_arr = np.array([max(0, s) for s in scores.values()])
    weights = r2_arr / (r2_arr.sum() or 1)

    def w_pred(Xi):
        return sum(w * m.predict(Xi) for w, m in zip(weights, base.values()))

    w_r2 = r2_score(y_val, w_pred(X_val))
    
    # Filter base models for Stacking to only those with highly competitive performance
    best_names = [n for n, s in scores.items() if s > 0.95]
    if len(best_names) < 2:
        best_names = list(scores.keys())
        
    stack = StackingRegressor([(n, base[n]) for n in best_names],
                               final_estimator=Ridge(), n_jobs=-1)
    stack.fit(X_tr, y_tr)
    s_r2 = r2_score(y_val, stack.predict(X_val))

    best_single_name = max(scores, key=scores.get)
    b_r2 = scores[best_single_name]

    r2s = {"stacking": s_r2, "weighted": w_r2, "best_single": b_r2}
    best_type = max(r2s, key=r2s.get)

    if best_type == "stacking":
        obj = {"type": "stacking", "model": stack, "r2": float(s_r2)}
    elif best_type == "weighted":
        obj = {"type": "weighted", "models": base, "weights": weights, "r2": float(w_r2)}
    else:
        obj = {"type": f"single_{best_single_name}", "model": base[best_single_name], "r2": float(b_r2)}

    joblib.dump(obj, MODEL_PATH)
    print(f"[INFO] Saved {obj['type']} R²={obj['r2']:.4f}")
    _ensemble_cache = obj
    return obj


def ml_predict(obj, X):
    if obj["type"] == "stacking" or obj["type"].startswith("single_"):
        return obj["model"].predict(X)
    preds = np.zeros(len(X))
    for w, m in zip(obj["weights"], obj["models"].values()):
        preds += w * m.predict(X)
    return preds


def build_spectrum(wl, inten, x_min=300, x_max=700, step=1.0, sigma=20.0):
    wl = np.asarray(wl, float)
    inten = np.asarray(inten, float)
    x_grid = np.arange(x_min, x_max + step, step)
    if len(wl) == 0:
        return x_grid, np.zeros_like(x_grid), float("nan")
    w = inten / inten.max() if inten.max() > 0 else inten
    gauss = np.exp(-0.5 * ((x_grid[None, :] - wl[:, None]) / sigma) ** 2)
    spec = (w[:, None] * gauss).sum(axis=0)
    if spec.max() > 0:
        spec /= spec.max()
    return x_grid, spec, float(x_grid[np.argmax(spec)])


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
                
            # 1. Crop black background border
            gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray_full, 15, 255, cv2.THRESH_BINARY)
            coords = cv2.findNonZero(thresh)
            
            if coords is None:
                continue  # Skip entirely black frames
                
            x, y, w_bbox, h_bbox = cv2.boundingRect(coords)
            cropped_frame = frame[y:y+h_bbox, x:x+w_bbox]
            gray_crop = gray_full[y:y+h_bbox, x:x+w_bbox]
            
            # 2. Mask out UV / Violet / Blue region aggressively
            hsv = cv2.cvtColor(cropped_frame, cv2.COLOR_BGR2HSV)
            # OpenCV Hue: 85 (Cyan) to 165 (Deep Purple). We drop Sat/Val to 0 to catch dark blue noise!
            lower_violet = np.array([85, 0, 0])
            upper_violet = np.array([165, 255, 255])
            v_mask = cv2.inRange(hsv, lower_violet, upper_violet)
            
            # Valid pixels are NOT blue/violet, and NOT extremely dark
            valid_mask = cv2.bitwise_not(v_mask)
            valid_mask[gray_crop < 20] = 0
            
            h_crop, w_crop = cropped_frame.shape[:2]
            gs = 8
            ph, pw = max(1, h_crop // gs), max(1, w_crop // gs)
            
            valid_rgbs = []
            valid_intensities = []
            
            for i in range(gs):
                for j in range(gs):
                    y_start, y_end = i*ph, (i+1)*ph
                    x_start, x_end = j*pw, (j+1)*pw
                    
                    patch = cropped_frame[y_start:y_end, x_start:x_end]
                    p_mask = valid_mask[y_start:y_end, x_start:x_end]
                    p_gray = gray_crop[y_start:y_end, x_start:x_end]
                    
                    if patch.size == 0 or cv2.countNonZero(p_mask) == 0:
                        continue
                        
                    # Calculate mean color strictly over the non-UV, non-black pixels
                    mean_color = cv2.mean(patch, mask=p_mask)[:3]
                    # BGR to RGB
                    rgb = [mean_color[2], mean_color[1], mean_color[0]]
                    
                    # Ignore overly dark or washed out artifacts
                    if sum(rgb) < 15 or sum(rgb) > 750:
                        continue
                        
                    # Absolute Fallback: Mathematically guarantee no Blue/UV or grey noise slip-through.
                    # Grey (80,80,80) and Cyan-Grey (40,80,80) incorrectly map to ~431nm in the ML model.
                    # By ensuring Blue is strictly LESS than the dominant Red or Green signal,
                    # we perfectly isolate bright, bloomy ROIs while destroying true greys/cyans.
                    if rgb[2] >= max(rgb[0], rgb[1]):
                        continue
                        
                    valid_rgbs.append(rgb)
                    
                    # Store distinct intensity for this specific patch
                    mean_gray = cv2.mean(p_gray, mask=p_mask)[0]
                    valid_intensities.append(mean_gray)
                    
            if not valid_rgbs:
                continue
                
            # 3. Batch predict all individual grid patches
            batch_df = pd.DataFrame(valid_rgbs, columns=["Red", "Green", "Blue"])
            predictions = ml_predict(obj, batch_df)
            # 4. Do NOT average the frame internally! By loading all patches dynamically,
            # this explicitly allows bimodal logic and multiple spatial peaks in the spectrum.
            wavelengths.extend(predictions.tolist())
            intensities.extend(valid_intensities)

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
