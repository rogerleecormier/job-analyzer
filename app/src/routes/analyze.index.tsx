import { createFileRoute } from "@tanstack/react-router";
import { AnalysisForm } from "@/components/features/analysis-form";

export const Route = createFileRoute("/analyze/")({
  component: AnalyzePage,
});

function AnalyzePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <AnalysisForm />
    </div>
  );
}
