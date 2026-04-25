import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  Hash,
  TrendingUp,
} from "lucide-react";
import type { AnalyticsSummaryData } from "@/server/functions/get-analytics";

interface DashboardMetricsProps {
  data: AnalyticsSummaryData | null;
}

export function DashboardMetrics({ data }: DashboardMetricsProps) {
  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No Analytics Yet</h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Analytics will appear after you analyze some job postings and the aggregation runs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalAnalyses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jobs Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalApplied}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalAnalyses > 0
                ? `${Math.round((data.totalApplied / data.totalAnalyses) * 100)}% apply rate`
                : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Match Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.averageMatchScore}/100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Industry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold leading-tight">
              {data.topIndustries[0]?.industry ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Applied Job Title
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold leading-tight">
              {data.topJobTitles[0]?.title ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Detailed Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top JD Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4" />
              Top JD Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KeywordList items={data.topJdKeywords.map((k) => ({ label: k.keyword, count: k.count }))} />
          </CardContent>
        </Card>

        {/* Top Resume Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Top Resume Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topResumeKeywords.length > 0 ? (
              <KeywordList items={data.topResumeKeywords.map((k) => ({ label: k.keyword, count: k.count }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Not yet computed.</p>
            )}
          </CardContent>
        </Card>

        {/* Top Job Titles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" />
              Top Applied Job Titles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KeywordList items={data.topJobTitles.map((t) => ({ label: t.title, count: t.count }))} />
          </CardContent>
        </Card>

        {/* Top Industries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Top 5 Industries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KeywordList items={data.topIndustries.map((i) => ({ label: i.industry, count: i.count }))} />
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      {data.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(data.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function KeywordList({ items }: { items: Array<{ label: string; count: number }> }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;

  const maxCount = Math.max(...items.map((i) => i.count));

  return (
    <div className="space-y-2">
      {items.slice(0, 10).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1 gap-2">
              <span className="text-sm break-words flex-1" title={item.label}>{item.label}</span>
              <Badge variant="outline" className="text-xs shrink-0 mt-px">
                {item.count}
              </Badge>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
