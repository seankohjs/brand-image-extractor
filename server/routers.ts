import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createCrawlJob,
  getCrawlJob,
  getAllCrawlJobs,
  updateCrawlJob,
  deleteCrawlJob,
  createExtractedImages,
  getImagesByCrawlJob,
  updateImageLabels,
} from "./db";
import {
  crawlWebsite,
  uploadImageToS3,
  getCrawlProgress,
  clearCrawlProgress,
  ImageMetadata,
} from "./crawler";
import { TRPCError } from "@trpc/server";
import { ColorInfo } from "./imageAnalysis";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // PUBLIC API - No Authentication Required
  // ============================================
  api: router({
    /**
     * Extract brand assets from a URL (synchronous)
     * This is the main API endpoint - waits for crawl to complete and returns all data
     * 
     * @param url - The website URL to crawl
     * @param maxPages - Maximum pages to crawl (1-50, default: 10)
     * @param downloadImages - Whether to download and store images (default: true)
     * @param filterBlurry - Exclude blurry images from results (default: true)
     * @param filterNoDescription - Only include images with descriptions (default: false)
     */
    extract: publicProcedure
      .input(z.object({
        url: z.string().url("Please enter a valid URL"),
        maxPages: z.number().min(1).max(50).default(10),
        downloadImages: z.boolean().default(true),
        filterBlurry: z.boolean().default(true),
        filterNoDescription: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const startTime = Date.now();
        
        // Create job record (userId 0 for API calls)
        const jobId = await createCrawlJob({
          userId: 0,
          targetUrl: input.url,
          status: "running",
        });

        try {
          // Run the crawl synchronously
          const result = await crawlWebsite(input.url, jobId, input.maxPages);

          // Process images
          const processedImages: Array<{
            originalUrl: string;
            storedUrl: string | null;
            pageUrl: string;
            altText: string | null;
            title: string | null;
            figcaption: string | null;
            labels: string[];
            width: number | null;
            height: number | null;
            fileSize: number | null;
            mimeType: string | null;
            isBlurry: boolean;
            blurScore: number;
            hasDescription: boolean;
            dominantColors: ColorInfo[];
          }> = [];

          for (const img of result.images) {
            // Apply filters
            if (input.filterBlurry && img.isBlurry) continue;
            if (input.filterNoDescription && !img.hasDescription) continue;
            // Skip images with specific alt text patterns
            if (img.altText?.toLowerCase().includes('gold-fan-blades')) continue;

            let storedUrl: string | null = null;
            let fileSize: number | null = null;
            let mimeType: string | null = null;
            let finalBlurry = img.isBlurry;
            let finalBlurScore = img.blurScore;
            let finalColors = img.dominantColors;

            // Download and store image if requested
            if (input.downloadImages) {
              const s3Result = await uploadImageToS3(img.originalUrl, jobId);
              if (s3Result) {
                storedUrl = s3Result.s3Url;
                fileSize = s3Result.fileSize;
                mimeType = s3Result.mimeType;
                finalBlurry = s3Result.isBlurry;
                finalBlurScore = s3Result.blurScore;
                finalColors = s3Result.dominantColors;
              }
            }

            // Re-apply blur filter after actual analysis
            if (input.filterBlurry && finalBlurry) continue;

            processedImages.push({
              originalUrl: img.originalUrl,
              storedUrl,
              pageUrl: img.pageUrl,
              altText: img.altText,
              title: img.title,
              figcaption: img.figcaption,
              labels: img.labels,
              width: img.width,
              height: img.height,
              fileSize,
              mimeType,
              isBlurry: finalBlurry,
              blurScore: finalBlurScore,
              hasDescription: img.hasDescription,
              dominantColors: finalColors,
            });
          }

          // Update job as completed
          await updateCrawlJob(jobId, {
            status: "completed",
            totalPages: result.pagesVisited.length,
            crawledPages: result.pagesVisited.length,
            totalImages: processedImages.length,
            completedAt: new Date(),
            brandColors: result.brandKit.colors,
            brandFonts: result.brandKit.fonts,
            cssColors: result.brandKit.cssColors,
            cssVariables: result.brandKit.cssVariables,
            screenshotUrl: result.brandKit.screenshotUrl,
          });

          clearCrawlProgress(jobId);

          const duration = Date.now() - startTime;

          return {
            success: true,
            jobId,
            url: input.url,
            duration: `${(duration / 1000).toFixed(1)}s`,
            stats: {
              pagesVisited: result.pagesVisited.length,
              imagesFound: result.images.length,
              imagesReturned: processedImages.length,
            },
            brandKit: {
              colors: result.brandKit.colors,
              fonts: result.brandKit.fonts,
              cssColors: result.brandKit.cssColors,
              screenshotUrl: result.brandKit.screenshotUrl,
            },
            images: processedImages,
            errors: result.errors,
          };
        } catch (error) {
          await updateCrawlJob(jobId, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          });
          clearCrawlProgress(jobId);

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Crawl failed",
          });
        }
      }),

    /**
     * Start an async crawl job (returns immediately with job ID)
     */
    startCrawl: publicProcedure
      .input(z.object({
        url: z.string().url("Please enter a valid URL"),
        maxPages: z.number().min(1).max(50).default(20),
      }))
      .mutation(async ({ input }) => {
        const jobId = await createCrawlJob({
          userId: 0,
          targetUrl: input.url,
          status: "pending",
        });

        // Start crawling in background
        (async () => {
          try {
            await updateCrawlJob(jobId, { status: "running" });
            const result = await crawlWebsite(input.url, jobId, input.maxPages);

            const imagesToInsert = [];
            for (const img of result.images) {
              // Skip images with specific alt text patterns
              if (img.altText?.toLowerCase().includes('gold-fan-blades')) continue;
              const s3Result = await uploadImageToS3(img.originalUrl, jobId);
              imagesToInsert.push({
                crawlJobId: jobId,
                sourceUrl: input.url,
                pageUrl: img.pageUrl,
                originalUrl: img.originalUrl,
                s3Url: s3Result?.s3Url || null,
                s3Key: s3Result?.s3Key || null,
                altText: img.altText,
                title: img.title,
                caption: img.caption,
                ariaLabel: img.ariaLabel,
                figcaption: img.figcaption,
                nearbyText: img.nearbyText,
                width: img.width,
                height: img.height,
                fileSize: s3Result?.fileSize || null,
                mimeType: s3Result?.mimeType || null,
                labels: img.labels,
                isBlurry: s3Result?.isBlurry ?? img.isBlurry,
                blurScore: s3Result?.blurScore ?? img.blurScore,
                hasDescription: img.hasDescription,
                dominantColors: s3Result?.dominantColors ?? img.dominantColors,
              });
            }

            if (imagesToInsert.length > 0) {
              await createExtractedImages(imagesToInsert);
            }

            await updateCrawlJob(jobId, {
              status: "completed",
              totalPages: result.pagesVisited.length,
              crawledPages: result.pagesVisited.length,
              totalImages: imagesToInsert.length,
              completedAt: new Date(),
              errorMessage: result.errors.length > 0 ? result.errors.join("\n") : null,
              brandColors: result.brandKit.colors,
              brandFonts: result.brandKit.fonts,
              cssColors: result.brandKit.cssColors,
              cssVariables: result.brandKit.cssVariables,
              screenshotUrl: result.brandKit.screenshotUrl,
            });
          } catch (error) {
            await updateCrawlJob(jobId, {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            });
          } finally {
            clearCrawlProgress(jobId);
          }
        })();

        return { jobId, status: "started" };
      }),

    /**
     * Get job status and results
     */
    getJob: publicProcedure
      .input(z.object({ 
        jobId: z.number(),
        filterBlurry: z.boolean().default(false),
        filterNoDescription: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        const job = await getCrawlJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }

        const progress = getCrawlProgress(input.jobId);

        // If job is completed, include images
        let images: any[] = [];
        if (job.status === "completed") {
          let allImages = await getImagesByCrawlJob(input.jobId);
          
          if (input.filterBlurry) {
            allImages = allImages.filter(img => !img.isBlurry);
          }
          if (input.filterNoDescription) {
            allImages = allImages.filter(img => img.hasDescription);
          }

          images = allImages.map(img => ({
            id: img.id,
            originalUrl: img.originalUrl,
            storedUrl: img.s3Url,
            pageUrl: img.pageUrl,
            altText: img.altText,
            title: img.title,
            figcaption: img.figcaption,
            labels: img.labels,
            width: img.width,
            height: img.height,
            fileSize: img.fileSize,
            mimeType: img.mimeType,
            isBlurry: img.isBlurry,
            blurScore: img.blurScore,
            hasDescription: img.hasDescription,
            dominantColors: img.dominantColors,
          }));
        }

        return {
          jobId: job.id,
          url: job.targetUrl,
          status: job.status,
          progress: progress ? {
            currentPage: progress.currentPage,
            crawledPages: progress.crawledPages,
            totalPages: progress.totalPages,
            imagesFound: progress.totalImages,
          } : null,
          stats: job.status === "completed" ? {
            pagesVisited: job.crawledPages,
            totalImages: job.totalImages,
            imagesReturned: images.length,
          } : null,
          brandKit: job.status === "completed" ? {
            colors: job.brandColors,
            fonts: job.brandFonts,
            cssColors: job.cssColors,
            screenshotUrl: job.screenshotUrl,
          } : null,
          images,
          error: job.errorMessage,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        };
      }),

    /**
     * List recent jobs
     */
    listJobs: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const jobs = await getAllCrawlJobs(input.limit);
        return jobs.map(job => ({
          jobId: job.id,
          url: job.targetUrl,
          status: job.status,
          pagesVisited: job.crawledPages,
          totalImages: job.totalImages,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        }));
      }),

    /**
     * Delete a job and its data
     */
    deleteJob: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const job = await getCrawlJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }
        await deleteCrawlJob(input.jobId);
        return { success: true };
      }),
  }),

  // Keep legacy endpoints for UI compatibility (now public)
  crawl: router({
    start: publicProcedure
      .input(z.object({
        url: z.string().url("Please enter a valid URL"),
        maxPages: z.number().min(1).max(50).default(20),
      }))
      .mutation(async ({ input }) => {
        const jobId = await createCrawlJob({
          userId: 0,
          targetUrl: input.url,
          status: "pending",
        });

        (async () => {
          try {
            await updateCrawlJob(jobId, { status: "running" });
            const result = await crawlWebsite(input.url, jobId, input.maxPages);

            const imagesToInsert = [];
            for (const img of result.images) {
              // Skip images with specific alt text patterns
              if (img.altText?.toLowerCase().includes('gold-fan-blades')) continue;
              const s3Result = await uploadImageToS3(img.originalUrl, jobId);
              imagesToInsert.push({
                crawlJobId: jobId,
                sourceUrl: input.url,
                pageUrl: img.pageUrl,
                originalUrl: img.originalUrl,
                s3Url: s3Result?.s3Url || null,
                s3Key: s3Result?.s3Key || null,
                altText: img.altText,
                title: img.title,
                caption: img.caption,
                ariaLabel: img.ariaLabel,
                figcaption: img.figcaption,
                nearbyText: img.nearbyText,
                width: img.width,
                height: img.height,
                fileSize: s3Result?.fileSize || null,
                mimeType: s3Result?.mimeType || null,
                labels: img.labels,
                isBlurry: s3Result?.isBlurry ?? img.isBlurry,
                blurScore: s3Result?.blurScore ?? img.blurScore,
                hasDescription: img.hasDescription,
                dominantColors: s3Result?.dominantColors ?? img.dominantColors,
              });
            }

            if (imagesToInsert.length > 0) {
              await createExtractedImages(imagesToInsert);
            }

            await updateCrawlJob(jobId, {
              status: "completed",
              totalPages: result.pagesVisited.length,
              crawledPages: result.pagesVisited.length,
              totalImages: imagesToInsert.length,
              completedAt: new Date(),
              errorMessage: result.errors.length > 0 ? result.errors.join("\n") : null,
              brandColors: result.brandKit.colors,
              brandFonts: result.brandKit.fonts,
              cssColors: result.brandKit.cssColors,
              cssVariables: result.brandKit.cssVariables,
              screenshotUrl: result.brandKit.screenshotUrl,
            });
          } catch (error) {
            await updateCrawlJob(jobId, {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            });
          } finally {
            clearCrawlProgress(jobId);
          }
        })();

        return { jobId };
      }),

    getStatus: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const job = await getCrawlJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }
        const progress = getCrawlProgress(input.jobId);
        return { ...job, progress: progress || null };
      }),

    list: publicProcedure.query(async () => {
      return getAllCrawlJobs(50);
    }),

    delete: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const job = await getCrawlJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }
        await deleteCrawlJob(input.jobId);
        return { success: true };
      }),
  }),

  images: router({
    getByCrawlJob: publicProcedure
      .input(z.object({ 
        crawlJobId: z.number(),
        filterBlurry: z.boolean().optional().default(false),
        filterNoDescription: z.boolean().optional().default(false),
      }))
      .query(async ({ input }) => {
        const job = await getCrawlJob(input.crawlJobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }

        let images = await getImagesByCrawlJob(input.crawlJobId);
        
        if (input.filterBlurry) {
          images = images.filter(img => !img.isBlurry);
        }
        if (input.filterNoDescription) {
          images = images.filter(img => img.hasDescription);
        }

        return images;
      }),

    updateLabels: publicProcedure
      .input(z.object({
        imageId: z.number(),
        labels: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        await updateImageLabels(input.imageId, input.labels);
        return { success: true };
      }),

    getDownloadData: publicProcedure
      .input(z.object({ crawlJobId: z.number() }))
      .query(async ({ input }) => {
        const job = await getCrawlJob(input.crawlJobId);
        if (!job) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        }

        const images = await getImagesByCrawlJob(input.crawlJobId);
        
        return {
          job,
          images: images.map(img => ({
            id: img.id,
            originalUrl: img.originalUrl,
            s3Url: img.s3Url,
            altText: img.altText,
            title: img.title,
            labels: img.labels,
            width: img.width,
            height: img.height,
            mimeType: img.mimeType,
            isBlurry: img.isBlurry,
            blurScore: img.blurScore,
            hasDescription: img.hasDescription,
            dominantColors: img.dominantColors,
          })),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
