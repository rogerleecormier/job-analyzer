import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { getCloudflareEnv } from "@/lib/cloudflare";
import type { CloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { masterResume, jobAnalyses } from "@/db/schema";
import {
  allocateTokenBudgets,
  callClaude,
  truncateToTokenBudget,
  WORKERS_AI_CONTEXT_WINDOW_TOKENS,
} from "@/lib/ai-gateway";
import { scrapeJob } from "./scrape-job";
import { aggregateAnalytics } from "@/server/cron/aggregate-analytics";
import { jsonrepair } from "jsonrepair";
import { resolveSessionUser } from "@/lib/resolve-user";

function cleanJobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname.includes("linkedin.com") && url.pathname.includes("/jobs")) {
      const jobId = url.searchParams.get("currentJobId");
      if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
    }
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "trackingId", "refId", "eBP"];
    for (const p of trackingParams) url.searchParams.delete(p);
    return url.toString();
  } catch {
    return raw;
  }
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

interface GapItem {
  requirement: string;
  status: "covered" | "partial" | "missing";
  requirementType?: "required" | "preferred";
  suggestion: string;
}

interface ComprehensiveAnalysis {
  matchScore: number;
  gapAnalysis: GapItem[];
  recommendations: string[];
  pursue: boolean;
  pursueJustification: string;
  keywords: string[];
  jobTitle: string;
  company: string;
  industry: string;
  location: string;
  strategyNote: string;
  personalInterest: string;
  careerAnalysis: CareerAnalysis;
}

const GAP_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "are", "was", "were", "have", "has", "had", "will", "would", "should", "could", "about", "over", "under", "through", "while", "where", "when", "what", "which", "years", "year", "experience", "required", "preferred", "ability", "strong", "knowledge", "skills", "skill",
]);

const TOOL_REQUIREMENT_GENERIC_TERMS = new Set([
  "basic", "familiar", "with", "or", "other", "portfolio", "program", "project", "management", "software", "platform", "tool", "tools", "system", "systems", "application", "applications",
]);

const NAMED_TECH_PATTERN_MAP: Array<{ key: string; pattern: RegExp }> = [
  { key: "google-cloud", pattern: /\b(google cloud|gcp|google cloud platform)\b/ },
  { key: "kubernetes", pattern: /\b(kubernetes|k8s)\b/ },
  { key: "docker", pattern: /\b(docker|dockerized)\b/ },
  { key: "aws", pattern: /\b(aws|amazon web services)\b/ },
  { key: "azure", pattern: /\b(azure|microsoft azure)\b/ },
  { key: "terraform", pattern: /\b(terraform)\b/ },
  { key: "ansible", pattern: /\b(ansible)\b/ },
  { key: "jenkins", pattern: /\b(jenkins)\b/ },
  { key: "langchain", pattern: /\b(langchain)\b/ },
  { key: "n8n", pattern: /\b(n8n)\b/ },
  { key: "dify", pattern: /\b(dify)\b/ },
];

const AI_ORCHESTRATION_TECH_KEYS = new Set(["langchain", "n8n", "dify"]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+.#\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractKeywordTokens(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GAP_STOP_WORDS.has(token));
}

function extractToolSpecificTokens(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOOL_REQUIREMENT_GENERIC_TERMS.has(token));
}

function getMentionedNamedTechKeys(text: string): string[] {
  const normalizedText = normalizeText(text);
  return NAMED_TECH_PATTERN_MAP
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ key }) => key);
}

function hasExplicitNamedTechEvidence(requirement: string, evidenceText: string): boolean {
  const requiredTechKeys = getMentionedNamedTechKeys(requirement);
  if (requiredTechKeys.length === 0) {
    return false;
  }

  return requiredTechKeys.every((key) => {
    const entry = NAMED_TECH_PATTERN_MAP.find((patternDef) => patternDef.key === key);
    return entry ? entry.pattern.test(evidenceText) : false;
  });
}

function isNamedTechRequirement(requirement: string): boolean {
  return getMentionedNamedTechKeys(requirement).length > 0;
}

function hasPortfolioProgramSoftwareEvidence(evidenceText: string): boolean {
  return /(clarity|planview|asana|smartsheet|monday\.com|monday|jira|ms project|microsoft project|workfront|service ?now ppm|portfolio management software|program management software|project management software)/.test(evidenceText);
}

function hasNamedToolRequirementWithoutDirectEvidence(
  requirement: string,
  evidenceText: string,
): boolean {
  const requirementText = normalizeText(requirement);
  const namedTools = [
    "clarity",
    "planview",
    "workfront",
    "service now ppm",
    "servicenow ppm",
    "google cloud",
    "google cloud platform",
    "gcp",
    "kubernetes",
    "k8s",
    "docker",
    "aws",
    "azure",
    "terraform",
    "ansible",
    "jenkins",
    "langchain",
    "n8n",
    "dify",
  ];

  return namedTools.some((tool) => requirementText.includes(tool) && !evidenceText.includes(tool));
}

type EvidenceStatus = "none" | "partial" | "covered";

interface GapEvidenceAssessment {
  id: number;
  evidenceStatus: EvidenceStatus;
}

const CERTIFICATION_PATTERN_MAP: Array<{ key: string; pattern: RegExp }> = [
  { key: "csm", pattern: /\b(csm|certified scrum master)\b/ },
  { key: "safe-agilist", pattern: /\b(safe(?:\s+agilist)?|sa\b|leading\s+safe)\b/ },
  { key: "pmp", pattern: /\b(pmp|project management professional)\b/ },
  { key: "prince2", pattern: /\b(prince2|prince\s*2)\b/ },
  { key: "lean-six-sigma", pattern: /\b(lean\s+six\s+sigma|six\s+sigma)\b/ },
  { key: "itil", pattern: /\bitil\b/ },
];

function getMentionedCertificationKeys(text: string): string[] {
  const normalizedText = normalizeText(text);
  return CERTIFICATION_PATTERN_MAP
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ key }) => key);
}

function hasAnyCertificationSignal(evidenceText: string): boolean {
  return /(certified|certification|certificate|credential|pmp|scrum master|safe|agilist|prince2|itil|six sigma)/.test(evidenceText);
}

function isCertificationRequirement(requirement: string): boolean {
  const normalizedRequirement = normalizeText(requirement);
  return /(certified|certification|certificate|credential|csm|scrum master|safe|agilist|pmp|project management professional|prince2|itil|six sigma)/.test(normalizedRequirement);
}

function isEducationRequirement(requirement: string): boolean {
  const normalizedRequirement = normalizeText(requirement);
  return /(bachelor|master|mba|phd|doctorate|degree|education|university|college|academic|graduation|undergraduate|graduate)/.test(normalizedRequirement);
}

function isDomainContextRequirement(requirement: string): boolean {
  const normalizedRequirement = normalizeText(requirement);
  return /(fintech|financial technology|financial services|banking|payments|healthcare|health tech|medtech|ecommerce|retail tech|insurtech|saas|regulated industry)/.test(normalizedRequirement);
}

function hasTransferableDomainEvidence(requirement: string, evidenceText: string): boolean {
  const normalizedRequirement = normalizeText(requirement);

  if (/fintech|financial technology/.test(normalizedRequirement)) {
    return /(payments?|payment processing|banking|financial services|pci|fraud|kyc|aml|risk|compliance|treasury|subscription billing|merchant|card|lending|insurance)/.test(evidenceText);
  }

  if (/healthcare|health tech|medtech/.test(normalizedRequirement)) {
    return /(hipaa|clinical|patient|provider|ehr|emr|care management|health plan|medical device|pharmacy)/.test(evidenceText);
  }

  if (/ecommerce|retail tech/.test(normalizedRequirement)) {
    return /(checkout|cart|merchant|sku|inventory|fulfillment|order management|marketplace|consumer platform)/.test(evidenceText);
  }

  return false;
}

function hasTransferableSkillEvidence(requirement: string, evidenceText: string): boolean {
  if (isCertificationRequirement(requirement) || isEducationRequirement(requirement) || isNamedTechRequirement(requirement)) {
    return false;
  }

  if (hasTransferableDomainEvidence(requirement, evidenceText)) {
    return true;
  }

  const requirementTokens = extractKeywordTokens(requirement).filter(
    (token) => !["fintech", "industry", "domain", "experience", "background"].includes(token),
  );

  if (requirementTokens.length === 0) {
    return false;
  }

  const transferableMatches = requirementTokens.filter((token) => evidenceText.includes(token)).length;
  return transferableMatches >= 1 && transferableMatches < Math.max(2, Math.ceil(requirementTokens.length * 0.7));
}

function getCertificationEvidenceStatus(requirement: string, evidenceText: string): EvidenceStatus {
  const requiredCertificationKeys = getMentionedCertificationKeys(requirement);

  if (requiredCertificationKeys.length > 0) {
    const coveredBySpecificCertification = requiredCertificationKeys.some((key) => {
      const entry = CERTIFICATION_PATTERN_MAP.find((patternDef) => patternDef.key === key);
      return entry ? entry.pattern.test(evidenceText) : false;
    });

    if (coveredBySpecificCertification) {
      return "covered";
    }

    // Keep named certification requirements strict: adjacent credentials do not satisfy the requirement.
    return "none";
  }

  if (hasAnyCertificationSignal(evidenceText)) {
    return "covered";
  }

  return "none";
}

function buildResumeEvidenceText(resumeRow: {
  rawText: string | null;
  summary: string | null;
  competencies: string | null;
  tools: string | null;
  certifications: string | null;
  experience: string | null;
}): string {
  const chunks: string[] = [];
  if (resumeRow.rawText) chunks.push(resumeRow.rawText);
  if (resumeRow.summary) chunks.push(resumeRow.summary);

  const parseStringArray = (value: string | null): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  };

  const parseExperience = (value: string | null): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => JSON.stringify(item));
    } catch {
      return [];
    }
  };

  chunks.push(...parseStringArray(resumeRow.competencies));
  chunks.push(...parseStringArray(resumeRow.tools));
  chunks.push(...parseStringArray(resumeRow.certifications));
  chunks.push(...parseExperience(resumeRow.experience));

  return normalizeText(chunks.join("\n"));
}

function getGapEvidenceStatus(requirement: string, evidenceText: string): EvidenceStatus {
  const normalizedRequirement = normalizeText(requirement);
  if (!normalizedRequirement) return "none";

  if (isCertificationRequirement(requirement)) {
    return getCertificationEvidenceStatus(requirement, evidenceText);
  }

  if (isEducationRequirement(requirement)) {
    if (evidenceText.includes(normalizedRequirement)) {
      return "covered";
    }
    return "none";
  }

  if (isNamedTechRequirement(requirement)) {
    if (hasExplicitNamedTechEvidence(requirement, evidenceText)) {
      return "covered";
    }

    const namedTechKeys = getMentionedNamedTechKeys(requirement);
    const isAiOrchestrationRequirement = namedTechKeys.some((key) => AI_ORCHESTRATION_TECH_KEYS.has(key));

    if (isAiOrchestrationRequirement) {
      if (/(ai workflow|llm orchestration|prompt chaining|agent workflow|rag pipeline|workflow automation)/.test(evidenceText)) {
        return "partial";
      }

      return "none";
    }

    if (/(container|containerized|cloud|infrastructure|devops|platform engineering|sre)/.test(evidenceText)) {
      return "partial";
    }

    return "none";
  }

  const isToolRequirement = /(software|platform|tool|system|application)/.test(normalizedRequirement);

  // Fast path: full phrase exists.
  if (evidenceText.includes(normalizedRequirement)) {
    return "covered";
  }

  // Domain synonym checks for common false-gap categories.
  if (
    (normalizedRequirement.includes("agile") || normalizedRequirement.includes("scrum")) &&
    /(agile|scrum|kanban|safe|waterfall|hybrid|pmp|project management professional)/.test(evidenceText)
  ) {
    return "covered";
  }

  if (
    normalizedRequirement.includes("project management") &&
    /(pmp|project management professional|program management|portfolio management|scrum master)/.test(evidenceText)
  ) {
    // Certifications/role language alone are adjacent evidence; require software proof for tool requirements.
    if (isToolRequirement && !hasPortfolioProgramSoftwareEvidence(evidenceText)) {
      return "partial";
    }
    if (isToolRequirement && hasNamedToolRequirementWithoutDirectEvidence(requirement, evidenceText)) {
      return "partial";
    }
    return "covered";
  }

  if (
    normalizedRequirement.includes("stakeholder") &&
    /(stakeholder|cross functional|executive communication|client facing|vendor management)/.test(evidenceText)
  ) {
    return "covered";
  }

  if (isToolRequirement) {
    if (hasNamedToolRequirementWithoutDirectEvidence(requirement, evidenceText)) {
      if (hasPortfolioProgramSoftwareEvidence(evidenceText)) {
        return "partial";
      }
      return "none";
    }

    const toolSpecificTokens = extractToolSpecificTokens(requirement);
    if (toolSpecificTokens.length > 0) {
      const specificMatches = toolSpecificTokens.filter((token) => evidenceText.includes(token)).length;
      if (specificMatches > 0) return "covered";
    }

    if (hasPortfolioProgramSoftwareEvidence(evidenceText)) {
      return "covered";
    }

    if (/(pmp|project management professional|program management|portfolio management)/.test(evidenceText)) {
      return "partial";
    }
  }

  const tokens = extractKeywordTokens(requirement);
  if (tokens.length === 0) return "none";

  const matches = tokens.filter((token) => evidenceText.includes(token)).length;
  const ratio = matches / tokens.length;
  if (ratio >= 0.7 || (tokens.length >= 4 && matches >= 3)) {
    return "covered";
  }

  if (ratio >= 0.45 || matches >= 2) {
    return "partial";
  }

  if (hasTransferableSkillEvidence(requirement, evidenceText)) {
    return "partial";
  }

  return "none";
}

function buildRefinedSuggestion(requirement: string, evidenceStatus: Exclude<EvidenceStatus, "none">): string {
  if (isCertificationRequirement(requirement)) {
    if (evidenceStatus === "partial") {
      return "Adjacent certification evidence appears in the resume source, but not the exact credential listed; keep this as a gap unless the specific certification is earned.";
    }
    return "The specific certification appears in the resume source; make the credential line explicit in summary and skills so ATS and recruiters can quickly verify it.";
  }

  if (isEducationRequirement(requirement)) {
    if (evidenceStatus === "partial") {
      return "Education evidence appears adjacent but not explicit; keep this as a gap unless the required degree/education is clearly listed.";
    }
    return "Education requirement appears covered in the resume source; ensure degree and institution are explicit and easy to find.";
  }

  if (isNamedTechRequirement(requirement)) {
    if (evidenceStatus === "partial") {
      return "Adjacent infrastructure or cloud evidence appears in the resume source, but the named technology is not explicit; keep this as a partial match unless the exact platform/tool is listed.";
    }
    return "The named platform or tool appears explicitly in the resume source; make that technology mention easy to spot in summary, skills, or role bullets.";
  }

  if (/(software|platform|tool|system|application)/.test(normalizeText(requirement))) {
    if (evidenceStatus === "partial") {
      return "Partial evidence appears in the resume source; make the specific tool/platform alignment more explicit in bullets and skills.";
    }
    return "Evidence appears in the resume source; tighten wording in tailored bullets/summary so this alignment is explicit for ATS and recruiters.";
  }

  if (evidenceStatus === "partial") {
    if (isDomainContextRequirement(requirement)) {
      return "Transferable domain-adjacent skills appear in the resume source; map those examples directly to this domain expectation in tailored bullets.";
    }
    return "Partial evidence appears in the resume source; strengthen wording with concrete examples and measurable outcomes.";
  }

  return "Evidence appears in the resume source; tighten wording in tailored bullets/summary so this alignment is explicit for ATS and recruiters.";
}

const GAP_EVIDENCE_AI_MAX_TOKENS = 1_800;
const GAP_EVIDENCE_RESUME_TOKEN_BUDGET = 8_000;

async function assessGapEvidenceWithAI(
  gapAnalysis: GapItem[],
  evidenceText: string,
  env: Partial<CloudflareEnv>,
): Promise<Map<number, EvidenceStatus> | null> {
  if (!env.AI || gapAnalysis.length === 0 || !evidenceText.trim()) {
    return null;
  }

  const evidenceSnippet = truncateToTokenBudget(evidenceText, GAP_EVIDENCE_RESUME_TOKEN_BUDGET, {
    marker: "\n...[resume evidence truncated for gap evidence scoring]...\n",
    preserveHeadRatio: 0.7,
  });

  const requirementsPayload = gapAnalysis.map((item, index) => ({
    id: index,
    requirement: item.requirement,
    requirementType: item.requirementType ?? "required",
  }));

  const systemMsg = "You are a strict JSON-only evaluator for resume-to-job requirement evidence mapping.";
  const userMsg = `Evaluate each requirement against the resume evidence and return only JSON.

RESUME EVIDENCE:
${evidenceSnippet}

REQUIREMENTS:
${JSON.stringify(requirementsPayload)}

Rules:
- Assess semantic similarity and transferable skills for every requirement.
- For certifications and education: only explicit evidence can be covered.
- For named frameworks/platforms/tools: only explicit mention can be covered.
- If evidence is adjacent or transferable but not exact, mark partial.
- If no meaningful evidence exists, mark none.
- Never infer a tool/cert/degree that is not in the resume evidence.

Return exactly:
{
  "assessments": [
    { "id": 0, "evidenceStatus": "covered|partial|none" }
  ]
}`;

  try {
    const rawResponse = await callClaude(env, [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ], { maxTokens: GAP_EVIDENCE_AI_MAX_TOKENS });

    const rawStr = typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse);
    const jsonStart = rawStr.indexOf("{");
    const jsonEnd = rawStr.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    const jsonSlice = rawStr.slice(jsonStart, jsonEnd + 1);
    let parsed: { assessments?: GapEvidenceAssessment[] };
    try {
      parsed = JSON.parse(jsonSlice) as { assessments?: GapEvidenceAssessment[] };
    } catch {
      parsed = JSON.parse(jsonrepair(jsonSlice)) as { assessments?: GapEvidenceAssessment[] };
    }

    const assessments = Array.isArray(parsed.assessments) ? parsed.assessments : [];
    const statusMap = new Map<number, EvidenceStatus>();
    for (const assessment of assessments) {
      if (typeof assessment.id !== "number") continue;
      if (assessment.evidenceStatus === "covered" || assessment.evidenceStatus === "partial" || assessment.evidenceStatus === "none") {
        statusMap.set(assessment.id, assessment.evidenceStatus);
      }
    }

    return statusMap;
  } catch {
    return null;
  }
}

function classifyRequirementType(text: string): "required" | "preferred" {
  const normalizedText = normalizeText(text);

  if (/(required|required qualification|must have|must|mandatory|minimum qualification|minimum requirement|need to have|essential)/.test(normalizedText)) {
    return "required";
  }

  if (/(preferred|nice to have|plus|desired|ideally|bonus|would be beneficial|strongly preferred)/.test(normalizedText)) {
    return "preferred";
  }

  return "required";
}

function normalizeGapAnalysisItems(gapAnalysis: GapItem[]): GapItem[] {
  return gapAnalysis.map((item, index) => {
    const requirement = item.requirement ?? "";
    const suggestion = item.suggestion ?? "";
    const inferredType = classifyRequirementType(`${requirement} ${suggestion}`);

    return {
      ...item,
      requirementType: item.requirementType === "preferred" ? "preferred" : inferredType,
    };
  });
}

async function refineGapAnalysisWithEvidence(
  gapAnalysis: GapItem[],
  evidenceText: string,
  env: Partial<CloudflareEnv>,
): Promise<GapItem[]> {
  const aiEvidenceStatuses = await assessGapEvidenceWithAI(gapAnalysis, evidenceText, env);

  // Keep evidence reclassification AI-driven only.
  if (!aiEvidenceStatuses) {
    return gapAnalysis;
  }

  return gapAnalysis.map((item, index) => {
    const aiEvidenceStatus = aiEvidenceStatuses.get(index);
    if (!aiEvidenceStatus) {
      return item;
    }

    if (aiEvidenceStatus === "none") {
      return {
        ...item,
        status: "missing",
        suggestion:
          item.suggestion ||
          "No direct evidence appears in the resume source; add explicit experience if this requirement is important for the target role.",
      };
    }

    if (aiEvidenceStatus === "partial") {
      return {
        ...item,
        status: "partial",
        suggestion: buildRefinedSuggestion(item.requirement, "partial"),
        };
    }

    return {
      ...item,
      status: "covered",
      suggestion: buildRefinedSuggestion(item.requirement, "covered"),
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calibrateMatchScore(analysis: ComprehensiveAnalysis): number {
  const gapItems = Array.isArray(analysis.gapAnalysis) ? analysis.gapAnalysis : [];
  if (gapItems.length === 0) {
    return clamp(Math.round(analysis.matchScore || 0), 1, 100);
  }

  let weightedEarned = 0;
  let weightedPossible = 0;
  let requiredMissing = 0;
  let preferredMissing = 0;
  let requiredPartial = 0;
  let preferredPartial = 0;

  for (const item of gapItems) {
    const isPreferred = item.requirementType === "preferred";
    const itemWeight = isPreferred ? 0.65 : 1;
    const partialCredit = isPreferred ? 0.22 : 0.35;

    weightedPossible += itemWeight;

    if (item.status === "covered") {
      weightedEarned += itemWeight;
      continue;
    }

    if (item.status === "partial") {
      weightedEarned += itemWeight * partialCredit;
      if (isPreferred) preferredPartial += 1;
      else requiredPartial += 1;
      continue;
    }

    if (isPreferred) preferredMissing += 1;
    else requiredMissing += 1;
  }

  const coverageScore = weightedPossible > 0 ? (weightedEarned / weightedPossible) * 100 : 0;

  // Missing required qualifications are penalized more than preferred gaps.
  const missingPenalty = Math.pow(requiredMissing, 1.18) * 8.5 + Math.pow(preferredMissing, 1.08) * 3.5;
  // Partial matches still help, but with lower weight and lighter penalties.
  const partialPenalty = Math.pow(requiredPartial, 1.06) * 1.8 + Math.pow(preferredPartial, 1.04) * 0.9;

  // Small bonus for complete coverage signals to reward stronger fits.
  const completionBonus = requiredMissing + preferredMissing === 0 ? 2 : 0;

  const deterministicScore = clamp(
    Math.round(coverageScore - missingPenalty - partialPenalty + completionBonus),
    1,
    100,
  );

  const modelScore = clamp(Math.round(analysis.matchScore || 0), 1, 100);

  // Blend model judgment with deterministic rubric to keep nuance and improve consistency.
  let calibrated = Math.round(deterministicScore * 0.7 + modelScore * 0.3);

  // Hard caps prioritize required gaps over preferred gaps.
  if (requiredMissing >= 5) calibrated = Math.min(calibrated, 50);
  else if (requiredMissing >= 3) calibrated = Math.min(calibrated, 70);
  else if (requiredMissing >= 1) calibrated = Math.min(calibrated, 89);

  return clamp(calibrated, 1, 100);
}

const MIN_SCORE_TO_PURSUE = 70;
const MIN_SCORE_TO_CONSIDER = 45;

function enforceRecommendationThresholds(analysis: ComprehensiveAnalysis): ComprehensiveAnalysis {
  const calibratedScore = analysis.matchScore;
  const careerRecommendation = analysis.careerAnalysis?.recommendation;

  // Hard guard: low calibrated scores can never produce a pursue verdict.
  if (calibratedScore < MIN_SCORE_TO_PURSUE) {
    const downgradedRecommendation =
      calibratedScore >= MIN_SCORE_TO_CONSIDER ? "consider" : "pass";

    return {
      ...analysis,
      pursue: false,
      pursueJustification:
        `Score ${calibratedScore}/100 is below the pursue threshold of ${MIN_SCORE_TO_PURSUE}; recommendation downgraded to ${downgradedRecommendation}. ` +
        (analysis.pursueJustification ?? ""),
      careerAnalysis: {
        ...analysis.careerAnalysis,
        recommendation:
          careerRecommendation === "pursue"
            ? downgradedRecommendation
            : (careerRecommendation ?? downgradedRecommendation),
      },
    };
  }

  return analysis;
}

const ANALYSIS_OUTPUT_TOKEN_BUDGET = 6_144;
const ANALYSIS_PROMPT_OVERHEAD_TOKENS = 3_000;
const ANALYSIS_CONTEXT_TOKEN_BUDGET = Math.min(
  48_000,
  WORKERS_AI_CONTEXT_WINDOW_TOKENS - ANALYSIS_OUTPUT_TOKEN_BUDGET - ANALYSIS_PROMPT_OVERHEAD_TOKENS,
);
const ANALYSIS_MIN_SECTION_TOKENS = 4_000;

/**
 * Comprehensive job analysis — single AI call that produces match scoring,
 * gap analysis with status indicators, strategic positioning notes,
 * and career trajectory analysis. Replaces the old two-step
 * analyzeJob + performStrategicAssessment flow.
 */
export const analyzeJob = createServerFn({ method: "POST" })
  .inputValidator((data: { url?: string; jdText?: string }) => {
    if (!data.url && !data.jdText?.trim()) {
      throw new Error("A job URL or pasted job description text is required");
    }
    if (data.url && !URL.canParse(data.url)) {
      throw new Error("A valid URL is required");
    }
    if (data.jdText && data.jdText.trim().length < 50) {
      throw new Error("Job description text is too short");
    }
    return data;
  })
  .handler(async ({ data }) => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB) {
        throw new Error("Database not available in development mode. Run with wrangler or deploy to Cloudflare.");
      }
      const db = getDb(env.DB);
      const user = await resolveSessionUser();
      if (!user) throw new Error("Not authenticated");
      const cleanedUrl = data.url ? cleanJobUrl(data.url) : "text-input";

      // 1. Scrape or use provided job description text
      let jdText: string;
      if (data.jdText?.trim()) {
        jdText = data.jdText.trim();
      } else {
        const scraped = await scrapeJob({ data: { url: data.url! } });
        jdText = scraped.text;
      }

      // 2. Load master resume (only for authenticated users)
      let resumeText = "";
      let resumeEvidenceText = "";
      if (user) {
        const resume = await db.select().from(masterResume).where(eq(masterResume.userId, user.id)).limit(1);
        if (!resume.length) {
          throw new Error(
            "No master resume found. Please add your resume first.",
          );
        }
        resumeText = resume[0].rawText ?? "";
        resumeEvidenceText = buildResumeEvidenceText({
          rawText: resume[0].rawText,
          summary: resume[0].summary,
          competencies: resume[0].competencies,
          tools: resume[0].tools,
          certifications: resume[0].certifications,
          experience: resume[0].experience,
        });
      }

      // 3. Single comprehensive AI analysis
      const [jdTokenBudget, resumeTokenBudget] = allocateTokenBudgets(
        [jdText, resumeText],
        ANALYSIS_CONTEXT_TOKEN_BUDGET,
        ANALYSIS_MIN_SECTION_TOKENS,
      );

      const resumeSnippet = resumeText.length > 0
        ? truncateToTokenBudget(resumeText, resumeTokenBudget, {
            marker: "\n...[resume truncated for analysis budget]...\n",
            preserveHeadRatio: 0.65,
          })
        : "[No resume provided. Anonymous analysis.]";
      const jdSnippet = truncateToTokenBudget(jdText, jdTokenBudget, {
        marker: "\n...[job description truncated for analysis budget]...\n",
        preserveHeadRatio: 0.7,
      });

      const systemMsg = `You are a JSON-only API. You are an Executive Resume Strategist and ATS Optimizer. Respond with ONLY a valid JSON object, nothing else. No markdown, no prose, no code fences. Start your response with { and end with }.`;

      const userMsg = `Perform a comprehensive analysis of this job posting against the candidate's resume. Produce a single unified assessment.

JOB POSTING:
${jdSnippet}

CANDIDATE RESUME:
${resumeSnippet}

Return a JSON object with these exact keys:
{
  "jobTitle": "string (extracted from JD)",
  "company": "string (extracted from JD)",
  "industry": "string",
  "location": "string",
  "matchScore": integer 1-100,
  "gapAnalysis": [
    {"requirement": "JD requirement", "requirementType": "required|preferred", "status": "covered|partial|missing", "suggestion": "how to address if partial/missing"}
  ],
  "recommendations": ["actionable recommendation strings"],
  "pursue": boolean,
  "pursueJustification": "string explaining the pursue/pass decision",
  "keywords": ["critical ATS keywords from the JD"],
  "strategyNote": "string - how to strategically position the candidate's background to mitigate gaps and maximize strengths",
  "personalInterest": "string - 1-3 sentences explaining why this specific company, role, and industry would genuinely interest the candidate based on their background, career trajectory, and what the company/role offers. Be specific about the company's mission, products, or market position and how it connects to the candidate's experience or goals.",
  "careerAnalysis": {
    "trajectory": "how this role would affect career trajectory",
    "recommendation": "pursue|consider|pass",
    "reasoning": "detailed reasoning for the career recommendation",
    "salaryAssessment": {
      "listed": "exact salary or range from JD, or null if not listed",
      "projectedRange": "projected salary range based on role title, seniority, and job location/metro area market data (e.g. '$85,000 - $105,000')",
      "assessment": "1-2 sentence assessment: is the listed/projected salary competitive for this role and area? Note if below, at, or above market."
    }
  }
}

MATCH SCORE RUBRIC — follow this strictly:
- 90-100: Candidate meets ALL required qualifications AND most preferred qualifications. Near-perfect fit.
- 75-89: Candidate meets MOST required qualifications with only minor gaps. Strong fit.
- 60-74: Candidate meets SOME required qualifications but has notable gaps in key areas. Moderate fit.
- 40-59: Candidate meets FEW required qualifications. Significant skill/experience gaps. Weak fit.
- 1-39: Candidate is largely unqualified. Major misalignment in industry, skills, or experience level.

Score MUST reflect the actual gap count: if 3+ requirements are "missing", score cannot exceed 70. If 5+ are missing, score cannot exceed 50. Count each gapAnalysis item's status to calibrate the score.

Analyze ALL requirements in the JD. For gapAnalysis, include every key requirement with its status. Be specific in suggestions.

FULL JD COVERAGE:
- Do not limit analysis to sections explicitly labeled "Requirements" or "Qualifications".
- Also extract and evaluate skills/signals from responsibilities, day-to-day duties, preferred sections, and broader role description.
- Include domain context expectations (for example: fintech, healthcare, ecommerce) when implied by responsibilities or company context.

REQUIREMENT PRIORITY LABELING:
- Every gapAnalysis item MUST include requirementType as "required" or "preferred".
- Label a requirement as "required" when the JD uses language like: required, must, minimum qualifications, mandatory, essential.
- Label a requirement as "preferred" when the JD uses language like: preferred, nice to have, bonus, desired, ideally.
- If no signal exists, default to "required".

STRICT EVIDENCE RULES:
- Do not infer or assume credentials, certifications, licenses, degrees, or tool experience that are not explicitly present in the resume text.
- For named certifications (example: CSM, SAFe Agilist, PMP), only mark "covered" when that specific named credential appears in the resume.
- For named technologies/platforms (example: Google Cloud, Kubernetes, AWS, Azure, Terraform), only mark "covered" when that specific tool/platform appears explicitly in the resume.
- This exact-match rule also applies to AI/workflow platforms such as LangChain, n8n, and Dify.
- Do not treat generic adjacent experience as exact tool evidence (example: cloud or container experience does not equal Google Cloud or Kubernetes).
- Do not treat adjacent credentials as equivalent (example: PMP does not satisfy CSM/SAFe).
- If evidence is ambiguous or implied but not explicit, mark as "partial" or "missing".

TRANSFERABLE SKILLS RULES:
- For non-certification and non-education items, if direct evidence is missing but there is adjacent/translatable evidence from another skillset or industry, mark as "partial" (not "missing").
- Example: if fintech context is implied but not stated as a requirement, and resume evidence shows payments/risk/compliance/banking-adjacent work from other industries, add a domain-context item and mark it "partial".
- Partial matches should receive lower score weight than covered matches, but still contribute positively.`;

      const rawResponse = await callClaude(env, [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ], { maxTokens: ANALYSIS_OUTPUT_TOKEN_BUDGET });

      const rawStr = typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse);
      const jsonStart = rawStr.indexOf("{");
      const jsonEnd = rawStr.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        const preview = rawStr.slice(0, 200).replace(/\n/g, " ");
        console.error("[analyzeJob] No JSON object found. Response preview:", preview);
        throw new Error(`AI did not return structured data (got: "${preview.slice(0, 80)}…"). Please try again.`);
      }
      let analysis: ComprehensiveAnalysis;
      try {
        const jsonSlice = rawStr.slice(jsonStart, jsonEnd + 1);
        let jsonToParse = jsonSlice;
        try {
          analysis = JSON.parse(jsonToParse) as ComprehensiveAnalysis;
        } catch {
          // Attempt repair for common AI output issues (unescaped quotes, trailing commas, etc.)
          jsonToParse = jsonrepair(jsonSlice);
          analysis = JSON.parse(jsonToParse) as ComprehensiveAnalysis;
        }
      } catch (parseErr) {
        const preview = rawStr.slice(jsonStart, jsonStart + 200).replace(/\n/g, " ");
        console.error("[analyzeJob] JSON.parse failed after repair attempt. Snippet:", preview);
        throw new Error(`AI returned malformed JSON (${parseErr instanceof Error ? parseErr.message : "parse error"}). Please try again.`);
      }

      if (Array.isArray(analysis.gapAnalysis)) {
        analysis.gapAnalysis = normalizeGapAnalysisItems(analysis.gapAnalysis);
      }

      if (resumeEvidenceText && Array.isArray(analysis.gapAnalysis)) {
        analysis.gapAnalysis = await refineGapAnalysisWithEvidence(analysis.gapAnalysis, resumeEvidenceText, env);
      }

      analysis.matchScore = calibrateMatchScore(analysis);
      analysis = enforceRecommendationThresholds(analysis);

      // 4. Persist to D1 — update if upgrading an old record, otherwise insert
      const now = new Date().toISOString();
      const analysisValues = {
        userId: user.id,
        jobUrl: cleanedUrl,
        jobTitle: analysis.jobTitle,
        company: analysis.company,
        industry: analysis.industry,
        location: analysis.location,
        jdText,
        matchScore: analysis.matchScore,
        gapAnalysis: JSON.stringify(analysis.gapAnalysis),
        recommendations: JSON.stringify(analysis.recommendations),
        pursue: analysis.pursue ? 1 : 0,
        pursueJustification: analysis.pursueJustification,
        keywords: JSON.stringify(analysis.keywords),
        strategyNote: analysis.strategyNote,
        personalInterest: analysis.personalInterest,
        careerAnalysis: JSON.stringify(analysis.careerAnalysis),
        createdAt: now,
      };

      const [inserted] = await db
        .insert(jobAnalyses)
        .values(analysisValues)
        .returning();

      // Refresh dashboard metrics in the background after each analysis
      aggregateAnalytics(env, user.id).catch((e) => console.error("[analyzeJob] aggregateAnalytics error:", e));

      return {
        id: inserted.id,
        ...analysis,
      };
    } catch (error) {
      console.error("analyzeJob error:", error);
      throw error;
    }
  });

/**
 * Fetch a single analysis by ID.
 */
export const getAnalysis = createServerFn({ method: "GET" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    try {
      const env = getCloudflareEnv();
      if (!env.DB) {
        throw new Error("Database not available in development mode.");
      }
      const db = getDb(env.DB);

      const user = await resolveSessionUser();
      if (!user) throw new Error("Not authenticated");

      const [row] = await db
        .select()
        .from(jobAnalyses)
        .where(and(eq(jobAnalyses.id, data.id), eq(jobAnalyses.userId, user.id)))
        .limit(1);

      if (!row) throw new Error("Analysis not found");

      return {
        id: row.id,
        jobTitle: row.jobTitle ?? "Untitled Position",
        company: row.company ?? "Unknown Company",
        industry: row.industry ?? undefined,
        location: row.location ?? undefined,
        matchScore: row.matchScore ?? 0,
        pursueJustification: row.pursueJustification ?? "No justification provided",
        gapAnalysis: JSON.parse(row.gapAnalysis ?? "[]"),
        recommendations: JSON.parse(row.recommendations ?? "[]"),
        keywords: JSON.parse(row.keywords ?? "[]"),
        pursue: row.pursue === 1,
        strategyNote: row.strategyNote ?? "",
        personalInterest: row.personalInterest ?? "",
        careerAnalysis: row.careerAnalysis ? JSON.parse(row.careerAnalysis) : null,
        applied: row.applied === 1,
        appliedAt: row.appliedAt ?? null,
        jobUrl: row.jobUrl,
        jdText: row.jdText,
        createdAt: row.createdAt,
      };
    } catch (error) {
      console.error("getAnalysis error:", error);
      throw error;
    }
  });
