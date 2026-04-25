import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  Mail,
  BarChart3,
  ArrowRight,
  FileUser,
  Download,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

const steps = [
  {
    num: 1,
    icon: FileUser,
    title: "Set Up Your Profile",
    desc: "Go to My Profile and paste or upload your master resume. This lets our AI understand your skills and experience.",
  },
  {
    num: 2,
    icon: Search,
    title: "Analyze a Job Posting",
    desc: "Paste any job URL to get an AI-powered match score, gap analysis, strategic positioning notes, and career trajectory insight.",
  },
  {
    num: 3,
    icon: FileText,
    title: "Create Tailored Resume",
    desc: "Generate an ATS-optimized resume targeted to the specific job, with competencies and bullet points mapped to the JD.",
  },
  {
    num: 4,
    icon: Mail,
    title: "Create Cover Letter",
    desc: "Generate a professional cover letter that connects your achievements to the employer's pain points.",
  },
  {
    num: 5,
    icon: Download,
    title: "Download & Apply",
    desc: "Download your tailored documents and apply with confidence. Track all analyses in your History dashboard.",
  },
];

function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-12 sm:py-16 rise-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--lagoon)] mb-6">
          <Target className="h-3.5 w-3.5" />
          AI-Powered Job Analysis
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Analyze Any Job.<br />
          <span className="text-[var(--lagoon)]">Win the Interview.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-[var(--sea-ink-soft)] leading-relaxed">
          Paste a job URL and get instant AI analysis with match scoring, gap identification,
          and ATS-optimized resume and cover letter generation.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link to="/analyze">
              <Search className="h-4.5 w-4.5" />
              Analyze a Job
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-6">
            <Link to="/resume">
              <FileUser className="h-4.5 w-4.5" />
              My Profile
            </Link>
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <div className="text-center mb-10">
          <span className="island-kicker text-[var(--lagoon)]">How It Works</span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold">Five simple steps</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="feature-card rounded-xl border border-[var(--line)] p-5 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--lagoon)]/15 text-sm font-bold text-[var(--lagoon)]">
                    {step.num}
                  </span>
                  <Icon className="h-4.5 w-4.5 text-[var(--sea-ink-soft)]" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{step.title}</h3>
                <p className="text-xs text-[var(--sea-ink-soft)] leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Links */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/analyze"
          className="group island-shell rounded-xl border border-[var(--line)] p-5 no-underline transition-all hover:border-[var(--lagoon)]/30"
        >
          <Search className="h-6 w-6 text-[var(--lagoon)] mb-3" />
          <h3 className="text-base font-semibold text-[var(--sea-ink)] mb-1">Smart Analysis</h3>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            AI-powered gap analysis, match scoring, and strategic recommendations.
          </p>
        </Link>
        <Link
          to="/history"
          className="group island-shell rounded-xl border border-[var(--line)] p-5 no-underline transition-all hover:border-[var(--lagoon)]/30"
        >
          <BarChart3 className="h-6 w-6 text-[var(--lagoon)] mb-3" />
          <h3 className="text-base font-semibold text-[var(--sea-ink)] mb-1">History & Docs</h3>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Browse past analyses and download generated resumes and cover letters.
          </p>
        </Link>
        <Link
          to="/dashboard"
          className="group island-shell rounded-xl border border-[var(--line)] p-5 no-underline transition-all hover:border-[var(--lagoon)]/30"
        >
          <BarChart3 className="h-6 w-6 text-[var(--palm)] mb-3" />
          <h3 className="text-base font-semibold text-[var(--sea-ink)] mb-1">Analytics</h3>
          <p className="text-xs text-[var(--sea-ink-soft)]">
            Track keywords, industries, and match trends across your job search.
          </p>
        </Link>
      </section>
    </div>
  );
}
