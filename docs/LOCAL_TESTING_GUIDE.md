# Local Testing Guide

This guide explains how to test your full-stack system locally without waiting for production deployments.

## Quick Start

### 1. **Full Local Stack** (Recommended)
```bash
# Start both frontend and worker locally
npm run dev:local

# In another terminal, run tests
npm run test:check        # Smart test runner with service checks
npm run test:all          # Run both API and browser tests
```

### 2. **Individual Components**
```bash
# Frontend only
npm run dev

# Worker only (in workers/generate directory)
cd workers/generate
npm run dev -- --local --port 8787
```

### 3. **Testing Options**
```bash
# Smart test runner (checks if services are running first)
npm run test:check        # API and integration tests (default)

# Direct test commands
npm run test:full-stack   # API and integration tests
npm run test:perf         # Performance tests only

# Test with service check
bash scripts/test-with-check.sh full  # API tests
bash scripts/test-with-check.sh perf  # Performance only
```

## Testing Strategies

### 1. **API Testing**
The `test-full-stack.js` script tests all API endpoints:

```bash
# Test all endpoints and performance
npm run test:full-stack

# Test only performance
npm run test:perf
```

**What it tests:**
- ✅ Worker health and connectivity
- ✅ Database connection (local D1)
- ✅ All user API endpoints
- ✅ Image upload functionality
- ✅ Template CRUD operations
- ✅ Frontend-to-API integration
- ✅ Response times and performance

### 2. **Performance Testing**
Performance tests measure response times and system health:

```bash
# Run performance tests only
npm run test:perf

# Or via test runner
bash scripts/test-with-check.sh perf
```

**What it tests:**
- ✅ API response times
- ✅ Frontend load times
- ✅ Worker health checks
- ✅ Database connectivity speed
- ✅ Overall system performance

### 3. **Integration Testing**
Tests the complete flow from frontend to backend:

```bash
# Start local stack and run integration tests
npm run dev:local &
sleep 10
npm run test:check
```

**What it tests:**
- ✅ Frontend → API communication
- ✅ Authentication flow (mocked in dev)
- ✅ Data persistence (local D1 database)
- ✅ File storage (local R2 emulation)
- ✅ Error propagation and handling

## Local Development Environment

### Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Worker        │
│   localhost:3000│◄──►│   localhost:8787│
│   (Next.js)     │    │   (Wrangler)    │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Local D1 DB   │
│   (Playwright)  │    │   + R2 Storage  │
└─────────────────┘    └─────────────────┘
```

### Environment Variables
The local stack automatically configures:
- `NEXT_PUBLIC_WORKER_API_URL=http://localhost:8787`
- `NODE_ENV=development` (enables mocks)
- Local D1 database in `.wrangler/state/v3/d1/`
- Local R2 storage emulation

### Debug Features
In development mode, you get:
- **Debug Panel**: Real-time status indicators
- **Mock Authentication**: No Google OAuth needed
- **Mock Credits**: 999 credits for testing
- **Detailed Logging**: Console logs for debugging
- **Hot Reload**: Changes reflect immediately

## Testing Workflows

### 1. **Feature Development Workflow**
```bash
# 1. Start local development
npm run dev:local

# 2. Make your changes
# ... edit code ...

# 3. Test changes
npm run test:full-stack

# 4. Run browser tests
npm run test:e2e

# 5. Deploy when confident
git push origin main
```

### 2. **Bug Investigation Workflow**
```bash
# 1. Reproduce locally
npm run dev:local

# 2. Run tests to identify issues
npm run test:check

# 3. Check specific API endpoints
curl http://localhost:8787/api/user/profile
curl http://localhost:8787/api/user/templates

# 4. Check frontend directly
curl http://localhost:3000/thumbnails
```

### 3. **Performance Testing Workflow**
```bash
# 1. Start clean environment
npm run dev:local

# 2. Run performance tests
npm run test:perf

# 3. Monitor resource usage
# Check wrangler logs: cd workers/generate && npx wrangler tail --local
# Check frontend logs in browser dev tools
```

## Troubleshooting

### Common Issues

**Worker not starting:**
```bash
cd workers/generate
npm install
npm run db:migrate:local
npm run dev -- --local --port 8787
```

**Frontend can't reach worker:**
- Check `NEXT_PUBLIC_WORKER_API_URL` in `.env.local`
- Ensure worker is running on port 8787
- Check CORS configuration in `next.config.ts`

**Tests failing:**
```bash
# Check if services are running
curl http://localhost:3000/thumbnails
curl http://localhost:8787/api/user/profile

# Reset local database
cd workers/generate
rm -rf .wrangler/state
npm run db:migrate:local
```

**API testing issues:**
```bash
# Test API endpoints directly
curl -v http://localhost:8787/api/user/profile
curl -v http://localhost:3000/thumbnails

# Check service status
npm run test:check
```

### Debug Commands

```bash
# Check worker logs
cd workers/generate && npx wrangler tail --local

# Check database state
cd workers/generate && npx wrangler d1 execute creator-tool-hub-db --local --command "SELECT * FROM users"

# Test API directly
curl -v http://localhost:8787/api/user/profile

# Check frontend build
npm run build && npm run start
```

## Alternative: Manual Service Management

If you prefer to manage services manually:

```bash
# Terminal 1: Start worker
cd workers/generate
npm run dev -- --local --port 8787

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Run tests
npm run test:check
```

## CI/CD Integration

Add to your GitHub Actions or CI pipeline:

```yaml
- name: Install dependencies
  run: npm ci

- name: Start local stack
  run: npm run dev:local &

- name: Wait for services
  run: sleep 30

- name: Run tests
  run: npm run test:check

- name: Run performance tests
  run: npm run test:perf
```

## Benefits of Local Testing

✅ **Faster feedback loop** - No deployment wait times  
✅ **Isolated testing** - No interference with production  
✅ **Debugging capabilities** - Full access to logs and state  
✅ **Cost effective** - No cloud resource usage  
✅ **Offline development** - Works without internet  
✅ **Reproducible** - Consistent environment for all developers  

This setup gives you confidence in your changes before deploying to production!
