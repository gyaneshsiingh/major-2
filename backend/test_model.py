import joblib
import pandas as pd
import numpy as np
import sys
import os

try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(BASE_DIR, "..", "best_ensemble_model.joblib")
    obj = joblib.load(model_path)
    print(f"Loaded {obj['type']} with R²: {obj['r2']}")

    def ml_predict(obj, X):
        if obj["type"] == "stacking" or obj["type"].startswith("single_"):
            return obj["model"].predict(X)
        preds = np.zeros(len(X))
        for w, m in zip(obj["weights"], obj["models"].values()):
            preds += w * m.predict(X)
        return preds

    # Test pure colors
    test_colors = [
        [0, 0, 255],     # Pure Blue (should be ~431)
        [0, 255, 0],     # Pure Green
        [255, 0, 0],     # Pure Red
        [255, 255, 255], # White
        [0, 255, 255],   # Cyan
        [100, 0, 255],   # Light purple
        [50, 0, 100],    # Dark purple
        [0, 128, 128],   # Dark Cyan
        [0, 255, 213]    # 494nm reference
    ]
    
    df = pd.DataFrame(test_colors, columns=["Red", "Green", "Blue"])
    preds = ml_predict(obj, df)
    
    print("Predictions for hardcoded colors:")
    for color, pred in zip(test_colors, preds):
        print(f"  RGB {color} -> {pred:.2f} nm")

except Exception as e:
    print(f"Error: {e}")
