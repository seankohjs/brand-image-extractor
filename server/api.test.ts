import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("api.extract", () => {
  it("validates URL input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.api.extract({ url: "not-a-valid-url", maxPages: 5 })
    ).rejects.toThrow();
  });

  it("validates maxPages range", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // maxPages too high
    await expect(
      caller.api.extract({ url: "https://example.com", maxPages: 100 })
    ).rejects.toThrow();

    // maxPages too low
    await expect(
      caller.api.extract({ url: "https://example.com", maxPages: 0 })
    ).rejects.toThrow();
  });
});

describe("api.startCrawl", () => {
  it("validates URL input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.api.startCrawl({ url: "invalid-url" })
    ).rejects.toThrow();
  });
});

describe("api.getJob", () => {
  it("returns NOT_FOUND for non-existent job", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.api.getJob({ jobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("api.listJobs", () => {
  it("accepts limit parameter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw with valid limit
    const result = await caller.api.listJobs({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates limit range", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Limit too high
    await expect(
      caller.api.listJobs({ limit: 200 })
    ).rejects.toThrow();

    // Limit too low
    await expect(
      caller.api.listJobs({ limit: 0 })
    ).rejects.toThrow();
  });
});

describe("api.deleteJob", () => {
  it("returns NOT_FOUND for non-existent job", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.api.deleteJob({ jobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("crawl endpoints (public)", () => {
  it("crawl.list works without authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.crawl.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("crawl.getStatus returns NOT_FOUND for non-existent job", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.crawl.getStatus({ jobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("images endpoints (public)", () => {
  it("images.getByCrawlJob returns NOT_FOUND for non-existent job", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.images.getByCrawlJob({ crawlJobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});
