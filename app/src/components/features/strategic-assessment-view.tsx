import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { performStrategicAssessment } from "@/server/functions/strategic-assessment";
import type { StrategicAssessment } from "@/lib/ats-format";

interface StrategicAssessmentViewProps {
  analysisId: number;
  onApproval: (approved: boolean) => void;
  isLoading?: boolean;
}

export function StrategicAssessmentView({
  analysisId,
  onApproval,
  isLoading = false,
}: StrategicAssessmentViewProps) {
  const [assessment, setAssessment] = useState<StrategicAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAssessment() {
    setLoading(true);
    setError(null);
    try {
      const result = await performStrategicAssessment({ data: { analysisId } });
      setAssessment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assessment");
    } finally {
      setLoading(false);
    }
  }

  if (!assessment) {
    return (
      <Button onClick={loadAssessment} disabled={loading} size="sm">
        {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
        {loading ? "Loading Assessment..." : "View Strategic Assessment"}
      </Button>
    );
  }

  const matchColor =
    assessment.matchScore >= 80
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : assessment.matchScore >= 60
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        : "bg-red-500/15 text-red-700 dark:text-red-400";

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Match Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Match Assessment
            <Badge className={matchColor}>{assessment.matchScore}%</Badge>
          </CardTitle>
          <CardDescription>{assessment.matchRationale}</CardDescription>
        </CardHeader>
      </Card>

      {/* Gap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Gap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assessment.gapAnalysis.map((gap, i) => (
            <div key={i} className="flex items-start gap-2">
              {gap.status === "covered" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
              ) : gap.status === "partial" ? (
                <div className="h-4 w-4 mt-0.5 border-l-2 border-yellow-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
              )}
              <div className="text-sm">
                <p className="font-medium">{gap.requirement}</p>
                {gap.suggestion && (
                  <p className="text-muted-foreground text-xs mt-1">{gap.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strategy Note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Strategy Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{assessment.strategyNote}</p>
        </CardContent>
      </Card>

      {/* Career Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Career Impact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm font-medium mb-1">Trajectory</p>
            <p className="text-sm text-muted-foreground">{assessment.careerAnalysis.trajectory}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Recommendation</p>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  assessment.careerAnalysis.recommendation === "pursue"
                    ? "success"
                    : assessment.careerAnalysis.recommendation === "consider"
                      ? "warning"
                      : "destructive"
                }
              >
                {assessment.careerAnalysis.recommendation.toUpperCase()}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Reasoning</p>
            <p className="text-sm text-muted-foreground">{assessment.careerAnalysis.reasoning}</p>
          </div>
        </CardContent>
      </Card>

      {/* Approval Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          onClick={() => onApproval(true)}
          disabled={isLoading}
          size="sm"
          variant="default"
        >
          {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
          {isLoading ? "Generating..." : "Generate Resume & Cover Letter"}
        </Button>
        <Button onClick={() => onApproval(false)} disabled={isLoading} size="sm" variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
