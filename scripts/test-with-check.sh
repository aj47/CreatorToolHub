#!/bin/bash

# Test runner that checks if services are running first

set -e

echo "🧪 Full Stack Test Runner"
echo "========================"

# Function to check if a service is running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
        echo "✅ $name is running at $url"
        return 0
    else
        echo "❌ $name is not running at $url"
        return 1
    fi
}

# Check if services are running
echo "🔍 Checking services..."

FRONTEND_RUNNING=false
WORKER_RUNNING=false

if check_service "http://localhost:3000" "Frontend"; then
    FRONTEND_RUNNING=true
fi

if check_service "http://localhost:8787/api/user/profile" "Worker"; then
    WORKER_RUNNING=true
fi

echo ""

# If services aren't running, provide instructions
if [ "$FRONTEND_RUNNING" = false ] || [ "$WORKER_RUNNING" = false ]; then
    echo "⚠️  Some services are not running. Please start them first:"
    echo ""
    echo "Option 1 - Start both services:"
    echo "  npm run dev:local"
    echo ""
    echo "Option 2 - Start individually:"
    if [ "$FRONTEND_RUNNING" = false ]; then
        echo "  npm run dev                                    # Frontend"
    fi
    if [ "$WORKER_RUNNING" = false ]; then
        echo "  cd workers/generate && npm run dev -- --local --port 8787  # Worker"
    fi
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Run tests based on argument
case "${1:-full}" in
    "full")
        echo "🚀 Running full stack tests..."
        npm run test:full-stack
        ;;
    "perf")
        echo "⚡ Running performance tests..."
        npm run test:perf
        ;;
    *)
        echo "Usage: $0 [full|perf]"
        echo ""
        echo "  full  - API and integration tests (default)"
        echo "  perf  - Performance tests only"
        exit 1
        ;;
esac

echo ""
echo "✅ Testing completed!"
