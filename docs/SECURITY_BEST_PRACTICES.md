# Security Best Practices

## Overview

This document outlines security best practices for the CreatorToolHub project, with a focus on preventing accidental exposure of API keys and secrets.

## Environment Variables and Secrets

### ✅ DO

- Store all secrets in environment variables (`.env.local`, `.env.production`, etc.)
- Add all `.env*` files to `.gitignore`
- Use Cloudflare Secrets for production API keys
- Rotate keys immediately if they are exposed
- Use strong, unique API keys from your service providers

### ❌ DON'T

- Commit `.env` files to git
- Hardcode API keys in source code
- Share API keys in chat, email, or documentation
- Use the same API key across multiple environments
- Leave old keys active after rotation

## Git Hooks

### Pre-commit Hook

A pre-commit hook is installed to prevent committing secrets. The hook checks for:

- Google API keys (AIza...)
- AWS keys (AKIA...)
- Autumn API keys (am_sk_live_...)
- Generic secret patterns (secret=, api_key=, password=, etc.)
- Private key files

### Installing Git Hooks

If you cloned the repository before hooks were set up, run:

```bash
./scripts/setup-git-hooks.sh
```

This will copy the hooks from `git-hooks/` to `.git/hooks/`.

### Bypassing Hooks (NOT RECOMMENDED)

If you absolutely need to bypass the pre-commit hook:

```bash
git commit --no-verify
```

**Warning**: Only use this if you are absolutely certain the commit does not contain secrets.

## .gitignore Configuration

The repository has two `.gitignore` files:

### Root `.gitignore`
- Ignores all `.env*` files
- Ignores build directories (`.next/`, `dist/`, etc.)
- Ignores node_modules

### `workers/generate/.gitignore`
- Ignores `.dev.vars` (Wrangler development variables)
- Ignores `.env` and `.env.*` files
- Ignores `.wrangler/` directory

## If You Accidentally Commit Secrets

### Immediate Actions

1. **Revoke the exposed keys immediately** in their respective dashboards:
   - Google Cloud Console for Gemini API keys
   - Autumn dashboard for Autumn API keys
   - AWS Console for AWS keys
   - etc.

2. **Generate new keys** from the service providers

3. **Update local environment files** with new keys

4. **Update production secrets** (Cloudflare, environment variables, etc.)

### Clean Git History

If secrets were committed to git, use `git filter-repo` to remove them:

```bash
# Install git-filter-repo if not already installed
pip install git-filter-repo

# Create a file with secrets to remove (one per line)
cat > /tmp/secrets.txt << EOF
old_api_key_1
old_api_key_2
EOF

# Remove secrets from git history
git filter-repo --replace-text /tmp/secrets.txt --force

# Re-add remote and push
git remote add origin https://github.com/aj47/CreatorToolHub.git
git push origin main --force-with-lease
```

**Warning**: Force pushing rewrites history. Coordinate with team members before doing this.

## Environment-Specific Configuration

### Development (`.env.local`)

```
GEMINI_API_KEY=your_dev_key
AUTUMN_SECRET_KEY=your_dev_key
```

### Production (Cloudflare Secrets)

Set via `wrangler secret put`:

```bash
cd workers/generate
wrangler secret put GEMINI_API_KEY
wrangler secret put AUTUMN_SECRET_KEY
```

## Monitoring and Auditing

### Check for Exposed Keys

To check if old keys are still in the codebase:

```bash
# Search for a specific key pattern
git log -p --all -S "your_key_here"

# Search in current files
grep -r "your_key_here" . --exclude-dir=node_modules --exclude-dir=.git
```

### Git History Audit

Review recent commits for any accidental secret exposure:

```bash
# View recent commits
git log --oneline -20

# View changes in a specific commit
git show <commit_hash>
```

## Team Collaboration

### For New Team Members

1. Clone the repository
2. Run `./scripts/setup-git-hooks.sh` to install git hooks
3. Create `.env.local` with development keys (ask team lead)
4. Never commit `.env*` files

### Key Rotation

When rotating keys:

1. Generate new keys in the service provider
2. Update all `.env*` files locally
3. Update production secrets (Cloudflare, etc.)
4. Revoke old keys in the service provider
5. Verify everything works
6. Document the rotation (but don't include keys in documentation)

## Additional Resources

- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Git Filter Repo Documentation](https://github.com/newren/git-filter-repo)
- [Cloudflare Secrets Documentation](https://developers.cloudflare.com/workers/platform/environment-variables/#secrets-on-cloudflare)

