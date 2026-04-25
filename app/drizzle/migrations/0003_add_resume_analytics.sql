-- 0001 (strategy_note, career_analysis) already applied manually
-- This migration adds the new resume analytics columns
ALTER TABLE generated_documents ADD COLUMN resume_keywords TEXT;
ALTER TABLE analytics_summary ADD COLUMN total_resumes_generated INTEGER;
