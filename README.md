# Brand Image Extractor

A web application and API that extracts images, brand colors, fonts, and other brand assets from any website using Playwright-based crawling.

## Features

- **Web Crawler**: Automated Playwright-based crawler that navigates through website pages
- **Image Extraction**: Captures images with metadata (alt text, titles, figcaptions, dimensions)
- **Brand Kit Analysis**: Extracts dominant colors, fonts, and CSS color palettes from pages
- **Blur Detection**: Filters out low-quality/blurry images using Laplacian variance analysis
- **Screenshot Capture**: Takes full-page screenshots for brand color analysis
- **Public API**: RESTful API endpoints for programmatic access (no authentication required)
- **Local Storage Option**: Run without S3 by storing files locally

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- MySQL or TiDB database

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd brand-image-extractor

# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install chromium
```

### Environment Setup

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/brand_extractor

# Storage Mode: 'local' or 's3'
STORAGE_MODE=local

# Local storage URL (when STORAGE_MODE=local)
LOCAL_STORAGE_URL=http://localhost:3000/uploads

# Authentication (required for session management)
JWT_SECRET=your-random-secret-string-here

# Server
PORT=3000
NODE_ENV=development
```

### Database Setup

```bash
# Run migrations
pnpm db:push
```

### Running the Application

```bash
# Development mode (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

The application will be available at `http://localhost:3000`

## API Reference

All API endpoints are public and require no authentication.

### Base URL

```
http://localhost:3000/api/trpc
```

### Endpoints

#### Extract Brand Assets (Synchronous)

Crawls a website and returns all extracted data. Waits for completion before returning.

```bash
POST /api/trpc/api.extract
```

**Request:**
```json
{
  "json": {
    "url": "https://example.com",
    "maxPages": 10,
    "downloadImages": true,
    "filterBlurry": true,
    "filterNoDescription": false
  }
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "success": true,
      "jobId": 123,
      "url": "https://example.com",
      "duration": "45.2s",
      "stats": {
        "pagesVisited": 10,
        "imagesFound": 150,
        "imagesReturned": 85
      },
      "brandKit": {
        "colors": [
          { "hex": "#1a1a2e", "percentage": 35.5 }
        ],
        "fonts": [
          { "family": "Inter", "weights": ["400", "600", "700"] }
        ],
        "cssColors": ["#ffffff", "#000000"],
        "screenshotUrl": "https://..."
      },
      "images": [
        {
          "originalUrl": "https://example.com/image.jpg",
          "storedUrl": "https://storage.../image.jpg",
          "altText": "Product image",
          "labels": ["product"],
          "width": 1200,
          "height": 800,
          "isBlurry": false,
          "dominantColors": [...]
        }
      ]
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/trpc/api.extract" \
  -H "Content-Type: application/json" \
  -d '{"json":{"url":"https://example.com","maxPages":10,"filterBlurry":true}}'
```

#### Start Async Crawl

Starts a crawl job in the background and returns immediately.

```bash
POST /api/trpc/api.startCrawl
```

**Request:**
```json
{
  "json": {
    "url": "https://example.com",
    "maxPages": 20
  }
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "jobId": 123,
      "status": "started"
    }
  }
}
```

#### Get Job Status & Results

```bash
GET /api/trpc/api.getJob?input={"json":{"jobId":123}}
```

#### List Recent Jobs

```bash
GET /api/trpc/api.listJobs?input={"json":{"limit":20}}
```

#### Delete Job

```bash
POST /api/trpc/api.deleteJob
```

**Request:**
```json
{
  "json": {
    "jobId": 123
  }
}
```

## Usage Examples

### JavaScript/TypeScript

```javascript
// Synchronous extraction
const response = await fetch('http://localhost:3000/api/trpc/api.extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    json: {
      url: 'https://example.com',
      maxPages: 10,
      filterBlurry: true
    }
  })
});

const data = await response.json();
console.log('Brand colors:', data.result.data.brandKit.colors);
console.log('Images found:', data.result.data.images.length);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/trpc/api.extract',
    json={
        'json': {
            'url': 'https://example.com',
            'maxPages': 10,
            'filterBlurry': True
        }
    }
)

data = response.json()['result']['data']
print('Brand colors:', data['brandKit']['colors'])
print('Fonts:', data['brandKit']['fonts'])

for image in data['images']:
    print(f"Image: {image['storedUrl'] or image['originalUrl']}")
```

## Project Structure

```
brand-image-extractor/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── _core/              # Framework core
│   ├── crawler.ts          # Playwright crawler
│   ├── imageAnalysis.ts    # Blur detection & color extraction
│   ├── brandKit.ts         # Brand kit extraction
│   ├── storageUnified.ts   # S3/local storage abstraction
│   ├── routers.ts          # tRPC API routes
│   └── db.ts               # Database queries
├── drizzle/                # Database schema & migrations
├── uploads/                # Local file storage (when STORAGE_MODE=local)
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests |
| `pnpm db:push` | Run database migrations |
| `pnpm check` | TypeScript type checking |
| `pnpm format` | Format code with Prettier |

## Storage Modes

### Local Storage (Development)

Set `STORAGE_MODE=local` in your `.env` file. Images are saved to the `uploads/` directory and served via Express static middleware.

### S3 Storage (Production)

When running in a cloud environment with S3 configured, set `STORAGE_MODE=s3` and provide the following environment variables:
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

## Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Website URL to crawl |
| `maxPages` | number | 10-20 | Maximum pages to crawl (1-50) |
| `downloadImages` | boolean | true | Download and store images |
| `filterBlurry` | boolean | true | Exclude blurry images |
| `filterNoDescription` | boolean | false | Only include images with alt text |

## Dependencies

### Core Dependencies

- **Playwright**: Browser automation for web crawling
- **Sharp**: Image processing for blur detection and color extraction
- **Express**: Web server framework
- **tRPC**: Type-safe API layer
- **Drizzle ORM**: Database ORM for MySQL/TiDB
- **React**: Frontend UI framework

### Development Dependencies

- **TypeScript**: Type safety
- **Vite**: Frontend build tool
- **Vitest**: Testing framework
- **Tailwind CSS**: Styling

## Troubleshooting

### Playwright Browser Issues

```bash
# Install browser dependencies
npx playwright install-deps chromium
```

### Database Connection Issues

Ensure your MySQL server is running and the connection string is correct in `.env`.

### Permission Issues

```bash
# Ensure uploads directory is writable
mkdir -p uploads && chmod 755 uploads
```

### Sharp Installation Issues

Sharp requires native compilation. If you encounter issues:

```bash
# Rebuild sharp
pnpm rebuild sharp
```

## License

MIT
