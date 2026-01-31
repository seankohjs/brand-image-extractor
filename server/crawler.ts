import { chromium, Browser, Page } from "playwright";
import { storagePut } from "./storageUnified";
import { nanoid } from "nanoid";
import { analyzeImage, ColorInfo } from "./imageAnalysis";
import { extractBrandKit, captureAndAnalyzeScreenshot, mergeColorPalettes, BrandKit, FontInfo } from "./brandKit";

export interface ImageMetadata {
  originalUrl: string;
  pageUrl: string;
  altText: string | null;
  title: string | null;
  caption: string | null;
  ariaLabel: string | null;
  figcaption: string | null;
  nearbyText: string | null;
  width: number | null;
  height: number | null;
  labels: string[];
  // Quality fields
  isBlurry: boolean;
  blurScore: number;
  hasDescription: boolean;
  dominantColors: ColorInfo[];
}

export interface CrawlProgress {
  totalPages: number;
  crawledPages: number;
  totalImages: number;
  currentPage: string;
  status: "running" | "completed" | "failed";
  error?: string;
}

export interface CrawlResult {
  images: ImageMetadata[];
  pagesVisited: string[];
  errors: string[];
  brandKit: BrandKit;
}

// Store active crawl progress for real-time updates
const crawlProgressMap = new Map<number, CrawlProgress>();

export function getCrawlProgress(jobId: number): CrawlProgress | undefined {
  return crawlProgressMap.get(jobId);
}

export function setCrawlProgress(jobId: number, progress: CrawlProgress): void {
  crawlProgressMap.set(jobId, progress);
}

export function clearCrawlProgress(jobId: number): void {
  crawlProgressMap.delete(jobId);
}

/**
 * Normalize URL to avoid duplicates
 */
function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(url, baseUrl);
    // Remove hash and trailing slash
    parsed.hash = "";
    let normalized = parsed.href;
    if (normalized.endsWith("/") && parsed.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Check if URL is from the same domain
 */
function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).hostname;
    const baseHost = new URL(baseUrl).hostname;
    return urlHost === baseHost || urlHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${urlHost}`);
  } catch {
    return false;
  }
}

/**
 * Extract image metadata from a page
 */
async function extractImagesFromPage(page: Page, pageUrl: string): Promise<Omit<ImageMetadata, "isBlurry" | "blurScore" | "hasDescription" | "dominantColors">[]> {
  const images: Omit<ImageMetadata, "isBlurry" | "blurScore" | "hasDescription" | "dominantColors">[] = [];

  const imageData = await page.evaluate(() => {
    const results: Array<{
      src: string;
      alt: string | null;
      title: string | null;
      ariaLabel: string | null;
      width: number | null;
      height: number | null;
      figcaption: string | null;
      nearbyText: string | null;
    }> = [];

    // Get all img elements
    const imgElements = document.querySelectorAll("img");
    
    imgElements.forEach((img) => {
      const src = img.src || img.dataset.src || img.getAttribute("data-lazy-src") || "";
      if (!src || src.startsWith("data:")) return;

      // Get figcaption if image is inside a figure
      let figcaption: string | null = null;
      const figure = img.closest("figure");
      if (figure) {
        const figcaptionEl = figure.querySelector("figcaption");
        if (figcaptionEl) {
          figcaption = figcaptionEl.textContent?.trim() || null;
        }
      }

      // Get nearby text (parent's text content, limited)
      let nearbyText: string | null = null;
      const parent = img.parentElement;
      if (parent) {
        const text = parent.textContent?.trim().slice(0, 200) || "";
        if (text && text !== img.alt) {
          nearbyText = text;
        }
      }

      results.push({
        src,
        alt: img.alt || null,
        title: img.title || null,
        ariaLabel: img.getAttribute("aria-label") || null,
        width: img.naturalWidth || img.width || null,
        height: img.naturalHeight || img.height || null,
        figcaption,
        nearbyText,
      });
    });

    // Also get background images from CSS
    const elementsWithBg = document.querySelectorAll("*");
    elementsWithBg.forEach((el) => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== "none" && bgImage.startsWith("url(")) {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !match[1].startsWith("data:")) {
          results.push({
            src: match[1],
            alt: null,
            title: null,
            ariaLabel: el.getAttribute("aria-label") || null,
            width: null,
            height: null,
            figcaption: null,
            nearbyText: null,
          });
        }
      }
    });

    return results;
  });

  // Process and deduplicate images
  const seenUrls = new Set<string>();
  
  for (const data of imageData) {
    const normalizedUrl = normalizeUrl(data.src, pageUrl);
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) continue;
    
    // Skip tiny images (likely icons/tracking pixels)
    if (data.width && data.height && data.width < 50 && data.height < 50) continue;
    
    seenUrls.add(normalizedUrl);

    // Generate labels from available metadata
    const labels: string[] = [];
    if (data.alt) labels.push(data.alt);
    if (data.title && data.title !== data.alt) labels.push(data.title);
    if (data.figcaption && !labels.includes(data.figcaption)) labels.push(data.figcaption);

    images.push({
      originalUrl: normalizedUrl,
      pageUrl,
      altText: data.alt,
      title: data.title,
      caption: null,
      ariaLabel: data.ariaLabel,
      figcaption: data.figcaption,
      nearbyText: data.nearbyText,
      width: data.width,
      height: data.height,
      labels,
    });
  }

  return images;
}

/**
 * Extract links from a page for crawling
 */
async function extractLinksFromPage(page: Page, baseUrl: string): Promise<string[]> {
  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    return Array.from(anchors).map((a) => (a as HTMLAnchorElement).href);
  });

  const validLinks: string[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const normalized = normalizeUrl(link, baseUrl);
    if (!normalized || seen.has(normalized)) continue;
    if (!isSameDomain(normalized, baseUrl)) continue;
    
    // Skip non-page URLs
    const url = new URL(normalized);
    const ext = url.pathname.split(".").pop()?.toLowerCase();
    const skipExtensions = ["pdf", "jpg", "jpeg", "png", "gif", "svg", "webp", "mp4", "mp3", "zip", "doc", "docx"];
    if (ext && skipExtensions.includes(ext)) continue;

    seen.add(normalized);
    validLinks.push(normalized);
  }

  return validLinks;
}

/**
 * Main crawler function
 */
export async function crawlWebsite(
  targetUrl: string,
  jobId: number,
  maxPages: number = 20,
  onProgress?: (progress: CrawlProgress) => void
): Promise<CrawlResult> {
  const result: CrawlResult = {
    images: [],
    pagesVisited: [],
    errors: [],
    brandKit: {
      colors: [],
      fonts: [],
      cssColors: [],
      cssVariables: {},
    },
  };

  let browser: Browser | null = null;
  const allColorPalettes: ColorInfo[][] = [];

  try {
    // Normalize the target URL
    const normalizedTarget = normalizeUrl(targetUrl, targetUrl);
    if (!normalizedTarget) {
      throw new Error("Invalid target URL");
    }

    // Initialize progress
    const progress: CrawlProgress = {
      totalPages: 1,
      crawledPages: 0,
      totalImages: 0,
      currentPage: normalizedTarget,
      status: "running",
    };
    setCrawlProgress(jobId, progress);
    onProgress?.(progress);

    // Launch browser (headed for better rendering)
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // BFS crawl
    const queue: string[] = [normalizedTarget];
    const visited = new Set<string>();
    const seenImages = new Set<string>();
    let brandKitExtracted = false;

    while (queue.length > 0 && visited.size < maxPages) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;

      try {
        // Update progress
        progress.currentPage = currentUrl;
        progress.totalPages = Math.max(progress.totalPages, visited.size + queue.length + 1);
        setCrawlProgress(jobId, progress);
        onProgress?.(progress);

        // Navigate to page
        await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1500); // Wait for dynamic content

        visited.add(currentUrl);
        result.pagesVisited.push(currentUrl);

        // Extract brand kit from first page (homepage)
        if (!brandKitExtracted) {
          try {
            const brandData = await extractBrandKit(page);
            result.brandKit.fonts = brandData.fonts;
            result.brandKit.cssColors = brandData.cssColors;
            result.brandKit.cssVariables = brandData.cssVariables;

            // Capture screenshot and extract colors
            const { screenshotBuffer, colors } = await captureAndAnalyzeScreenshot(page);
            allColorPalettes.push(colors);

            // Upload screenshot to S3
            const screenshotKey = `crawl-${jobId}/screenshot-${nanoid(6)}.png`;
            const { url: screenshotUrl } = await storagePut(screenshotKey, screenshotBuffer, "image/png");
            result.brandKit.screenshotUrl = screenshotUrl;

            brandKitExtracted = true;
          } catch (error) {
            console.error("Brand kit extraction failed:", error);
          }
        }

        // Extract images
        const pageImages = await extractImagesFromPage(page, currentUrl);
        for (const img of pageImages) {
          if (!seenImages.has(img.originalUrl)) {
            seenImages.add(img.originalUrl);
            // Add quality fields with defaults (will be analyzed during upload)
            result.images.push({
              ...img,
              isBlurry: false,
              blurScore: 50,
              hasDescription: !!(img.altText || img.title || img.figcaption),
              dominantColors: [],
            });
          }
        }

        // Update progress
        progress.crawledPages = visited.size;
        progress.totalImages = result.images.length;
        setCrawlProgress(jobId, progress);
        onProgress?.(progress);

        // Extract links for further crawling
        const links = await extractLinksFromPage(page, normalizedTarget);
        for (const link of links) {
          if (!visited.has(link) && !queue.includes(link)) {
            queue.push(link);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to crawl ${currentUrl}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMsg);
        visited.add(currentUrl); // Mark as visited to avoid retry
      }
    }

    // Merge all color palettes
    result.brandKit.colors = mergeColorPalettes(allColorPalettes);

    // Final progress update
    progress.status = "completed";
    progress.crawledPages = visited.size;
    progress.totalImages = result.images.length;
    setCrawlProgress(jobId, progress);
    onProgress?.(progress);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMsg);
    
    const progress = getCrawlProgress(jobId);
    if (progress) {
      progress.status = "failed";
      progress.error = errorMsg;
      setCrawlProgress(jobId, progress);
      onProgress?.(progress);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

/**
 * Download, analyze, and upload image to S3
 */
export async function uploadImageToS3(
  imageUrl: string,
  jobId: number
): Promise<{ 
  s3Url: string; 
  s3Key: string; 
  fileSize: number; 
  mimeType: string;
  isBlurry: boolean;
  blurScore: number;
  dominantColors: ColorInfo[];
} | null> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Analyze image quality
    let isBlurry = false;
    let blurScore = 50;
    let dominantColors: ColorInfo[] = [];

    try {
      const analysis = await analyzeImage(buffer);
      isBlurry = analysis.quality.isBlurry;
      blurScore = analysis.quality.blurScore;
      dominantColors = analysis.colors;
    } catch (error) {
      console.error("Image analysis failed:", error);
    }

    // Generate S3 key
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const filename = `${nanoid(10)}.${ext}`;
    const s3Key = `crawl-${jobId}/${filename}`;

    // Upload to S3
    const { url } = await storagePut(s3Key, buffer, contentType);

    return {
      s3Url: url,
      s3Key,
      fileSize: buffer.length,
      mimeType: contentType,
      isBlurry,
      blurScore,
      dominantColors,
    };
  } catch (error) {
    console.error(`Failed to upload image ${imageUrl}:`, error);
    return null;
  }
}
