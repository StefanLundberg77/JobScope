import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tailorApplicationWithAI } from "@/lib/gemini";
import { MasterProfileData } from "@/lib/types";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

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

    // Run AI tailoring
    const tailored = await tailorApplicationWithAI(
      {
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: JSON.parse(job.requiredSkills || "[]"),
      },
      profile
    );

    // Save or update TailoredApplication in database
    const application = await prisma.tailoredApplication.create({
      data: {
        jobId: job.id,
        tailoredSummary: tailored.tailoredSummary,
        tailoredExperiences: JSON.stringify(tailored.tailoredExperiences),
        tailoredSkills: JSON.stringify(tailored.tailoredSkills),
        coverLetter: tailored.coverLetter,
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

// User saves manual edits to the tailored CV / cover letter (Human-in-the-loop)
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
