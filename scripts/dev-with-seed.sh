#!/bin/bash

# Enhanced local development script with database seeding
# This script sets up the local environment and populates test data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Cleanup function
cleanup() {
    print_status "\n🛑 Shutting down services..."
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_status ""
print_status "🚀 Creator Tool Hub - Local Development with Test Data"
print_status "======================================================"

# 1. Setup local D1 database
print_status "🗄️  Setting up local D1 database..."
cd workers/generate

if [ ! -d ".wrangler/state/v3/d1" ]; then
    print_status "   Creating local database..."
    npm run db:migrate:local
else
    print_status "   Local database already exists"
fi

# 2. Seed the database with test data
print_status "🌱 Seeding database with test data..."
if [ -f "../../scripts/seed-local-db.sql" ]; then
    print_status "   Populating with sample generations and user data..."
    npx wrangler d1 execute creator-tool-hub-db --local --file ../../scripts/seed-local-db.sql
    print_success "   ✅ Database seeded successfully!"
else
    print_warning "   ⚠️  Seed file not found, skipping seeding"
fi

# 3. Start Cloudflare Worker locally
print_status ""
print_status "⚡ Starting Cloudflare Worker (local mode)..."
npm run dev -- --local --port 8787 &
WORKER_PID=$!

# Wait for worker to start
print_status "   Waiting for worker to start..."
sleep 5

# Test worker connectivity
print_status "   Testing worker connectivity..."
if curl -s http://localhost:8787/api/user/profile > /dev/null; then
    print_success "   ✅ Worker is running at http://localhost:8787"
else
    print_warning "   ⚠️  Worker may still be starting up..."
fi

cd ../..

# 4. Update local environment for frontend
print_status ""
print_status "🔧 Configuring frontend environment..."
if [ ! -f ".env.local" ]; then
    print_status "   Creating .env.local..."
    cat > .env.local << EOF
# Local development configuration
GEMINI_API_KEY=AQ.Ab8RN6KXt7SDuLP5NEdawKNYYUhrKdrK7toGnHa8UIdmjYYaEw
NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787
NODE_ENV=development
EOF
    print_success "   ✅ Created .env.local with test API key"
else
    # Update existing .env.local to point to local worker
    if grep -q "NEXT_PUBLIC_WORKER_API_URL" .env.local; then
        sed -i.bak 's|NEXT_PUBLIC_WORKER_API_URL=.*|NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787|' .env.local
    else
        echo "NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787" >> .env.local
    fi
    print_success "   ✅ Updated .env.local to use local worker"
fi

# 5. Start frontend
print_status ""
print_status "🌐 Starting Next.js frontend..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
print_status "   Waiting for frontend to start..."
sleep 10

print_status ""
print_success "🎉 Local development environment is ready with test data!"
print_status ""
print_status "📍 Services:"
print_status "   Frontend:  http://localhost:3000"
print_status "   Worker:    http://localhost:8787"
print_status "   Dashboard: http://localhost:3000/dashboard"
print_status ""
print_status "🎯 Test Data Available:"
print_status "   • 8 sample thumbnail generations"
print_status "   • 3 sample templates"
print_status "   • Mock user: dev@example.com"
print_status "   • 999 mock credits"
print_status ""
print_status "🧪 Testing Commands (run in another terminal):"
print_status "   npm run test:full-stack    # Test all API endpoints"
print_status "   npm run test:perf          # Performance tests only"
print_status ""
print_status "🔍 Debug:"
print_status "   • Check browser console for detailed logs"
print_status "   • All data stored in local D1 database"
print_status "   • Mock images served via placeholder service"
print_status ""
print_status "⏹️  Press Ctrl+C to stop all services"
print_status ""

# Wait for user to stop
wait
