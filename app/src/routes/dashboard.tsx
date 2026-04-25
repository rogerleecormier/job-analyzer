import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { DashboardMetrics } from "@/components/features/dashboard-metrics";
import { getAnalytics } from "@/server/functions/get-analytics";
import { manuallyAggregateAnalytics } from "@/server/functions/manually-aggregate-analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, RefreshCw } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
  loader: async () => {
    return getAnalytics({ data: { period: "all_time" } });
  },
  pendingComponent: DashboardLoading,
});

function DashboardPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleResync() {
    setSyncing(true);
    try {
      await manuallyAggregateAnalytics();
      await router.invalidate();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--palm)]/15">
            <BarChart3 className="h-5 w-5 text-[var(--palm)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-[var(--sea-ink-soft)]">Insights across your job search.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Resync"}
        </Button>
      </div>
      <DashboardMetrics data={data} />
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
