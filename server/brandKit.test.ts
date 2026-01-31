import { describe, expect, it } from "vitest";
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("images.getByCrawlJob with filters", () => {
  it("works without authentication (public API)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should work but throw NOT_FOUND for non-existent job
    await expect(
      caller.images.getByCrawlJob({ crawlJobId: 999999, filterBlurry: true, filterNoDescription: false })
    ).rejects.toThrow("Job not found");
  });

  it("accepts filter parameters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // This should not throw a validation error for the filter params
    await expect(
      caller.images.getByCrawlJob({ crawlJobId: 999999, filterBlurry: true, filterNoDescription: true })
    ).rejects.toThrow("Job not found");
  });

  it("defaults filter parameters to false", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Without filter params, should still work
    await expect(
      caller.images.getByCrawlJob({ crawlJobId: 999999 })
    ).rejects.toThrow("Job not found");
  });
});

describe("crawl.getStatus with brand kit", () => {
  it("works without authentication (public API)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should work but throw NOT_FOUND for non-existent job
    await expect(
      caller.crawl.getStatus({ jobId: 999999 })
    ).rejects.toThrow("Job not found");
  });

  it("returns NOT_FOUND for non-existent job", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.crawl.getStatus({ jobId: 99999 })
    ).rejects.toThrow("Job not found");
  });
});
