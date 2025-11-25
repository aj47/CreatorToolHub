# E2E Tests for CreatorToolHub

This directory contains end-to-end tests using Playwright to verify the production credits flow and other critical functionality.

## Setup

Playwright is already installed as a dev dependency. To install the browsers:

```bash
npx playwright install
```

## Running Tests

### Test Production Credits Flow

To test the production site (https://creatortoolhub.com):

```bash
npm run test:e2e:prod
```

### Test Local Development

To test against localhost:3000:

```bash
npm run test:e2e
```

### Interactive UI Mode

To run tests with the Playwright UI (great for debugging):

```bash
npm run test:e2e:ui
```

### Headed Mode (See Browser)

To see the browser while tests run:

```bash
npm run test:e2e:headed
```

### Debug Mode

To debug tests step-by-step:

```bash
npm run test:e2e:debug
```

## Test Files

### `credits-flow.spec.ts`

Tests the core credits infrastructure:
- ✅ Credit balance display
- ✅ Autumn API accessibility
- ✅ Worker API health
- ✅ Microsoft Clarity integration
- ✅ CSP headers configuration

**What it checks:**
- `/api/autumn/products` returns 200/401 (not 500)
- Worker API is accessible
- Clarity script is loaded (if `NEXT_PUBLIC_CLARITY_ID` is set)
- CSP headers allow Clarity domains

### `thumbnail-generation-credits.spec.ts`

Tests the thumbnail generation flow with credits:
- ✅ Credit balance on thumbnails page
- ✅ Provider selection UI
- ✅ Credit gating (prevents generation with insufficient credits)
- ✅ API calls to Autumn for credit checks
- ✅ Worker credit pricing configuration
- ✅ Next.js API routes (refine, video SEO) have Autumn configured

**What it checks:**
- Credits are displayed correctly
- `/api/refine` returns 200/401 (not 500 from missing `AUTUMN_SECRET_KEY`)
- `/api/generate-video-content` is configured
- Worker responds correctly (not 500 from missing secrets)

## Expected Results

### ✅ Passing Tests (Correctly Configured)

All tests should pass if:
1. `AUTUMN_SECRET_KEY` is set in both:
   - Cloudflare Pages (Production environment)
   - Cloudflare Worker secrets
2. `NEXT_PUBLIC_CLARITY_ID` is set in Cloudflare Pages (at build time)
3. All other required secrets are configured

### ❌ Failing Tests (Configuration Issues)

Tests will fail with specific errors if:

**Missing `AUTUMN_SECRET_KEY` in Pages:**
- `/api/refine` returns 500
- `/api/generate-video-content` returns 500
- Error message: "Billing service not configured"

**Missing `AUTUMN_SECRET_KEY` in Worker:**
- Worker returns 500 with "Missing AUTUMN_SECRET_KEY"
- Credits won't be deducted for thumbnail generation

**Missing `NEXT_PUBLIC_CLARITY_ID`:**
- No Clarity script in HTML
- No network requests to clarity.ms
- CSP doesn't include Clarity domains

## Interpreting Results

After running tests, check the console output:

```
📊 Current credit balance: 100 credits
✅ Autumn API is being called
✅ Worker is responding correctly (status: 401)
✅ API routes are responding
⚠️  No Clarity network requests detected - check NEXT_PUBLIC_CLARITY_ID
```

### Common Issues

1. **"Autumn API returned 500 errors"**
   - Fix: Set `AUTUMN_SECRET_KEY` in Cloudflare Pages environment variables
   - Redeploy after setting

2. **"Worker missing AUTUMN_SECRET_KEY"**
   - Fix: Run `wrangler secret put AUTUMN_SECRET_KEY` in `workers/generate/`
   - Redeploy worker

3. **"No Clarity network requests detected"**
   - Fix: Set `NEXT_PUBLIC_CLARITY_ID` in Cloudflare Pages
   - **Important:** Trigger a new build (it's a build-time variable)

4. **"Refine API billing not configured"**
   - Fix: Set `AUTUMN_SECRET_KEY` in Cloudflare Pages
   - This affects `/api/refine` and `/api/generate-video-content`

## CI/CD Integration

To run these tests in CI:

```bash
# Install browsers in CI
npx playwright install --with-deps

# Run tests
npm run test:e2e:prod
```

## Viewing Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

This shows:
- Screenshots of failures
- Videos of test runs
- Network activity
- Console logs

