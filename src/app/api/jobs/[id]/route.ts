import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const job = await prisma.jobListing.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Jobbannons hittades inte" },
        { status: 404 }
      );
    }

    const parsed = {
      ...job,
      requiredSkills: JSON.parse(job.requiredSkills || "[]"),
      preferredSkills: JSON.parse(job.preferredSkills || "[]"),
      matchAnalysis: job.matchAnalysis ? JSON.parse(job.matchAnalysis) : null,
      applications: job.applications.map((app) => ({
        ...app,
        tailoredExperiences: JSON.parse(app.tailoredExperiences || "[]"),
        tailoredSkills: JSON.parse(app.tailoredSkills || "[]"),
        diffNotes: app.diffNotes ? JSON.parse(app.diffNotes) : [],
      })),
    };

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Fel vid hämtning av jobb";
    console.error("Get job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { status, notes } = body;

    const updated = await prisma.jobListing.update({
      where: { id },
      data: {
        ...(status && { status }),
      },
      include: {
        applications: {
          take: 1,
        },
      },
    });

    // If notes are supplied, update the latest application or create note
    if (notes !== undefined && updated.applications.length > 0) {
      await prisma.tailoredApplication.update({
        where: { id: updated.applications[0].id },
        data: { notes },
      });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera jobb";
    console.error("Update job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    await prisma.jobListing.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte radera jobb";
    console.error("Delete job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
