#!/bin/bash

echo "🛑 Stopping all Bani AI services..."
echo "=================================="

# Kill uvicorn backend processes
echo "🔧 Stopping backend servers..."
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "python.*main.py" 2>/dev/null || true

# Kill npm/node frontend processes
echo "🌐 Stopping frontend servers..."
pkill -f "npm start" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true

# Kill any processes on specific ports
echo "🔌 Freeing up ports..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Kill any remaining node processes (but not Cursor editor processes)
echo "🧹 Cleaning up Node.js processes..."
pkill -f "node.*start" 2>/dev/null || true

echo ""
echo "✅ All Bani AI services stopped!"
echo "📝 Note: Cursor editor processes are left running" 