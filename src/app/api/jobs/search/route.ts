import { NextResponse } from "next/server";
import { searchJobTech } from "@/lib/jobtech";

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
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const data = await searchJobTech({
      query,
      location,
      remote,
      limit,
      offset,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Fel vid hämtning av annonser";
    console.error("Job search error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
