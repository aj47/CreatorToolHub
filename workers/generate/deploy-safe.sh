#!/bin/bash

# Safe deployment script that preserves secrets and environment variables
# This script ensures that secrets are not lost during deployment

set -e  # Exit on any error

echo "🔒 Safe Cloudflare Worker Deployment"
echo "===================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if user is authenticated
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Please run:"
    echo "   wrangler auth login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"

# Function to check if a secret exists
check_secret() {
    local secret_name=$1
    echo "🔍 Checking if secret '$secret_name' exists..."
    
    # Try to list secrets and check if our secret is there
    if wrangler secret list 2>/dev/null | grep -q "$secret_name"; then
        echo "✅ Secret '$secret_name' exists"
        return 0
    else
        echo "⚠️  Secret '$secret_name' not found"
        return 1
    fi
}

# Function to set a secret if it doesn't exist
ensure_secret() {
    local secret_name=$1
    local env_var_name=$2
    
    if ! check_secret "$secret_name"; then
        if [ -n "${!env_var_name}" ]; then
            echo "🔑 Setting secret '$secret_name' from environment variable '$env_var_name'..."
            echo "${!env_var_name}" | wrangler secret put "$secret_name"
            echo "✅ Secret '$secret_name' set successfully"
        else
            echo "⚠️  Environment variable '$env_var_name' not set"
            echo "   You can set it manually later with:"
            echo "   wrangler secret put $secret_name"
        fi
    fi
}

# Function to backup current secrets (list them)
backup_secrets() {
    echo "📋 Current secrets in worker:"
    wrangler secret list 2>/dev/null || echo "   No secrets found or unable to list"
    echo ""
}

# Function to deploy worker
deploy_worker() {
    echo "🚀 Deploying worker..."
    wrangler deploy
    echo "✅ Worker deployed successfully"
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."
    
    # Check if secrets still exist after deployment
    echo "Checking secrets after deployment:"
    backup_secrets
    
    # Test the worker endpoint
    echo "Testing worker endpoint..."
    local worker_url="https://creator-tool-hub.techfren.workers.dev"
    
    if curl -s -f "$worker_url" > /dev/null; then
        echo "✅ Worker is responding"
    else
        echo "⚠️  Worker may not be responding correctly"
    fi
}

# Main deployment process
main() {
    echo "Starting safe deployment process..."
    echo ""
    
    # Step 1: Backup current secrets
    backup_secrets
    
    # Step 2: Ensure critical secrets exist
    echo "🔑 Ensuring critical secrets are set..."
    ensure_secret "GEMINI_API_KEY" "GEMINI_API_KEY"
    ensure_secret "AUTUMN_SECRET_KEY" "AUTUMN_SECRET_KEY"
    ensure_secret "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_ID"
    ensure_secret "GOOGLE_CLIENT_SECRET" "GOOGLE_CLIENT_SECRET"
    ensure_secret "NEXTAUTH_SECRET" "NEXTAUTH_SECRET"
    echo ""
    
    # Step 3: Deploy the worker
    deploy_worker
    echo ""
    
    # Step 4: Verify deployment
    verify_deployment
    echo ""
    
    echo "🎉 Safe deployment completed!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Test your API endpoints to ensure they work correctly"
    echo "2. Check worker logs with: wrangler tail"
    echo "3. If secrets are missing, set them with:"
    echo "   wrangler secret put GEMINI_API_KEY"
    echo "   wrangler secret put AUTUMN_SECRET_KEY"
    echo "   wrangler secret put GOOGLE_CLIENT_ID"
    echo "   wrangler secret put GOOGLE_CLIENT_SECRET"
    echo "   wrangler secret put NEXTAUTH_SECRET"
    echo ""
    echo "🔗 Worker URL: https://creator-tool-hub.techfren.workers.dev"
    echo "🔗 Production API: https://creatortoolhub.com/api/generate"
}

# Run the main function
main
