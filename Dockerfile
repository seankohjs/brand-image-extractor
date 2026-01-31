# Brand Image Extractor - Dockerfile
FROM node:20-slim

WORKDIR /app

# Install system dependencies for Playwright and native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libx11-6 \
    libxcb-dri3-0 \
    libglib2.0-0 \
    fonts-liberation \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --ignore-scripts

# Rebuild native modules
RUN pnpm rebuild

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Install Playwright browsers
RUN npx playwright install chromium

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
