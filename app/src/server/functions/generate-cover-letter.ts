import { createServerFn } from "@tanstack/react-start";
import { resolveSessionUser } from "@/lib/resolve-user";
import { eq, and } from "drizzle-orm";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { masterResume, jobAnalyses, generatedDocuments } from "@/db/schema";
import {
  allocateTokenBudgets,
  callClaude,
  truncateToTokenBudget,
  WORKERS_AI_CONTEXT_WINDOW_TOKENS,
} from "@/lib/ai-gateway";
import { COVER_LETTER_PROMPT, type CoverLetterContent } from "@/lib/ats-format";
import { generateCoverLetterPdf } from "@/lib/pdf";

const COVER_LETTER_OUTPUT_TOKEN_BUDGET = 3_072;
const COVER_LETTER_PROMPT_OVERHEAD_TOKENS = 3_500;
const COVER_LETTER_CONTEXT_TOKEN_BUDGET = Math.min(
  24_000,
  WORKERS_AI_CONTEXT_WINDOW_TOKENS - COVER_LETTER_OUTPUT_TOKEN_BUDGET - COVER_LETTER_PROMPT_OVERHEAD_TOKENS,
);
const COVER_LETTER_MIN_SECTION_TOKENS = 2_500;

/**
 * Generate an enhanced cover letter using the Executive Resume Strategist framework.
 * Connects 3 specific achievements to pain points identified in the JD.
 * Signed by 'Roger Cormier'.
 */
export const generateCoverLetter = createServerFn({ method: "POST" })
  .inputValidator((data: { analysisId: number; extraGuidance?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB || !env.R2) {
        throw new Error("Database and R2 storage not available in development mode. Deploy to Cloudflare Workers.");
      }

      const db = getDb(env.DB);
      const user = await resolveSessionUser();
      if (!user) throw new Error("Not authenticated");

      // Load the job analysis
      const [analysis] = await db
        .select()
        .from(jobAnalyses)
        .where(and(eq(jobAnalyses.id, data.analysisId), eq(jobAnalyses.userId, user.id)))
        .limit(1);
      if (!analysis) throw new Error("Analysis not found");

      // Load master resume
      const [resume] = await db.select().from(masterResume).where(eq(masterResume.userId, user.id)).limit(1);
      if (!resume) throw new Error("No master resume found");

      // Format candidate data
      const candidateData = JSON.stringify({
        fullName: resume.fullName,
        email: resume.email,
        phone: resume.phone,
        linkedin: resume.linkedin,
        website: resume.website,
        summary: resume.summary,
        competencies: resume.competencies ? JSON.parse(resume.competencies) : [],
        tools: resume.tools ? JSON.parse(resume.tools) : [],
        experience: resume.experience ? JSON.parse(resume.experience) : [],
        education: resume.education ? JSON.parse(resume.education) : [],
        certifications: resume.certifications ? JSON.parse(resume.certifications) : [],
      }, null, 2);

      // Include raw resume text for mining real achievements
      const rawResumeText = resume.rawText ?? "";
      const [jobDescriptionBudget, rawResumeBudget] = allocateTokenBudgets(
        [analysis.jdText ?? "", rawResumeText],
        COVER_LETTER_CONTEXT_TOKEN_BUDGET,
        COVER_LETTER_MIN_SECTION_TOKENS,
      );
      const jobDescription = truncateToTokenBudget(analysis.jdText ?? "", jobDescriptionBudget, {
        marker: "\n...[job description truncated for cover letter budget]...\n",
        preserveHeadRatio: 0.7,
      });
      const rawResumeSource = truncateToTokenBudget(rawResumeText, rawResumeBudget, {
        marker: "\n...[resume text truncated for cover letter budget]...\n",
        preserveHeadRatio: 0.65,
      });

      // Extract "pain points" from gap analysis and recommendations
      const painPoints = [
        ...(analysis.gapAnalysis ? JSON.parse(analysis.gapAnalysis) : []),
        ...(analysis.recommendations ? JSON.parse(analysis.recommendations) : []),
      ].slice(0, 3).join(" | ");

      const extraGuidance = (data.extraGuidance ?? "").trim();

      // Build the enhanced prompt
      const prompt = COVER_LETTER_PROMPT
        .replace("{candidateData}", candidateData)
        .replace("{rawResumeText}", rawResumeSource)
        .replace("{jobTitle}", analysis.jobTitle ?? "")
        .replace("{company}", analysis.company ?? "")
        .replace("{jobDescription}", jobDescription)
        .replace("{painPoints}", painPoints || "Improve operational efficiency and team performance")
        .replace("{extraGuidance}", extraGuidance || "None provided");

      const rawResponse = await callClaude(env, [
        {
          role: "system",
          content: "You are an expert cover letter writer. You produce professional, compelling cover letters as valid JSON only. You connect the candidate's REAL achievements from their resume to the target job's requirements. Never fabricate or generalize — use specific details from the candidate's actual experience.",
        },
        { role: "user", content: prompt },
      ], { maxTokens: COVER_LETTER_OUTPUT_TOKEN_BUDGET });

      // Parse the JSON response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse cover letter content");
      }
      const letterContent: CoverLetterContent = JSON.parse(jsonMatch[0]);

      // Ensure candidate name signature (not hardcoded)
      letterContent.candidateName = resume.fullName;
      if (!letterContent.signoff || letterContent.signoff.length < 2) {
        letterContent.signoff = resume.fullName;
      }

      // Build contact info line matching resume header
      const contactParts = [
        resume.email,
        resume.phone,
        resume.linkedin,
        resume.website,
      ].filter(Boolean);
      const contactInfo = contactParts.join(" | ");

      // Generate PDF with header
      const pdfBytes = await generateCoverLetterPdf({
        ...letterContent,
        nameHeader: resume.fullName,
        contactInfo,
      });

      // Upload to R2
      const timestamp = Date.now();
      const r2Key = `documents/${data.analysisId}/cover_letter_${timestamp}.pdf`;
      const fileName = `CoverLetter_${(analysis.company ?? "Company").replace(/\s+/g, "_")}_${(analysis.jobTitle ?? "Position").replace(/\s+/g, "_")}.pdf`;

      await env.R2.put(r2Key, pdfBytes, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: { fileName },
      });

      const now = new Date().toISOString();
      const [doc] = await db
        .insert(generatedDocuments)
        .values({
          jobAnalysisId: data.analysisId,
          docType: "cover_letter",
          r2Key,
          fileName,
          createdAt: now,
        })
        .returning();

      return { documentId: doc.id, fileName, r2Key };
    } catch (error) {
      console.error("generateCoverLetter error:", error);
      throw error;
    }
  });
