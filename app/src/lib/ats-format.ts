/**
 * Strict ATS resume section ordering and formatting constraints.
 * The resume MUST follow this exact section hierarchy:
 *   1. Name Header
 *   2. Contact Information
 *   3. Professional Summary
 *   4. Core Competencies (8 strategic buckets)
 *   5. Technical Skills (5-6 categories)
 *   6. Professional Experience (6 bullets per role, [Action] + [Context] + [Quantifiable Result])
 *   7. Education
 *   8. Certifications
 *
 * Format rules:
 *   - Maximum 2 pages
 *   - No tables, columns, or complex formatting
 *   - Simple bullet points for lists
 *   - Clear section headers
 *   - No graphics, icons, or embedded images
 *   - Standard fonts only (handled at PDF level)
 *   - Professional Summary: 100 words maximum (2-3 sentences, at least 2 required), concise and impactful
 *   - Bold only 'PMP-Certified' and 'U.S. Army Veteran'
 */

export const ATS_SECTION_ORDER = [
  "Name Header",
  "Contact Information",
  "Professional Summary",
  "Core Competencies",
  "Technical Skills",
  "Professional Experience",
  "Education",
  "Certifications",
] as const;

export type AtsSection = (typeof ATS_SECTION_ORDER)[number];

export interface AtsResumeContent {
  nameHeader: string;
  contactInfo: string;
  professionalSummary: string;
  coreCompetencies: string[]; // 8 strategic buckets
  technicalSkills: Array<{
    category: string;
    skills: string[];
  }>;
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    bullets: string[]; // Exactly 6 bullets: [Action Verb] + [Context/Tool] + [Quantifiable Result]
  }>;
  education: Array<{
    degree: string;
    fieldOfStudy?: string;
    institution: string;
    year: string;
  }>;
  certifications: string[];
}

export interface StrategicAssessment {
  matchScore: number; // 0-100%
  matchRationale: string;
  gapAnalysis: Array<{
    requirement: string;
    status: "covered" | "partial" | "missing";
    suggestion?: string;
  }>;
  strategyNote: string; // How to position backgrounds like NetSuite/SaaS/DevOps
  careerAnalysis: {
    trajectory: string;
    recommendation: "pursue" | "consider" | "pass";
    reasoning: string;
  };
}

export interface KeywordMapping {
  keyword: string;
  priority: "critical" | "high" | "medium" | "nice_to_have";
  placement: string;
}

export interface CoverLetterContent {
  greeting: string;
  opening: string;
  bullets: string[];
  body?: string; // legacy fallback
  closing: string;
  signoff: string;
  candidateName: string;
}

export const STRATEGIC_ASSESSMENT_PROMPT = `Act as an 'Executive Resume Strategist and ATS Optimizer'. Perform a Pre-Writing Match Assessment.

CANDIDATE DATA:
{candidateData}

TARGET JOB DESCRIPTION:
{jobDescription}

Provide a Strategic Assessment JSON with:
1. matchScore (0-100): Based on Required vs. Preferred qualifications
2. matchRationale (string): Explain the score
3. gapAnalysis (array): List critical JD requirements not found in source documents. Do not invent fiction; flag gaps instead.
   - Each item: { requirement: "string", status: "covered|partial|missing", suggestion?: "string" }
4. strategyNote (string): How to position backgrounds (NetSuite/SaaS/DevOps) to mitigate gaps
5. careerAnalysis (object):
   - trajectory: "string" - How this position would affect career trajectory
   - recommendation: "pursue|consider|pass" 
   - reasoning: "string" - Whether to pursue this role

Return ONLY valid JSON, no other text.`;

export const RESUME_GENERATION_PROMPT = `Act as an 'Executive Resume Strategist and ATS Optimizer'. Generate a highly targeted, interview-winning resume that is a CUSTOMIZED version of the candidate's actual resume, tailored specifically to the target job description.

ZERO-TOLERANCE HALLUCINATION POLICY:
- Every word in the resume must be based on the candidate's actual experience, skills, achievements, and qualifications.
- Do NOT infer or add "adjacent" expertise (e.g., if they used Python, do NOT assume they know Go or Rust).
- Do NOT generalize or embellish achievements. If they don't mention a specific metric or accomplishment, do NOT fabricate it.
- Do NOT assume industry knowledge. If they didn't explicitly work in a domain, do NOT claim industry expertise.
- When in doubt, use ONLY what is explicitly written in the CANDIDATE ORIGINAL RESUME TEXT or the structured data.
- The professional summary, all competencies, all skills, and all achievements must be 100% grounded in the provided resume data.

HOW TO TAILOR (EXECUTE IN THIS ORDER):
1. ANALYZE TARGET JOB: Read the job title, company, and description. Extract:
   - Primary technical skills and tools required (e.g., Python, AWS, React, SQL)
   - Key methodologies or frameworks (e.g., Agile, microservices, CI/CD)
   - Business outcomes the role prioritizes (e.g., "scale systems," "improve performance," "reduce costs," "lead team")
   - Pain points or gaps the company needs to fill
   - Seniority level and scope (individual contributor vs. leadership)
2. MAP CANDIDATE EXPERIENCE TO JD: For each role in the candidate's resume, ask:
   - What skills/tools from THIS role match the target JD requirements?
   - What achievements in THIS role demonstrate those skills?
   - How can THIS role's experience bridge the candidate to the target position?
3. SELECT (not rephrase): For each candidate role, identify 10+ distinct achievements in the raw resume text. SELECT the 6 that:
   - Demonstrate the specific skills the JD requires (e.g., if JD requires SQL optimization, select bullets about database work)
   - Show relevant scale, leadership, or impact for the target role
   - Include quantifiable metrics and outcomes
   - Are contextually different (no two bullets describe the same type of work)
4. REWORD FOR JD LANGUAGE: Use phrasing patterns from the JD. If JD says "architected," use "architected." If JD says "optimized systems," reword related bullets to emphasize optimization and systems thinking.
5. PRESERVE FACTS: Company names, dates, titles, certifications, education — copy exactly from the original resume.

TAILORING GUIDANCE PRIORITY (CRITICAL):
- Treat "Additional Tailoring Guidance" as a first-class requirement, not an optional suggestion.
- If guidance asks for certain themes/tools/industries and those are supported by the candidate source data, you MUST reflect them in the output (especially in Professional Experience bullets).
- If guidance references a specific employer/role and that role exists in the provided candidate data, you MUST emphasize that role's most relevant achievements.
- Never fabricate: only apply guidance using facts already present in candidate data/raw text.

FORMAT REQUIREMENTS:
* Maximum 2 pages preferred, but NEVER omit experience entries to fit within 2 pages — all jobs are more important than the page count. Use standard headers, no tables, no graphics.
* CRITICAL — PROFESSIONAL EXPERIENCE: You MUST include EVERY SINGLE role listed in the candidate's structured data. Do NOT drop, merge, or omit any position for any reason — not for page length, not for relevance. If the candidate has 3 jobs, the output must have exactly 3 experience entries. If they have 4 jobs, output 4. Count the jobs in the structured data and verify your output contains the same count before responding.
* Professional Summary: 2-3 sentences (100 words maximum). At least 2 sentences required. CRITICAL: Synthesize ONLY from the candidate's actual qualifications, experience, and achievements in the resume. Be concise and impactful — every word should deliver value. Do NOT add qualifications, expertise, or accomplishments not explicitly stated in the resume. Do NOT infer specializations or capabilities the candidate has not mentioned. Do NOT generalize their background. TAILORING REQUIREMENT: Adjust the summary's emphasis to bridge the candidate's background specifically to the target role. If the target JD emphasizes project management, rewrite the summary to lead with PM expertise. If it emphasizes technical architecture, lead with architecture experience. If Additional Tailoring Guidance specifies certain strengths or specializations, weave those into the summary if they are evidenced in the resume. Write a focused bridging narrative using ONLY information explicitly found in their original resume text, but organized to immediately address what the target job is looking for.
* Core Competencies: 8 strategic buckets selected ONLY from the candidate's actual skills mentioned in the resume and structured data — do NOT invent new competencies. CRITICAL: Prioritize competencies that align with BOTH the target JD keywords AND the Additional Tailoring Guidance. If guidance requests specific competency areas, include those if they exist in the candidate's data. Do NOT add competencies that seem related but aren't explicitly stated. Only use skills, competencies, and expertise areas that are directly mentioned or clearly demonstrated in their experience. Every competency must match something in the candidate's materials.
* Technical Skills: CRITICAL — Extract ONLY from the candidate's provided structured data and resume text. Do NOT hallucinate, fabricate, or infer skills the candidate never used or mentioned. If the candidate does not mention AWS, do NOT add it. DYNAMIC SELECTION: Actively select technical skill categories based on which skills best match BOTH the target job description keywords AND the Additional Tailoring Guidance. For example: if the JD emphasizes project management AND guidance asks to highlight vendor management, select PM categories (Project Management Tools, Agile/Scrum, Vendor Management, etc.) over generic ones. If guidance emphasizes technical architecture, select infrastructure tools. Vary the categories based on JD and guidance relevance, not just what appears first. Use 5-6 categories in 'Category: Skill A, Skill B' format with only tools/technologies explicitly stated in the candidate's materials. Include methodologies (Waterfall, Agile, Hybrid), PM tools (Asana, Smartsheet, Monday.com), frameworks, and platforms — not just programming languages.
* Professional Experience: EXACTLY 6 bullets per role following [Action Verb] + [Context/Tool] + [Quantifiable Result]
  - You MUST generate exactly 6 bullets for every job role. No fewer, no more.
  - CRITICAL: Resume text contains MANY achievements per role. Your job is to SELECT which 6 achievements to highlight, based on the specific JD. Different JDs → DIFFERENT selections → DIFFERENT bullets.
  - SELECTION PROCESS (execute in this order):
    1. Read TARGET JD: Extract primary skills, tools, methodologies, pain points, and outcomes the job prioritizes
    2. Scan CANDIDATE ORIGINAL RESUME TEXT: Identify ALL distinct achievements, projects, responsibilities, and outcomes mentioned for this role
    3. Build achievement pool: Create a mental list of 10+ distinct things this candidate did in this role (e.g., "improved system performance," "built new feature," "managed vendor relationships," "reduced costs," "led team," etc.)
    4. SELECT 6 that best align with the TARGET JD (not generic, but specifically matching THIS job's requirements)
    5. For each selected achievement: Extract or infer the specific metrics/numbers from resume text
    6. Reword using language patterns from the JD (if JD says "optimized," use "optimized"; if JD says "spearheaded," use similar language)
  - Mining Real Metrics: Search the CANDIDATE ORIGINAL RESUME TEXT for specific numbers, percentages, dollar amounts, timeframes, team sizes tied to each achievement
  - Action Verbs: Select verbs that match JD language. If JD uses "Architected," "Optimized," "Led," use those or similar. Avoid generic verbs like "Worked on," "Helped with," "Assisted."
  - Examples of different selections for same role:
    * For JD emphasizing "database optimization": Select bullets about query tuning, indexing, performance improvements
    * For JD emphasizing "team leadership": Select bullets about mentoring, hiring, process improvements, team growth
    * For JD emphasizing "cost reduction": Select bullets about budget management, vendor negotiations, efficiency gains
    * For JD emphasizing "cloud infrastructure": Select bullets about AWS/Azure deployments, DevOps, infrastructure decisions
  - Only use achievements/metrics explicitly stated in resume text — do NOT invent outcomes
  - Do NOT fabricate achievements or responsibilities
  - Prioritize bullets showing skills matching BOTH the target JD AND Additional Tailoring Guidance
  - CRITICAL CHECK: Before finalizing, verify the 6 bullets:
    * Are DISTINCT (no two bullets describe similar work)
    * Collectively demonstrate the TOP 6 capabilities most relevant to THIS specific job
    * Each has real metrics/context from the resume
    * Would be DIFFERENT if generated for a different JD
* Education: Include degree type (e.g. B.S., M.S., MBA), field of study (e.g. Computer Science, Business Administration), institution, and graduation year — copy exactly from the candidate's resume
* Certifications: Copy EVERY certification from the candidate's resume — do not omit any. Include all abbreviated/special-character certs like PMP, CompTIA Network+, CompTIA A+, Security+, CCNA, AWS certs, etc.
* Maximize ATS keyword density while remaining factually accurate

CANDIDATE STRUCTURED DATA:
{candidateData}

CANDIDATE ORIGINAL RESUME TEXT (mine this for real achievements, metrics, and details):
{rawResumeText}

TARGET JOB:
Title: {jobTitle}
Company: {company}
Description: {jobDescription}
Key Keywords to Integrate: {keywords}
Additional Tailoring Guidance: {extraGuidance}

Respond with valid JSON only:
{
  "nameHeader": "string",
  "contactInfo": "string (Email | Phone | LinkedIn | Website)",
  "professionalSummary": "string (2-3 sentences, maximum 100 words, at least 2 sentences required, concise and impactful, tailored to bridge candidate background to target role)",
  "coreCompetencies": ["string", "string", ...] (exactly 8, from candidate's actual skills),
  "technicalSkills": [
    {"category": "string", "skills": ["string", "string"]},
    ...
  ] CRITICAL: Use ONLY skills from the candidate's structured data. Do NOT hallucinate or invent tools (e.g., do not add AWS if not mentioned),
  "experience": [
    {
      "title": "string (actual title from resume)",
      "company": "string (actual company from resume)",
      "dates": "string (actual dates from resume)",
      "bullets": ["string (exactly 6 real achievements reworded for target JD)", ...]
    }
  ],
  CRITICAL REMINDER: The experience array MUST contain one entry for EVERY job in the candidate's structured data. Do NOT omit any role.
  "education": [{"degree": "string (e.g. B.S., M.S., MBA)", "fieldOfStudy": "string (e.g. Computer Science)", "institution": "string", "year": "string"}],
  "certifications": ["string — include EVERY certification from the resume, omit NONE"]
}`;

export const COVER_LETTER_PROMPT = `Act as an 'Executive Resume Strategist'. Generate a professional, tailored cover letter.

CRITICAL INSTRUCTIONS:
* Maximum 1 page
* TAILORING REQUIREMENT: Every element—opening, bullets, closing—must be specifically tailored to the target job. Do NOT write a generic cover letter.
* Opening: Lead with a specific achievement from the resume that directly addresses a primary pain point or requirement from the job description
* Bullets: Connect exactly 3 SPECIFIC achievements from the candidate's ACTUAL resume to the 3 identified pain points in the JD. Each bullet must map 1:1 to 1 pain point.
* Closing: Reinforce why this candidate's specific experience makes them uniquely suited for THIS job (not just any job in the field).
* Do NOT fabricate or generalize — use real metrics, projects, and results from the candidate's resume
* Tone: Professional, decisive, forward-thinking
* Sign off with the candidate's actual name
* Treat Additional Tailoring Guidance as mandatory when it can be satisfied by source evidence in the resume data
* ACHIEVEMENT-TO-PAIN-POINT MAPPING: Before writing, explicitly map each identified pain point to a specific achievement in the candidate's resume. Write bullets that show the candidate has solved similar problems before.

CANDIDATE DATA:
{candidateData}

CANDIDATE ORIGINAL RESUME TEXT (mine for real achievements):
{rawResumeText}

TARGET JOB:
Title: {jobTitle}
Company: {company}
Description: {jobDescription}
Pain Points: {painPoints}
Additional Tailoring Guidance: {extraGuidance}

Respond with valid JSON:
{
  "greeting": "string",
  "opening": "string (1 paragraph, connect to pain point with a real achievement)",
  "bullets": ["string", "string", "string"] (exactly 3 bullet points, each a specific achievement from the resume tied to a JD pain point),
  "closing": "string",
  "signoff": "string (candidate's full name)",
  "candidateName": "string"
}`;

export const KEYWORD_VERIFICATION_PROMPT = `Analyze keyword placement and missing keywords.

JD KEYWORDS:
{jdKeywords}

RESUME CONTENT:
{resumeContent}

Respond with JSON:
{
  "keywordMappings": [
    {"keyword": "string", "priority": "critical|high|medium|nice_to_have", "placement": "section name or NOT FOUND"}
  ],
  "excludedKeywords": [
    {"keyword": "string", "transferableBridge": "string"}
  ],
  "assumptions": ["[ASSUMPTION] notes"],
  "verifications": ["[VERIFY] notes"]
}`;

/* Legacy prompts for backward compatibility */
export const RESUME_GENERATION_PROMPT_LEGACY = `You are an expert ATS resume optimizer. Generate a resume that is STRICTLY ATS-optimized.

CRITICAL FORMAT RULES:
- NO tables, columns, or multi-column layouts
- NO complex formatting, graphics, or icons
- Use simple bullet points (•) for lists
- Clear ALL-CAPS section headers
- Single-column layout only
- Standard readable formatting

MANDATORY SECTION ORDER (do not reorder, skip, or add sections):
1. NAME HEADER (Full name, large)
2. CONTACT INFORMATION (Email | Phone | LinkedIn | Website — one line)
3. PROFESSIONAL SUMMARY (2-3 sentences tailored to the job)
4. COMPETENCIES (bullet list of relevant skills/competencies)
5. TOOLS (bullet list of tools/technologies)
6. EXPERIENCE (reverse chronological, each with title, company, dates, bullets)
7. EDUCATION (degree, institution, year)
8. CERTIFICATIONS (list)

Respond with valid JSON matching this structure:
{
  "nameHeader": "string",
  "contactInfo": "string",
  "professionalSummary": "string",
  "competencies": ["string"],
  "tools": ["string"],
  "experience": [{"title":"string","company":"string","dates":"string","bullets":["string"]}],
  "education": [{"degree":"string","institution":"string","year":"string"}],
  "certifications": ["string"]
}`;

export const COVER_LETTER_PROMPT_LEGACY = `You are an expert cover letter writer. Generate a professional, ATS-friendly cover letter.

RULES:
- Standard business letter format
- 3-4 paragraphs: Opening, Body (1-2 paragraphs highlighting relevant experience), Closing
- Directly reference the job title and company
- Highlight specific matches between the candidate's experience and job requirements
- Professional but personable tone
- No excessive formatting

Respond with valid JSON:
{
  "greeting": "string",
  "opening": "string",
  "body": "string",
  "closing": "string",
  "signoff": "string"
}`;
