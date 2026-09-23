/**
 * API route handlers for /api/jobs/search.
 * Unified search proxy querying both JobTech Dev Search API and public LinkedIn.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchJobTech, OCCUPATION_FIELD_DATA_IT, normalizeJobTechWorkplaceModel } from "@/lib/jobtech";
import { searchLinkedInJobs } from "@/lib/linkedin";
import { UnifiedJobHit } from "@/lib/types";

/**
 * GET /api/jobs/search
 * Executes aggregated search across JobTech and LinkedIn based on query keywords,
 * location filters, remote toggle, and pagination parameters.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const broadIt = searchParams.get("broadIt") !== "false";
    const occupationField = broadIt ? OCCUPATION_FIELD_DATA_IT : undefined;
    const location = (searchParams.get("location") || "goteborg") as
      | "goteborg"
      | "commute"
      | "region_14"
      | "all";
    const remote = searchParams.get("remote") === "true";
    const includeBlocked = searchParams.get("includeBlocked") === "true";
    const source = (searchParams.get("source") || "all") as "all" | "jobtech" | "linkedin";
    const sort = searchParams.get("sort") || "relevance";
    const jtSort = sort === "date" ? ("pubdate-desc" as const) : undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let hits: UnifiedJobHit[] = [];
    let totalCount = 0;

    if (source === "jobtech") {
      const data = await searchJobTech({ query, occupationField, location, remote, limit, offset, sort: jtSort });
      hits = (data.hits || []).map((h) => ({
        ...h,
        workplace_model: normalizeJobTechWorkplaceModel(h.workplace_model, h.headline, remote),
        source: "jobtech" as const,
      }));
      totalCount = data.total?.value || hits.length;
    } else if (source === "linkedin") {
      const data = await searchLinkedInJobs({ query, location, remote, limit, offset });
      hits = data.hits || [];
      totalCount = data.total?.value || hits.length;
    } else {
      // Source is "all": query both in parallel
      const [jobTechResult, linkedInResult] = await Promise.allSettled([
        searchJobTech({ query, occupationField, location, remote, limit, offset, sort: jtSort }),
        searchLinkedInJobs({ query, location, remote, limit: Math.min(limit, 25), offset }),
      ]);

      const jtHits: UnifiedJobHit[] =
        jobTechResult.status === "fulfilled"
          ? (jobTechResult.value.hits || []).map((h) => ({
              ...h,
              workplace_model: normalizeJobTechWorkplaceModel(h.workplace_model, h.headline, remote),
              source: "jobtech" as const,
            }))
          : [];

      const liHits: UnifiedJobHit[] =
        linkedInResult.status === "fulfilled"
          ? linkedInResult.value.hits || []
          : [];

      const jtTotal = jobTechResult.status === "fulfilled" ? jobTechResult.value.total?.value || 0 : 0;
      const liTotal = linkedInResult.status === "fulfilled" ? linkedInResult.value.total?.value || 0 : 0;

      // Combine hits
      hits = [...liHits, ...jtHits];
      totalCount = jtTotal + liTotal;
    }

    // Filter out strictly on-site jobs if user selected remote filter
    if (remote) {
      hits = hits.filter((h) => h.workplace_model !== "onsite");
      totalCount = hits.length;
    }

    // Query blocked jobs from database
    const blockedRecords = await prisma.blockedJob.findMany({
      select: { externalId: true },
    });
    const blockedSet = new Set(blockedRecords.map((b) => b.externalId));

    // Tag each hit with its blocked status
    hits = hits.map((h) => ({
      ...h,
      isBlocked: blockedSet.has(h.id),
    }));

    // Unless includeBlocked is explicitly requested, exclude blocked listings from the results
    if (!includeBlocked) {
      hits = hits.filter((h) => !blockedSet.has(h.id));
      totalCount = hits.length;
    }

    // Sort combined results by publication date descending when requested
    if (sort === "date") {
      hits.sort((a, b) => {
        const timeA = a.publication_date ? new Date(a.publication_date).getTime() : 0;
        const timeB = b.publication_date ? new Date(b.publication_date).getTime() : 0;
        return timeB - timeA;
      });
    }

    return NextResponse.json({
      total: { value: totalCount },
      hits,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Fel vid hämtning av annonser";
    console.error("Job search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
