CREATE TABLE `crawl_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetUrl` varchar(2048) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`totalPages` int NOT NULL DEFAULT 0,
	`crawledPages` int NOT NULL DEFAULT 0,
	`totalImages` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `crawl_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extracted_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`crawlJobId` int NOT NULL,
	`sourceUrl` varchar(2048) NOT NULL,
	`pageUrl` varchar(2048) NOT NULL,
	`originalUrl` varchar(2048) NOT NULL,
	`s3Url` varchar(2048),
	`s3Key` varchar(512),
	`altText` text,
	`title` text,
	`caption` text,
	`ariaLabel` text,
	`figcaption` text,
	`nearbyText` text,
	`width` int,
	`height` int,
	`fileSize` int,
	`mimeType` varchar(128),
	`labels` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `extracted_images_id` PRIMARY KEY(`id`)
);
