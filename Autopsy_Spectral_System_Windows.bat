@echo off
echo Starting Backend server...
cd backend
start cmd /k "python -m uvicorn main:app --port 8000 --reload"

echo Starting Frontend server...
cd ..\dashboard
start cmd /k "npm run dev"

echo =========================================
echo Both servers are starting! Opening Google Chrome automatically in a few seconds...
echo Close all new command windows to stop the servers later.
echo =========================================

timeout /t 3 /nobreak >nul
start chrome http://localhost:5173 || start http://localhost:5173

pause
