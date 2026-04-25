import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Loader2, Download, RefreshCw } from "lucide-react";
import { generateResume } from "@/server/functions/generate-resume";
import { generateCoverLetter } from "@/server/functions/generate-cover-letter";
import { getDocumentDownload, getDocumentsForAnalysis } from "@/server/functions/get-history";

import { AppliedToggle } from "@/components/features/applied-toggle";

interface DocumentActionsProps {
  analysisId: number;
  applied?: boolean;
}

type DocResult = { documentId: number; fileName: string; r2Key: string };

async function triggerDownload(r2Key: string, fileName: string) {
  const result = await getDocumentDownload({ data: { r2Key } });
  const blob = new Blob([new Uint8Array(result.data)], { type: result.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function DocumentActions({ analysisId, applied = false }: DocumentActionsProps) {
  const [resumeLoading, setResumeLoading] = useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [resumeDownloading, setResumeDownloading] = useState(false);
  const [coverLetterDownloading, setCoverLetterDownloading] = useState(false);
  const [resumeResult, setResumeResult] = useState<DocResult | null>(null);
  const [coverLetterResult, setCoverLetterResult] = useState<DocResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraGuidance, setExtraGuidance] = useState("");

  // Load any previously generated documents for this analysis
  useEffect(() => {
    getDocumentsForAnalysis({ data: { analysisId } }).then((docs) => {
      if (docs.resume) setResumeResult(docs.resume);
      if (docs.coverLetter) setCoverLetterResult(docs.coverLetter);
    }).catch(() => {/* ignore */});
  }, [analysisId]);

  async function handleGenerateResume() {
    setResumeLoading(true);
    setError(null);
    try {
      const result = await generateResume({
        data: { analysisId, extraGuidance: extraGuidance.trim() || undefined },
      });
      setResumeResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume generation failed");
    } finally {
      setResumeLoading(false);
    }
  }

  async function handleGenerateCoverLetter() {
    setCoverLetterLoading(true);
    setError(null);
    try {
      const result = await generateCoverLetter({
        data: { analysisId, extraGuidance: extraGuidance.trim() || undefined },
      });
      setCoverLetterResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover letter generation failed");
    } finally {
      setCoverLetterLoading(false);
    }
  }

  async function handleDownloadResume() {
    if (!resumeResult) return;
    setResumeDownloading(true);
    setError(null);
    try {
      await triggerDownload(resumeResult.r2Key, resumeResult.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setResumeDownloading(false);
    }
  }

  async function handleDownloadCoverLetter() {
    if (!coverLetterResult) return;
    setCoverLetterDownloading(true);
    setError(null);
    try {
      await triggerDownload(coverLetterResult.r2Key, coverLetterResult.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setCoverLetterDownloading(false);
    }
  }

  const busy = resumeLoading || coverLetterLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Generate Documents</h3>
        <AppliedToggle analysisId={analysisId} initialApplied={applied} />
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        <label htmlFor="extra-guidance" className="text-sm font-medium">
          Extra Tailoring Guidance (Optional)
        </label>
        <textarea
          id="extra-guidance"
          value={extraGuidance}
          onChange={(e) => setExtraGuidance(e.target.value)}
          placeholder="Example: Emphasize healthcare domain experience and vendor management leadership."
          disabled={busy}
          rows={4}
          className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          This guidance is sent to AI for both resume and cover letter generation.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Resume */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">ATS Resume</span>
          </div>
          {resumeResult ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadResume}
                disabled={resumeDownloading}
                size="sm"
                className="flex-1"
              >
                {resumeDownloading ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                Download
              </Button>
              <Button
                onClick={handleGenerateResume}
                disabled={resumeLoading || busy}
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Regenerate"
              >
                {resumeLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateResume}
              disabled={busy}
              size="sm"
              className="w-full"
            >
              {resumeLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {resumeLoading ? "Creating..." : "Create Resume"}
            </Button>
          )}
        </div>

        {/* Cover Letter */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">Cover Letter</span>
          </div>
          {coverLetterResult ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadCoverLetter}
                disabled={coverLetterDownloading}
                size="sm"
                className="flex-1"
              >
                {coverLetterDownloading ? <Loader2 className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                Download
              </Button>
              <Button
                onClick={handleGenerateCoverLetter}
                disabled={coverLetterLoading || busy}
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Regenerate"
              >
                {coverLetterLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateCoverLetter}
              disabled={busy}
              size="sm"
              variant="secondary"
              className="w-full"
            >
              {coverLetterLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {coverLetterLoading ? "Creating..." : "Create Cover Letter"}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
