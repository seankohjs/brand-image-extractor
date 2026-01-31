import { describe, expect, it } from "vitest";
import { getStorageMode, getUploadsDir } from "./storageUnified";
import * as path from "path";

describe("storageUnified", () => {
  it("returns valid storage mode", () => {
    const mode = getStorageMode();
    expect(["local", "s3"]).toContain(mode);
  });

  it("returns valid uploads directory path", () => {
    const uploadsDir = getUploadsDir();
    expect(uploadsDir).toBeTruthy();
    expect(path.isAbsolute(uploadsDir)).toBe(true);
    expect(uploadsDir).toContain("uploads");
  });

  it("defaults to s3 mode when STORAGE_MODE is not set", () => {
    // In the test environment, STORAGE_MODE is not explicitly set
    // so it should default to 's3'
    const mode = getStorageMode();
    expect(mode).toBe("s3");
  });
});
