/**
 * Cron Trigger handler: Aggregate analytics from job_analyses into analytics_summary.
 * Runs every 6 hours via Cloudflare Cron Triggers.
 *
 * This module exports a `scheduled` handler to be wired into the Worker entry.
 */
import { getDb } from "@/db/client";
import { jobAnalyses, analyticsSummary, generatedDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { CloudflareEnv } from "@/lib/cloudflare";

interface KeywordCount {
  keyword: string;
  count: number;
}

interface TitleCount {
  title: string;
  count: number;
}

interface IndustryCount {
  industry: string;
  count: number;
}

function topN<T extends Record<string, unknown>>(
  arr: T[],
  key: keyof T,
  n: number,
): T[] {
  return arr
    .sort(
      (a, b) =>
        (b as Record<string, number>).count -
        (a as Record<string, number>).count,
    )
    .slice(0, n);
}

export async function aggregateAnalytics(env: CloudflareEnv, userId?: number) {
  const db = getDb(env.DB);

  // If no userId provided (cron trigger), aggregate for all users individually
  if (!userId) {
    const allUsers = await db.select({ userId: jobAnalyses.userId }).from(jobAnalyses);
    const uniqueUserIds = [...new Set(allUsers.map(u => u.userId).filter((id): id is number => id !== null))];
    for (const uid of uniqueUserIds) {
      await aggregateAnalytics(env, uid);
    }
    return;
  }

  // Fetch analyses for this user only
  const allAnalyses = await db.select().from(jobAnalyses).where(eq(jobAnalyses.userId, userId));
  if (allAnalyses.length === 0) {
    const now = new Date().toISOString();
    const period = "all_time";

    const [existing] = await db
      .select()
      .from(analyticsSummary)
      .where(and(eq(analyticsSummary.period, period), eq(analyticsSummary.userId, userId)))
      .limit(1);

    const emptyPayload = {
      userId,
      period,
      topJdKeywords: JSON.stringify([]),
      topResumeKeywords: JSON.stringify([]),
      topJobTitles: JSON.stringify([]),
      topIndustries: JSON.stringify([]),
      averageMatchScore: 0,
      totalAnalyses: 0,
      totalResumesGenerated: 0,
      totalApplied: 0,
      updatedAt: now,
    };

    if (existing) {
      await db
        .update(analyticsSummary)
        .set(emptyPayload)
        .where(eq(analyticsSummary.id, existing.id));
    } else {
      await db.insert(analyticsSummary).values(emptyPayload);
    }

    return;
  }

  // ─── Compute JD Keywords ──────────────────────────────
  const jdKeywordMap = new Map<string, number>();
  for (const a of allAnalyses) {
    const keywords: string[] = JSON.parse(a.keywords ?? "[]");
    for (const kw of keywords) {
      const normalized = kw.toLowerCase().trim();
      if (normalized) {
        jdKeywordMap.set(normalized, (jdKeywordMap.get(normalized) ?? 0) + 1);
      }
    }
  }
  const topJdKeywords: KeywordCount[] = topN(
    Array.from(jdKeywordMap.entries()).map(([keyword, count]) => ({
      keyword,
      count,
    })),
    "count",
    20,
  );

  // ─── Compute Resume Keywords ──────────────────────────
  const resumeKeywordMap = new Map<string, number>();
  const analysisIds = allAnalyses.map(a => a.id);
  const allResumes = (await db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.docType, "resume")))
    .filter(d => analysisIds.includes(d.jobAnalysisId!));
  
  for (const doc of allResumes) {
    const keywords: string[] = JSON.parse(doc.resumeKeywords ?? "[]");
    for (const kw of keywords) {
      const normalized = kw.toLowerCase().trim();
      if (normalized) {
        resumeKeywordMap.set(normalized, (resumeKeywordMap.get(normalized) ?? 0) + 1);
      }
    }
  }
  const topResumeKeywords: KeywordCount[] = topN(
    Array.from(resumeKeywordMap.entries()).map(([keyword, count]) => ({
      keyword,
      count,
    })),
    "count",
    20,
  );

  // ─── Compute Top Job Titles (Applied only) ─────────────
  const titleMap = new Map<string, number>();
  for (const a of allAnalyses) {
    if (a.applied === 1) {
      const title = (a.jobTitle ?? "").trim();
      if (title) {
        titleMap.set(title, (titleMap.get(title) ?? 0) + 1);
      }
    }
  }
  const topJobTitles: TitleCount[] = topN(
    Array.from(titleMap.entries()).map(([title, count]) => ({ title, count })),
    "count",
    5,
  );

  // ─── Compute Top Industries ────────────────────────────
  const industryMap = new Map<string, number>();
  for (const a of allAnalyses) {
    const industry = (a.industry ?? "").trim();
    if (industry) {
      industryMap.set(industry, (industryMap.get(industry) ?? 0) + 1);
    }
  }
  const topIndustries: IndustryCount[] = topN(
    Array.from(industryMap.entries()).map(([industry, count]) => ({
      industry,
      count,
    })),
    "count",
    5,
  );

  // ─── Average Match Score ───────────────────────────────
  const scores = allAnalyses
    .map((a) => a.matchScore)
    .filter((s): s is number => s !== null);
  const averageMatchScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // ─── Total Resumes Generated ───────────────────────────
  const totalResumesGenerated = allResumes.length;

  // ─── Total Jobs Applied ───────────────────────────────
  const totalApplied = allAnalyses.filter((a) => a.applied === 1).length;

  const now = new Date().toISOString();
  const period = "all_time";

  // Upsert: check if exists for this user + period, then update or insert
  const [existing] = await db
    .select()
    .from(analyticsSummary)
    .where(and(eq(analyticsSummary.period, period), eq(analyticsSummary.userId, userId)))
    .limit(1);

  const payload = {
    userId,
    period,
    topJdKeywords: JSON.stringify(topJdKeywords),
    topResumeKeywords: JSON.stringify(topResumeKeywords),
    topJobTitles: JSON.stringify(topJobTitles),
    topIndustries: JSON.stringify(topIndustries),
    averageMatchScore: Math.round(averageMatchScore * 10) / 10,
    totalAnalyses: allAnalyses.length,
    totalResumesGenerated,
    totalApplied,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(analyticsSummary)
      .set(payload)
      .where(eq(analyticsSummary.id, existing.id));
  } else {
    await db.insert(analyticsSummary).values(payload);
  }
}
