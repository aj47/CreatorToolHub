#!/bin/bash

# Verification script for key rotation
# This script verifies that:
# 1. Old keys are not present in the codebase
# 2. New keys are properly set in local files
# 3. Production secrets are set
# 4. Worker is functioning

set -e

echo "🔍 Key Rotation Verification"
echo "============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Old keys to check for
OLD_GEMINI="***REMOVED***"
OLD_AUTUMN="***REMOVED***"

# New keys to verify
NEW_GEMINI="AIzaSyB-Nx6r7RvC1i1pqRXr8Wub0AE2RSeCnPM"
NEW_AUTUMN="am_sk_live_LsfzJP38oGlliG51u3yLCAXC0WtJyQH8a89kCqAS5n"

echo "1. Checking for old keys in codebase..."
if grep -r "$OLD_GEMINI" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="KEY_ROTATION_SUMMARY.md" --exclude="verify-key-rotation.sh" 2>/dev/null; then
    echo -e "${RED}❌ FAIL: Old Gemini key found in codebase!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ PASS: Old Gemini key not found${NC}"
fi

if grep -r "$OLD_AUTUMN" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="KEY_ROTATION_SUMMARY.md" --exclude="verify-key-rotation.sh" 2>/dev/null; then
    echo -e "${RED}❌ FAIL: Old Autumn key found in codebase!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ PASS: Old Autumn key not found${NC}"
fi

echo ""
echo "2. Verifying new keys in local files..."

# Check .env.local
if grep -q "$NEW_GEMINI" .env.local 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: New Gemini key in .env.local${NC}"
else
    echo -e "${RED}❌ FAIL: New Gemini key not in .env.local${NC}"
fi

if grep -q "$NEW_AUTUMN" .env.local 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: New Autumn key in .env.local${NC}"
else
    echo -e "${RED}❌ FAIL: New Autumn key not in .env.local${NC}"
fi

# Check workers/generate/.dev.vars
if grep -q "$NEW_GEMINI" workers/generate/.dev.vars 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: New Gemini key in workers/generate/.dev.vars${NC}"
else
    echo -e "${RED}❌ FAIL: New Gemini key not in workers/generate/.dev.vars${NC}"
fi

if grep -q "$NEW_AUTUMN" workers/generate/.dev.vars 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: New Autumn key in workers/generate/.dev.vars${NC}"
else
    echo -e "${RED}❌ FAIL: New Autumn key not in workers/generate/.dev.vars${NC}"
fi

echo ""
echo "3. Checking .gitignore configuration..."

if [ -f "workers/generate/.gitignore" ]; then
    echo -e "${GREEN}✅ PASS: workers/generate/.gitignore exists${NC}"
    if grep -q ".dev.vars" workers/generate/.gitignore; then
        echo -e "${GREEN}✅ PASS: .dev.vars is in .gitignore${NC}"
    else
        echo -e "${RED}❌ FAIL: .dev.vars not in .gitignore${NC}"
    fi
else
    echo -e "${RED}❌ FAIL: workers/generate/.gitignore does not exist${NC}"
fi

echo ""
echo "4. Checking git status..."

if git ls-files | grep -q "workers/generate/.dev.vars"; then
    echo -e "${RED}❌ FAIL: .dev.vars is still tracked by git${NC}"
else
    echo -e "${GREEN}✅ PASS: .dev.vars is not tracked by git${NC}"
fi

echo ""
echo "5. Verifying production secrets..."
cd workers/generate
if npx wrangler secret list 2>/dev/null | grep -q "GEMINI_API_KEY"; then
    echo -e "${GREEN}✅ PASS: GEMINI_API_KEY is set in production${NC}"
else
    echo -e "${RED}❌ FAIL: GEMINI_API_KEY not set in production${NC}"
fi

if npx wrangler secret list 2>/dev/null | grep -q "AUTUMN_SECRET_KEY"; then
    echo -e "${GREEN}✅ PASS: AUTUMN_SECRET_KEY is set in production${NC}"
else
    echo -e "${RED}❌ FAIL: AUTUMN_SECRET_KEY not set in production${NC}"
fi
cd ../..

echo ""
echo "6. Testing production worker..."
RESPONSE=$(curl -s https://creatortoolhub.com/api/user/profile)
if echo "$RESPONSE" | grep -q "AUTH_REQUIRED\|error"; then
    echo -e "${GREEN}✅ PASS: Worker is responding${NC}"
    echo "   Response: $RESPONSE"
else
    echo -e "${YELLOW}⚠️  WARNING: Unexpected worker response${NC}"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "============================="
echo -e "${GREEN}✅ Verification Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Revoke old keys in Google Cloud Console and Autumn dashboard"
echo "2. Test image generation on production site"
echo "3. Delete KEY_ROTATION_SUMMARY.md and this script"

