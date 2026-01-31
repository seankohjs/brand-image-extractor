# Brand Image Extractor - TODO

## Core Features
- [x] URL input form with validation to accept website URLs for crawling
- [x] Playwright-based web crawler that navigates through website pages automatically
- [x] Image extraction engine that captures image URLs, alt text, titles, and metadata
- [x] Image labeling system that associates descriptive text with each extracted image
- [x] File storage integration to save extracted images to S3 with organized naming
- [x] Database schema to store crawl jobs, extracted images, and their metadata
- [x] Results display page showing extracted images with their labels in a gallery view
- [x] Download functionality to export extracted images and metadata as JSON file
- [x] Crawl progress tracking with real-time status updates during extraction
- [x] Error handling for failed crawls, inaccessible pages, and missing images

## Technical Tasks
- [x] Install Playwright and configure browser automation
- [x] Create database tables for crawl_jobs and extracted_images
- [x] Implement crawler service with page navigation logic
- [x] Build tRPC procedures for CRUD operations
- [x] Create frontend components for URL input and gallery
- [x] Implement S3 upload for extracted images
- [x] Add JSON metadata export functionality
- [x] Write tests for crawler and API endpoints

## New Features (v2)
- [x] Page screenshot capture using headed Playwright browser
- [x] Dominant color extraction from page screenshots
- [x] Blurry image detection and filtering
- [x] Brand kit extraction (colors, fonts, CSS variables)
- [x] Filter images with no description
- [x] Display brand color palette in results
- [x] Display extracted fonts in results
- [x] Image quality score display

## New Features (v3)
- [x] Add local file storage as alternative to S3
- [x] Create storage abstraction layer (S3 or local)
- [x] Add static file serving for local uploads
- [x] Environment variable to toggle storage mode

## API Conversion (v4)
- [x] Remove authentication requirements from crawl endpoints
- [x] Create public API endpoint for crawling
- [x] Add synchronous crawl option that returns results directly
- [x] Return images with brand kit data in API response
- [x] Add API documentation

## Documentation (v5)
- [x] Create comprehensive README.md
- [x] Verify package.json dependencies
- [x] Create startup scripts
- [x] Add environment configuration examples
