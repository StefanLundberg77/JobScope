/**
 * API route handlers for /api/jobs/[id]/export.
 * Exports the application package (CV PDF, Cover Letter PDF, plain text versions,
 * email elevator pitch, and original job posting backup) to a dedicated folder in exports/.
 */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  sanitizePathSegment,
  formatCvPlainText,
  formatCoverLetterPlainText,
  formatApplicationInfoPlainText,
  generateCvHtml,
  generateCoverLetterHtml,
  getPhotoAsBase64,
  renderHtmlToPdf,
  ExportApplicationData,
} from "@/lib/exportUtils";
import { MasterProfileData, WorkExperience, SkillCategory } from "@/lib/types";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    let body: {
      includePhotoOnCv?: boolean;
      includePhotoOnLetter?: boolean;
      selectedPhoto?: string;
      language?: "sv" | "en";
      tailoredSummary?: string;
      tailoredExperiences?: WorkExperience[];
      tailoredSkills?: SkillCategory[];
      coverLetter?: string;
      emailSubject?: string;
      emailBody?: string;
      notes?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // Load job and existing application
    const job = await prisma.jobListing.findUnique({
      where: { id },
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Jobbannons hittades inte" },
        { status: 404 }
      );
    }

    // Load master profile
    const profileRecord = await prisma.masterProfile.findFirst();
    if (!profileRecord || !profileRecord.fullName) {
      return NextResponse.json(
        {
          error:
            "Vänligen fyll i ditt Master-CV under fliken 'Min Profil' innan du exporterar.",
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

    const latestApp = job.applications[0];

    // Priority: explicitly passed client state > saved DB state > empty defaults
    const language: "sv" | "en" =
      body.language || (latestApp?.language === "en" ? "en" : "sv");
    const tailoredSummary =
      body.tailoredSummary !== undefined
        ? body.tailoredSummary
        : latestApp?.tailoredSummary || profile.summary || "";
    const tailoredExperiences: WorkExperience[] =
      body.tailoredExperiences !== undefined
        ? body.tailoredExperiences
        : latestApp?.tailoredExperiences
        ? JSON.parse(latestApp.tailoredExperiences)
        : profile.experiences || [];
    const tailoredSkills: SkillCategory[] =
      body.tailoredSkills !== undefined
        ? body.tailoredSkills
        : latestApp?.tailoredSkills
        ? JSON.parse(latestApp.tailoredSkills)
        : profile.skills || [];
    const coverLetter =
      body.coverLetter !== undefined
        ? body.coverLetter
        : latestApp?.coverLetter || "";
    const emailSubject =
      body.emailSubject !== undefined
        ? body.emailSubject
        : latestApp?.emailSubject || `Ansökan: ${job.title} - ${profile.fullName}`;
    const emailBody =
      body.emailBody !== undefined
        ? body.emailBody
        : latestApp?.emailBody || "";
    const notes =
      body.notes !== undefined
        ? body.notes
        : latestApp?.notes || job.notes || "";

    const includePhotoOnCv = body.includePhotoOnCv ?? true;
    const includePhotoOnLetter = body.includePhotoOnLetter ?? false;
    const photoPath = body.selectedPhoto || profileRecord.photoUrl || "/profile/cv_rum_gron_vaxt.jpg";

    const exportData: ExportApplicationData = {
      jobTitle: job.title,
      jobCompany: job.company,
      jobLocation: job.location,
      jobUrl: job.url || undefined,
      jobDescription: job.description,
      notes,
      tailoredSummary,
      tailoredExperiences,
      tailoredSkills,
      coverLetter,
      emailSubject,
      emailBody,
      language,
      matchScore: job.matchScore,
      matchAnalysisText: job.matchAnalysis
        ? JSON.stringify(JSON.parse(job.matchAnalysis), null, 2)
        : undefined,
      includePhotoOnCv,
      includePhotoOnLetter,
      photoPath,
    };

    // Prepare target directory
    const today = new Date().toISOString().slice(0, 10);
    const safeCompany = sanitizePathSegment(job.company);
    const safeTitle = sanitizePathSegment(job.title);
    const folderName = `${today}_${safeCompany}_${safeTitle}`;

    const exportsBaseDir = path.join(process.cwd(), "exports");
    const targetFolder = path.join(exportsBaseDir, folderName);
    await fs.mkdir(targetFolder, { recursive: true });

    const safeCandidate = sanitizePathSegment(profile.fullName);
    const cvPdfName = `CV_${safeCandidate}_${safeCompany}.pdf`;
    const letterPdfName = `Personligt_Brev_${safeCandidate}_${safeCompany}.pdf`;
    const cvTxtName = `CV_${safeCandidate}_${safeCompany}.txt`;
    const letterTxtName = `Personligt_Brev_${safeCandidate}_${safeCompany}.txt`;
    const infoTxtName = `Epost_och_Ansökningsinfo.txt`;
    const jobBackupTxtName = `Originalannons.txt`;

    // 1. Write Plain Text Files
    const cvTxtContent = formatCvPlainText(profile, exportData);
    const letterTxtContent = formatCoverLetterPlainText(profile, exportData);
    const infoTxtContent = formatApplicationInfoPlainText(profile, exportData);
    const jobBackupContent = [
      `JOBBANNONS: ${job.title} — ${job.company}`,
      "=".repeat(60),
      `Plats:       ${job.location}`,
      `Källa:       ${job.source}`,
      `Publicerad:  ${job.publishedAt ? new Date(job.publishedAt).toLocaleDateString("sv-SE") : "Okänt"}`,
      `Sista dag:   ${job.deadline ? new Date(job.deadline).toLocaleDateString("sv-SE") : "Ej angiven"}`,
      job.url ? `Annons-URL:  ${job.url}` : "",
      "",
      "ANNONSTEXT",
      "-".repeat(60),
      job.description || "(Ingen annonstext)",
    ].filter(Boolean).join("\r\n");

    await Promise.all([
      fs.writeFile(path.join(targetFolder, cvTxtName), cvTxtContent, "utf-8"),
      fs.writeFile(path.join(targetFolder, letterTxtName), letterTxtContent, "utf-8"),
      fs.writeFile(path.join(targetFolder, infoTxtName), infoTxtContent, "utf-8"),
      fs.writeFile(path.join(targetFolder, jobBackupTxtName), jobBackupContent, "utf-8"),
    ]);

    // 2. Generate and Write PDF Files
    const photoBase64 = await getPhotoAsBase64(photoPath);

    const cvHtml = generateCvHtml(profile, exportData, photoBase64);
    const letterHtml = generateCoverLetterHtml(profile, exportData, photoBase64);

    const cvPdfPath = path.join(targetFolder, cvPdfName);
    const letterPdfPath = path.join(targetFolder, letterPdfName);

    await Promise.all([
      renderHtmlToPdf(cvHtml, cvPdfPath),
      renderHtmlToPdf(letterHtml, letterPdfPath),
    ]);

    const generatedFiles = [
      cvPdfName,
      letterPdfName,
      cvTxtName,
      letterTxtName,
      infoTxtName,
      jobBackupTxtName,
    ];

    return NextResponse.json({
      success: true,
      folderName,
      folderPath: targetFolder,
      relativeFolder: `exports/${folderName}`,
      files: generatedFiles,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte exportera ansökan";
    console.error("Export application error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
