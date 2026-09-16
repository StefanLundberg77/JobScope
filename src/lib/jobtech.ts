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
  location?: "goteborg" | "commute" | "region_14" | "all";
  remote?: boolean;
  limit?: number;
  offset?: number;
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
  workplace_model?: string; // remote, hybrid, onsite
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
 * location, remote work, and occupation field filters.
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
