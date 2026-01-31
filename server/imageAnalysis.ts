import sharp from "sharp";

export interface ImageQuality {
  isBlurry: boolean;
  blurScore: number; // 0-100, higher = sharper
  hasDescription: boolean;
}

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
}

/**
 * Detect if an image is blurry using Laplacian variance
 * Lower variance = more blurry
 */
export async function detectBlur(imageBuffer: Buffer): Promise<{ isBlurry: boolean; blurScore: number }> {
  try {
    // Convert to grayscale and get raw pixel data
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .resize(200, 200, { fit: "inside" }) // Resize for faster processing
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Calculate Laplacian variance (edge detection)
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
        const laplacian = 
          -4 * data[idx] +
          data[idx - 1] +
          data[idx + 1] +
          data[idx - width] +
          data[idx + width];
        
        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    
    // Normalize to 0-100 score (higher = sharper)
    // Typical variance ranges from 0 (very blurry) to 2000+ (very sharp)
    const blurScore = Math.min(100, Math.max(0, variance / 20));
    
    // Consider image blurry if score is below 15
    const isBlurry = blurScore < 15;

    return { isBlurry, blurScore: Math.round(blurScore) };
  } catch (error) {
    console.error("Blur detection failed:", error);
    return { isBlurry: false, blurScore: 50 }; // Default to not blurry on error
  }
}

/**
 * Extract dominant colors from an image
 */
export async function extractDominantColors(imageBuffer: Buffer, numColors: number = 5): Promise<ColorInfo[]> {
  try {
    // Resize image for faster processing and get raw pixel data
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Simple color quantization using k-means-like approach
    const colorCounts = new Map<string, number>();
    const totalPixels = info.width * info.height;

    // Count colors (quantized to reduce unique colors)
    for (let i = 0; i < data.length; i += 3) {
      // Quantize to reduce color space (divide by 16, multiply by 16)
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      
      const key = `${r},${g},${b}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Sort by frequency and take top colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, numColors);

    return sortedColors.map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      return {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        percentage: Math.round((count / totalPixels) * 100),
      };
    });
  } catch (error) {
    console.error("Color extraction failed:", error);
    return [];
  }
}

/**
 * Extract colors from a screenshot buffer
 */
export async function extractColorsFromScreenshot(screenshotBuffer: Buffer): Promise<ColorInfo[]> {
  return extractDominantColors(screenshotBuffer, 8);
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

/**
 * Analyze image quality and extract metadata
 */
export async function analyzeImage(imageBuffer: Buffer): Promise<{
  quality: ImageQuality;
  colors: ColorInfo[];
  dimensions: { width: number; height: number } | null;
}> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const blurResult = await detectBlur(imageBuffer);
    const colors = await extractDominantColors(imageBuffer, 3);

    return {
      quality: {
        isBlurry: blurResult.isBlurry,
        blurScore: blurResult.blurScore,
        hasDescription: false, // Will be set by caller based on alt/title
      },
      colors,
      dimensions: metadata.width && metadata.height 
        ? { width: metadata.width, height: metadata.height }
        : null,
    };
  } catch (error) {
    console.error("Image analysis failed:", error);
    return {
      quality: { isBlurry: false, blurScore: 50, hasDescription: false },
      colors: [],
      dimensions: null,
    };
  }
}
