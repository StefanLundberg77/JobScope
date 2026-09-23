/**
 * API route handlers for /api/jobs/[id]/tailor.
 * Orchestrates AI-driven resume tailoring, STAR-method bullet refinement, cover letter creation,
 * and human-in-the-loop manual overrides.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tailorApplicationWithAI } from "@/lib/gemini";
import { MasterProfileData } from "@/lib/types";

/**
 * POST /api/jobs/[id]/tailor
 * Initiates AI tailoring pipeline for the specified job posting.
 * Loads the candidate's Master-CV, invokes Gemini to align skills/achievements,
 * calculates ATS match score, and persists a new TailoredApplication record.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    let body: { language?: "sv" | "en" | "auto"; model?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const job = await prisma.jobListing.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Jobbannons hittades inte" },
        { status: 404 }
      );
    }

    const profileRecord = await prisma.masterProfile.findFirst();
    if (!profileRecord || !profileRecord.fullName) {
      return NextResponse.json(
        {
          error:
            "Vänligen fyll i ditt Master-CV under fliken 'Min Profil' innan du optimerar.",
        },
        { status: 400 }
      );
    }

    const profile: MasterProfileData = {
      id: profileRecord.id,
      fullName: profileRecord.fullName,
      email: profileRecord.email,
      phone: profileRecord.phone,
      location: profileRecord.location,
      title: profileRecord.title,
      summary: profileRecord.summary,
      website: profileRecord.website,
      linkedin: profileRecord.linkedin,
      github: profileRecord.github,
      experiences: JSON.parse(profileRecord.experiences || "[]"),
      education: JSON.parse(profileRecord.education || "[]"),
      skills: JSON.parse(profileRecord.skills || "[]"),
      languages: JSON.parse(profileRecord.languages || "[]"),
      projects: JSON.parse(profileRecord.projects || "[]"),
    };

    // Run AI tailoring with language option and optional model override
    const tailored = await tailorApplicationWithAI(
      {
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: JSON.parse(job.requiredSkills || "[]"),
      },
      profile,
      {
        language: body.language || "auto",
        model: body.model || undefined,
      }
    );

    // Save or update TailoredApplication in database
    const application = await prisma.tailoredApplication.create({
      data: {
        jobId: job.id,
        tailoredSummary: tailored.tailoredSummary,
        tailoredExperiences: JSON.stringify(tailored.tailoredExperiences),
        tailoredSkills: JSON.stringify(tailored.tailoredSkills),
        coverLetter: tailored.coverLetter,
        emailSubject: tailored.emailSubject || "",
        emailBody: tailored.emailBody || "",
        language: tailored.language || "sv",
        diffNotes: JSON.stringify(tailored.diffNotes),
      },
    });

    // Update job listing status and match score
    await prisma.jobListing.update({
      where: { id: job.id },
      data: {
        status: job.status === "saved" ? "tailored" : job.status,
        matchScore: tailored.matchAnalysis.score,
        matchAnalysis: JSON.stringify(tailored.matchAnalysis),
      },
    });

    return NextResponse.json({
      applicationId: application.id,
      ...tailored,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte generera ansökan";
    console.error("Tailor job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/jobs/[id]/tailor
 * Saves manual user edits to tailored resume, cover letter, or custom application notes.
 * Enforces human-in-the-loop control prior to printing or sending.
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const {
      applicationId,
      tailoredSummary,
      tailoredExperiences,
      tailoredSkills,
      coverLetter,
      emailSubject,
      emailBody,
      language,
      notes,
    } = body;

    let app = null;
    if (applicationId) {
      app = await prisma.tailoredApplication.update({
        where: { id: applicationId },
        data: {
          ...(tailoredSummary !== undefined && { tailoredSummary }),
          ...(tailoredExperiences !== undefined && {
            tailoredExperiences: JSON.stringify(tailoredExperiences),
          }),
          ...(tailoredSkills !== undefined && {
            tailoredSkills: JSON.stringify(tailoredSkills),
          }),
          ...(coverLetter !== undefined && { coverLetter }),
          ...(emailSubject !== undefined && { emailSubject }),
          ...(emailBody !== undefined && { emailBody }),
          ...(language !== undefined && { language }),
          ...(notes !== undefined && { notes }),
        },
      });
    } else {
      // Find latest or create
      const existing = await prisma.tailoredApplication.findFirst({
        where: { jobId: id },
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        app = await prisma.tailoredApplication.update({
          where: { id: existing.id },
          data: {
            ...(tailoredSummary !== undefined && { tailoredSummary }),
            ...(tailoredExperiences !== undefined && {
              tailoredExperiences: JSON.stringify(tailoredExperiences),
            }),
            ...(tailoredSkills !== undefined && {
              tailoredSkills: JSON.stringify(tailoredSkills),
            }),
            ...(coverLetter !== undefined && { coverLetter }),
            ...(emailSubject !== undefined && { emailSubject }),
            ...(emailBody !== undefined && { emailBody }),
            ...(language !== undefined && { language }),
            ...(notes !== undefined && { notes }),
          },
        });
      } else {
        app = await prisma.tailoredApplication.create({
          data: {
            jobId: id,
            tailoredSummary: tailoredSummary || "",
            tailoredExperiences: JSON.stringify(tailoredExperiences || []),
            tailoredSkills: JSON.stringify(tailoredSkills || []),
            coverLetter: coverLetter || "",
            emailSubject: emailSubject || "",
            emailBody: emailBody || "",
            language: language || "sv",
            notes: notes || "",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      application: {
        ...app,
        tailoredExperiences: JSON.parse(app.tailoredExperiences || "[]"),
        tailoredSkills: JSON.parse(app.tailoredSkills || "[]"),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara ändringar";
    console.error("Save tailored CV error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
