import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import {
  saveResume,
  parseResumeText,
  type ResumeData,
} from "@/server/functions/manage-resume";

function extractBasicFields(text: string): Partial<ResumeData> {
  const result: Partial<ResumeData> = {};
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (firstLine && firstLine.trim().length < 80) result.fullName = firstLine.trim();
  const emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/);
  if (emailMatch) result.email = emailMatch[0];
  const phoneMatch = text.match(/\(?\d{3}\)?[\s.\-•]\d{3}[\s.\-]\d{4}/);
  if (phoneMatch) result.phone = phoneMatch[0].trim();
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-]+/i);
  if (linkedinMatch) result.linkedin = linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : "https://" + linkedinMatch[0];
  const urls = text.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[\w.\-]+\.[a-z]{2,}[/\w.\-?=&]*/gi);
  if (urls?.length) result.website = urls[0];
  return result;
}

// ─── Main component ───────────────────────────────────────────────
export function ResumeManager({ initial }: { initial: ResumeData | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(initial?.updatedAt ?? null);

  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [linkedin, setLinkedin] = useState(initial?.linkedin ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [rawText, setRawText] = useState(initial?.rawText ?? "");
  const [parsedStructured, setParsedStructured] = useState<Partial<ResumeData>>({
    summary: initial?.summary,
    experience: initial?.experience,
    competencies: initial?.competencies,
    tools: initial?.tools,
    education: initial?.education,
    certifications: initial?.certifications,
  });

  const parseFile = useCallback(async (file: File) => {
    setUploadStatus("parsing");
    setUploadError(null);
    try {
      let text = "";
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => ("str" in item ? item.str : "")).join(" "));
        }
        text = pages.join("\n\n");
      } else if (ext === "docx") {
        const mammoth = await import("mammoth/mammoth.browser");
        const arrayBuffer = await file.arrayBuffer();
        const result = await (mammoth as any).extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }
      setRawText(text);
      const fields = extractBasicFields(text);
      if (fields.fullName && !fullName) setFullName(fields.fullName);
      if (fields.email && !email) setEmail(fields.email);
      if (fields.phone && !phone) setPhone(fields.phone);
      if (fields.linkedin && !linkedin) setLinkedin(fields.linkedin);
      if (fields.website && !website) setWebsite(fields.website);
      // Extract structured fields (experience, competencies, etc.) via AI
      const parsed = await parseResumeText({ data: { text } }).catch(() => null);
      if (parsed) {
        setParsedStructured({
          summary: parsed.summary,
          experience: parsed.experience,
          competencies: parsed.competencies,
          tools: parsed.tools,
          education: parsed.education,
          certifications: parsed.certifications,
        });
      }
      setUploadStatus("done");
      setTimeout(() => setUploadStatus("idle"), 4000);
    } catch (err) {
      console.error("[parseFile]", err);
      setUploadError(err instanceof Error ? err.message : "Failed to read file");
      setUploadStatus("error");
    }
  }, [fullName, email, phone, linkedin, website]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setStatus("saving");
    setErrorMsg(null);
    try {
      const result = await saveResume({
        data: {
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          linkedin: linkedin.trim() || undefined,
          website: website.trim() || undefined,
          rawText: rawText || undefined,
          summary: parsedStructured.summary,
          experience: parsedStructured.experience,
          competencies: parsedStructured.competencies,
          tools: parsedStructured.tools,
          education: parsedStructured.education,
          certifications: parsedStructured.certifications,
        },
      });
      setLastSaved(result.updatedAt);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl mx-auto">
      {/* ── Upload drop zone ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Resume</CardTitle>
          <CardDescription>
            Upload your resume (PDF, DOCX, or TXT). The raw text is what the AI uses for all analyses and document generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={[
              "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors select-none",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50",
            ].join(" ")}
          >
            {uploadStatus === "parsing" ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            ) : uploadStatus === "done" ? (
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            ) : uploadStatus === "error" ? (
              <FileText className="h-10 w-10 text-destructive" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-base font-semibold">
                {uploadStatus === "parsing" ? "Reading file…" :
                 uploadStatus === "done" ? "Resume imported — review text below." :
                 uploadStatus === "error" ? "Failed to read file" :
                 "Click to upload or drag & drop"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {uploadStatus === "idle" || uploadStatus === "error"
                  ? "PDF, DOCX, TXT, or Markdown"
                  : uploadStatus === "done"
                  ? "Contact fields auto-filled. Save when ready."
                  : "This may take a few seconds…"}
              </p>
            </div>
            {(uploadStatus === "idle" || uploadStatus === "error") && (
              <div className="flex gap-2">
                {["PDF", "DOCX", "TXT", "MD"].map((fmt) => (
                  <span key={fmt} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">{fmt}</span>
                ))}
              </div>
            )}
          </div>
          {uploadStatus === "error" && uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </CardContent>
      </Card>

      {/* ── Contact Info ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            Used in the header of generated resumes and cover letters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="phone">Phone</label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="linkedin">LinkedIn</label>
              <Input id="linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="website">Website / Portfolio</label>
              <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Raw Resume Text ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Resume Text</CardTitle>
          <CardDescription>
            This is the full text the AI reads for analysis, gap scoring, and document generation. Paste or edit directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your resume text here, or upload a file above…"
            className="w-full min-h-[400px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {rawText && (
            <p className="text-xs text-muted-foreground mt-1.5">{rawText.length.toLocaleString()} characters</p>
          )}
        </CardContent>
      </Card>

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {lastSaved ? (
          <p className="text-sm text-muted-foreground">
            Last saved: {new Date(lastSaved).toLocaleString()}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={status === "saving" || !fullName.trim()} className="min-w-32">
          {status === "saving" ? (
            <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Saving…</>
          ) : status === "saved" ? (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> Saved!</>
          ) : (
            "Save Resume"
          )}
        </Button>
      </div>
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
    </form>
  );
}

