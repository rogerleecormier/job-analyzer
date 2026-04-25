import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, PlusCircle, Link, FileText } from "lucide-react";
import { analyzeJob } from "@/server/functions/analyze-job";
import { AnalysisResult } from "@/components/features/analysis-result";
import { DocumentActions } from "@/components/features/document-actions";

type AnalysisData = Awaited<ReturnType<typeof analyzeJob>>;
type InputMode = "url" | "text";

export function AnalysisForm() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isUrl = mode === "url";
    if (isUrl && !url.trim()) return;
    if (!isUrl && !jdText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeJob({
        data: isUrl ? { url: url.trim() } : { jdText: jdText.trim() },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setUrl("");
    setJdText("");
    setError(null);
  }

  const canSubmit = !loading && (mode === "url" ? !!url.trim() : jdText.trim().length >= 50);

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="island-shell rounded-xl border border-[var(--line)] p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-1">Analyze a Job Posting</h2>
        <p className="text-sm text-[var(--sea-ink-soft)] mb-4">
          Load a job description from a URL or paste the text directly for a comprehensive AI analysis with match scoring, gap identification, and strategic positioning.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface)] border border-[var(--line)] w-fit mb-4">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "url"
                ? "bg-[var(--lagoon)] text-white"
                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            From URL
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "text"
                ? "bg-[var(--lagoon)] text-white"
                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste Text
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "url" ? (
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/jobs/position"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                required
                className="flex-1 h-10 bg-[var(--surface)] border-[var(--line)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)]/50"
              />
              <Button type="submit" disabled={!canSubmit} className="h-10 px-5 rounded-lg">
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                placeholder="Paste the full job description here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                disabled={loading}
                required
                rows={10}
                className="bg-[var(--surface)] border-[var(--line)] text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)]/50 resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--sea-ink-soft)]">
                  {jdText.trim().length < 50 && jdText.length > 0
                    ? "Too short — paste the full job description"
                    : jdText.trim().length > 0
                    ? `${jdText.trim().length} characters`
                    : ""}
                </span>
                <Button type="submit" disabled={!canSubmit} className="h-10 px-5 rounded-lg">
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                  {loading ? "Analyzing..." : "Analyze"}
                </Button>
              </div>
            </>
          )}
        </form>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 rise-in">
          <div className="flex items-center justify-between">
            {"alreadyAnalyzed" in result && !!result.alreadyAnalyzed && (
              <p className="text-sm text-muted-foreground">
                This URL was already analyzed — showing existing results.
              </p>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                New Job Analysis
              </Button>
            </div>
          </div>
          <AnalysisResult analysis={result} />
          <DocumentActions analysisId={result.id} applied={"applied" in result && result.applied === true} />
        </div>
      )}
    </div>
  );
}
