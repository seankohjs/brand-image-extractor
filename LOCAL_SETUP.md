# Local Development Setup

This guide explains how to run the Brand Image Extractor on your local machine.

## Prerequisites

- Node.js 18+ 
- pnpm (package manager)
- MySQL or TiDB database

## Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Storage Configuration
# Set to 'local' to store files locally instead of S3
STORAGE_MODE=local

# Base URL for serving local files
LOCAL_STORAGE_URL=http://localhost:3000/uploads

# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/brand_extractor

# Authentication
JWT_SECRET=your-random-secret-string-here

# Server
PORT=3000
NODE_ENV=development
```

## Storage Modes

### Local Storage (Recommended for Development)

Set `STORAGE_MODE=local` in your `.env` file. Images will be saved to the `uploads/` directory and served via Express static middleware.

**Advantages:**
- No external dependencies
- Works offline
- Easy to inspect files

### S3 Storage (Production)

When running in the Manus environment, S3 storage is used automatically. The following environment variables are auto-injected:
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

## Database Setup

1. Create a MySQL database:
   ```sql
   CREATE DATABASE brand_extractor;
   ```

2. Run migrations:
   ```bash
   pnpm db:push
   ```

## Running the Application

**Development mode:**
```bash
pnpm dev
```

**Production build:**
```bash
pnpm build
pnpm start
```

## Authentication Notes

The application uses Manus OAuth for authentication. For local development, you have two options:

1. **Skip authentication** - Modify the code to bypass auth checks for testing
2. **Use mock user** - Create a test user directly in the database

## File Structure

```
uploads/                  # Local file storage (created automatically)
├── crawl-{jobId}/       # Images organized by crawl job
│   ├── image1.jpg
│   ├── image2.png
│   └── screenshot.png
```

## Troubleshooting

### Playwright Browser Issues
If you encounter browser launch errors:
```bash
npx playwright install-deps chromium
```

### Database Connection Issues
Ensure your MySQL server is running and the connection string is correct.

### Permission Issues
Make sure the `uploads/` directory is writable:
```bash
mkdir -p uploads && chmod 755 uploads
```
