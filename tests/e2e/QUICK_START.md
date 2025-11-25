# Quick Start: Testing Production Credits Flow

## Run Tests Against Production

```bash
npm run test:e2e:prod
```

This will test https://creatortoolhub.com and verify:
- ✅ Autumn API is configured
- ✅ Worker API is healthy
- ✅ Next.js API routes have billing enabled
- ⚠️ Microsoft Clarity integration status
- ⚠️ Credit pricing consistency

## View Latest Test Results

See: `tests/e2e/PRODUCTION_TEST_RESULTS.md`

## Current Findings (2025-11-23)

### ✅ Working
- Autumn API integration (credits system is configured)
- Worker API responding correctly
- `/api/refine` and `/api/generate-video-content` have Autumn enabled

### ❌ Issues Found

**1. Microsoft Clarity Not Loaded**
- Missing `NEXT_PUBLIC_CLARITY_ID` at build time
- Fix: Set in Cloudflare Pages env vars and redeploy

**2. Credit Pricing Mismatch**
- Worker charges 1 credit/variant for all providers
- UI expects Gemini to cost 4 credits/variant
- Fix: Update worker code to match UI pricing

## Quick Commands

```bash
# Test production
npm run test:e2e:prod

# Test with UI (interactive)
PLAYWRIGHT_BASE_URL=https://creatortoolhub.com npm run test:e2e:ui

# Test local development
npm run test:e2e

# View HTML report
npx playwright show-report
```

## What Gets Tested

### Credits Infrastructure
- `/api/autumn/products` - Autumn API accessibility
- Worker health check
- API routes billing configuration

### Microsoft Clarity
- Script injection in HTML
- Network requests to clarity.ms
- CSP headers configuration

### API Endpoints
- `/api/generate` - Thumbnail generation
- `/api/refine` - Thumbnail refinement  
- `/api/generate-video-content` - Video SEO

All endpoints should return 401 (auth required) not 500 (misconfigured).

## Next Steps

1. **Fix Clarity** - Set `NEXT_PUBLIC_CLARITY_ID` and redeploy
2. **Fix Pricing** - Align worker credit charges with UI expectations
3. **Re-run Tests** - Verify fixes with `npm run test:e2e:prod`
4. **Monitor** - Check Autumn dashboard for correct credit deductions

