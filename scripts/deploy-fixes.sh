#!/bin/bash

# Deploy fixes for production issues
# 1. Cloud storage "baseUrl is empty" error
# 2. Authentication state detection

set -e

echo "🚀 Deploying Production Fixes"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "📋 Issues being fixed:"
echo "   1. Cloud storage error: 'baseUrl is empty'"
echo "   2. Authentication showing 'Free after sign-up' for logged-in users"
echo ""

# Build and deploy the updated code
echo "🔨 Building updated application..."
npm run build

echo ""
echo "📦 Deploying to Cloudflare Pages..."

# Check if this is a git repository and commit changes
if [ -d ".git" ]; then
    echo "📝 Committing authentication fixes..."
    git add app/thumbnails/page.tsx
    git commit -m "Fix authentication state detection in production

- Add proper authentication check via /api/auth/session
- Fix generate button showing 'Free after sign-up' for logged-in users
- Add loading state for authentication check
- Maintain development mode compatibility"

    echo "⬆️  Pushing to main branch..."
    git push origin main
    
    echo "✅ Code deployed via git push (Cloudflare Pages will auto-deploy)"
else
    echo "⚠️  Not a git repository - manual deployment needed"
fi

echo ""
echo "🔧 Environment Variable Fix Required:"
echo "   The cloud storage issue requires setting an environment variable"
echo "   in the Cloudflare Pages dashboard:"
echo ""
echo "   Variable: NEXT_PUBLIC_WORKER_API_URL"
echo "   Value:    https://creator-tool-hub.techfren.workers.dev"
echo ""
echo "📋 Manual Steps:"
echo "   1. Go to: https://dash.cloudflare.com/"
echo "   2. Navigate to: Pages > creator-tool-hub > Settings > Environment variables"
echo "   3. Add NEXT_PUBLIC_WORKER_API_URL = https://creator-tool-hub.techfren.workers.dev"
echo "   4. Save and redeploy"
echo ""

echo "🧪 Testing deployment..."
echo "   After the environment variable is set, test at:"
echo "   https://creatortoolhub.com/thumbnails"
echo ""
echo "   Expected results:"
echo "   ✅ No 'Cloud storage error' in console"
echo "   ✅ Generate button shows credit count for logged-in users"
echo "   ✅ Cloud storage operations work (templates, images)"
echo ""

echo "✅ Deployment script completed!"
echo ""
echo "⏳ Next steps:"
echo "   1. Wait for Cloudflare Pages auto-deployment to complete"
echo "   2. Set the environment variable as described above"
echo "   3. Test the fixes in production"
