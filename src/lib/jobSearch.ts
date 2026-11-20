/**
 * Shared search, URL normalization, and duplicate-detection utilities for JobScope.
 * Used across API routes and frontend views to provide consistent Swedish/Unicode-safe
 * filtering and company history matching.
 */

import { BlockedJobItem, JobItem } from "@/lib/types";

/**
 * Minimal shape required to run text and URL search against a persisted job record.
 */
export interface SearchableJob {
  id: string;
  externalId?: string | null;
  title: string;
  company: string;
  location: string;
  url?: string | null;
  description?: string | null;
  requiredSkills?: string[] | string | null;
  preferredSkills?: string[] | string | null;
  status: string;
  dismissReason?: string | null;
  notes?: string | null;
  applications?: { notes?: string | null }[];
}

/**
 * Options controlling search scope.
 */
export interface JobQueryOptions {
  includeDescription?: boolean;
}

const TRACKING_QUERY_PARAMS = new Set([
  "trk",
  "refid",
  "trackingid",
  "ebp",
  "position",
  "pagenum",
  "fbclid",
  "gclid",
  "ref",
  "source",
  "src",
]);

/**
 * Normalizes text for case-insensitive matching with proper Swedish locale handling (a/o/u, aa/ae/oe).
 */
export function normalizeSearchText(value?: string | null): string {
  if (!value) return "";
  return value.toLocaleLowerCase("sv-SE").replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a company name for grouping multiple roles at the same employer.
 * Strips common legal entity suffixes (AB, Inc, Ltd, etc.) and trailing punctuation.
 */
export function normalizeCompanyName(company?: string | null): string {
  const base = normalizeSearchText(company)
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "";

  return base
    .replace(/\s+(ab|aktiebolag|hb|kb|inc|ltd|llc|gmbh|as|a\/s|oy)$/i, "")
    .trim();
}

/**
 * Extracts a numeric LinkedIn job ID from a LinkedIn URL or stored externalId.
 */
export function extractLinkedInJobId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  const extMatch = trimmed.match(/^linkedin-(\d+)$/i);
  if (extMatch) return extMatch[1];

  const viewMatch = trimmed.match(/linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d+)/i);
  if (viewMatch) return viewMatch[1];

  const queryMatch = trimmed.match(/[?&]currentJobId=(\d+)/i);
  if (queryMatch) return queryMatch[1];

  return null;
}

/**
 * Normalizes a job URL by removing tracking query params, www prefix, hash fragments, and trailing slashes.
 */
export function normalizeJobUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase();

    const keptParams: [string, string][] = [];
    parsed.searchParams.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(lowerKey)) {
        return;
      }
      keptParams.push([lowerKey, val]);
    });
    keptParams.sort(([a], [b]) => a.localeCompare(b));

    const queryStr =
      keptParams.length > 0
        ? "?" + keptParams.map(([k, v]) => `${k}=${v}`).join("&")
        : "";

    return `${host}${pathname}${queryStr}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Checks whether a search query appears to be a URL.
 */
function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
}

/**
 * Flattens a skill list (array or JSON string) into a single space-separated string.
 */
function flattenSkills(skills?: string[] | string | null): string {
  if (!skills) return "";
  if (Array.isArray(skills)) return skills.join(" ");
  return skills;
}

/**
 * Evaluates whether a job listing matches a user search query.
 * Supports LinkedIn job ID matching, normalized URL matching, and multi-token AND text search.
 */
export function matchesJobQuery(
  job: SearchableJob,
  rawQuery: string,
  options: JobQueryOptions = {}
): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  // Check LinkedIn job ID match first so pasted LinkedIn URLs match stored externalIds
  const queryLinkedInId = extractLinkedInJobId(trimmed);
  if (queryLinkedInId) {
    const jobLinkedInId =
      extractLinkedInJobId(job.externalId) || extractLinkedInJobId(job.url);
    if (jobLinkedInId && jobLinkedInId === queryLinkedInId) {
      return true;
    }
  }

  // Check normalized URL match when user pastes a link
  if (looksLikeUrl(trimmed)) {
    const normalizedQueryUrl = normalizeJobUrl(trimmed);
    const normalizedJobUrl = normalizeJobUrl(job.url);
    if (
      normalizedQueryUrl &&
      normalizedJobUrl &&
      (normalizedJobUrl === normalizedQueryUrl ||
        normalizedJobUrl.includes(normalizedQueryUrl) ||
        normalizedQueryUrl.includes(normalizedJobUrl))
    ) {
      return true;
    }
  }

  const normalizedQuery = normalizeSearchText(trimmed);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const appNotes = job.applications?.[0]?.notes || "";
  const fields = [
    job.company,
    job.title,
    job.location,
    job.url || "",
    job.externalId || "",
    job.notes || "",
    appNotes,
    job.dismissReason || "",
    flattenSkills(job.requiredSkills),
    flattenSkills(job.preferredSkills),
  ];

  if (options.includeDescription && job.description) {
    fields.push(job.description);
  }

  const haystack = normalizeSearchText(fields.join(" "));
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Evaluates whether a blocked job record matches a user search query.
 */
export function matchesBlockedJobQuery(
  blocked: BlockedJobItem,
  rawQuery: string
): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return false;

  const queryLinkedInId = extractLinkedInJobId(trimmed);
  if (queryLinkedInId) {
    const blockedLinkedInId = extractLinkedInJobId(blocked.externalId);
    if (blockedLinkedInId && blockedLinkedInId === queryLinkedInId) {
      return true;
    }
  }

  const tokens = normalizeSearchText(trimmed).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;

  const haystack = normalizeSearchText(
    [
      blocked.company || "",
      blocked.title || "",
      blocked.reason || "",
      blocked.externalId || "",
    ].join(" ")
  );

  return tokens.every((token) => haystack.includes(token));
}

/**
 * Finds existing saved jobs matching a pasted job URL or LinkedIn job ID.
 */
export function findDuplicateJobsForUrl(
  jobs: JobItem[],
  inputUrl: string
): JobItem[] {
  const trimmed = inputUrl.trim();
  if (!trimmed) return [];

  const targetLinkedInId = extractLinkedInJobId(trimmed);
  const targetNormalizedUrl = normalizeJobUrl(trimmed);

  if (!targetLinkedInId && !targetNormalizedUrl) return [];

  return jobs.filter((job) => {
    if (targetLinkedInId) {
      const jobLinkedInId =
        extractLinkedInJobId(job.externalId) || extractLinkedInJobId(job.url);
      if (jobLinkedInId && jobLinkedInId === targetLinkedInId) {
        return true;
      }
    }

    if (targetNormalizedUrl && job.url) {
      const jobNormalizedUrl = normalizeJobUrl(job.url);
      if (jobNormalizedUrl && jobNormalizedUrl === targetNormalizedUrl) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Builds a lookup map of normalized company name to total number of tracked listings.
 */
export function buildCompanyCounts(jobs: JobItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const key = normalizeCompanyName(job.company);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
