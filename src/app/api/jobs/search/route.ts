import { NextResponse } from "next/server";
import { searchJobTech } from "@/lib/jobtech";
import { searchLinkedInJobs } from "@/lib/linkedin";
import { UnifiedJobHit } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const location = (searchParams.get("location") || "goteborg") as
      | "goteborg"
      | "commute"
      | "region_14"
      | "all";
    const remote = searchParams.get("remote") === "true";
    const source = (searchParams.get("source") || "all") as "all" | "jobtech" | "linkedin";
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let hits: UnifiedJobHit[] = [];
    let totalCount = 0;

    if (source === "jobtech") {
      const data = await searchJobTech({ query, location, remote, limit, offset });
      hits = (data.hits || []).map((h) => ({
        ...h,
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
        searchJobTech({ query, location, remote, limit, offset }),
        searchLinkedInJobs({ query, location, remote, limit: Math.min(limit, 15), offset }),
      ]);

      const jtHits: UnifiedJobHit[] =
        jobTechResult.status === "fulfilled"
          ? (jobTechResult.value.hits || []).map((h) => ({
              ...h,
              source: "jobtech" as const,
            }))
          : [];

      const liHits: UnifiedJobHit[] =
        linkedInResult.status === "fulfilled"
          ? linkedInResult.value.hits || []
          : [];

      const jtTotal = jobTechResult.status === "fulfilled" ? jobTechResult.value.total?.value || 0 : 0;
      const liTotal = linkedInResult.status === "fulfilled" ? linkedInResult.value.total?.value || 0 : 0;

      // Interleave or combine hits
      hits = [...liHits, ...jtHits];
      totalCount = jtTotal + liTotal;
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
