#!/bin/bash

echo "🧬 Starting GEO Dataset Search Chatbot..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    npm install --workspace=backend
    npm install --workspace=frontend
    echo "✅ Dependencies installed"
    echo ""
fi

echo "🚀 Starting servers..."
echo "   - Backend: http://localhost:3001"
echo "   - Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
