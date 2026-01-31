import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Crawl jobs table - tracks each URL crawl request
 */
export const crawlJobs = mysqlTable("crawl_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetUrl: varchar("targetUrl", { length: 2048 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  totalPages: int("totalPages").default(0).notNull(),
  crawledPages: int("crawledPages").default(0).notNull(),
  totalImages: int("totalImages").default(0).notNull(),
  errorMessage: text("errorMessage"),
  // Brand kit data
  brandColors: json("brandColors").$type<Array<{ hex: string; rgb: { r: number; g: number; b: number }; percentage: number }>>(),
  brandFonts: json("brandFonts").$type<Array<{ family: string; weights: string[]; usage: string; count: number }>>(),
  cssColors: json("cssColors").$type<string[]>(),
  cssVariables: json("cssVariables").$type<Record<string, string>>(),
  screenshotUrl: varchar("screenshotUrl", { length: 2048 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CrawlJob = typeof crawlJobs.$inferSelect;
export type InsertCrawlJob = typeof crawlJobs.$inferInsert;

/**
 * Extracted images table - stores metadata for each extracted image
 */
export const extractedImages = mysqlTable("extracted_images", {
  id: int("id").autoincrement().primaryKey(),
  crawlJobId: int("crawlJobId").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
  pageUrl: varchar("pageUrl", { length: 2048 }).notNull(),
  originalUrl: varchar("originalUrl", { length: 2048 }).notNull(),
  s3Url: varchar("s3Url", { length: 2048 }),
  s3Key: varchar("s3Key", { length: 512 }),
  altText: text("altText"),
  title: text("title"),
  caption: text("caption"),
  ariaLabel: text("ariaLabel"),
  figcaption: text("figcaption"),
  nearbyText: text("nearbyText"),
  width: int("width"),
  height: int("height"),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  labels: json("labels").$type<string[]>(),
  // Image quality fields
  isBlurry: boolean("isBlurry").default(false),
  blurScore: int("blurScore"),
  hasDescription: boolean("hasDescription").default(false),
  dominantColors: json("dominantColors").$type<Array<{ hex: string; rgb: { r: number; g: number; b: number }; percentage: number }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExtractedImage = typeof extractedImages.$inferSelect;
export type InsertExtractedImage = typeof extractedImages.$inferInsert;
