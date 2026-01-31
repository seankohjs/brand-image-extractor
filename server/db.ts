import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, crawlJobs, extractedImages, InsertCrawlJob, InsertExtractedImage, CrawlJob, ExtractedImage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Crawl Jobs ============

export async function createCrawlJob(job: InsertCrawlJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(crawlJobs).values(job);
  return result[0].insertId;
}

export async function getCrawlJob(id: number): Promise<CrawlJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(crawlJobs).where(eq(crawlJobs.id, id)).limit(1);
  return result[0];
}

export async function getCrawlJobsByUser(userId: number): Promise<CrawlJob[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(crawlJobs).where(eq(crawlJobs.userId, userId)).orderBy(desc(crawlJobs.createdAt));
}

export async function getAllCrawlJobs(limit: number = 50): Promise<CrawlJob[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt)).limit(limit);
}

export async function updateCrawlJob(
  id: number,
  updates: Partial<Pick<CrawlJob, "status" | "totalPages" | "crawledPages" | "totalImages" | "errorMessage" | "completedAt" | "brandColors" | "brandFonts" | "cssColors" | "cssVariables" | "screenshotUrl">>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(crawlJobs).set(updates).where(eq(crawlJobs.id, id));
}

export async function deleteCrawlJob(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Delete associated images first
  await db.delete(extractedImages).where(eq(extractedImages.crawlJobId, id));
  // Delete the job
  await db.delete(crawlJobs).where(eq(crawlJobs.id, id));
}

// ============ Extracted Images ============

export async function createExtractedImage(image: InsertExtractedImage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(extractedImages).values(image);
  return result[0].insertId;
}

export async function createExtractedImages(images: InsertExtractedImage[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (images.length === 0) return;

  await db.insert(extractedImages).values(images);
}

export async function getImagesByCrawlJob(crawlJobId: number): Promise<ExtractedImage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(extractedImages).where(eq(extractedImages.crawlJobId, crawlJobId));
}

export async function getImageById(id: number): Promise<ExtractedImage | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(extractedImages).where(eq(extractedImages.id, id)).limit(1);
  return result[0];
}

export async function updateImageLabels(id: number, labels: string[]): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(extractedImages).set({ labels }).where(eq(extractedImages.id, id));
}

export async function deleteImagesByCrawlJob(crawlJobId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(extractedImages).where(eq(extractedImages.crawlJobId, crawlJobId));
}
