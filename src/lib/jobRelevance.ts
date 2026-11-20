/**
 * Job relevance and exclusion engine for JobScope.
 * Implements a two-layer filtering strategy for Swedish and English tech job feeds:
 * 1. Always-on non-developer noise exclusion + positive developer relevance gate (in broad mode).
 * 2. User-configurable seniority and tech-stack exclusions with Swedish/English inflection expansion.
 */

/**
 * Targeted LinkedIn boolean search query for broad software, AI, and data developer sweeps.
 * Avoids ambiguous standalone terms like "Utvecklare" (matches Produktutvecklare/Metodutvecklare)
 * and bare "AI" (matches academic postdocs and mechanical CAE thesis ads).
 */
export const LINKEDIN_DEVELOPER_BROAD_QUERY =
  '(Systemutvecklare OR Mjukvaruutvecklare OR Fullstack OR "Software Engineer" OR "Software Developer" OR "AI Engineer" OR "Data Engineer" OR .NET OR Python)';

/**
 * Default user-configurable exclusion chips for seniority and unwanted tech stacks.
 * These are pre-selected in the Filter drawer and used as fallback defaults in /api/jobs/scan,
 * while remaining toggleable by the user in the UI.
 */
export const DEFAULT_CONFIGURABLE_EXCLUDES: string[] = [
  "Senior",
  "Erfaren",
  "Lead",
  "Arkitekt",
  "Embedded",
  "C++",
  "SAP",
  "Dynamics",
];

/**
 * Pattern expansion map for configurable exclusion chips.
 * Maps a short UI chip label to Swedish/English variants and inflections.
 */
const CONFIGURABLE_EXCLUDE_EXPANSIONS: Record<string, string[]> = {
  senior: ["senior", "seniora", "principal", "staff"],
  erfaren: ["erfaren", "erfarna"],
  lead: ["lead", "tech lead", "team lead", "technical lead"],
  arkitekt: [
    "arkitekt",
    "architect",
    "lösningsarkitekt",
    "systemarkitekt",
    "molnarkitekt",
    "it-arkitekt",
    "enterprise-arkitekt",
    "solution architect",
    "solutions architect",
    "cloud architect",
    "software architect",
    "enterprise architect",
    "system architect",
    "data architect",
  ],
  embedded: ["embedded", "inbyggda", "inbyggd", "firmware", "autosar", "adas", "rtos", "vhdl", "fpga"],
  "c++": ["c++"],
  sap: ["sap", "abap"],
  dynamics: [
    "dynamics",
    "dynamics 365",
    "business central",
    "d365",
    "jeeves",
    "erp-konsult",
    "ifs",
    "ifs-utvecklare",
    "servicenow",
    "salesforce",
  ],
  mobile: ["androidutvecklare", "ios-utvecklare", "android developer", "ios developer", "mobile developer"],
};

/**
 * Non-developer role patterns that are always excluded in broad developer search mode.
 * Covers academic/research roles, thesis/internships, non-software "-utvecklare" compounds,
 * IT support/infrastructure administration, mechanical/CAE/hardware engineering, and non-coding management.
 */
export const ALWAYS_EXCLUDED_NON_DEV_PATTERNS: string[] = [
  // Academic & Research
  "Postdoktor",
  "Postdoktorer",
  "Postdoc",
  "Doktorand",
  "PhD",
  "Forskare",
  "Universitetslektor",
  "Högskolelektor",
  "Adjunkt",
  "Professor",

  // Thesis, Internships & Student Assignments
  "Master Thesis",
  "Bachelor Thesis",
  "Thesis",
  "Examensarbete",
  "Exjobb",
  "LIA",
  "LIA-praktik",
  "Praktik",
  "Praktikant",
  "Intern",
  "Internship",
  "Sommarjobb",
  "Summer Intern",

  // Non-Software "-utvecklare" & Public-Sector / Business Roles
  "Produktutvecklare",
  "Metodutvecklare",
  "Verksamhetsutvecklare",
  "Affärsutvecklare",
  "Organisationsutvecklare",
  "Processutvecklare",
  "Fastighetsutvecklare",
  "Stadsutvecklare",
  "Samhällsutvecklare",
  "Kvalitetsutvecklare",
  "Konceptutvecklare",
  "Materialutvecklare",
  "Förpackningsutvecklare",
  "Receptutvecklare",
  "Kundutvecklare",
  "Utvecklingsledare",
  "Samordnare",
  "Biståndshandläggare",
  "Förvaltningsledare",
  "Business Developer",
  "Product Developer",
  "Method Developer",
  "Property Developer",
  "Park Manager",

  // IT Support, Helpdesk, Technicians & Infrastructure Administration
  "IT-tekniker",
  "IT tekniker",
  "Supporttekniker",
  "IT-support",
  "IT support",
  "Teknisk support",
  "Helpdesk",
  "Servicedesk",
  "Nätverkstekniker",
  "Drifttekniker",
  "Systemadministratör",
  "Servicetekniker",
  "Servicerådgivare",
  "Infrastrukturutvecklare",
  "Systemförvaltare",
  "Systemingenjör",
  "Systemspecialist",
  "Linuxspecialist",
  "Serverinfrastruktur",
  "Teknisk specialist",

  // Non-Coding Management, Agile Governance & Security Management
  "Product Owner",
  "Produktägare",
  "Produktledare",
  "Product Manager",
  "Produktchef",
  "Testledare",
  "Projektledare",
  "Delprojektledare",
  "Scrum Master",
  "Configuration Manager",
  "Teamcoach",
  "Informationssäkerhet",
  "Informationssäkerhetsspecialist",
  "Cybersecurity",
  "IT-säkerhetschef",
  "IT-säkerhetsansvarig",
  "Security Manager",
  "Chef för",
  "Chief of",
  "Head of",
  "Engineering Manager",
  "IT-chef",

  // Mechanical, CAE, Hardware & Low-Level Automotive Verification
  "CAE",
  "CAD",
  "HIL",
  "Hårdvara",
  "Hårdvarutestare",
  "Hardware",
  "Mekanik",
  "Mechanical",
  "Elkraft",
  "Electronics",
  "Electrical",
  "Propulsion",
  "Provare",
  "RF-testutvecklare",
  "Simuleringsteknik",
  "Thermal Management",
  "Verifikationsingenjör",
  "Verification Engineer",
  "Kristallzüchtung",
];

/**
 * Combined default exclusion patterns exported for backward compatibility.
 */
export const DEFAULT_EXCLUDED_ROLE_PATTERNS: string[] = [
  ...ALWAYS_EXCLUDED_NON_DEV_PATTERNS,
  ...DEFAULT_CONFIGURABLE_EXCLUDES,
];

/**
 * Positive software, AI, and data engineering signals required on job headlines
 * during broad developer sweeps ("Alla utvecklarjobb").
 * Intentionally excludes bare "utvecklare" and bare "AI" to prevent non-software false positives.
 */
const POSITIVE_DEVELOPER_SIGNALS: string[] = [
  // Swedish software, AI & data developer titles
  "systemutvecklare",
  "mjukvaruutvecklare",
  "mjukvarukonstruktör",
  "fullstackutvecklare",
  "backendutvecklare",
  "frontendutvecklare",
  "webbutvecklare",
  "apputvecklare",
  "mobilutvecklare",
  "spelutvecklare",
  "datautvecklare",
  "molnutvecklare",
  "integrationsutvecklare",
  "it-utvecklare",
  "ai-utvecklare",
  "ai utvecklare",
  "javautvecklare",
  "pythonutvecklare",
  ".net-utvecklare",
  "c#-utvecklare",
  "programmerare",
  "ml-ingenjör",
  "ai-ingenjör",
  "applikationsspecialist",
  "systemanalytiker",
  "mjukvarutestare",
  "testutvecklare",
  "testautomatiserare",
  "databasutvecklare",

  // English software, AI & data engineering titles
  "software engineer",
  "software developer",
  "software application",
  "software test",
  "sw engineer",
  "sw developer",
  "system developer",
  "systems developer",
  "application developer",
  "database developer",
  "dba",
  "full-stack",
  "fullstack",
  "full stack",
  "backend",
  "back-end",
  "frontend",
  "front-end",
  "web developer",
  "game developer",
  "ai engineer",
  "genai",
  "llm engineer",
  "ml engineer",
  "machine learning",
  "data engineer",
  "analytics engineer",
  "data solutions",
  "data scientist",
  "devops",
  "cloud engineer",
  "platform engineer",
  "site reliability",
  "sre",
  "integration developer",
  "integration engineer",
  "automation engineer",
  "qa engineer",
  "test automation",
  "developer",

  // Concrete programming languages, frameworks & platforms
  ".net",
  "c#",
  "python",
  "typescript",
  "javascript",
  "react",
  "next.js",
  "nextjs",
  "node.js",
  "nodejs",
  "angular",
  "vue",
  "java",
  "kotlin",
  "golang",
  "rust",
  "sql",
  "azure",
  "aws",
  "gcp",
  "docker",
  "kubernetes",
  "unity",
  "rag",
  "mcp",
  "api",
  "apis",
  "graphql",
];

/**
 * Escapes special regex metacharacters in a literal term.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tests whether a normalized text contains the given term with Unicode-safe word boundaries.
 * Handles Swedish characters (åäö) and non-alphanumeric tokens like "C++" or ".NET" reliably
 * without falsely matching longer words (e.g. "arkitekt" does not match "arkitektur").
 */
export function matchesTermBoundary(text: string, term: string): boolean {
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;

  const escaped = escapeRegex(cleanTerm);
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
  return regex.test(text);
}

/**
 * Expands user-supplied exclusion words using known Swedish/English role variants.
 */
function expandExclusionTerms(terms: string[]): string[] {
  const expanded = new Set<string>();
  for (const raw of terms) {
    const clean = raw.trim();
    if (!clean) continue;
    expanded.add(clean);
    const key = clean.toLowerCase();
    const variants = CONFIGURABLE_EXCLUDE_EXPANSIONS[key];
    if (variants) {
      for (const variant of variants) {
        expanded.add(variant);
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Checks whether a job ad headline or occupation label matches non-developer noise
 * or any user-configured exclusion terms.
 *
 * @param headline Job ad title
 * @param excludeWords User-selected exclusion chips (defaults to DEFAULT_CONFIGURABLE_EXCLUDES if omitted)
 * @param occupationLabel Optional taxonomy occupation label from JobTech
 * @param includeNonDevDefaults Whether to always apply non-developer domain exclusions (default: true)
 */
export function isExcludedJobTitle(
  headline: string,
  excludeWords: string[] = DEFAULT_CONFIGURABLE_EXCLUDES,
  occupationLabel?: string,
  includeNonDevDefaults = true
): boolean {
  const combined = `${headline || ""} ${occupationLabel || ""}`.trim();
  if (!combined) return false;

  const activeTerms = includeNonDevDefaults
    ? [...ALWAYS_EXCLUDED_NON_DEV_PATTERNS, ...expandExclusionTerms(excludeWords)]
    : expandExclusionTerms(excludeWords);

  for (const term of activeTerms) {
    if (matchesTermBoundary(combined, term)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a job headline contains at least one positive software, AI, or data
 * development signal. Used as a relevance gate during broad developer sweeps.
 */
export function hasDeveloperRelevanceSignal(headline: string): boolean {
  const cleanHeadline = (headline || "").trim();
  if (!cleanHeadline) return false;

  for (const signal of POSITIVE_DEVELOPER_SIGNALS) {
    if (matchesTermBoundary(cleanHeadline, signal)) {
      return true;
    }
  }

  // Catch compound Swedish software titles ending in "-utvecklare" preceded by a known tech token
  // while explicitly excluding non-software compounds already filtered by the denylist.
  if (/(?:system|mjukvaru|webb|app|mobil|spel|data|moln|cloud|ai|ml|api|net|java|python|react|sql|bi|integration)[\s-]?utvecklare/iu.test(cleanHeadline)) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether a job search hit is relevant for the user's current search parameters.
 *
 * Layer 1 (when broadIt is enabled):
 *   - Rejects non-developer noise (academic, thesis/LIA, non-software "-utvecklare", support, CAE/hardware, management).
 *   - When no explicit keyword query is entered ("Alla utvecklarjobb"), requires a positive software/AI/data signal on the headline.
 * Layer 2 (always active):
 *   - Rejects hits matching the user's active configurable exclusion chips (with Swedish/English variant expansion).
 */
export function isRelevantDeveloperHit(
  hit: {
    headline?: string;
    occupation?: { label?: string };
    source?: "jobtech" | "linkedin";
  },
  options: {
    broadIt: boolean;
    query?: string;
    excludeWords?: string[];
  }
): boolean {
  const headline = hit.headline || "";
  const occLabel = hit.occupation?.label;
  const excludeWords = options.excludeWords ?? DEFAULT_CONFIGURABLE_EXCLUDES;
  const isBroadDefaultSweep = options.broadIt && !(options.query || "").trim();

  // Reject excluded titles (non-dev defaults active whenever broadIt is on, plus user-configured chips always)
  if (isExcludedJobTitle(headline, excludeWords, occLabel, options.broadIt)) {
    return false;
  }

  // In broad default mode ("Alla utvecklarjobb"), enforce positive developer signal on headline
  if (isBroadDefaultSweep && !hasDeveloperRelevanceSignal(headline)) {
    return false;
  }

  return true;
}
