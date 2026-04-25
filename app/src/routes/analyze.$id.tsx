import { createFileRoute } from "@tanstack/react-router";
import { AnalysisResult } from "@/components/features/analysis-result";
import { DocumentActions } from "@/components/features/document-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getAnalysis } from "@/server/functions/analyze-job";

export const Route = createFileRoute("/analyze/$id")({
  component: AnalysisDetailPage,
  loader: async ({ params }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) throw new Error("Invalid analysis ID");
    return getAnalysis({ data: { id } });
  },
  pendingComponent: AnalysisLoading,
  errorComponent: AnalysisError,
});

function AnalysisDetailPage() {
  const analysis = Route.useLoaderData();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-[var(--sea-ink-soft)]">
        <Link to="/history" search={{ page: 1 }}>
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>
      </Button>

      <AnalysisResult analysis={analysis} />

      <DocumentActions analysisId={analysis.id} applied={analysis.applied} />
    </div>
  );
}

function AnalysisLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function AnalysisError({ error }: { error: Error }) {
  return (
    <div className="max-w-3xl mx-auto py-12 text-center">
      <h2 className="text-2xl font-bold text-destructive mb-2">Analysis Not Found</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <Button asChild>
        <Link to="/analyze">Try Another Search</Link>
      </Button>
    </div>
  );
}
