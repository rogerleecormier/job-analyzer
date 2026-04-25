
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Users Table ─────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "admin" | "user"
  createdAt: text("created_at").notNull(),
});

// ─── Master Resume ───────────────────────────────────────────────
export const masterResume = sqliteTable("master_resume", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  website: text("website"),
  summary: text("summary"),
  competencies: text("competencies"), // JSON array of strings
  tools: text("tools"), // JSON array of strings
  experience: text("experience"), // JSON array of experience objects
  education: text("education"), // JSON array of education objects
  certifications: text("certifications"), // JSON array of strings
  rawText: text("raw_text"),
  updatedAt: text("updated_at"),
});

// ─── Job Analyses ────────────────────────────────────────────────
export const jobAnalyses = sqliteTable("job_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  jobUrl: text("job_url").notNull(),
  jobTitle: text("job_title"),
  company: text("company"),
  industry: text("industry"),
  location: text("location"),
  jdText: text("jd_text"),
  matchScore: integer("match_score"),
  gapAnalysis: text("gap_analysis"), // JSON
  recommendations: text("recommendations"), // JSON
  pursue: integer("pursue"), // 1 = Pursue, 0 = Do Not Pursue
  pursueJustification: text("pursue_justification"),
  keywords: text("keywords"), // JSON array
  strategyNote: text("strategy_note"),
  personalInterest: text("personal_interest"), // 1-3 sentence "why this role/company interests me"
  careerAnalysis: text("career_analysis"), // JSON: { trajectory, recommendation, reasoning }
  applied: integer("applied").default(0), // 1 = applied, 0 = not applied
  appliedAt: text("applied_at"),
  createdAt: text("created_at"),
});

// ─── Generated Documents ─────────────────────────────────────────
export const generatedDocuments = sqliteTable("generated_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobAnalysisId: integer("job_analysis_id").references(() => jobAnalyses.id),
  docType: text("doc_type").notNull(), // "resume" | "cover_letter"
  r2Key: text("r2_key").notNull(),
  fileName: text("file_name"),
  resumeKeywords: text("resume_keywords"), // JSON array of keywords extracted from generated resume
  createdAt: text("created_at"),
});

// ─── Analytics Summary (populated by Cron only) ──────────────────
export const analyticsSummary = sqliteTable("analytics_summary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  period: text("period").notNull(), // "all_time", "2026-03", etc.
  topJdKeywords: text("top_jd_keywords"), // JSON
  topResumeKeywords: text("top_resume_keywords"), // JSON
  topJobTitles: text("top_job_titles"), // JSON
  topIndustries: text("top_industries"), // JSON
  averageMatchScore: real("average_match_score"),
  totalAnalyses: integer("total_analyses"),
  totalResumesGenerated: integer("total_resumes_generated"),
  totalApplied: integer("total_applied").default(0),
  updatedAt: text("updated_at"),
});
