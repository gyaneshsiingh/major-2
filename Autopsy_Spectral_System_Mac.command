#!/bin/bash
# Find the exact folder this script is in, regardless of where it was clicked
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Starting Backend server..."
cd "$DIR/backend" || exit
python3 -m uvicorn main:app --port 8000 --reload &
BACKEND_PID=$!

echo "Starting Frontend server..."
cd "$DIR/dashboard" || exit
npm run dev &
FRONTEND_PID=$!

echo "========================================="
echo "Servers are starting. Opening Google Chrome automatically in 3 seconds..."
echo "Close this window to stop the application later."
echo "========================================="

sleep 3
open -a "Google Chrome" http://localhost:5173 || open http://localhost:5173

cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM SIGHUP EXIT
wait $BACKEND_PID $FRONTEND_PID
