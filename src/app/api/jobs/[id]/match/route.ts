/**
 * API route handlers for /api/jobs/[id]/match.
 * Evaluates ATS semantic match score and requirement alignment on demand
 * for a specific saved job listing using Gemini AI.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeJobMatchWithAI, getGeminiApiKey } from "@/lib/gemini";
import { MasterProfileData } from "@/lib/types";

/**
 * POST /api/jobs/[id]/match
 * Executes on-demand ATS match analysis for an existing job listing and persists the result.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Ingen Gemini API-nyckel konfigurerad. Ange den under Inställningar." },
        { status: 400 }
      );
    }

    const job = await prisma.jobListing.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Jobbannonsen hittades inte i databasen." },
        { status: 404 }
      );
    }

    const profileRecord = await prisma.masterProfile.findFirst();
    if (!profileRecord || !profileRecord.title) {
      return NextResponse.json(
        { error: "Vänligen fyll i ditt Master-CV under 'Min Profil' innan du kör matchning." },
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

    const analysis = await analyzeJobMatchWithAI(
      {
        title: job.title,
        company: job.company,
        description: job.description,
        requiredSkills: JSON.parse(job.requiredSkills || "[]"),
        preferredSkills: JSON.parse(job.preferredSkills || "[]"),
      },
      profile
    );

    const updatedJob = await prisma.jobListing.update({
      where: { id: job.id },
      data: {
        matchScore: analysis.score,
        matchAnalysis: JSON.stringify(analysis),
      },
    });

    return NextResponse.json({
      ...updatedJob,
      requiredSkills: JSON.parse(updatedJob.requiredSkills || "[]"),
      preferredSkills: JSON.parse(updatedJob.preferredSkills || "[]"),
      matchAnalysis: analysis,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Fel vid ATS-matchningsanalys";
    console.error("Match analysis error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
