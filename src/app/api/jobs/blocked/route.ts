/**
 * API route handlers for /api/jobs/blocked.
 * Manages blocked/ignored job postings to prevent them from appearing in search results
 * or being ingested during automated scans.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/jobs/blocked
 * Retrieves all blocked job records.
 */
export async function GET() {
  try {
    const blocked = await prisma.blockedJob.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ blocked });
  } catch (error) {
    console.error("Failed to fetch blocked jobs:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta blockerade annonser" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs/blocked
 * Blocks a job ad by its externalId (e.g. 'linkedin-123' or JobTech ID).
 * If the job is currently saved in Kanban, it removes it from saved listings.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { externalId, title, company } = body;

    if (!externalId) {
      return NextResponse.json(
        { error: "externalId är obligatoriskt" },
        { status: 400 }
      );
    }

    const blocked = await prisma.blockedJob.upsert({
      where: { externalId },
      update: {
        title: title || undefined,
        company: company || undefined,
      },
      create: {
        externalId,
        title: title || null,
        company: company || null,
      },
    });

    // If job was previously saved in JobListing, remove it so it doesn't clutter Kanban
    try {
      await prisma.jobListing.deleteMany({
        where: { externalId },
      });
    } catch (e) {
      console.warn("Could not remove saved JobListing for blocked job:", e);
    }

    return NextResponse.json({ blocked });
  } catch (error) {
    console.error("Failed to block job:", error);
    return NextResponse.json(
      { error: "Kunde inte blockera annonsen" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/blocked?externalId=...
 * Unblocks a job ad so it can reappear in searches if desired.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get("externalId");

    if (!externalId) {
      return NextResponse.json(
        { error: "externalId är obligatoriskt" },
        { status: 400 }
      );
    }

    await prisma.blockedJob.deleteMany({
      where: { externalId },
    });

    return NextResponse.json({ success: true, unblocked: externalId });
  } catch (error) {
    console.error("Failed to unblock job:", error);
    return NextResponse.json(
      { error: "Kunde inte häva blockeringen" },
      { status: 500 }
    );
  }
}
