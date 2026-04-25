import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { masterResume, jobAnalyses } from "@/db/schema";
import { callClaude } from "@/lib/ai-gateway";
import { STRATEGIC_ASSESSMENT_PROMPT, type StrategicAssessment } from "@/lib/ats-format";
import { resolveSessionUser } from "@/lib/resolve-user";

/**
 * Perform a Pre-Writing Match Assessment using the Executive Resume Strategist framework.
 * Returns: Match Score, Gap Analysis, Strategy Note, and Career Analysis
 * Does NOT generate resume/cover letter yet — just the assessment.
 */
export const performStrategicAssessment = createServerFn({ method: "POST" })
  .inputValidator((data: { analysisId: number }) => data)
  .handler(async ({ data }): Promise<StrategicAssessment> => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB) {
        throw new Error("Database not available in development mode.");
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

      // Format job data
      const jobDescription = JSON.stringify({
        title: analysis.jobTitle,
        company: analysis.company,
        description: analysis.jdText,
        keywords: analysis.keywords ? JSON.parse(analysis.keywords) : [],
      }, null, 2);

      // Build the assessment prompt
      const prompt = STRATEGIC_ASSESSMENT_PROMPT
        .replace("{candidateData}", candidateData)
        .replace("{jobDescription}", jobDescription);

      const rawResponse = await callClaude(env, [
        { role: "user", content: prompt },
      ]);

      // Parse the JSON response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse strategic assessment response");
      }

      const assessment: StrategicAssessment = JSON.parse(jsonMatch[0]);

      return assessment;
    } catch (error) {
      console.error("performStrategicAssessment error:", error);
      throw error;
    }
  });
