/**
 * API route handlers for /api/jobs.
 * Handles listing saved jobs and ingesting new job postings from multiple sources.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchJobTechAd, normalizeJobTechWorkplaceModel } from "@/lib/jobtech";
import { fetchAndParseJobUrl, parseJobAdText } from "@/lib/parser";
import { isLinkedInUrl, fetchLinkedInJobDetails } from "@/lib/linkedin";
import { analyzeJobMatchWithAI, getGeminiApiKey } from "@/lib/gemini";
import { MasterProfileData } from "@/lib/types";

/**
 * GET /api/jobs
 * Retrieves all saved job listings, optionally filtered by application status.
 * Deserializes SQLite JSON strings into strongly typed arrays and objects.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const jobs = await prisma.jobListing.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        applications: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    const parsedJobs = jobs.map((job) => ({
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
    }));

    return NextResponse.json(parsedJobs);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte hämta sparade jobb";
    console.error("List jobs error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/jobs
 * Ingests a new job listing from JobTech ID, LinkedIn URL/ID, external web URL,
 * raw pasted text, or manual form entry. Triggers automatic AI match scoring if configured.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { externalId, url, rawText, manualData } = body;

    let jobData = {
      externalId: externalId || null,
      title: "",
      company: "",
      location: "Göteborg",
      workplaceType: "onsite",
      url: url || null,
      source: "jobtech",
      publishedAt: new Date(),
      deadline: null as Date | null,
      description: "",
      requiredSkills: [] as string[],
      preferredSkills: [] as string[],
    };

    if (externalId?.startsWith("linkedin-") || isLinkedInUrl(url || "")) {
      const targetUrlOrId = url || externalId!;
      const parsed = await fetchLinkedInJobDetails(targetUrlOrId);

      let reqSkills: string[] = [];
      let prefSkills: string[] = [];

      // Extract skills using Gemini if available
      try {
        if (parsed.description) {
          const aiParsed = await parseJobAdText(parsed.description, parsed.url);
          reqSkills = aiParsed.requiredSkills || [];
          prefSkills = aiParsed.preferredSkills || [];
        }
      } catch (e) {
        console.warn("Gemini skill extraction on LinkedIn job skipped:", e);
      }

      jobData.title = parsed.title;
      jobData.company = parsed.company;
      jobData.location = parsed.location;
      jobData.workplaceType = parsed.workplaceType;
      jobData.url = parsed.url || url || null;
      jobData.source = "linkedin";
      jobData.deadline = parsed.deadline ? new Date(parsed.deadline) : null;
      jobData.description = parsed.description;
      jobData.requiredSkills = reqSkills;
      jobData.preferredSkills = prefSkills;
    } else if (externalId) {
      // Fetch full details from JobTech API
      const ad = await fetchJobTechAd(externalId);
      jobData.title = ad.headline;
      jobData.company = ad.employer.name;
      jobData.location =
        ad.workplace_address?.municipality ||
        ad.workplace_address?.city ||
        "Sverige";

      jobData.workplaceType = normalizeJobTechWorkplaceModel(
        ad.workplace_model,
        (ad.headline || "") + " " + (ad.description?.text || "")
      );

      jobData.url =
        ad.application_details?.url || ad.webpage_url || ad.employer.url || null;
      jobData.source = "jobtech";
      jobData.publishedAt = new Date(ad.publication_date);
      jobData.deadline = ad.application_deadline
        ? new Date(ad.application_deadline)
        : null;
      jobData.description = ad.description?.text || "";

      jobData.requiredSkills = [
        ...(ad.must_have?.skills?.map((s) => s.label) || []),
        ...(ad.must_have?.languages?.map((l) => l.label) || []),
        ...(ad.must_have?.work_experiences?.map((w) => w.label) || []),
      ];

      jobData.preferredSkills = [
        ...(ad.nice_to_have?.skills?.map((s) => s.label) || []),
        ...(ad.nice_to_have?.languages?.map((l) => l.label) || []),
        ...(ad.nice_to_have?.work_experiences?.map((w) => w.label) || []),
      ];
    } else if (url) {
      const parsed = await fetchAndParseJobUrl(url);
      jobData.title = parsed.title;
      jobData.company = parsed.company;
      jobData.location = parsed.location;
      jobData.workplaceType = parsed.workplaceType;
      jobData.url = url;
      jobData.source = "custom_url";
      jobData.deadline = parsed.deadline ? new Date(parsed.deadline) : null;
      jobData.description = parsed.description;
      jobData.requiredSkills = parsed.requiredSkills;
      jobData.preferredSkills = parsed.preferredSkills;
    } else if (rawText) {
      const parsed = await parseJobAdText(rawText);
      jobData.title = parsed.title;
      jobData.company = parsed.company;
      jobData.location = parsed.location;
      jobData.workplaceType = parsed.workplaceType;
      jobData.source = "manual";
      jobData.deadline = parsed.deadline ? new Date(parsed.deadline) : null;
      jobData.description = parsed.description;
      jobData.requiredSkills = parsed.requiredSkills;
      jobData.preferredSkills = parsed.preferredSkills;
    } else if (manualData) {
      jobData = { ...jobData, ...manualData, source: "manual" };
    } else {
      return NextResponse.json(
        { error: "Ange externalId, url eller råtext för annonsen." },
        { status: 400 }
      );
    }

    // Check if job already saved
    let job = null;
    if (jobData.externalId) {
      job = await prisma.jobListing.findUnique({
        where: { externalId: jobData.externalId },
      });
    }

    if (!job) {
      job = await prisma.jobListing.create({
        data: {
          externalId: jobData.externalId,
          title: jobData.title,
          company: jobData.company,
          location: jobData.location,
          workplaceType: jobData.workplaceType,
          url: jobData.url,
          source: jobData.source,
          publishedAt: jobData.publishedAt,
          deadline: jobData.deadline,
          description: jobData.description,
          requiredSkills: JSON.stringify(jobData.requiredSkills),
          preferredSkills: JSON.stringify(jobData.preferredSkills),
          status: "saved",
        },
      });
    }

    // Attempt automatic quick match analysis if Gemini API key is configured
    const apiKey = await getGeminiApiKey();
    if (apiKey && !job.matchScore) {
      try {
        const profileRecord = await prisma.masterProfile.findFirst();
        if (profileRecord && profileRecord.title) {
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
              requiredSkills: jobData.requiredSkills,
              preferredSkills: jobData.preferredSkills,
            },
            profile
          );

          job = await prisma.jobListing.update({
            where: { id: job.id },
            data: {
              matchScore: analysis.score,
              matchAnalysis: JSON.stringify(analysis),
            },
          });
        }
      } catch (err) {
        console.error("Match analysis non-fatal error:", err);
      }
    }

    return NextResponse.json({
      ...job,
      requiredSkills: JSON.parse(job.requiredSkills || "[]"),
      preferredSkills: JSON.parse(job.preferredSkills || "[]"),
      matchAnalysis: job.matchAnalysis ? JSON.parse(job.matchAnalysis) : null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara jobb";
    console.error("Save job error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
