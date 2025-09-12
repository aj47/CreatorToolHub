# Cloudflare Storage Setup Guide

This guide explains how to set up Cloudflare D1 database and R2 storage for user data persistence in Creator Tool Hub.

## Prerequisites

- Cloudflare account with Workers/Pages access
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Cloudflare (`wrangler auth login`)

## 1. Create Cloudflare D1 Database

```bash
cd workers/generate
wrangler d1 create creator-tool-hub-db
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "creator-tool-hub-db"
database_id = "your-database-id-here"  # Replace with actual ID
```

## 2. Create Cloudflare R2 Bucket

```bash
wrangler r2 bucket create creator-tool-hub-user-data
```

## 3. Run Database Migrations

```bash
# Apply migrations to production database
wrangler d1 migrations apply creator-tool-hub-db

# For local development
wrangler d1 migrations apply creator-tool-hub-db --local
```

## 4. Deploy Worker

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
wrangler deploy
```

## 5. Update Environment Variables

Set the following secrets in Cloudflare dashboard or via CLI:

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put AUTUMN_SECRET_KEY  # Optional, for billing
```

## 6. Configure Routes

Update `wrangler.toml` with your domain:

```toml
routes = [
  { pattern = "yourdomain.com/api/generate", zone_name = "yourdomain.com" },
  { pattern = "yourdomain.com/api/user/*", zone_name = "yourdomain.com" }
]
```

## API Endpoints

The following endpoints are available for user data management:

### Templates
- `GET /api/user/templates` - List user templates
- `POST /api/user/templates` - Create template
- `PUT /api/user/templates/:id` - Update template
- `DELETE /api/user/templates/:id` - Delete template

### Images
- `GET /api/user/images?type=frame|reference` - List user images
- `POST /api/user/images` - Upload image (multipart/form-data)
- `DELETE /api/user/images/:id` - Delete image

### Settings
- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update settings

### Migration
- `POST /api/user/migrate` - Migrate from localStorage

## Database Schema

The system uses the following tables:

- `users` - User profiles
- `user_templates` - Custom templates
- `reference_images` - Template reference images
- `user_images` - User uploaded images (frames/references)
- `user_settings` - User preferences and favorites

## R2 Storage Structure

Files are organized as:
```
users/{user_id}/
├── templates/{template_id}/references/{image_id}.{ext}
└── images/
    ├── frames/{image_id}.{ext}
    └── references/{image_id}.{ext}
```

## Frontend Integration

The frontend automatically detects cloud storage availability and:

1. **Fallback Mode**: Uses localStorage when cloud storage is unavailable
2. **Hybrid Mode**: Syncs between localStorage and cloud storage
3. **Migration**: Automatically migrates existing localStorage data on first login
4. **Offline Support**: Continues working offline with localStorage

## Testing

### Local Development

```bash
# Start local development with D1 and R2 emulation
wrangler dev --local

# Test database migrations locally
wrangler d1 migrations apply creator-tool-hub-db --local
```

### Production Testing

1. **Authentication**: Ensure Google OAuth is working
2. **Template CRUD**: Create, update, delete templates
3. **Image Upload**: Upload frames and reference images
4. **Cross-device Sync**: Login from different devices/browsers
5. **Migration**: Test with existing localStorage data
6. **Offline Mode**: Test with network disabled

## Troubleshooting

### Common Issues

1. **Database ID mismatch**: Ensure `wrangler.toml` has correct database ID
2. **R2 bucket not found**: Verify bucket name matches configuration
3. **Authentication errors**: Check Google OAuth setup
4. **Migration failures**: Check browser console for detailed errors

### Debug Endpoints

- `GET /api/user/profile` - Check user authentication
- Browser DevTools → Application → Local Storage - Check localStorage data
- Browser DevTools → Network - Monitor API calls

### Logs

```bash
# View worker logs
wrangler tail

# View specific deployment logs
wrangler tail --format=pretty
```

## Security Considerations

1. **Authentication**: All endpoints require valid Google OAuth token
2. **User Isolation**: Data is isolated by derived user ID
3. **File Validation**: Images are validated for type and size
4. **Rate Limiting**: Consider adding rate limiting for production
5. **CORS**: Configure appropriate CORS headers if needed

## Performance Optimization

1. **Caching**: R2 objects have 1-year cache headers
2. **Compression**: Images are compressed client-side before upload
3. **Deduplication**: Files are deduplicated by SHA-256 hash
4. **Batch Operations**: Multiple operations are batched where possible

## Monitoring

Monitor the following metrics:

1. **D1 Database**: Query performance, storage usage
2. **R2 Storage**: Bandwidth, storage usage, request count
3. **Worker**: CPU time, memory usage, error rates
4. **User Experience**: Migration success rate, sync failures

## Cost Estimation

Typical costs for moderate usage:

- **D1**: ~$0.50/month (1M reads, 100K writes)
- **R2**: ~$0.015/GB/month storage + $0.36/million requests
- **Workers**: Included in free tier for most usage

## Backup and Recovery

1. **Database Backup**: Use `wrangler d1 export` for backups
2. **R2 Backup**: Consider cross-region replication
3. **User Data Export**: Implement user data export functionality
4. **Disaster Recovery**: Document recovery procedures
