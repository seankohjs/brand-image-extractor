import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getCrawlJob, getImagesByCrawlJob } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve local uploads directory for local storage mode
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1d',
    etag: true,
  }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ZIP download endpoint
  app.get('/api/download/:jobId', async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      if (isNaN(jobId)) {
        return res.status(400).json({ error: 'Invalid job ID' });
      }

      const job = await getCrawlJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const images = await getImagesByCrawlJob(jobId);
      if (images.length === 0) {
        return res.status(404).json({ error: 'No images found for this job' });
      }

      // Set response headers for ZIP download
      const filename = `brand-images-${jobId}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.pipe(res);

      // Add each image to the archive
      const uploadsDir = path.join(process.cwd(), 'uploads');
      for (const img of images) {
        if (img.s3Url) {
          // Extract local path from URL (e.g., /uploads/crawl-1/img.png -> crawl-1/img.png)
          const relativePath = img.s3Url.replace(/^\/uploads\//, '');
          const filePath = path.join(uploadsDir, relativePath);

          if (fs.existsSync(filePath)) {
            const imgFilename = path.basename(filePath);
            archive.file(filePath, { name: imgFilename });
          }
        }
      }

      // Add metadata JSON
      const metadata = {
        jobId,
        url: job.targetUrl,
        crawledAt: job.createdAt,
        brandKit: {
          colors: job.brandColors,
          fonts: job.brandFonts,
          cssColors: job.cssColors,
        },
        images: images.map(img => ({
          filename: img.s3Url ? path.basename(img.s3Url) : null,
          originalUrl: img.originalUrl,
          altText: img.altText,
          width: img.width,
          height: img.height,
          dominantColors: img.dominantColors,
        })),
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      await archive.finalize();
    } catch (error) {
      console.error('ZIP download error:', error);
      res.status(500).json({ error: 'Failed to create ZIP' });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
