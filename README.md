# 🔬 Auto Spectral Analysis System

An AI-powered spectral analysis platform that automates photoluminescence (PL) spectrum extraction, wavelength prediction, and visualization from uploaded videos or images.

The system eliminates manual analysis by using computer vision and machine learning to detect spectral regions, extract RGB values, predict wavelengths, and generate interactive dashboards.

---

## 🚀 Features

- 📹 Upload PL experiment videos
- 🖼️ Extract frames automatically
- 🎯 Detect spectral region using computer vision
- 🌈 Extract RGB values from detected spectrum
- 🤖 Predict wavelength using Machine Learning
- 📊 Interactive dashboard for visualization
- 💾 Store experiment history in SQLite
- 🐳 Docker support
- ☁️ Deployable using Render

---

## 🏗️ Project Structure

```
.
├── backend/
│   ├── app.py
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── ...
│
├── dashboard/
│   ├── src/
│   ├── public/
│   └── ...
│
├── best_ensemble_model.joblib
├── nm RGB.csv
├── pl_results.db
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── Autopsy_Spectral_System_Windows.bat
├── Autopsy_Spectral_System_Mac.command
├── Autopsy_Spectral_System_Linux.sh
└── README.md
```

---

# Tech Stack

### Frontend

- React
- JavaScript
- HTML5
- CSS3

### Backend

- Flask
- Python

### Machine Learning

- Scikit-learn
- NumPy
- Pandas
- Joblib

### Computer Vision

- OpenCV
- Pillow

### Database

- SQLite

### Deployment

- Docker
- Docker Compose
- Render

---

# Machine Learning Pipeline

1. Upload PL experiment video.
2. Extract video frames.
3. Detect spectral region.
4. Calculate RGB values.
5. Feed RGB values into the trained ensemble model.
6. Predict wavelength (nm).
7. Store prediction results.
8. Display interactive graphs and experiment history.

---

# Installation

## Clone Repository

```bash
git clone https://github.com/gyaneshsiingh/major-2.git

cd major-2
```

---

## Backend

```bash
cd backend

pip install -r requirements.txt

python app.py
```

---

## Dashboard

```bash
cd dashboard

npm install

npm start
```

---

# Docker

Build the project

```bash
docker-compose up --build
```

---

# Model

The project uses a trained Ensemble Machine Learning model stored as:

```
best_ensemble_model.joblib
```

The model predicts the wavelength based on extracted RGB values.

---

# Dataset

```
nm RGB.csv
```

Contains:

- Wavelength (nm)
- Red
- Green
- Blue

Used for training the ML model.

---

# Database

SQLite database:

```
pl_results.db
```

Stores:

- Uploaded experiments
- Predicted wavelengths
- RGB values
- Timestamps

---

# Scripts

### Windows

```bash
Autopsy_Spectral_System_Windows.bat
```

### macOS

```bash
Autopsy_Spectral_System_Mac.command
```

### Linux

```bash
Autopsy_Spectral_System_Linux.sh
```

---

# Docker Deployment

```bash
docker build -t auto-spectral-system .

docker run -p 5000:5000 auto-spectral-system
```

---

# Render Deployment

The repository includes:

```
render.yaml
```

for one-click deployment on Render.

---

# Future Improvements

- Deep Learning based spectrum detection
- Multi-spectrum support
- Real-time webcam analysis
- User authentication
- Cloud storage integration
- Experiment comparison dashboard
- Export results as PDF/CSV

---

# Screenshots

Add screenshots here.

```
/screenshots
```

Example:

- Dashboard
- Upload Page
- Spectrum Detection
- Prediction Result
- Graphs

---

# Author

**Gyanesh Singh**

GitHub: https://github.com/gyaneshsiingh

---

# License

This project is developed for academic and research purposes.
