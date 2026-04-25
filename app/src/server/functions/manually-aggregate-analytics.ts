import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";
import type { CloudflareEnv } from "@/lib/cloudflare";
import { aggregateAnalytics } from "@/server/cron/aggregate-analytics";

/**
 * Manual trigger for analytics aggregation (for testing/backfill).
 * This function manually runs the analytics aggregation and returns success/error.
 */
export const manuallyAggregateAnalytics = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB) {
        return { 
          success: false, 
          error: "Database not available in this environment" 
        };
      }
      await aggregateAnalytics(env as CloudflareEnv);
      return { 
        success: true, 
        message: "Analytics aggregated successfully" 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("manuallyAggregateAnalytics error:", errorMessage);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  });
