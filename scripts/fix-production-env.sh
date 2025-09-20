#!/bin/bash

# Script to fix production environment variables for Cloudflare Pages
# This fixes the cloud storage "baseUrl is empty" error

set -e

echo "🔧 Fixing Production Environment Variables"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: Wrangler CLI is not installed"
    echo "   Install with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudflare"
    echo "   Login with: wrangler login"
    exit 1
fi

echo ""
echo "📋 Current Issue:"
echo "   - Cloud storage error: 'baseUrl is empty'"
echo "   - Missing NEXT_PUBLIC_WORKER_API_URL in Cloudflare Pages"
echo ""

# Get the project name (assuming it's creator-tool-hub based on the codebase)
PROJECT_NAME="creator-tool-hub"
WORKER_URL="https://creator-tool-hub.techfren.workers.dev"

echo "🔍 Checking current Cloudflare Pages projects..."

# List pages projects to verify the project exists
if ! wrangler pages project list | grep -q "$PROJECT_NAME"; then
    echo "❌ Error: Cloudflare Pages project '$PROJECT_NAME' not found"
    echo "   Available projects:"
    wrangler pages project list
    echo ""
    echo "   Please update PROJECT_NAME in this script to match your actual project name"
    exit 1
fi

echo "✅ Found Cloudflare Pages project: $PROJECT_NAME"
echo ""

echo "🔧 Setting environment variables..."

# Set the missing environment variable
echo "Setting NEXT_PUBLIC_WORKER_API_URL=$WORKER_URL"

# Note: Cloudflare Pages environment variables are set via the dashboard or API
# The wrangler CLI doesn't have a direct command for Pages env vars yet
echo ""
echo "⚠️  MANUAL ACTION REQUIRED:"
echo "   Cloudflare Pages environment variables must be set via the dashboard."
echo ""
echo "📋 Steps to fix:"
echo "   1. Go to: https://dash.cloudflare.com/"
echo "   2. Navigate to: Pages > $PROJECT_NAME > Settings > Environment variables"
echo "   3. Add the following environment variable:"
echo ""
echo "      Variable name:  NEXT_PUBLIC_WORKER_API_URL"
echo "      Value:          $WORKER_URL"
echo "      Environment:    Production (and Preview if desired)"
echo ""
echo "   4. Click 'Save'"
echo "   5. Redeploy your site (Pages > $PROJECT_NAME > Deployments > Retry deployment)"
echo ""

# Check if the worker is accessible
echo "🧪 Testing worker accessibility..."
if curl -s --head "$WORKER_URL" | head -n 1 | grep -q "200\|404"; then
    echo "✅ Worker is accessible at: $WORKER_URL"
else
    echo "⚠️  Warning: Worker may not be accessible at: $WORKER_URL"
    echo "   This could cause issues even after setting the environment variable"
fi

echo ""
echo "📝 Additional Notes:"
echo "   - After setting the environment variable, the cloud storage should work"
echo "   - Users will be able to save templates and images to the cloud"
echo "   - The 'baseUrl is empty' error should be resolved"
echo ""
echo "🔗 Useful Links:"
echo "   - Cloudflare Dashboard: https://dash.cloudflare.com/"
echo "   - Pages Documentation: https://developers.cloudflare.com/pages/"
echo ""

echo "✅ Script completed. Please follow the manual steps above."
