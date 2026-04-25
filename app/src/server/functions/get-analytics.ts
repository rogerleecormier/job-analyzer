import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { analyticsSummary } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveSessionUser } from "@/lib/resolve-user";

export interface AnalyticsSummaryData {
  period: string;
  topJdKeywords: Array<{ keyword: string; count: number }>;
  topResumeKeywords: Array<{ keyword: string; count: number }>;
  topJobTitles: Array<{ title: string; count: number }>;
  topIndustries: Array<{ industry: string; count: number }>;
  averageMatchScore: number;
  totalAnalyses: number;
  totalResumesGenerated: number;
  totalApplied: number;
  updatedAt: string;
}

/**
 * Read pre-aggregated analytics from the analytics_summary table.
 * This data is computed by the Cron Trigger, not at page load.
 */
export const getAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: { period?: string }) => data)
  .handler(async ({ data }): Promise<AnalyticsSummaryData | null> => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB) {
        // Return mock data in dev mode
        return {
          period: data.period ?? "all_time",
          topJdKeywords: [],
          topResumeKeywords: [],
          topJobTitles: [],
          topIndustries: [],
          averageMatchScore: 0,
          totalAnalyses: 0,
          totalResumesGenerated: 0,
          totalApplied: 0,
          updatedAt: new Date().toISOString(),
        };
      }
      const db = getDb(env.DB);
      const user = await resolveSessionUser();
      if (!user) return null;
      const period = data.period ?? "all_time";

      const [row] = await db
        .select()
        .from(analyticsSummary)
        .where(and(eq(analyticsSummary.period, period), eq(analyticsSummary.userId, user.id)))
        .limit(1);

      if (!row) return null;

      return {
        period: row.period,
        topJdKeywords: JSON.parse(row.topJdKeywords ?? "[]"),
        topResumeKeywords: JSON.parse(row.topResumeKeywords ?? "[]"),
        topJobTitles: JSON.parse(row.topJobTitles ?? "[]"),
        topIndustries: JSON.parse(row.topIndustries ?? "[]"),
        averageMatchScore: row.averageMatchScore ?? 0,
        totalAnalyses: row.totalAnalyses ?? 0,
        totalResumesGenerated: row.totalResumesGenerated ?? 0,
        totalApplied: row.totalApplied ?? 0,
        updatedAt: row.updatedAt ?? "",
      };
    } catch (error) {
      console.error("getAnalytics error:", error);
      return {
        period: data.period ?? "all_time",
        topJdKeywords: [],
        topResumeKeywords: [],
        topJobTitles: [],
        topIndustries: [],
        averageMatchScore: 0,
        totalAnalyses: 0,
        totalResumesGenerated: 0,
        totalApplied: 0,
        updatedAt: new Date().toISOString(),
      };
    }
  });
