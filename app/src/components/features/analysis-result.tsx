import { ScoreBadge } from "./score-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  Tag,
  TrendingUp,
  Shield,
  Target,
  DollarSign,
  Sparkles,
} from "lucide-react";

interface GapItem {
  requirement?: string;
  area?: string;
  status?: "covered" | "partial" | "missing";
  requirementType?: "required" | "preferred";
  suggestion?: string;
  detail?: string;
}

function getRequirementTypeBadge(requirementType?: string) {
  if (requirementType === "required") {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>;
  }
  if (requirementType === "preferred") {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Preferred</Badge>;
  }
  return null;
}

interface SalaryAssessment {
  listed: string | null;
  projectedRange: string;
  assessment: string;
}

interface CareerAnalysis {
  trajectory: string;
  recommendation: "pursue" | "consider" | "pass";
  reasoning: string;
  salaryAssessment?: SalaryAssessment;
}

interface AnalysisResultProps {
  analysis: {
    jobTitle: string;
    company: string;
    industry?: string;
    location?: string;
    matchScore: number;
    pursue: boolean;
    pursueJustification: string;
    gapAnalysis: GapItem[];
    recommendations: string[];
    keywords: string[];
    strategyNote?: string;
    personalInterest?: string;
    careerAnalysis?: CareerAnalysis | null;
  };
}

function getVerdictConfig(pursue: boolean, careerRec?: string) {
  const rec = careerRec ?? (pursue ? "pursue" : "pass");
  if (rec === "pursue") return { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "PURSUE", icon: CheckCircle2 };
  if (rec === "consider") return { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "CONSIDER", icon: AlertTriangle };
  return { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "PASS", icon: XCircle };
}

function getStatusIcon(status?: string) {
  if (status === "covered") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  if (status === "missing") return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
}

function getStatusBadge(status?: string) {
  if (status === "covered") return <Badge variant="success" className="text-[10px] px-1.5 py-0">Match</Badge>;
  if (status === "partial") return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Partial</Badge>;
  if (status === "missing") return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Gap</Badge>;
  return null;
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const verdict = getVerdictConfig(analysis.pursue, analysis.careerAnalysis?.recommendation);
  const VerdictIcon = verdict.icon;

  const covered = analysis.gapAnalysis.filter((g) => g.status === "covered").length;
  const partial = analysis.gapAnalysis.filter((g) => g.status === "partial").length;
  const missing = analysis.gapAnalysis.filter((g) => g.status === "missing").length;

  return (
    <div className="space-y-5">
      {/* Hero Card - Score + Verdict */}
      <div className={`rounded-xl border p-5 ${verdict.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{analysis.jobTitle}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {analysis.company}
              {analysis.industry ? ` · ${analysis.industry}` : ""}
              {analysis.location ? ` · ${analysis.location}` : ""}
            </p>
          </div>
          <ScoreBadge score={analysis.matchScore} size="lg" />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <VerdictIcon className={`h-5 w-5 ${verdict.color}`} />
          <span className={`text-sm font-bold ${verdict.color}`}>{verdict.label}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{analysis.pursueJustification}</p>

        {analysis.careerAnalysis && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Career Impact</span>
            </div>
            <p className="text-sm text-muted-foreground">{analysis.careerAnalysis.trajectory}</p>
            {analysis.careerAnalysis.reasoning && (
              <p className="text-xs text-muted-foreground/70 mt-1">{analysis.careerAnalysis.reasoning}</p>
            )}

            {analysis.careerAnalysis.salaryAssessment && (
              <div className="mt-3 pt-2 border-t border-current/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary Assessment</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    {analysis.careerAnalysis.salaryAssessment.listed
                      ? analysis.careerAnalysis.salaryAssessment.listed
                      : analysis.careerAnalysis.salaryAssessment.projectedRange}
                  </span>
                  {!analysis.careerAnalysis.salaryAssessment.listed && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Projected</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1">{analysis.careerAnalysis.salaryAssessment.assessment}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Why This Role */}
      {analysis.personalInterest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Why This Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.personalInterest}</p>
          </CardContent>
        </Card>
      )}

      {/* Requirements Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Requirements Analysis
            </span>
            {analysis.gapAnalysis.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {covered} matched · {partial} partial · {missing} gaps
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.gapAnalysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requirements analyzed.</p>
          ) : (
            <div className="space-y-2.5">
              {analysis.gapAnalysis.map((gap, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {getStatusIcon(gap.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{gap.requirement ?? gap.area}</span>
                      {getRequirementTypeBadge(gap.requirementType)}
                      {getStatusBadge(gap.status)}
                    </div>
                    {(gap.suggestion ?? gap.detail) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{gap.suggestion ?? gap.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Note */}
      {analysis.strategyNote && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Strategic Positioning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.strategyNote}</p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span className="text-muted-foreground">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Keywords */}
      {analysis.keywords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4" />
              ATS Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
