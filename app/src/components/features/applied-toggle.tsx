import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toggleApplied } from "@/server/functions/toggle-applied";

interface AppliedToggleProps {
  analysisId: number;
  initialApplied: boolean;
}

export function AppliedToggle({ analysisId, initialApplied }: AppliedToggleProps) {
  const [applied, setApplied] = useState(initialApplied);
  const [loading, setLoading] = useState(false);

  // Reset state when analysisId or initialApplied changes
  useEffect(() => {
    setApplied(initialApplied);
  }, [analysisId, initialApplied]);

  async function handleToggle() {
    setLoading(true);
    try {
      const result = await toggleApplied({ data: { id: analysisId, applied: !applied } });
      setApplied(result.applied);
    } catch {
      // revert on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant={applied ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className={`flex items-center gap-2 transition-colors ${
          applied
            ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
          : "hover:border-emerald-500 hover:text-emerald-600"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : applied ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
        {applied ? "Applied" : "Mark as Applied"}
      </Button>
    </div>
  );
}
