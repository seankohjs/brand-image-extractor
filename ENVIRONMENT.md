# Environment Configuration

This document describes all environment variables used by the Brand Image Extractor.

## Required Variables

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://user:pass@localhost:3306/db` |

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT session tokens (min 32 chars) | `openssl rand -hex 32` |

## Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_MODE` | Storage backend: `local` or `s3` | `local` |
| `LOCAL_STORAGE_URL` | Base URL for local file serving | `http://localhost:3000/uploads` |

### S3 Storage (Production)

When `STORAGE_MODE=s3`, these variables are required:

| Variable | Description |
|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | S3 API endpoint URL |
| `BUILT_IN_FORGE_API_KEY` | S3 API authentication key |

## Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## Example .env File

Create a `.env` file in the project root with the following content:

```env
# Database
DATABASE_URL=mysql://root:password@localhost:3306/brand_extractor

# Storage
STORAGE_MODE=local
LOCAL_STORAGE_URL=http://localhost:3000/uploads

# Authentication
JWT_SECRET=your-secret-key-at-least-32-characters-long

# Server
PORT=3000
NODE_ENV=development
```

## Generating JWT Secret

Use one of these methods to generate a secure JWT secret:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Storage Modes

### Local Storage (`STORAGE_MODE=local`)

- Images are saved to the `uploads/` directory
- Files are served via Express static middleware
- Best for development and testing
- No external dependencies required

### S3 Storage (`STORAGE_MODE=s3`)

- Images are uploaded to S3-compatible storage
- Requires API credentials
- Best for production deployments
- Provides CDN-backed delivery
