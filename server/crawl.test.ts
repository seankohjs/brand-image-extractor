import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("crawl.start", () => {
  it("validates URL format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.crawl.start({ url: "not-a-valid-url", maxPages: 5 })
    ).rejects.toThrow();
  });

  it("validates maxPages range", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.crawl.start({ url: "https://example.com", maxPages: 100 })
    ).rejects.toThrow();

    await expect(
      caller.crawl.start({ url: "https://example.com", maxPages: 0 })
    ).rejects.toThrow();
  });
});

describe("crawl.list", () => {
  it("works without authentication (public API)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.crawl.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("crawl.getStatus", () => {
  it("returns NOT_FOUND for non-existent job", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.crawl.getStatus({ jobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("images.getByCrawlJob", () => {
  it("returns NOT_FOUND for non-existent job", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.images.getByCrawlJob({ crawlJobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("images.updateLabels", () => {
  it("works without authentication (public API)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should accept valid labels array and succeed
    const result = await caller.images.updateLabels({ imageId: 999999, labels: ["label1", "label2"] });
    expect(result).toEqual({ success: true });
  });
});
