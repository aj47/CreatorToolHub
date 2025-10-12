#!/bin/bash

# Setup script to install git hooks for the repository
# This script copies the shared git hooks to the local .git/hooks directory

set -e

echo "🔧 Setting up git hooks..."
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if git-hooks directory exists
if [ ! -d "git-hooks" ]; then
    echo "❌ Error: git-hooks directory not found"
    exit 1
fi

# Copy hooks to .git/hooks
HOOKS_COPIED=0

for hook in git-hooks/*; do
    hook_name=$(basename "$hook")
    hook_dest=".git/hooks/$hook_name"
    
    if [ -f "$hook" ]; then
        cp "$hook" "$hook_dest"
        chmod +x "$hook_dest"
        echo "✅ Installed $hook_name"
        HOOKS_COPIED=$((HOOKS_COPIED + 1))
    fi
done

echo ""
if [ $HOOKS_COPIED -gt 0 ]; then
    echo "✅ Git hooks installed successfully!"
    echo ""
    echo "Installed hooks:"
    echo "  - pre-commit: Prevents committing secrets"
    echo ""
    echo "To bypass hooks (NOT RECOMMENDED):"
    echo "  git commit --no-verify"
else
    echo "⚠️  No hooks found to install"
    exit 1
fi

