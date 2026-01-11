#!/bin/bash

# Hymo WebUI Development Server

PORT=${1:-3000}

echo "🚀 Starting Hymo WebUI Development Server..."
echo "📍 Port: $PORT"
echo ""
echo "🌐 Open your browser to: http://localhost:$PORT"
echo ""

cd "$(dirname "$0")"
npm run dev -- --port $PORT
