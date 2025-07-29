#!/bin/bash

echo "🎯 Starting Fuzzy Search Comparison Tool..."

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Please run this script from the Tools/FuzzySearchComparison directory"
    exit 1
fi

# Start the backend server
echo "🚀 Starting backend server on port 8001..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
cd ..

# Wait a moment for the server to start
sleep 2

# Open the frontend in the default browser
echo "🌐 Opening frontend in browser..."
if command -v open &> /dev/null; then
    # macOS
    open frontend/index.html
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open frontend/index.html
elif command -v start &> /dev/null; then
    # Windows
    start frontend/index.html
else
    echo "Please open frontend/index.html in your browser"
fi

echo "✅ Fuzzy Search Comparison Tool is running!"
echo "📊 Frontend: file://$(pwd)/frontend/index.html"
echo "🔧 Backend API: http://localhost:8001"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for Ctrl+C
trap "echo '🛑 Stopping server...'; kill $BACKEND_PID; exit" INT
wait $BACKEND_PID