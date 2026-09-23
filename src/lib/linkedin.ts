/**
 * Public LinkedIn Job Search and Scraper Client (Guest Mode - No Login Required).
 * Queries public guest job endpoints and extracts metadata using regex parsing
 * to circumvent authentication requirements.
 */

import { UnifiedJobHit } from "./types";
import { ParsedJobAd } from "./parser";

/**
 * Parameters for querying the public LinkedIn guest jobs search endpoint.
 */
export interface LinkedInSearchParams {
  query?: string;
  location?: "goteborg" | "commute" | "region_14" | "all" | string;
  remote?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Normalized LinkedIn search response envelope.
 */
export interface LinkedInSearchResponse {
  total: {
    value: number;
  };
  hits: UnifiedJobHit[];
}

/**
 * Decodes HTML character entities (named and decimal) into standard UTF-8 characters.
 *
 * @param html String containing HTML entity encodings
 * @returns Decoded plain text string
 */
function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

/**
 * Maps application internal location identifiers to LinkedIn location strings.
 *
 * @param location Internal location identifier
 * @returns LinkedIn geographic query string
 */
function mapLocationToLinkedIn(location?: string): string {
  switch (location) {
    case "goteborg":
    case "commute":
      return "Gothenburg, Sweden";
    case "region_14":
      return "Västra Götaland County, Sweden";
    case "all":
      return "Sweden";
    default:
      return location || "Gothenburg, Sweden";
  }
}

/**
 * Validates whether a provided URL belongs to the linkedin.com domain.
 *
 * @param url Candidate URL string
 * @returns True if URL hostname contains linkedin.com
 */
export function isLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("linkedin.com");
  } catch {
    return false;
  }
}

/**
 * Searches public LinkedIn job listings via the guest endpoint without requiring authentication.
 *
 * @param params Search query parameters (keywords, location, remote, pagination)
 * @returns Parsed unified job hits
 */
export async function searchLinkedInJobs(
  params: LinkedInSearchParams
): Promise<LinkedInSearchResponse> {
  const rawQuery = params.query?.trim() || "IT OR Utvecklare OR Developer";
  // The LinkedIn guest endpoint ignores f_WT, so append remote/distans keywords
  // to ensure only actual remote positions are returned.
  const query = params.remote
    ? params.query?.trim()
      ? `${rawQuery} (remote OR distans)`
      : `(${rawQuery}) (remote OR distans)`
    : rawQuery;
  const location = mapLocationToLinkedIn(params.location);
  const start = params.offset ?? 0;
  const targetLimit = params.limit ?? 25;

  // LinkedIn returns up to 10 cards per guest API chunk.
  // When targetLimit > 10, calculate required page offsets (capped at 3 pages / 30 hits for performance).
  const pageSize = 10;
  const numPages = Math.min(Math.ceil(targetLimit / pageSize), 3);
  const pageOffsets = Array.from({ length: numPages }, (_, i) => start + i * pageSize);

  const fetchPage = async (pageStart: number): Promise<UnifiedJobHit[]> => {
    const url = new URL(
      "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    );
    url.searchParams.set("keywords", query);
    url.searchParams.set("location", location);
    url.searchParams.set("start", String(pageStart));

    if (params.remote) {
      url.searchParams.set("f_WT", "2"); // 2 = Remote on LinkedIn
    }

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      console.warn(`LinkedIn search returned status ${res.status}: ${res.statusText}`);
      return [];
    }

    const html = await res.text();
    const cardRegex = /<li[\s\S]*?<\/li>/gi;
    const cards = html.match(cardRegex) || [];

    const pageHits: UnifiedJobHit[] = [];

    for (const card of cards) {
      // Extract title
      const titleMatch = card.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      const title = titleMatch ? decodeHtml(titleMatch[1].replace(/<[^>]+>/g, "")) : "";
      if (!title) continue;

      // Extract company
      const companyMatch = card.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
      const company = companyMatch ? decodeHtml(companyMatch[1].replace(/<[^>]+>/g, "")) : "Företag";

      // Extract location
      const locMatch = card.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const loc = locMatch ? decodeHtml(locMatch[1].replace(/<[^>]+>/g, "")) : "Göteborg";

      const lowerTitle = title.toLowerCase();
      const lowerLoc = loc.toLowerCase();

      const isExplicitOnsite =
        lowerTitle.includes("på plats") ||
        lowerTitle.includes("onsite") ||
        lowerLoc.includes("på plats");
      const isExplicitRemote =
        lowerTitle.includes("remote") ||
        lowerTitle.includes("distans") ||
        lowerLoc.includes("remote") ||
        lowerLoc.includes("distans");
      const isExplicitHybrid =
        lowerTitle.includes("hybrid") ||
        lowerLoc.includes("hybrid");

      // Skip explicitly on-site jobs if user requested remote positions
      if (params.remote && isExplicitOnsite) {
        continue;
      }

      let workplaceModel: "remote" | "hybrid" | "onsite" = "onsite";
      if (isExplicitRemote) {
        workplaceModel = "remote";
      } else if (isExplicitHybrid) {
        workplaceModel = "hybrid";
      } else if (params.remote) {
        workplaceModel = "remote";
      }

      // Extract link
      const linkMatch = card.match(/<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);
      const rawLink = linkMatch ? linkMatch[1].split("?")[0] : "";

      // Extract ID from urn or link
      const urnMatch = card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/i);
      const linkIdMatch = rawLink.match(/-(\d+)$/);
      const jobId = urnMatch ? urnMatch[1] : linkIdMatch ? linkIdMatch[1] : `li-${Math.random().toString(36).substring(2, 9)}`;

      // Extract date
      const timeMatch = card.match(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/i);
      const pubDate = timeMatch ? (timeMatch[1] || timeMatch[2]?.trim()) : new Date().toISOString().split("T")[0];

      pageHits.push({
        id: `linkedin-${jobId}`,
        headline: title,
        employer: {
          name: company,
          url: undefined,
        },
        workplace_address: {
          municipality: loc,
          city: loc,
        },
        workplace_model: workplaceModel,
        publication_date: pubDate,
        webpage_url: rawLink,
        source: "linkedin",
      });
    }

    return pageHits;
  };

  try {
    const results = await Promise.allSettled(pageOffsets.map(fetchPage));
    const seenIds = new Set<string>();
    const hits: UnifiedJobHit[] = [];

    for (const res of results) {
      if (res.status === "fulfilled") {
        for (const hit of res.value) {
          if (!seenIds.has(hit.id)) {
            seenIds.add(hit.id);
            hits.push(hit);
          }
        }
      }
    }

    const trimmedHits = hits.slice(0, targetLimit);

    return {
      total: {
        value: trimmedHits.length,
      },
      hits: trimmedHits,
    };
  } catch (error) {
    console.error("LinkedIn search fetch failed:", error);
    return { total: { value: 0 }, hits: [] };
  }
}

/**
 * Fetches and parses the full public job posting details from a LinkedIn job page.
 * Extracts title, company, location, formatted description, and workplace model.
 *
 * @param urlOrId Full LinkedIn job URL or prefixed LinkedIn identifier (e.g. 'linkedin-12345')
 * @returns Normalized ParsedJobAd payload
 */
export async function fetchLinkedInJobDetails(urlOrId: string): Promise<ParsedJobAd> {
  let targetUrl = urlOrId;
  if (!targetUrl.startsWith("http")) {
    const cleanId = targetUrl.replace(/^linkedin-/, "");
    targetUrl = `https://www.linkedin.com/jobs/view/${cleanId}`;
  }

  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!res.ok) {
    throw new Error(`Kunde inte hämta LinkedIn-annons (HTTP ${res.status})`);
  }

  const html = await res.text();

  // Extract Title
  const titleMatch =
    html.match(/<h1[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtml(titleMatch[1].replace(/<[^>]+>/g, "")).split("|")[0].split("-")[0].trim()
    : "Systemutvecklare";

  // Extract Company
  const companyMatch =
    html.match(/<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<span[^>]*class="[^"]*topcard__flavor[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const company = companyMatch
    ? decodeHtml(companyMatch[1].replace(/<[^>]+>/g, "")).trim()
    : "LinkedIn Arbetsgivare";

  // Extract Location
  const locMatch =
    html.match(/<span[^>]*class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const location = locMatch
    ? decodeHtml(locMatch[1].replace(/<[^>]+>/g, "")).trim()
    : "Göteborg";

  // Extract Description Markup
  const descMatch =
    html.match(/<div class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<section class="show-more-less-html"[^>]*>([\s\S]*?)<\/section>/i);

  let cleanDescription = "";
  if (descMatch) {
    cleanDescription = descMatch[1]
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim();
    cleanDescription = decodeHtml(cleanDescription);
  } else {
    // Fallback: strip all tags from body
    cleanDescription = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Determine workplace type
  let workplaceType: "onsite" | "hybrid" | "remote" = "onsite";
  const lowerContent = (title + " " + cleanDescription + " " + location).toLowerCase();
  if (lowerContent.includes("remote") || lowerContent.includes("distans")) {
    workplaceType = "remote";
  } else if (lowerContent.includes("hybrid")) {
    workplaceType = "hybrid";
  }

  return {
    title,
    company,
    location,
    workplaceType,
    url: targetUrl,
    description: cleanDescription,
    requiredSkills: [],
    preferredSkills: [],
  };
}
