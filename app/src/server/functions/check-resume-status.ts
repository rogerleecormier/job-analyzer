import { createServerFn } from "@tanstack/react-start";
import { resolveSessionUser } from "@/lib/resolve-user";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { jobAnalyses, generatedDocuments } from "@/db/schema";

/**
 * Backfill: Check how many resumes exist in R2 and generatedDocuments
 */
export const checkResumeStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB || !env.R2) {
        throw new Error("Database and R2 not available");
      }
      
      const db = getDb(env.DB);
      

      const user = await resolveSessionUser();
      if (!user) throw new Error("Not authenticated");
      // Count resumes in generatedDocuments table for this user
      const generatedCount = await db
        .select()
        .from(generatedDocuments)
        .where(generatedDocuments.jobAnalysisId.in(
          db.select({ id: jobAnalyses.id })
            .from(jobAnalyses)
            .where(jobAnalyses.userId.eq(user.id))
        ));
      const resumeCount = generatedCount.filter(doc => doc.docType === 'resume').length;
      
      // List all files in R2 to see what's actually stored
      const listResult = await env.R2.list({ prefix: 'documents/' });
      const resumeFiles = listResult.objects.filter(obj => 
        obj.key.includes('resume') && obj.key.endsWith('.pdf')
      );

      return {
        generatedDocumentsTotal: generatedCount.length,
        trackedResumes: resumeCount,
        resumesInR2: resumeFiles.length,
        r2Keys: resumeFiles.map(f => f.key),
      };
    } catch (error) {
      console.error("checkResumeStatus error:", error);
      throw error;
    }
  });
