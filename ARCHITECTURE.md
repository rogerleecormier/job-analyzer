# Job Analyzer — System Architecture

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                              │
│                                                                     │
│  ┌──────────────┐   ┌────────────┐   ┌──────────┐   ┌───────────┐ │
│  │ TanStack     │   │ D1         │   │ R2       │   │ KV        │ │
│  │ Start on     │──▶│ (SQLite)   │   │ (Object  │   │ (Cache)   │ │
│  │ CF Workers   │   │            │   │  Storage) │   │           │ │
│  └──────┬───────┘   └────────────┘   └──────────┘   └───────────┘ │
│         │                                                           │
│         ├──▶ Browser Rendering API (Puppeteer)                      │
│         ├──▶ AI Gateway ──▶ Claude Opus 4.6 (Anthropic)             │
│         ├──▶ Workers AI (lightweight extraction)                    │
│         │                                                           │
│  ┌──────┴──────────┐                                                │
│  │ Cron Trigger     │  (scheduled analytics aggregation)            │
│  │ 0 */6 * * *      │                                               │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Wrangler Configuration (`wrangler.toml`)

```toml
name = "job-analyzer"
main = "dist/_worker.js"       # Vite build output for CF Workers
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

# ──────────────────────────────────────
# D1 Database
# ──────────────────────────────────────
[[d1_databases]]
binding = "DB"
database_name = "job-analyzer-db"
database_id = "<D1_DATABASE_ID>"           # Provisioned via CLI
migrations_dir = "drizzle/migrations"

# ──────────────────────────────────────
# R2 Object Storage (PDFs)
# ──────────────────────────────────────
[[r2_buckets]]
binding = "R2"
bucket_name = "job-analyzer-documents"

# ──────────────────────────────────────
# KV Namespace (URL scrape cache)
# ──────────────────────────────────────
[[kv_namespaces]]
binding = "KV"
id = "<KV_NAMESPACE_ID>"                   # Provisioned via CLI

# ──────────────────────────────────────
# AI Gateway + Workers AI
# ──────────────────────────────────────
[ai]
binding = "AI"

# AI Gateway is configured at the account level;
# requests are routed via the gateway endpoint URL
# stored as a secret/env var.

# ──────────────────────────────────────
# Browser Rendering API
# ──────────────────────────────────────
[browser]
binding = "BROWSER"

# ──────────────────────────────────────
# Environment Variables / Secrets
# ──────────────────────────────────────
[vars]
AI_GATEWAY_ENDPOINT = "https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/job-analyzer"
ANTHROPIC_MODEL = "claude-opus-4-6-20250320"

# Secrets (set via `wrangler secret put`):
#   ANTHROPIC_API_KEY

# ──────────────────────────────────────
# Cron Triggers
# ──────────────────────────────────────
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours — analytics aggregation
```

---

## 3. Drizzle ORM Schema Design

All tables live in a single D1 database. Drizzle kit generates migration SQL.

### 3.1 `master_resume`

Stores the single preloaded master resume the user manages.

| Column          | Type         | Notes                           |
|-----------------|--------------|---------------------------------|
| `id`            | INTEGER (PK) | Auto-increment                  |
| `full_name`     | TEXT         | NOT NULL                        |
| `email`         | TEXT         |                                 |
| `phone`         | TEXT         |                                 |
| `linkedin`      | TEXT         |                                 |
| `website`       | TEXT         |                                 |
| `summary`       | TEXT         | Professional Summary            |
| `competencies`  | TEXT (JSON)  | JSON array of strings           |
| `tools`         | TEXT (JSON)  | JSON array of strings           |
| `experience`    | TEXT (JSON)  | JSON array of experience objects |
| `education`     | TEXT (JSON)  | JSON array of education objects  |
| `certifications`| TEXT (JSON)  | JSON array of strings           |
| `raw_text`      | TEXT         | Full plain-text for AI context  |
| `updated_at`    | TEXT         | ISO 8601 timestamp              |

### 3.2 `job_analyses`

One row per analyzed job.

| Column              | Type         | Notes                              |
|---------------------|--------------|------------------------------------|
| `id`                | INTEGER (PK) | Auto-increment                    |
| `job_url`           | TEXT         | NOT NULL, original URL             |
| `job_title`         | TEXT         |                                    |
| `company`           | TEXT         |                                    |
| `industry`          | TEXT         |                                    |
| `location`          | TEXT         |                                    |
| `jd_text`           | TEXT         | Scraped job description text       |
| `match_score`       | INTEGER      | 1–100                              |
| `gap_analysis`      | TEXT (JSON)  | Structured gap findings            |
| `recommendations`   | TEXT (JSON)  | Structured recommendations         |
| `pursue`            | INTEGER      | 1 = Pursue, 0 = Do Not Pursue     |
| `pursue_justification` | TEXT      | Explanation                        |
| `keywords`          | TEXT (JSON)  | Extracted keywords from JD         |
| `created_at`        | TEXT         | ISO 8601 timestamp                 |

### 3.3 `generated_documents`

Metadata for every generated PDF (resume or cover letter).

| Column            | Type         | Notes                                    |
|-------------------|--------------|------------------------------------------|
| `id`              | INTEGER (PK) | Auto-increment                           |
| `job_analysis_id` | INTEGER (FK) | References `job_analyses.id`             |
| `doc_type`        | TEXT         | `"resume"` or `"cover_letter"`           |
| `r2_key`          | TEXT         | Object key in R2 bucket                  |
| `file_name`       | TEXT         | Human-readable filename for download     |
| `created_at`      | TEXT         | ISO 8601 timestamp                       |

### 3.4 `analytics_summary`

Pre-aggregated by the Cron Trigger — **never computed at page load**.

| Column                   | Type         | Notes                                      |
|--------------------------|--------------|--------------------------------------------|
| `id`                     | INTEGER (PK) | Auto-increment                             |
| `period`                 | TEXT         | e.g. `"all_time"`, `"2026-03"`, `"2026-W12"` |
| `top_jd_keywords`        | TEXT (JSON)  | `[{ "keyword": "...", "count": N }, ...]`  |
| `top_resume_keywords`    | TEXT (JSON)  | Same shape                                  |
| `top_job_titles`         | TEXT (JSON)  | Top 5 `[{ "title": "...", "count": N }]`   |
| `top_industries`         | TEXT (JSON)  | Top 5 `[{ "industry": "...", "count": N }]`|
| `average_match_score`    | REAL         | Average across all analyses in period       |
| `total_analyses`         | INTEGER      | Count of analyses in period                 |
| `updated_at`             | TEXT         | ISO 8601 timestamp                          |

### Schema Code (`src/db/schema.ts`)

```ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const masterResume = sqliteTable("master_resume", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  website: text("website"),
  summary: text("summary"),
  competencies: text("competencies"),        // JSON
  tools: text("tools"),                      // JSON
  experience: text("experience"),            // JSON
  education: text("education"),              // JSON
  certifications: text("certifications"),    // JSON
  rawText: text("raw_text"),
  updatedAt: text("updated_at"),
});

export const jobAnalyses = sqliteTable("job_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobUrl: text("job_url").notNull(),
  jobTitle: text("job_title"),
  company: text("company"),
  industry: text("industry"),
  location: text("location"),
  jdText: text("jd_text"),
  matchScore: integer("match_score"),
  gapAnalysis: text("gap_analysis"),         // JSON
  recommendations: text("recommendations"),  // JSON
  pursue: integer("pursue"),
  pursueJustification: text("pursue_justification"),
  keywords: text("keywords"),                // JSON
  createdAt: text("created_at"),
});

export const generatedDocuments = sqliteTable("generated_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobAnalysisId: integer("job_analysis_id").references(() => jobAnalyses.id),
  docType: text("doc_type").notNull(),       // "resume" | "cover_letter"
  r2Key: text("r2_key").notNull(),
  fileName: text("file_name"),
  createdAt: text("created_at"),
});

export const analyticsSummary = sqliteTable("analytics_summary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  period: text("period").notNull(),
  topJdKeywords: text("top_jd_keywords"),    // JSON
  topResumeKeywords: text("top_resume_keywords"), // JSON
  topJobTitles: text("top_job_titles"),      // JSON
  topIndustries: text("top_industries"),     // JSON
  averageMatchScore: real("average_match_score"),
  totalAnalyses: integer("total_analyses"),
  updatedAt: text("updated_at"),
});
```

---

## 4. TanStack Start Routing Structure

```
src/
├── routes/
│   ├── __root.tsx              # Root layout (nav, Tailwind shell)
│   ├── index.tsx               # Landing / redirect to /analyze
│   ├── analyze.tsx             # POST job URL → scrape → AI analysis
│   ├── analyze.$id.tsx         # View analysis result + generate docs
│   ├── dashboard.tsx           # Analytics dashboard (reads analytics_summary)
│   └── history.tsx             # Document archive (TanStack Table)
├── components/
│   ├── ui/                     # Shadcn primitive components (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── progress.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   └── features/               # Composite feature blocks
│       ├── analysis-form.tsx        # URL input + submit
│       ├── analysis-result.tsx      # Score, gaps, recommendation display
│       ├── document-actions.tsx     # Generate resume / cover letter buttons
│       ├── score-badge.tsx          # Color-coded match score
│       ├── pursue-verdict.tsx       # Pursue / Do Not Pursue banner
│       ├── dashboard-metrics.tsx    # Metric cards for dashboard
│       ├── keyword-chart.tsx        # Top keywords visualization
│       └── history-table.tsx        # TanStack Table wrapper
├── server/
│   ├── functions/
│   │   ├── scrape-job.ts           # Browser Rendering API → KV cache
│   │   ├── analyze-job.ts          # AI Gateway → Claude analysis
│   │   ├── generate-resume.ts      # Generate ATS resume PDF → R2
│   │   ├── generate-cover-letter.ts # Generate cover letter PDF → R2
│   │   ├── get-analytics.ts        # Read from analytics_summary
│   │   └── get-history.ts          # Paginated job history
│   └── cron/
│       └── aggregate-analytics.ts  # Cron handler: compute & upsert summary
├── db/
│   ├── schema.ts                   # Drizzle schema (above)
│   └── client.ts                   # Drizzle client factory (D1 binding)
├── lib/
│   ├── ai-gateway.ts              # AI Gateway HTTP client
│   ├── pdf.ts                     # PDF generation utility
│   └── ats-format.ts             # ATS resume formatting constraints
└── styles/
    └── globals.css                # Tailwind directives + Shadcn CSS vars
```

---

## 5. Request Flow Details

### 5.1 Ingestion & Analysis (`/analyze`)

```
User submits URL
       │
       ▼
[Server Function: scrapeJob]
       │
       ├─ Check KV cache (binding: KV) by URL hash
       │   ├─ HIT  → return cached JD text
       │   └─ MISS → Browser Rendering API (binding: BROWSER)
       │              │
       │              ▼
       │         Puppeteer: navigate, extract text
       │              │
       │              ▼
       │         Store in KV (TTL: 7 days)
       │
       ▼
[Server Function: analyzeJob]
       │
       ├─ Load master_resume from D1
       ├─ Build prompt (JD text + master resume text)
       ├─ POST to AI Gateway → Claude Opus 4.6
       │   Response: { matchScore, gapAnalysis, recommendations,
       │               pursue, justification, keywords, jobTitle,
       │               company, industry }
       │
       ▼
  Insert into job_analyses (D1)
       │
       ▼
  Redirect to /analyze/$id (result view)
```

### 5.2 Document Generation

```
User clicks "Generate Resume" or "Generate Cover Letter"
       │
       ▼
[Server Function: generateResume / generateCoverLetter]
       │
       ├─ Load job_analyses row + master_resume from D1
       ├─ Build generation prompt with ATS constraints
       ├─ POST to AI Gateway → Claude Opus 4.6
       │   Response: structured document content
       │
       ├─ Render to PDF (clean text layer, no complex formatting)
       │   Resume section order enforced:
       │     1. Name Header
       │     2. Contact Information
       │     3. Professional Summary
       │     4. Competencies
       │     5. Tools
       │     6. Experience
       │     7. Education
       │     8. Certifications
       │
       ├─ Upload PDF to R2 (binding: R2)
       │   Key: documents/{analysisId}/{type}_{timestamp}.pdf
       │
       ├─ Insert into generated_documents (D1)
       │
       ▼
  Return download URL (R2 presigned or proxied)
```

### 5.3 Cron: Analytics Aggregation

```
Cron fires every 6 hours
       │
       ▼
[Cron Handler: aggregateAnalytics]
       │
       ├─ Query job_analyses: extract all keywords, titles, industries, scores
       ├─ Compute:
       │   • Top N JD keywords (frequency count)
       │   • Top N resume keywords (from generated docs or master)
       │   • Top 5 job titles
       │   • Top 5 industries
       │   • Average match score
       │   • Total analyses count
       │
       ├─ UPSERT into analytics_summary for period = "all_time"
       │   (optionally also per-month / per-week periods)
       │
       ▼
  Done. Dashboard reads this table via loader.
```

---

## 6. Component Hierarchy

```
Primitive (src/components/ui/)        Feature (src/components/features/)
──────────────────────────────        ─────────────────────────────────
<Button />                            <AnalysisForm />
<Card />                                ├── <Input /> (url)
<Badge />                               └── <Button /> (submit)
<Input />
<Dialog />                            <AnalysisResult />
<Table />                               ├── <ScoreBadge />
<Progress />                            ├── <PursueVerdict />
<Skeleton />                            ├── <Card /> (gap analysis)
<Separator />                           ├── <Card /> (recommendations)
<Tabs />                                └── <DocumentActions />
                                             ├── <Button /> (generate resume)
                                             └── <Button /> (generate cover letter)

                                      <DashboardMetrics />
                                        ├── <Card /> × 4 (metric cards)
                                        └── <KeywordChart />

                                      <HistoryTable />
                                        └── TanStack Table instance
                                            ├── <Badge /> (score)
                                            └── <Button /> (download links)
```

---

## 7. Deployment Provisioning Commands

```bash
# 1. Create D1 database
npx wrangler d1 create job-analyzer-db
# → Copy the database_id into wrangler.toml

# 2. Create R2 bucket
npx wrangler r2 bucket create job-analyzer-documents

# 3. Create KV namespace
npx wrangler kv namespace create KV
# → Copy the namespace id into wrangler.toml

# 4. Set secrets
npx wrangler secret put ANTHROPIC_API_KEY

# 5. Run D1 migrations (after Drizzle generates them)
npx drizzle-kit generate
npx wrangler d1 migrations apply job-analyzer-db --remote

# 6. Deploy
npx wrangler deploy
```

---

## 8. Build & Dev Scripts (`package.json` excerpt)

```json
{
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "preview": "wrangler dev",
    "deploy": "vinxi build && wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply job-analyzer-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply job-analyzer-db --remote",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| Loaders over TanStack Query | Start's native `loader` runs on the edge (server). Eliminates client-side waterfall. Query only needed if we add real-time polling later. |
| JSON columns in D1 | D1 is SQLite — no native JSON type, but `text` + Drizzle JSON helpers provide structured access without extra join tables. |
| KV for scrape cache | URL scrapes are idempotent and expensive. KV provides edge-local reads with configurable TTL (7 days). |
| Cron for analytics | Avoids expensive aggregation queries on every dashboard load. 6-hour cadence is sufficient for macro analytics. |
| ATS strict format | Enforced at prompt level AND in the PDF renderer. Section order is hardcoded, not configurable, to guarantee ATS parsing. |
| R2 for PDFs | Cheap, S3-compatible storage colocated with Workers. Presigned URLs or Worker-proxied downloads — no egress fees. |
| AI Gateway | Centralized logging, rate limiting, caching, and fallback routing for all LLM calls. Required for production observability. |

---

## 10. Awaiting Approval

**This document is the blueprint.** No code has been written. Please review the:

1. Wrangler bindings and configuration
2. Drizzle schema design (all 4 tables)
3. Routing structure and server function layout
4. Request flow for each workflow
5. Component hierarchy (primitives vs. features)

Confirm approval or request changes, and I will proceed with full implementation.
