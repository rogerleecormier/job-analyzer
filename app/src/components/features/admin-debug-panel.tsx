import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { backfillResumeTracking } from "@/server/functions/backfill-resume-tracking";
import { manuallyAggregateAnalytics } from "@/server/functions/manually-aggregate-analytics";
import { Loader } from "lucide-react";

export function AdminDebugPanel() {
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);
  const [aggregateResult, setAggregateResult] = useState<any>(null);

  const handleBackfill = async () => {
    setBackfillLoading(true);
    try {
      const result = await backfillResumeTracking();
      setBackfillResult(result);
    } catch (error) {
      setBackfillResult({ error: String(error) });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleAggregate = async () => {
    setAggregateLoading(true);
    try {
      const result = await manuallyAggregateAnalytics();
      setAggregateResult(result);
      // Refresh page after aggregation
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setAggregateResult({ error: String(error) });
    } finally {
      setAggregateLoading(false);
    }
  };

  return (
    <Card className="border-amber-500/50 bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Analytics Maintenance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            onClick={handleBackfill}
            disabled={backfillLoading}
            variant="outline"
            className="w-full"
          >
            {backfillLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            Step 1: Backfill Existing Resumes
          </Button>
          {backfillResult && (
            <pre className="text-xs bg-black/20 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(backfillResult, null, 2)}
            </pre>
          )}
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleAggregate}
            disabled={aggregateLoading}
            variant="outline"
            className="w-full"
          >
            {aggregateLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            Step 2: Reaggregate Metrics
          </Button>
          {aggregateResult && (
            <pre className="text-xs bg-black/20 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(aggregateResult, null, 2)}
            </pre>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>How to fix stale metrics:</strong> If your top job titles don't match your recent applications, click "Step 2: Reaggregate Metrics" to recalculate rankings based on your actual job analyses. Metrics normally update automatically every 6 hours.
        </p>
      </CardContent>
    </Card>
  );
}
