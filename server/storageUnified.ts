/**
 * Unified Storage Module
 * Supports both S3 (via Manus proxy) and local file storage
 * 
 * Set STORAGE_MODE=local in .env to use local storage
 * Default is S3 when running in Manus environment
 */

import { ENV } from './_core/env';
import * as fs from 'fs';
import * as path from 'path';

// Storage mode: 's3' or 'local'
const STORAGE_MODE = process.env.STORAGE_MODE || 's3';

// Local storage directory (relative to project root)
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Base URL for serving local files (set this to your server URL)
const LOCAL_BASE_URL = process.env.LOCAL_STORAGE_URL || 'http://localhost:3000/uploads';

/**
 * Ensure the uploads directory exists
 */
function ensureUploadsDir(subDir?: string): string {
  const dir = subDir ? path.join(LOCAL_UPLOADS_DIR, subDir) : LOCAL_UPLOADS_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * S3 Storage Implementation (via Manus proxy)
 */
type StorageConfig = { baseUrl: string; apiKey: string };

function getS3Config(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "S3 storage credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY, or use STORAGE_MODE=local"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getS3Config();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `S3 upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

/**
 * Local Storage Implementation
 */
async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  
  // Extract directory from key (e.g., "crawl-123/image.jpg" -> "crawl-123")
  const keyParts = key.split('/');
  const fileName = keyParts.pop() || key;
  const subDir = keyParts.join('/');
  
  // Ensure directory exists
  const dir = ensureUploadsDir(subDir);
  const filePath = path.join(dir, fileName);
  
  // Convert data to Buffer if needed
  let buffer: Buffer;
  if (typeof data === 'string') {
    buffer = Buffer.from(data);
  } else if (data instanceof Uint8Array) {
    buffer = Buffer.from(data);
  } else {
    buffer = data;
  }
  
  // Write file
  fs.writeFileSync(filePath, buffer);
  
  // Generate URL
  const url = `${LOCAL_BASE_URL}/${key}`;
  
  return { key, url };
}

/**
 * Unified Storage Put - automatically uses S3 or local based on STORAGE_MODE
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (STORAGE_MODE === 'local') {
    return localPut(relKey, data, contentType);
  }
  return s3Put(relKey, data, contentType);
}

/**
 * Unified Storage Get - returns URL for accessing the file
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  
  if (STORAGE_MODE === 'local') {
    const url = `${LOCAL_BASE_URL}/${key}`;
    return { key, url };
  }
  
  // For S3, get presigned download URL
  const { baseUrl, apiKey } = getS3Config();
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  const url = (await response.json()).url;
  return { key, url };
}

/**
 * Get the current storage mode
 */
export function getStorageMode(): 'local' | 's3' {
  return STORAGE_MODE as 'local' | 's3';
}

/**
 * Get the local uploads directory path
 */
export function getUploadsDir(): string {
  return LOCAL_UPLOADS_DIR;
}
