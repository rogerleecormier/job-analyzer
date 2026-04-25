import { createFileRoute } from "@tanstack/react-router";
import { AnalysisForm } from "@/components/features/analysis-form";

export const Route = createFileRoute("/about")({
  component: AboutRedirect,
});

/**
 * Legacy route — kept for file cleanup.
 * The real routes are /analyze, /dashboard, /history.
 */
function AboutRedirect() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <AnalysisForm />
    </div>
  );
}
