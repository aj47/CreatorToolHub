# Secrets and Environment Variables Management

This guide explains how to properly manage secrets and environment variables for the Cloudflare Worker to prevent them from being removed during deployments.

## 🔑 Required Secrets

These are sensitive values that should **never** be committed to version control:

### 1. GEMINI_API_KEY (Required)
- **Purpose**: Google Gemini API access for AI image generation
- **Set with**: `wrangler secret put GEMINI_API_KEY`
- **Get from**: Google AI Studio (https://aistudio.google.com/app/apikey)

### 2. AUTUMN_SECRET_KEY (Required)
- **Purpose**: Autumn billing service for credit management
- **Set with**: `wrangler secret put AUTUMN_SECRET_KEY`
- **Get from**: Autumn dashboard

## 📝 Environment Variables

These are non-sensitive configuration values defined in `wrangler.toml`:

### 1. NODE_ENV
- **Value**: `"production"`
- **Purpose**: Runtime environment detection

### 2. FEATURE_ID
- **Value**: `"credits"`
- **Purpose**: Autumn feature ID for billing

### 3. MODEL_ID
- **Value**: `"gemini-2.5-flash-image-preview"`
- **Purpose**: Default Gemini model to use

### 4. ALLOWED_ORIGINS
- **Value**: Comma-separated list of allowed CORS origins
- **Purpose**: CORS configuration

## 🚀 Safe Deployment Process

### Option 1: Use the Safe Deployment Script
```bash
cd workers/generate
npm run deploy:safe
```

### Option 2: Manual Process
```bash
# 1. Check current secrets
npm run secrets:list

# 2. Set secrets if missing
npm run secrets:put:gemini
npm run secrets:put:autumn

# 3. Deploy worker
npm run deploy

# 4. Verify secrets still exist
npm run secrets:list
```

## ⚠️ Why Secrets Get Removed

When you run `wrangler deploy`, it:
1. Reads your `wrangler.toml` configuration
2. Deploys the worker with ONLY the configuration defined in the file
3. **Removes any secrets/variables not explicitly managed**

This is why secrets disappear - they're not defined in `wrangler.toml` (and shouldn't be for security).

## 🔧 Troubleshooting

### If secrets are missing after deployment:
```bash
# Check what secrets exist
wrangler secret list

# Set missing secrets
wrangler secret put GEMINI_API_KEY
wrangler secret put AUTUMN_SECRET_KEY
```

### If the worker returns "Missing GEMINI_API_KEY" error:
1. Verify the secret exists: `wrangler secret list`
2. If missing, set it: `wrangler secret put GEMINI_API_KEY`
3. Test the worker: `curl https://creatortoolhub.com/api/generate`

### If the worker returns "Missing AUTUMN_SECRET_KEY" error:
1. Verify the secret exists: `wrangler secret list`
2. If missing, set it: `wrangler secret put AUTUMN_SECRET_KEY`

## 📋 Deployment Checklist

Before deploying:
- [ ] Secrets are set in Cloudflare
- [ ] `wrangler.toml` has all required environment variables
- [ ] Database migrations are applied
- [ ] R2 bucket exists and is configured

After deploying:
- [ ] Verify secrets still exist (`wrangler secret list`)
- [ ] Test API endpoints
- [ ] Check worker logs (`wrangler tail`)

## 🔗 Useful Commands

```bash
# List all secrets
wrangler secret list

# Set a secret
wrangler secret put SECRET_NAME

# Delete a secret
wrangler secret delete SECRET_NAME

# View worker logs
wrangler tail

# Test deployment
curl https://creatortoolhub.com/api/generate

# Deploy safely
npm run deploy:safe
```

## 🏗️ Environment Structure

```
Production Worker Environment:
├── Secrets (encrypted, not in wrangler.toml)
│   ├── GEMINI_API_KEY
│   └── AUTUMN_SECRET_KEY
├── Variables (in wrangler.toml)
│   ├── NODE_ENV
│   ├── FEATURE_ID
│   ├── MODEL_ID
│   └── ALLOWED_ORIGINS
└── Bindings (in wrangler.toml)
    ├── DB (D1 database)
    └── R2 (R2 bucket)
```

## 🔒 Security Best Practices

1. **Never commit secrets to git**
2. **Use environment variables for local development**
3. **Use Cloudflare secrets for production**
4. **Rotate secrets regularly**
5. **Use the safe deployment script**
6. **Always verify secrets after deployment**
