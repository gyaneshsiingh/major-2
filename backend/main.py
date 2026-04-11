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
    # Filter to visible range only (400-700nm) for better accuracy
    df = df[(df["nm"] >= 400) & (df["nm"] <= 700)]
    print(f"[INFO] Filtered to visible range: {len(df)} rows (400-700nm)")
    X = df.drop(columns=["nm"])
    y = df["nm"].values
    X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    kernel = (
        ConstantKernel(1e5, (1e2, 1e8))
        * RBF(np.ones(X.shape[1]), (1e-3, 1e3))
        + WhiteKernel(1, (1e-5, 1e3))
    )
    gpr = GaussianProcessRegressor(kernel=kernel, normalize_y=True,
                                   n_restarts_optimizer=5, random_state=42)
    base = {
        "rf":  RandomForestRegressor(n_estimators=200, random_state=42),
        "gbr": GradientBoostingRegressor(random_state=42),
        "gpr": gpr,
        "knn": KNeighborsRegressor(n_neighbors=5),
    }
    if XG_AVAILABLE:
        base["xgb"] = XGBRegressor(n_estimators=200, learning_rate=0.08, random_state=42)

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
    print(f"  ensemble (all {len(base)} models) R²={w_r2:.4f}")
    for name, wt in zip(base.keys(), weights):
        print(f"    {name}: weight={wt:.4f}")

    obj = {"type": "ensemble_all", "models": base, "weights": weights, "r2": float(w_r2)}

    joblib.dump(obj, MODEL_PATH)
    print(f"[INFO] ✅ Saved ensemble_all R²={obj['r2']:.4f}")
    _ensemble_cache = obj
    return obj


def ml_predict(obj, X):
    """Predict using ALL models weighted by R²."""
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

        frame_idx = 0
        frame_batch_rgb = []
        frame_batch_intensity = []
        wavelengths, intensities = [], []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            h, w, _ = frame.shape
            grid_size = 8
            patch_h, patch_w = h // grid_size, w // grid_size

            patch_rgbs = []
            patch_weights = []
            for i in range(grid_size):
                for j in range(grid_size):
                    y1, y2 = i * patch_h, (i + 1) * patch_h
                    x1, x2 = j * patch_w, (j + 1) * patch_w
                    patch = frame[y1:y2, x1:x2]
                    if patch.size == 0:
                        continue
                    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
                    intensity = np.mean(gray)
                    rgb_mean = cv2.resize(patch, (1, 1))[0, 0][::-1]
                    patch_rgbs.append(rgb_mean)
                    patch_weights.append(intensity ** 2)

            patch_weights = np.array(patch_weights)
            if patch_weights.sum() == 0:
                continue
            patch_weights /= patch_weights.sum()
            patch_rgbs = np.array(patch_rgbs)
            weighted_rgb = np.average(patch_rgbs, axis=0, weights=patch_weights)

            frame_batch_rgb.append(weighted_rgb)
            frame_batch_intensity.append(np.mean(patch_weights))

            # Aggregate every 26 frames (~1 sec)
            if frame_idx % 26 == 0:
                avg_rgb = np.mean(frame_batch_rgb, axis=0)
                avg_intensity = np.mean(frame_batch_intensity)
                batch_df = pd.DataFrame([avg_rgb], columns=["Red", "Green", "Blue"])
                pred_nm = float(ml_predict(obj, batch_df)[0])
                wavelengths.append(pred_nm)
                intensities.append(avg_intensity)
                frame_batch_rgb, frame_batch_intensity = [], []

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
