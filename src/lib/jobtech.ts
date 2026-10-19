/**
 * Arbetsförmedlingen JobTech Dev Search API client.
 * Provides integration for searching public Swedish job ads, filtering by municipality/region,
 * and fetching individual job postings without requiring an API key.
 */

/**
 * Parameters for querying the JobTech Search API.
 */
export interface JobTechSearchParams {
  query?: string;
  occupationField?: string;
  occupationGroups?: string[];
  location?: "goteborg" | "commute" | "region_14" | "all";
  remote?: boolean;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "pubdate-desc";
}

/**
 * Raw hit object returned by the JobTech Search API.
 */
export interface JobTechHit {
  id: string;
  headline: string;
  employer: {
    name: string;
    workplace?: string;
    url?: string;
  };
  workplace_address?: {
    municipality?: string;
    region?: string;
    city?: string;
    street_address?: string;
  };
  workplace_model?: string | { concept_id?: string | null; label?: string | null }; // remote, hybrid, onsite or taxonomy object
  publication_date: string;
  application_deadline?: string;
  webpage_url?: string;
  application_details?: {
    url?: string;
    email?: string;
    reference?: string;
  };
  description?: {
    text?: string;
    text_formatted?: string;
  };
  occupation?: {
    concept_id?: string;
    label?: string;
  };
  occupation_group?: {
    concept_id?: string;
    label?: string;
  };
  must_have?: {
    skills?: { label: string }[];
    languages?: { label: string }[];
    work_experiences?: { label: string }[];
  };
  nice_to_have?: {
    skills?: { label: string }[];
    languages?: { label: string }[];
    work_experiences?: { label: string }[];
  };
}

/**
 * Encapsulated search response envelope from JobTech API.
 */
export interface JobTechSearchResponse {
  total: {
    value: number;
  };
  hits: JobTechHit[];
}

/** Arbetsförmedlingen Data/IT occupation field taxonomy ID */
export const OCCUPATION_FIELD_DATA_IT = "apaJ_2ja_LuF";

/** Arbetsförmedlingen Software and Systems Developers occupation group taxonomy ID */
export const OCCUPATION_GROUP_SOFTWARE_DEV = "DJh5_yyF_hEM";

/** Arbetsförmedlingen System Testers and Test Leads occupation group taxonomy ID */
export const OCCUPATION_GROUP_TEST_QA = "D9SL_mtn_vGM";

/** Developer & QA occupation groups that strictly match software engineering qualifications */
export const DEVELOPER_OCCUPATION_GROUPS = [
  OCCUPATION_GROUP_SOFTWARE_DEV,
  OCCUPATION_GROUP_TEST_QA,
];

/** Default role keywords that should be excluded to avoid mismatched IT support, senior, embedded or ERP roles */
export const DEFAULT_EXCLUDED_ROLE_PATTERNS = [
  // Seniority & Leadership
  "Senior",
  "Erfaren",
  "Lead",
  "Principal",
  "Arkitekt",
  "Architect",
  // IT Support / Technician / Hardware / Infrastructure
  "IT-tekniker",
  "IT tekniker",
  "Supporttekniker",
  "IT-support",
  "IT support",
  "Helpdesk",
  "Servicedesk",
  "Nätverkstekniker",
  "Drifttekniker",
  "Systemadministratör",
  "Servicetekniker",
  "Servicerådgivare",
  // Non-coding management & test lead
  "Product Owner",
  "Produktägare",
  "Produktledare",
  "Testledare",
  "Projektledare",
  "Scrum Master",
  // Unwanted technical stacks
  "Embedded",
  "C++",
  "SAP",
  "Dynamics",
  "Business Central",
  "Jeeves",
  "ERP-konsult",
];

/**
 * Checks whether a job ad headline or occupation label matches any excluded patterns.
 */
export function isExcludedJobTitle(
  headline: string,
  excludeWords: string[] = [],
  occupationLabel?: string
): boolean {
  const combined = `${headline} ${occupationLabel || ""}`.toLowerCase();
  const allExcludes = Array.from(new Set([...DEFAULT_EXCLUDED_ROLE_PATTERNS, ...excludeWords]));

  for (const term of allExcludes) {
    const cleanTerm = term.trim().toLowerCase();
    if (!cleanTerm) continue;

    // Word boundary or phrase check
    const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, "i");
    if (regex.test(combined)) {
      return true;
    }
  }
  return false;
}

/** Official municipality code for Gothenburg */
const GOTEBORG_MUNICIPALITY = "1480";

/** Official Swedish municipality codes within commuting distance of Gothenburg */
const COMMUTE_MUNICIPALITIES = [
  "1480", // Göteborg
  "1481", // Mölndal
  "1402", // Partille
  "1401", // Härryda
  "1482", // Kungälv
  "1441", // Lerum
  "1440", // Ale
  "1489", // Alingsås
  "1384", // Kungsbacka
  "1490", // Borås
];

/** Official region code for Västra Götaland County */
const REGION_VASTRA_GOTALAND = "14";

/**
 * Queries the official Arbetsförmedlingen JobTech Dev Search API with optional keyword,
 * location, remote work, occupation field, or occupation groups filters.
 *
 * @param params Search query parameters
 * @returns Search response containing total count and array of job hits
 */
export async function searchJobTech(
  params: JobTechSearchParams
): Promise<JobTechSearchResponse> {
  const url = new URL("https://jobsearch.api.jobtechdev.se/search");

  if (params.query?.trim()) {
    url.searchParams.set("q", params.query.trim());
  }

  // Occupation field filter (e.g. Data/IT)
  if (params.occupationField) {
    url.searchParams.set("occupation-field", params.occupationField);
  }

  // Occupation groups filter (e.g. Mjukvaru- och systemutvecklare m.fl.)
  if (params.occupationGroups && params.occupationGroups.length > 0) {
    params.occupationGroups.forEach((group) => {
      url.searchParams.append("occupation-group", group);
    });
  }

  // Location filter
  if (params.location === "goteborg") {
    url.searchParams.set("municipality", GOTEBORG_MUNICIPALITY);
  } else if (params.location === "commute") {
    COMMUTE_MUNICIPALITIES.forEach((m) =>
      url.searchParams.append("municipality", m)
    );
  } else if (params.location === "region_14") {
    url.searchParams.set("region", REGION_VASTRA_GOTALAND);
  }

  // Remote filter
  if (params.remote) {
    url.searchParams.set("remote", "true");
  }

  // Sort order (e.g. relevance or pubdate-desc)
  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }

  url.searchParams.set("limit", String(params.limit ?? 25));
  url.searchParams.set("offset", String(params.offset ?? 0));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    // Cache searches briefly for performance
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`JobTech API returned status ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetches the full detailed payload for a specific job ad by JobTech ID.
 *
 * @param id JobTech ad ID
 * @returns Detailed JobTechHit object
 */
export async function fetchJobTechAd(id: string): Promise<JobTechHit> {
  const res = await fetch(`https://jobsearch.api.jobtechdev.se/ad/${id}`, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ad ${id} from JobTech API`);
  }

  return res.json();
}

/**
 * Normalizes workplace model from JobTech (which can be a string or { concept_id, label } object)
 * into a typed "remote" | "hybrid" | "onsite" value.
 */
export function normalizeJobTechWorkplaceModel(
  rawModel: unknown,
  headline?: string,
  isRemoteSearch?: boolean
): "remote" | "hybrid" | "onsite" {
  const modelObj =
    typeof rawModel === "object" && rawModel !== null
      ? (rawModel as { label?: string | null })
      : null;
  const label = typeof rawModel === "string" ? rawModel : modelObj?.label || "";
  const lowerLabel = label.toLowerCase();
  const lowerHeadline = (headline || "").toLowerCase();

  if (
    lowerLabel.includes("distans") ||
    lowerLabel.includes("remote") ||
    lowerHeadline.includes("distans") ||
    lowerHeadline.includes("remote")
  ) {
    return "remote";
  }
  if (lowerLabel.includes("hybrid") || lowerHeadline.includes("hybrid")) {
    return "hybrid";
  }
  if (lowerLabel.includes("plats") || lowerLabel.includes("onsite")) {
    return "onsite";
  }
  if (isRemoteSearch) {
    return "remote";
  }
  return "onsite";
}

