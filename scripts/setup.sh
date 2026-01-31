#!/bin/bash

# Brand Image Extractor - Setup Script
# This script sets up the project for local development

set -e

echo "🚀 Brand Image Extractor - Setup"
echo "================================="

# Check Node.js version
echo ""
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Install Playwright browsers
echo ""
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium
npx playwright install-deps chromium 2>/dev/null || true

# Create uploads directory
echo ""
echo "📁 Creating uploads directory..."
mkdir -p uploads
chmod 755 uploads

# Check for .env file
echo ""
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Please create a .env file with the following content:"
    echo ""
    echo "  DATABASE_URL=mysql://user:password@localhost:3306/brand_extractor"
    echo "  STORAGE_MODE=local"
    echo "  LOCAL_STORAGE_URL=http://localhost:3000/uploads"
    echo "  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo 'your-secret-key-here')"
    echo "  PORT=3000"
    echo "  NODE_ENV=development"
    echo ""
    echo "See ENVIRONMENT.md for more details."
else
    echo "✅ .env file found"
fi

# Run database migrations (if DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
    echo ""
    echo "🗄️  Running database migrations..."
    pnpm db:push
else
    echo ""
    echo "⚠️  DATABASE_URL not set. Skipping migrations."
    echo "   Run 'pnpm db:push' after setting up your database."
fi

echo ""
echo "================================="
echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  pnpm dev"
echo ""
echo "The app will be available at http://localhost:3000"
echo ""
