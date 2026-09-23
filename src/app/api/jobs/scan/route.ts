/**
 * API route handlers for /api/jobs/scan.
 * Executes automated background batch scanning across JobTech Dev API and public LinkedIn,
 * deduplicating against the database and triggering Gemini ATS match evaluation.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchJobTech, fetchJobTechAd, OCCUPATION_FIELD_DATA_IT, normalizeJobTechWorkplaceModel } from "@/lib/jobtech";
import { searchLinkedInJobs, fetchLinkedInJobDetails } from "@/lib/linkedin";
import { analyzeJobMatchWithAI, getGeminiApiKey } from "@/lib/gemini";
import { parseJobAdText } from "@/lib/parser";
import { MasterProfileData } from "@/lib/types";

/**
 * POST /api/jobs/scan
 * Runs a multi-source job sweep matching the candidate's preferences, deduplicates against
 * existing database records, evaluates ATS match score, and saves candidates meeting minScore.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // 1. Get UserSettings
    const settings = await prisma.userSettings.findUnique({
      where: { id: "default" },
    });

    const minScoreThreshold = body.minScore ?? settings?.minScore ?? 50;
    const broadIt = body.broadIt ?? settings?.broadItSearch ?? true;
    const query = body.query || (!broadIt ? (settings?.targetRole || "Systemutvecklare & AI-utvecklare") : "");
    const location = body.location || (settings?.targetLocations?.toLowerCase().includes("göteborg") ? "goteborg" : "all");
    const remote = body.remote ?? (settings?.workPreference === "remote");

    // 2. Get MasterProfile for ATS matching
    const profileRecord = await prisma.masterProfile.findFirst();
    let profile: MasterProfileData | null = null;
    if (profileRecord) {
      profile = {
        id: profileRecord.id,
        fullName: profileRecord.fullName || "Kandidat",
        email: profileRecord.email,
        phone: profileRecord.phone,
        location: profileRecord.location || "Göteborg",
        title: profileRecord.title || settings?.targetRole || "Systemutvecklare & AI-utvecklare",
        summary: profileRecord.summary || "",
        website: profileRecord.website,
        linkedin: profileRecord.linkedin,
        github: profileRecord.github,
        experiences: JSON.parse(profileRecord.experiences || "[]"),
        education: JSON.parse(profileRecord.education || "[]"),
        skills: JSON.parse(profileRecord.skills || "[]"),
        languages: JSON.parse(profileRecord.languages || "[]"),
        projects: JSON.parse(profileRecord.projects || "[]"),
      };
    }

    // 3. Search both LinkedIn & JobTech in parallel
    const [jobTechRes, linkedInRes] = await Promise.allSettled([
      searchJobTech({
        query: query || undefined,
        occupationField: broadIt ? OCCUPATION_FIELD_DATA_IT : undefined,
        location,
        remote,
        limit: 25,
      }),
      searchLinkedInJobs({
        query: query || (broadIt ? "IT OR Utvecklare OR Developer OR AI OR GenAI" : (settings?.targetRole || "Systemutvecklare & AI-utvecklare")),
        location,
        remote,
        limit: 20,
      }),
    ]);

    const jtHits = jobTechRes.status === "fulfilled" ? jobTechRes.value.hits || [] : [];
    const liHits = linkedInRes.status === "fulfilled" ? linkedInRes.value.hits || [] : [];

    // 4. Fetch existing job external IDs and blocked jobs to avoid duplicates and blocked listings
    const [existingJobs, blockedJobs] = await Promise.all([
      prisma.jobListing.findMany({
        select: { externalId: true, title: true, company: true },
      }),
      prisma.blockedJob.findMany({
        select: { externalId: true, title: true, company: true },
      }),
    ]);

    const existingIds = new Set(existingJobs.map((j) => j.externalId).filter(Boolean));
    const existingTitleComp = new Set(
      existingJobs.map((j) => `${j.title.toLowerCase()}___${j.company.toLowerCase()}`)
    );

    const blockedIds = new Set(blockedJobs.map((b) => b.externalId).filter(Boolean));
    const blockedTitleComp = new Set(
      blockedJobs.map(
        (b) => `${(b.title || "").toLowerCase()}___${(b.company || "").toLowerCase()}`
      )
    );

    const candidates: Array<{
      externalId: string;
      source: "jobtech" | "linkedin";
      headline: string;
      company: string;
      url?: string;
    }> = [];

    for (const h of liHits) {
      const key = `${h.headline.toLowerCase()}___${h.employer.name.toLowerCase()}`;
      if (
        !existingIds.has(h.id) &&
        !existingTitleComp.has(key) &&
        !blockedIds.has(h.id) &&
        !blockedTitleComp.has(key)
      ) {
        candidates.push({
          externalId: h.id,
          source: "linkedin",
          headline: h.headline,
          company: h.employer.name,
          url: h.webpage_url,
        });
      }
    }

    for (const h of jtHits) {
      const key = `${h.headline.toLowerCase()}___${h.employer.name.toLowerCase()}`;
      if (
        !existingIds.has(h.id) &&
        !existingTitleComp.has(key) &&
        !blockedIds.has(h.id) &&
        !blockedTitleComp.has(key)
      ) {
        candidates.push({
          externalId: h.id,
          source: "jobtech",
          headline: h.headline,
          company: h.employer.name,
          url: h.webpage_url || h.application_details?.url,
        });
      }
    }

    const savedJobs = [];
    const apiKey = await getGeminiApiKey();

    // Process top candidates (limit to max 10 to evaluate diverse IT roles without hitting rate limits)
    const toProcess = candidates.slice(0, 10);

    for (const cand of toProcess) {
      try {
        let title = cand.headline;
        let company = cand.company;
        let jobLocation = "Göteborg";
        let workplaceType = "onsite";
        let description = "";
        let requiredSkills: string[] = [];
        let preferredSkills: string[] = [];
        let url = cand.url || null;

        if (cand.source === "linkedin") {
          const details = await fetchLinkedInJobDetails(cand.externalId);
          title = details.title || title;
          company = details.company || company;
          jobLocation = details.location || jobLocation;
          workplaceType = details.workplaceType || "onsite";
          description = details.description || "";
          url = details.url || url;

          if (description && apiKey) {
            try {
              const aiParsed = await parseJobAdText(description, url || undefined);
              requiredSkills = aiParsed.requiredSkills || [];
              preferredSkills = aiParsed.preferredSkills || [];
            } catch {}
          }
        } else {
          const ad = await fetchJobTechAd(cand.externalId);
          title = ad.headline || title;
          company = ad.employer.name || company;
          jobLocation = ad.workplace_address?.municipality || ad.workplace_address?.city || "Sverige";
          workplaceType = normalizeJobTechWorkplaceModel(
            ad.workplace_model,
            (ad.headline || "") + " " + (ad.description?.text || "")
          );
          description = ad.description?.text || "";
          url = ad.application_details?.url || ad.webpage_url || url;
          requiredSkills = [
            ...(ad.must_have?.skills?.map((s) => s.label) || []),
            ...(ad.must_have?.languages?.map((l) => l.label) || []),
            ...(ad.must_have?.work_experiences?.map((w) => w.label) || []),
          ];
          preferredSkills = [
            ...(ad.nice_to_have?.skills?.map((s) => s.label) || []),
            ...(ad.nice_to_have?.languages?.map((l) => l.label) || []),
            ...(ad.nice_to_have?.work_experiences?.map((w) => w.label) || []),
          ];
        }

        // Calculate match score if profile and AI are available
        let matchScore: number | null = null;
        let matchAnalysisStr: string | null = null;

        if (apiKey && profile && description) {
          try {
            const analysis = await analyzeJobMatchWithAI(
              {
                title,
                company,
                description,
                requiredSkills,
                preferredSkills,
              },
              profile
            );
            matchScore = analysis.score;
            matchAnalysisStr = JSON.stringify(analysis);
          } catch (e) {
            console.warn(`Could not calculate ATS score for ${title}:`, e);
          }
        }

        // Only save if no score requirement OR if score >= minScoreThreshold
        if (matchScore === null || matchScore >= minScoreThreshold) {
          const created = await prisma.jobListing.create({
            data: {
              externalId: cand.externalId,
              title,
              company,
              location: jobLocation,
              workplaceType,
              url,
              source: cand.source,
              description,
              requiredSkills: JSON.stringify(requiredSkills),
              preferredSkills: JSON.stringify(preferredSkills),
              status: "saved",
              matchScore,
              matchAnalysis: matchAnalysisStr,
            },
          });
          savedJobs.push({
            id: created.id,
            title: created.title,
            company: created.company,
            matchScore,
            source: cand.source,
          });
        }
      } catch (err) {
        console.error(`Failed processing candidate ${cand.headline}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      scannedTotal: jtHits.length + liHits.length,
      newCandidates: candidates.length,
      savedCount: savedJobs.length,
      savedJobs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Fel vid automatisk sökning";
    console.error("Auto scan error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Support GET to trigger scan or test easily
  return POST(req);
}
