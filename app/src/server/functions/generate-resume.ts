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
import { RESUME_GENERATION_PROMPT, type AtsResumeContent } from "@/lib/ats-format";
import { generateResumePdf } from "@/lib/pdf";
import { jsonrepair } from "jsonrepair";

const RESUME_OUTPUT_TOKEN_BUDGET = 8_192;
const RESUME_PROMPT_OVERHEAD_TOKENS = 6_000;
const RESUME_CONTEXT_TOKEN_BUDGET = Math.min(
  36_000,
  WORKERS_AI_CONTEXT_WINDOW_TOKENS - RESUME_OUTPUT_TOKEN_BUDGET - RESUME_PROMPT_OVERHEAD_TOKENS,
);
const RESUME_MIN_SECTION_TOKENS = 3_000;

const GUIDANCE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "are", "was", "were", "have", "has", "had", "will", "would", "should", "could", "about", "over", "under", "through", "while", "where", "when", "what", "which", "highlight", "bullet", "bullets", "specific", "certain", "topic", "topics",
]);

function selectExperienceForPrompt(
  experiences: unknown[],
  extraGuidance: string,
  jdKeywords: string[] = [],
  limit = 3,
): unknown[] {
  if (!Array.isArray(experiences) || experiences.length <= limit) {
    return Array.isArray(experiences) ? experiences : [];
  }

  const guidanceTerms = extraGuidance
    .toLowerCase()
    .split(/[^a-z0-9+.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !GUIDANCE_STOP_WORDS.has(token));

  const jdTerms = jdKeywords
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9+.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !GUIDANCE_STOP_WORDS.has(token));

  if (guidanceTerms.length === 0 && jdTerms.length === 0) {
    return experiences.slice(0, limit);
  }

  const scored = experiences.map((exp, index) => {
    const haystack = JSON.stringify(exp).toLowerCase();
    let relevance = 0;
    
    // Score against guidance terms (higher weight: 10 points per match)
    for (const term of guidanceTerms) {
      if (haystack.includes(term)) relevance += 10;
    }
    
    // Score against JD keywords (medium weight: 5 points per match)
    for (const term of jdTerms) {
      if (haystack.includes(term)) relevance += 5;
    }
    
    // Keep some recency bias while allowing strongly relevant older roles.
    const recencyScore = Math.max(0, limit - index) * 0.5;
    return {
      index,
      score: relevance + recencyScore,
      relevance,
      exp,
    };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.exp);

  return top;
}

/**
 * Generate an enhanced ATS-optimized resume using the Executive Resume Strategist framework.
 * Creates a highly targeted resume with 8 strategic competency buckets, 5-6 technical skill categories,
 * and exactly 6 bullets per role with [Action Verb] + [Context] + [Quantifiable Result].
 */
export const generateResume = createServerFn({ method: "POST" })
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

      const extraGuidance = (data.extraGuidance ?? "").trim();

      // Format structured candidate data
      const allExperience: unknown[] = resume.experience ? JSON.parse(resume.experience) : [];
      // Parse JD keywords for experience selection scoring
      let jdKeywords: string[] = [];
      try {
        const keywordData = analysis.keywords ? JSON.parse(analysis.keywords) : [];
        jdKeywords = Array.isArray(keywordData) ? keywordData : [];
      } catch {
        jdKeywords = [];
      }
      // Use up to 3 roles, biasing toward JD keyword relevance and guidance relevance
      const selectedExperience = selectExperienceForPrompt(allExperience, extraGuidance, jdKeywords, 3);
      const experienceCount = selectedExperience.length;

      const candidateData = JSON.stringify({
        fullName: resume.fullName,
        email: resume.email,
        phone: resume.phone,
        linkedin: resume.linkedin,
        website: resume.website,
        summary: resume.summary,
        competencies: resume.competencies ? JSON.parse(resume.competencies) : [],
        tools: resume.tools ? JSON.parse(resume.tools) : [],
        experience: selectedExperience,
        education: resume.education ? JSON.parse(resume.education) : [],
        certifications: resume.certifications ? JSON.parse(resume.certifications) : [],
      }, null, 2);

      // Include the raw resume text so the AI can mine real achievements and metrics
      const rawResumeText = resume.rawText ?? "";
      const [jobDescriptionBudget, rawResumeBudget] = allocateTokenBudgets(
        [analysis.jdText ?? "", rawResumeText],
        RESUME_CONTEXT_TOKEN_BUDGET,
        RESUME_MIN_SECTION_TOKENS,
      );
      const jobDescription = truncateToTokenBudget(analysis.jdText ?? "", jobDescriptionBudget, {
        marker: "\n...[job description truncated for resume generation budget]...\n",
        preserveHeadRatio: 0.7,
      });
      const rawResumeSource = truncateToTokenBudget(rawResumeText, rawResumeBudget, {
        marker: "\n...[resume text truncated for resume generation budget]...\n",
        preserveHeadRatio: 0.65,
      });

      // Build the enhanced prompt
      const prompt = RESUME_GENERATION_PROMPT
        .replace("{candidateData}", candidateData)
        .replace("{rawResumeText}", rawResumeSource)
        .replace("{jobTitle}", analysis.jobTitle ?? "")
        .replace("{company}", analysis.company ?? "")
        .replace("{jobDescription}", jobDescription)
        .replace("{keywords}", analysis.keywords ?? "[]")
        .replace("{experienceCount}", String(experienceCount))
        .replace("{extraGuidance}", extraGuidance || "None provided");

      const systemContent = experienceCount > 0
        ? `You are an expert Executive Resume Strategist specializing in ATS-optimized resume generation. You produce resumes as valid JSON only. CRITICAL RULES: (1) You NEVER fabricate experience — every detail must come from the candidate's actual resume. (2) You SELECT which achievements to highlight based on the TARGET JOB, not just reword the same bullets. (3) Different jobs → Different selections. For each role, scan the raw resume text for 10+ distinct achievements, then SELECT and highlight the 6 that best demonstrate skills the JD requires. (4) The candidate has exactly ${experienceCount} job(s) — your output MUST contain exactly ${experienceCount} experience entries. (5) Use metrics and details from the resume text; do not fabricate outcomes or achievements.`
        : `You are an expert Executive Resume Strategist specializing in ATS-optimized resume generation. You produce resumes as valid JSON only. CRITICAL RULES: (1) You NEVER fabricate experience — every detail must come from the candidate's actual resume. (2) You SELECT which achievements to highlight based on the TARGET JOB. (3) Structured experience data is unavailable — extract ALL distinct work history entries directly from the CANDIDATE ORIGINAL RESUME TEXT and identify every employer and role. (4) For each role, identify available achievements and SELECT the 6 that best demonstrate the skills the TARGET JOB requires. Different jobs require different selections of the same candidate's work.`;

      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: systemContent },
        { role: "user", content: prompt },
      ];

      const parseResume = (raw: string): AtsResumeContent => {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to extract JSON from resume generation response");
        return JSON.parse(jsonrepair(jsonMatch[0])) as AtsResumeContent;
      };

      const isResumeContentSparse = (content: AtsResumeContent): boolean => {
        const tooFewCompetencies = !content.coreCompetencies || content.coreCompetencies.length < 4;
        const tooFewSkillCategories = !content.technicalSkills || content.technicalSkills.length < 2;
        const missingExperience = !content.experience || content.experience.length === 0;
        return tooFewCompetencies || tooFewSkillCategories || missingExperience;
      };

      let rawResponse = await callClaude(env, messages, { maxTokens: RESUME_OUTPUT_TOKEN_BUDGET });
      let resumeContent = parseResume(rawResponse);

      // Retry once if the model returned a sparse/truncated result
      if (isResumeContentSparse(resumeContent)) {
        console.warn(
          `[generateResume] Sparse result detected (competencies=${
            resumeContent.coreCompetencies?.length ?? 0
          }, skillCategories=${
            resumeContent.technicalSkills?.length ?? 0
          }, experience=${
            resumeContent.experience?.length ?? 0
          }). Retrying…`,
        );
        rawResponse = await callClaude(env, messages, { maxTokens: RESUME_OUTPUT_TOKEN_BUDGET });
        resumeContent = parseResume(rawResponse);
        if (isResumeContentSparse(resumeContent)) {
          console.error("[generateResume] Sparse result persisted after retry.");
        }
      }

      // Generate PDF
      const pdfBytes = await generateResumePdf(resumeContent);

      // Extract keywords from the generated resume
      const resumeKeywords: string[] = [];
      // Add core competencies
      if (resumeContent.coreCompetencies) {
        resumeKeywords.push(...resumeContent.coreCompetencies);
      }
      // Add technical skills
      if (resumeContent.technicalSkills) {
        for (const skillCategory of resumeContent.technicalSkills) {
          resumeKeywords.push(...skillCategory.skills);
        }
      }
      // Add certifications
      if (resumeContent.certifications) {
        resumeKeywords.push(...resumeContent.certifications);
      }
      // Deduplicate and normalize
      const uniqueKeywords = Array.from(new Set(resumeKeywords.map(k => k.toLowerCase().trim())))
        .filter(k => k.length > 0)
        .slice(0, 50); // Keep top 50

      // Upload to R2
      const timestamp = Date.now();
      const r2Key = `documents/${data.analysisId}/resume_${timestamp}.pdf`;
      const fileName = `Resume_${(analysis.company ?? "Company").replace(/\s+/g, "_")}_${(analysis.jobTitle ?? "Position").replace(/\s+/g, "_")}.pdf`;

      await env.R2.put(r2Key, pdfBytes, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: { fileName },
      });

      // Log to D1
      const now = new Date().toISOString();
      const [doc] = await db
        .insert(generatedDocuments)
        .values({
          jobAnalysisId: data.analysisId,
          docType: "resume",
          r2Key,
          fileName,
          resumeKeywords: JSON.stringify(uniqueKeywords),
          createdAt: now,
        })
        .returning();

      return { documentId: doc.id, fileName, r2Key };
    } catch (error) {
      console.error("generateResume error:", error);
      throw error;
    }
  });
