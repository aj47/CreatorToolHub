#!/bin/bash

# Local Full Stack Development Script
# Runs both frontend and backend locally with proper integration

set -e

echo "🚀 Starting Local Full Stack Development Environment"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🧹 Cleaning up background processes..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo ""
echo "📋 Setting up local development environment..."

# 1. Setup local D1 database
echo "🗄️  Setting up local D1 database..."
cd workers/generate
if [ ! -d ".wrangler/state/v3/d1" ]; then
    echo "   Creating local database..."
    npm run db:migrate:local
else
    echo "   Local database already exists"
fi

# 2. Start Cloudflare Worker locally
echo ""
echo "⚡ Starting Cloudflare Worker (local mode)..."
npm run dev -- --local --port 8787 &
WORKER_PID=$!

# Wait for worker to start
echo "   Waiting for worker to start..."
sleep 5

# Test worker connectivity
echo "   Testing worker connectivity..."
if curl -s http://localhost:8787/api/user/profile > /dev/null; then
    echo "   ✅ Worker is running at http://localhost:8787"
else
    echo "   ⚠️  Worker may still be starting up..."
fi

cd ../..

# 3. Update local environment for frontend
echo ""
echo "🔧 Configuring frontend environment..."
if [ ! -f ".env.local" ]; then
    echo "   Creating .env.local..."
    cat > .env.local << EOF
# Local development configuration
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787
NODE_ENV=development
EOF
    echo "   ⚠️  Please update GEMINI_API_KEY in .env.local"
else
    # Update existing .env.local to point to local worker
    if grep -q "NEXT_PUBLIC_WORKER_API_URL" .env.local; then
        sed -i.bak 's|NEXT_PUBLIC_WORKER_API_URL=.*|NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787|' .env.local
    else
        echo "NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787" >> .env.local
    fi
    echo "   ✅ Updated .env.local to use local worker"
fi

# 4. Start frontend
echo ""
echo "🌐 Starting Next.js frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📍 Services:"
echo "   Frontend:  http://localhost:3000"
echo "   Worker:    http://localhost:8787"
echo "   Thumbnails: http://localhost:3000/thumbnails"
echo ""
echo "🧪 Testing Commands (run in another terminal):"
echo "   npm run test:full-stack    # Test all API endpoints"
echo "   npm run test:e2e           # Browser tests"
echo "   npm run test:perf          # Performance tests only"
echo ""
echo "🔍 Debug:"
echo "   • Debug panel will show local worker status"
echo "   • All data stored in local D1 database"
echo "   • Check browser console for detailed logs"
echo ""
echo "⏹️  Press Ctrl+C to stop all services"
echo ""

# Wait for user to stop
wait
