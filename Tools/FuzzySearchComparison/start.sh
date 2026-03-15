#!/bin/bash
# Run from repo root (Bani-AI) or from Tools/FuzzySearchComparison
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: backend/main.py not found in $SCRIPT_DIR"
    exit 1
fi

echo "🎯 Starting Fuzzy Search Comparison Tool..."

echo "🚀 Starting backend server on port 8001..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
cd ..

sleep 2

echo "🌐 Opening frontend in browser..."
if command -v open &> /dev/null; then
    open frontend/index.html
elif command -v xdg-open &> /dev/null; then
    xdg-open frontend/index.html
elif command -v start &> /dev/null; then
    start frontend/index.html
else
    echo "Please open frontend/index.html in your browser"
fi

echo "✅ Fuzzy Search Comparison Tool is running!"
echo "📊 Frontend: file://$(pwd)/frontend/index.html"
echo "🔧 Backend API: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop the server"

trap "echo '🛑 Stopping server...'; kill $BACKEND_PID 2>/dev/null; exit" INT
wait $BACKEND_PID
