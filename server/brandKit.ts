import { Page } from "playwright";
import { ColorInfo, extractColorsFromScreenshot } from "./imageAnalysis";

export interface FontInfo {
  family: string;
  weights: string[];
  usage: "heading" | "body" | "other";
  count: number;
}

export interface BrandKit {
  colors: ColorInfo[];
  fonts: FontInfo[];
  cssColors: string[];
  cssVariables: Record<string, string>;
  screenshotUrl?: string;
}

/**
 * Extract brand kit information from a page
 */
export async function extractBrandKit(page: Page): Promise<Omit<BrandKit, "colors" | "screenshotUrl">> {
  const brandData = await page.evaluate(() => {
    const fonts = new Map<string, { weights: Set<string>; usage: "heading" | "body" | "other"; count: number }>();
    const cssColors = new Set<string>();
    const cssVariables: Record<string, string> = {};

    // Extract CSS variables from :root
    const rootStyles = getComputedStyle(document.documentElement);
    const styleSheets = document.styleSheets;
    
    try {
      for (const sheet of Array.from(styleSheets)) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (const rule of Array.from(rules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
              const style = rule.style;
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                if (prop.startsWith("--")) {
                  const value = style.getPropertyValue(prop).trim();
                  if (value) {
                    cssVariables[prop] = value;
                    // Check if it's a color value
                    if (value.match(/^#[0-9a-f]{3,8}$/i) || 
                        value.match(/^rgb/i) || 
                        value.match(/^hsl/i) ||
                        value.match(/^oklch/i)) {
                      cssColors.add(value);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheets will throw
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Extract fonts from elements
    const allElements = document.querySelectorAll("*");
    const headingTags = ["H1", "H2", "H3", "H4", "H5", "H6"];
    const bodyTags = ["P", "SPAN", "DIV", "LI", "TD", "TH", "A"];

    allElements.forEach((el) => {
      const style = getComputedStyle(el);
      const fontFamily = style.fontFamily.split(",")[0].trim().replace(/['"]/g, "");
      const fontWeight = style.fontWeight;
      
      if (fontFamily && fontFamily !== "inherit" && fontFamily !== "initial") {
        let usage: "heading" | "body" | "other" = "other";
        if (headingTags.includes(el.tagName)) {
          usage = "heading";
        } else if (bodyTags.includes(el.tagName)) {
          usage = "body";
        }

        if (!fonts.has(fontFamily)) {
          fonts.set(fontFamily, { weights: new Set(), usage, count: 0 });
        }
        const fontData = fonts.get(fontFamily)!;
        fontData.weights.add(fontWeight);
        fontData.count++;
        // Prioritize heading/body over other
        if (usage === "heading" || (usage === "body" && fontData.usage === "other")) {
          fontData.usage = usage;
        }
      }

      // Extract colors from styles
      const colorProps = ["color", "backgroundColor", "borderColor"];
      colorProps.forEach((prop) => {
        const value = style.getPropertyValue(prop);
        if (value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)") {
          // Convert to hex if possible
          if (value.startsWith("rgb")) {
            const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
              const hex = "#" + [match[1], match[2], match[3]]
                .map(x => parseInt(x).toString(16).padStart(2, "0"))
                .join("");
              cssColors.add(hex);
            }
          } else if (value.startsWith("#")) {
            cssColors.add(value);
          }
        }
      });
    });

    // Convert fonts map to array
    const fontsArray = Array.from(fonts.entries())
      .map(([family, data]) => ({
        family,
        weights: Array.from(data.weights),
        usage: data.usage,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 fonts

    // Get unique colors, sorted by frequency (approximated by order of discovery)
    const colorsArray = Array.from(cssColors).slice(0, 20);

    return {
      fonts: fontsArray,
      cssColors: colorsArray,
      cssVariables,
    };
  });

  return brandData;
}

/**
 * Take a full-page screenshot and extract dominant colors
 */
export async function captureAndAnalyzeScreenshot(page: Page): Promise<{
  screenshotBuffer: Buffer;
  colors: ColorInfo[];
}> {
  // Take full page screenshot
  const screenshotBuffer = await page.screenshot({
    fullPage: false, // Just viewport for color analysis
    type: "png",
  });

  // Extract colors from screenshot
  const colors = await extractColorsFromScreenshot(screenshotBuffer);

  return {
    screenshotBuffer,
    colors,
  };
}

/**
 * Merge color palettes from multiple sources
 */
export function mergeColorPalettes(palettes: ColorInfo[][]): ColorInfo[] {
  const colorMap = new Map<string, ColorInfo>();

  for (const palette of palettes) {
    for (const color of palette) {
      const existing = colorMap.get(color.hex);
      if (existing) {
        existing.percentage = Math.max(existing.percentage, color.percentage);
      } else {
        colorMap.set(color.hex, { ...color });
      }
    }
  }

  return Array.from(colorMap.values())
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10);
}
