CREATE TABLE `analytics_summary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period` text NOT NULL,
	`top_jd_keywords` text,
	`top_resume_keywords` text,
	`top_job_titles` text,
	`top_industries` text,
	`average_match_score` real,
	`total_analyses` integer,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `generated_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_analysis_id` integer,
	`doc_type` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text,
	`created_at` text,
	FOREIGN KEY (`job_analysis_id`) REFERENCES `job_analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_url` text NOT NULL,
	`job_title` text,
	`company` text,
	`industry` text,
	`location` text,
	`jd_text` text,
	`match_score` integer,
	`gap_analysis` text,
	`recommendations` text,
	`pursue` integer,
	`pursue_justification` text,
	`keywords` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `master_resume` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`phone` text,
	`linkedin` text,
	`website` text,
	`summary` text,
	`competencies` text,
	`tools` text,
	`experience` text,
	`education` text,
	`certifications` text,
	`raw_text` text,
	`updated_at` text
);
