import { createServerFn } from "@tanstack/react-start";
import { resolveSessionUser } from "@/lib/resolve-user";
import { eq, and } from "drizzle-orm";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { jobAnalyses } from "@/db/schema";

export const toggleApplied = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number; applied: boolean }) => data)
  .handler(async ({ data }) => {
    const env = getCloudflareEnv();
    if (!env.DB) throw new Error("Database not available.");

    const db = getDb(env.DB);
    const user = await resolveSessionUser();
    if (!user) throw new Error("Not authenticated");

    const now = data.applied ? new Date().toISOString() : null;


    // Only allow update if the analysis belongs to the user
    const [updated] = await db
      .update(jobAnalyses)
      .set({
        applied: data.applied ? 1 : 0,
        appliedAt: now,
      })
      .where(and(eq(jobAnalyses.id, data.id), eq(jobAnalyses.userId, user.id)))
      .returning();
    if (!updated) throw new Error("Not found or not authorized");

    return {
      id: updated.id,
      applied: updated.applied === 1,
      appliedAt: updated.appliedAt ?? null,
    };
  });
