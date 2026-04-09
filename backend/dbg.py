import cv2
import numpy as np
import pandas as pd
from main import get_ensemble, ml_predict

df = pd.read_csv("nm RGB.csv")
print("Top blue records:")
print(df[df['Blue'] > 200].head(10))

# Colors to test
colors = [
    ("Pure Blue", [0, 0, 255]),
    ("Bright Blue", [100, 100, 255]),
    ("White-Blue", [200, 200, 255]),
    ("Near White", [240, 240, 245]),
    ("Cyan-ish", [0, 255, 255]),
    ("Magenta-ish", [255, 0, 255])
]

print("\n--- HSV Values for Colors ---")
for name, rgb in colors:
    # Convert RGB to BGR for OpenCV
    bgr = np.uint8([[[rgb[2], rgb[1], rgb[0]]]])
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0][0]
    print(f"{name} (RGB {rgb}) -> HSV {hsv}")

print("\n--- ML Predictions for Colors ---")
obj = get_ensemble()
for name, rgb in colors:
    df_in = pd.DataFrame([rgb], columns=["Red", "Green", "Blue"])
    pred = ml_predict(obj, df_in)[0]
    print(f"{name} (RGB {rgb}) predicts: {pred:.1f} nm")

