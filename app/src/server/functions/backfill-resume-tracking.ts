import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { generatedDocuments } from "@/db/schema";

/**
 * Backfill: Create generatedDocuments entries for existing resumes in R2
 * This one-time migration discovers resume PDFs in R2 and creates database records
 */
export const backfillResumeTracking = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB || !env.R2) {
        return {
          success: false,
          error: "Database and/or R2 storage not available in this environment",
        };
      }

      const db = getDb(env.DB);

      // Get all existing records to avoid duplicates
      const existing = await db.select().from(generatedDocuments);
      const existingKeys = new Set(existing.map(doc => doc.r2Key));

      // List all resumePDFs in R2
      const listResult = await env.R2.list({ prefix: "documents/" });
      const resumePdfs = listResult.objects.filter(
        obj =>
          obj.key.includes("resume") &&
          obj.key.endsWith(".pdf") &&
          !existingKeys.has(obj.key)
      );

      if (resumePdfs.length === 0) {
        return {
          success: true,
          message: "No new resumes to backfill",
          created: 0,
        };
      }

      // Extract jobAnalysisId from the path (documents/{id}/...)
      const newRecords = resumePdfs.map(pdf => {
        const match = pdf.key.match(/documents\/(\d+)\//);
        const jobAnalysisId = match ? parseInt(match[1], 10) : null;
        const fileName =
          pdf.key.split("/").pop() || "resume.pdf";

        return {
          jobAnalysisId,
          docType: "resume",
          r2Key: pdf.key,
          fileName,
          resumeKeywords: JSON.stringify([]), // Legacy resumes have no keywords
          createdAt: new Date().toISOString(),
        };
      });

      // Insert all at once
      if (newRecords.length > 0) {
        await db.insert(generatedDocuments).values(newRecords);
      }

      return {
        success: true,
        message: `Backfilled ${newRecords.length} resume(s)`,
        created: newRecords.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("backfillResumeTracking error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });
