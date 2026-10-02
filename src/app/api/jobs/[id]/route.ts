/**
 * API route handlers for /api/jobs/[id].
 * Supports retrieving details, updating Kanban pipeline status or notes, and deleting job entries.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/jobs/[id]
 * Retrieves a single job listing by ID, including its associated tailored applications.
 */
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

/**
 * PATCH /api/jobs/[id]
 * Updates a job's Kanban lifecycle status (e.g. 'applied', 'interview') or custom notes.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { status, notes, dismissReason } = body;

    const updated = await prisma.jobListing.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(dismissReason !== undefined && { dismissReason }),
      },
      include: {
        applications: {
          take: 1,
        },
      },
    });

    // Synchronize with BlockedJob for automatic job search filtering
    if (status === "dismissed" && updated.externalId) {
      const activeReason =
        dismissReason !== undefined ? dismissReason : updated.dismissReason;
      await prisma.blockedJob.upsert({
        where: { externalId: updated.externalId },
        update: {
          title: updated.title,
          company: updated.company,
          reason: activeReason,
        },
        create: {
          externalId: updated.externalId,
          title: updated.title,
          company: updated.company,
          reason: activeReason,
        },
      });
    } else if (status && status !== "dismissed" && updated.externalId) {
      // If moving back to an active stage, unblock the job automatically
      await prisma.blockedJob.deleteMany({
        where: { externalId: updated.externalId },
      });
    }

    // If notes are supplied, update the latest application or create note
    if (notes !== undefined) {
      if (updated.applications.length > 0) {
        await prisma.tailoredApplication.update({
          where: { id: updated.applications[0].id },
          data: { notes },
        });
      } else {
        await prisma.tailoredApplication.create({
          data: {
            jobId: id,
            notes,
          },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera jobb";
    console.error("Update job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id]
 * Deletes a job listing and cascades deletion to linked tailored applications.
 */
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

