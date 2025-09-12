#!/bin/bash

# Cloudflare Deployment Script for Creator Tool Hub
# This script automates the setup and deployment of Cloudflare resources

set -e  # Exit on any error

echo "🚀 Creator Tool Hub - Cloudflare Deployment Script"
echo "=================================================="

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

# Navigate to workers directory
cd workers/generate

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    echo "❌ wrangler.toml not found in workers/generate directory"
    exit 1
fi

echo "✅ Found wrangler.toml configuration"

# Function to create D1 database
create_database() {
    echo ""
    echo "📊 Setting up D1 Database..."
    
    # Check if database already exists
    if wrangler d1 list | grep -q "creator-tool-hub-db"; then
        echo "✅ Database 'creator-tool-hub-db' already exists"
        DB_ID=$(wrangler d1 list | grep "creator-tool-hub-db" | awk '{print $2}')
    else
        echo "Creating new D1 database..."
        DB_OUTPUT=$(wrangler d1 create creator-tool-hub-db)
        DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | cut -d'"' -f4)
        echo "✅ Database created with ID: $DB_ID"
        
        # Update wrangler.toml with the database ID
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
        else
            # Linux
            sed -i "s/database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
        fi
        echo "✅ Updated wrangler.toml with database ID"
    fi
}

# Function to create R2 bucket
create_bucket() {
    echo ""
    echo "🪣 Setting up R2 Bucket..."
    
    # Check if bucket already exists
    if wrangler r2 bucket list | grep -q "creator-tool-hub-user-data"; then
        echo "✅ Bucket 'creator-tool-hub-user-data' already exists"
    else
        echo "Creating new R2 bucket..."
        wrangler r2 bucket create creator-tool-hub-user-data
        echo "✅ R2 bucket created"
    fi
}

# Function to run migrations
run_migrations() {
    echo ""
    echo "🔄 Running Database Migrations..."
    
    # Check if migrations directory exists
    if [ ! -d "migrations" ]; then
        echo "❌ Migrations directory not found"
        exit 1
    fi
    
    # Apply migrations to production
    echo "Applying migrations to production database..."
    wrangler d1 migrations apply creator-tool-hub-db --remote
    echo "✅ Production migrations applied"
    
    # Apply migrations to local (for development)
    echo "Applying migrations to local database..."
    wrangler d1 migrations apply creator-tool-hub-db --local
    echo "✅ Local migrations applied"
}

# Function to install dependencies
install_dependencies() {
    echo ""
    echo "📦 Installing Dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        echo "✅ Dependencies installed"
    else
        echo "⚠️  No package.json found, skipping dependency installation"
    fi
}

# Function to deploy worker
deploy_worker() {
    echo ""
    echo "🚀 Deploying Worker..."
    
    wrangler deploy
    echo "✅ Worker deployed successfully"
}

# Function to setup secrets
setup_secrets() {
    echo ""
    echo "🔐 Setting up Secrets..."
    
    # Check if GEMINI_API_KEY is set
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "⚠️  GEMINI_API_KEY environment variable not set"
        echo "   You can set it manually later with:"
        echo "   wrangler secret put GEMINI_API_KEY"
    else
        echo "Setting GEMINI_API_KEY..."
        echo "$GEMINI_API_KEY" | wrangler secret put GEMINI_API_KEY
        echo "✅ GEMINI_API_KEY set"
    fi
    
    # Check if AUTUMN_SECRET_KEY is set (optional)
    if [ -z "$AUTUMN_SECRET_KEY" ]; then
        echo "⚠️  AUTUMN_SECRET_KEY not set (optional for billing)"
        echo "   You can set it manually later with:"
        echo "   wrangler secret put AUTUMN_SECRET_KEY"
    else
        echo "Setting AUTUMN_SECRET_KEY..."
        echo "$AUTUMN_SECRET_KEY" | wrangler secret put AUTUMN_SECRET_KEY
        echo "✅ AUTUMN_SECRET_KEY set"
    fi
}

# Function to test deployment
test_deployment() {
    echo ""
    echo "🧪 Testing Deployment..."
    
    # Get worker URL
    WORKER_URL=$(wrangler whoami | grep "Account ID" | awk '{print $3}')
    if [ -n "$WORKER_URL" ]; then
        echo "Worker should be available at: https://creator-tool-hub-worker.your-subdomain.workers.dev"
        echo "You can test it with:"
        echo "  curl https://creator-tool-hub-worker.your-subdomain.workers.dev/api/user/profile"
    fi
    
    echo ""
    echo "To run comprehensive tests, use:"
    echo "  cd ../../"
    echo "  node scripts/test-cloud-storage.js https://your-worker-url.workers.dev"
}

# Main deployment flow
main() {
    echo ""
    echo "Starting deployment process..."
    
    # Parse command line arguments
    SKIP_DB=false
    SKIP_R2=false
    SKIP_DEPLOY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --skip-r2)
                SKIP_R2=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-db      Skip database creation and migrations"
                echo "  --skip-r2      Skip R2 bucket creation"
                echo "  --skip-deploy  Skip worker deployment"
                echo "  --help         Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    if [ "$SKIP_DB" = false ]; then
        create_database
        run_migrations
    else
        echo "⏭️  Skipping database setup"
    fi
    
    if [ "$SKIP_R2" = false ]; then
        create_bucket
    else
        echo "⏭️  Skipping R2 bucket setup"
    fi
    
    install_dependencies
    setup_secrets
    
    if [ "$SKIP_DEPLOY" = false ]; then
        deploy_worker
        test_deployment
    else
        echo "⏭️  Skipping worker deployment"
    fi
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update your frontend environment variables if needed"
    echo "2. Test the deployment with the provided test script"
    echo "3. Configure your domain routing in Cloudflare dashboard"
    echo "4. Monitor logs with: wrangler tail"
    echo ""
    echo "For troubleshooting, see: docs/CLOUDFLARE_STORAGE_SETUP.md"
}

# Run main function
main "$@"
