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
    const excludeParam = searchParams.get("exclude") || "";
    const excludeWords = excludeParam
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    // Format negative terms for upstream APIs
    const negativeJtTerms = excludeWords.map((w) => `-${w}`).join(" ");
    const jtQuery = query
      ? `${query} ${negativeJtTerms}`.trim()
      : negativeJtTerms;

    const negativeLiTerms = excludeWords.map((w) => `NOT ${w}`).join(" ");
    const liQuery = query
      ? `${query} ${negativeLiTerms}`.trim()
      : negativeLiTerms
      ? `IT OR Utvecklare ${negativeLiTerms}`.trim()
      : "";

    let hits: UnifiedJobHit[] = [];
    let totalCount = 0;

    /**
     * Merges two collections of UnifiedJobHit, preserving unique IDs and upgrading
     * workplace_model to "remote" if designated in either hit.
     */
    function mergeJobHits(
      primaryHits: UnifiedJobHit[],
      secondaryHits: UnifiedJobHit[]
    ): UnifiedJobHit[] {
      const map = new Map<string, UnifiedJobHit>();
      for (const hit of primaryHits) {
        map.set(hit.id, { ...hit });
      }
      for (const hit of secondaryHits) {
        if (map.has(hit.id)) {
          const existing = map.get(hit.id)!;
          if (hit.workplace_model === "remote") {
            existing.workplace_model = "remote";
          }
        } else {
          map.set(hit.id, { ...hit });
        }
      }
      return Array.from(map.values());
    }

    async function fetchJobTechHits(): Promise<{ hits: UnifiedJobHit[]; total: number }> {
      if (!remote) {
        const data = await searchJobTech({ query: jtQuery || undefined, occupationField, location, remote: false, limit, offset, sort: jtSort });
        const normalized = (data.hits || []).map((h) => ({
          ...h,
          workplace_model: normalizeJobTechWorkplaceModel(h.workplace_model, h.headline, false),
          source: "jobtech" as const,
        }));
        return { hits: normalized, total: data.total?.value || normalized.length };
      }

      // Additive remote search: query local jobs AND nationwide remote jobs in parallel
      const [localRes, remoteRes] = await Promise.allSettled([
        searchJobTech({ query: jtQuery || undefined, occupationField, location, remote: false, limit, offset, sort: jtSort }),
        searchJobTech({ query: jtQuery || undefined, occupationField, location: "all", remote: true, limit, offset: 0, sort: jtSort }),
      ]);

      const localHits: UnifiedJobHit[] =
        localRes.status === "fulfilled"
          ? (localRes.value.hits || []).map((h) => ({
              ...h,
              workplace_model: normalizeJobTechWorkplaceModel(h.workplace_model, h.headline, false),
              source: "jobtech" as const,
            }))
          : [];

      const remoteHits: UnifiedJobHit[] =
        remoteRes.status === "fulfilled"
          ? (remoteRes.value.hits || []).map((h) => ({
              ...h,
              workplace_model: normalizeJobTechWorkplaceModel(h.workplace_model, h.headline, true),
              source: "jobtech" as const,
            }))
          : [];

      const localTotal = localRes.status === "fulfilled" ? localRes.value.total?.value || 0 : 0;
      const remoteTotal = remoteRes.status === "fulfilled" ? remoteRes.value.total?.value || 0 : 0;

      const merged = mergeJobHits(localHits, remoteHits);
      return { hits: merged, total: localTotal + remoteTotal };
    }

    async function fetchLinkedInHits(): Promise<{ hits: UnifiedJobHit[]; total: number }> {
      if (!remote) {
        const data = await searchLinkedInJobs({ query: liQuery || undefined, location, remote: false, limit, offset });
        return { hits: data.hits || [], total: data.total?.value || (data.hits || []).length };
      }

      // Additive remote search: query local LinkedIn jobs AND nationwide remote jobs in parallel
      const [localRes, remoteRes] = await Promise.allSettled([
        searchLinkedInJobs({ query: liQuery || undefined, location, remote: false, limit: Math.min(limit, 25), offset }),
        searchLinkedInJobs({ query: liQuery || undefined, location: "all", remote: true, limit: Math.min(limit, 25), offset: 0 }),
      ]);

      const localHits = localRes.status === "fulfilled" ? localRes.value.hits || [] : [];
      const remoteHits = remoteRes.status === "fulfilled" ? remoteRes.value.hits || [] : [];
      const localTotal = localRes.status === "fulfilled" ? localRes.value.total?.value || 0 : 0;
      const remoteTotal = remoteRes.status === "fulfilled" ? remoteRes.value.total?.value || 0 : 0;

      const merged = mergeJobHits(localHits, remoteHits);
      return { hits: merged, total: localTotal + remoteTotal };
    }

    if (source === "jobtech") {
      const jt = await fetchJobTechHits();
      hits = jt.hits;
      totalCount = jt.total;
    } else if (source === "linkedin") {
      const li = await fetchLinkedInHits();
      hits = li.hits;
      totalCount = li.total;
    } else {
      const [jt, li] = await Promise.all([fetchJobTechHits(), fetchLinkedInHits()]);
      hits = mergeJobHits(li.hits, jt.hits);
      totalCount = jt.total + li.total;
    }

    // Filter out hits where headline matches any excluded keyword
    if (excludeWords.length > 0) {
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const excludeRegexes = excludeWords.map(
        (w) => new RegExp(`(^|\\b|\\s)${escapeRegExp(w)}(\\b|\\s|$)`, "i")
      );
      hits = hits.filter((h) => {
        const headline = h.headline || "";
        return !excludeRegexes.some((rx) => rx.test(headline));
      });
      totalCount = Math.min(totalCount, hits.length);
    }

    // Query blocked jobs and saved listings from database
    const [blockedRecords, dismissedJobs, savedJobs] = await Promise.all([
      prisma.blockedJob.findMany({
        select: { externalId: true, reason: true },
      }),
      prisma.jobListing.findMany({
        where: { status: "dismissed" },
        select: { externalId: true, dismissReason: true },
      }),
      prisma.jobListing.findMany({
        where: { status: { not: "dismissed" } },
        select: { externalId: true, status: true },
      }),
    ]);

    const blockedMap = new Map<string, string | null>();
    blockedRecords.forEach((b) => {
      blockedMap.set(b.externalId, b.reason || null);
    });
    dismissedJobs.forEach((d) => {
      if (d.externalId) {
        if (!blockedMap.has(d.externalId) || !blockedMap.get(d.externalId)) {
          blockedMap.set(d.externalId, d.dismissReason || null);
        }
      }
    });

    const savedMap = new Map<string, string>();
    savedJobs.forEach((s) => {
      if (s.externalId) savedMap.set(s.externalId, s.status);
    });

    // Tag each hit with its blocked status, dismissal reason, and saved pipeline status
    hits = hits.map((h) => {
      const isBlocked = blockedMap.has(h.id);
      return {
        ...h,
        isBlocked,
        dismissReason: isBlocked ? blockedMap.get(h.id) || null : null,
        savedStatus: (savedMap.get(h.id) as any) || undefined,
      };
    });

    // Unless includeBlocked is explicitly requested, exclude blocked listings from the results
    if (!includeBlocked) {
      hits = hits.filter((h) => !blockedMap.has(h.id));
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
