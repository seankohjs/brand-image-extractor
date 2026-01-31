ALTER TABLE `crawl_jobs` ADD `brandColors` json;--> statement-breakpoint
ALTER TABLE `crawl_jobs` ADD `brandFonts` json;--> statement-breakpoint
ALTER TABLE `crawl_jobs` ADD `cssColors` json;--> statement-breakpoint
ALTER TABLE `crawl_jobs` ADD `cssVariables` json;--> statement-breakpoint
ALTER TABLE `crawl_jobs` ADD `screenshotUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `extracted_images` ADD `isBlurry` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `extracted_images` ADD `blurScore` int;--> statement-breakpoint
ALTER TABLE `extracted_images` ADD `hasDescription` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `extracted_images` ADD `dominantColors` json;