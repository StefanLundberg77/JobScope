/**
 * Utilities for exporting job applications to disk as structured packages.
 * Generates ATS-optimized A4 PDFs (via headless browser) and clean plain text (.txt) files.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { execFile, exec } from "child_process";
import { promisify } from "util";
import {
  MasterProfileData,
  WorkExperience,
  SkillCategory,
  Education,
  Project,
} from "./types";
import {
  detectLanguage,
  translateJobTitle,
  translateLocation,
  translateEducation,
  translateSkillCategory,
} from "./languageUtils";

const execFileAsync = promisify(execFile);

/**
 * Standard bilingual labels for exported documents.
 */
const EXPORT_LABELS = {
  sv: {
    summary: "Sammanfattning",
    experience: "Arbetslivserfarenhet",
    skills: "Teknisk kompetens & Färdigheter",
    education: "Utbildning",
    projects: "Utvalda Projekt",
    languages: "Språk",
    present: "Pågående",
    recipientAtt: "Att: Rekryteringsteamet / ",
    application: "Ansökan:",
    signOff: "Med vänliga hälsningar,",
  },
  en: {
    summary: "Professional Summary",
    experience: "Professional Experience",
    skills: "Technical Skills & Competencies",
    education: "Education",
    projects: "Featured Projects",
    languages: "Languages",
    present: "Present",
    recipientAtt: "Attn: Hiring Team / ",
    application: "Application:",
    signOff: "Sincerely,",
  },
};

/**
 * Sanitizes a string for safe usage in file and folder paths on Windows and Unix filesystems.
 */
export function sanitizePathSegment(input: string): string {
  if (!input) return "namnlös";
  return input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[.]+$/g, "")
    .slice(0, 80)
    .trim();
}

/**
 * Locates an installed browser executable capable of headless PDF rendering.
 * Checks Microsoft Edge and Google Chrome standard installation paths on Windows.
 */
export function findBrowserExecutable(): string | null {
  const candidatePaths = [
    process.env["ProgramFiles(x86)"]
      ? path.join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
    process.env["ProgramFiles"]
      ? path.join(process.env["ProgramFiles"], "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
    process.env["ProgramFiles"]
      ? path.join(process.env["ProgramFiles"], "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.env["ProgramFiles(x86)"]
      ? path.join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.env["LOCALAPPDATA"]
      ? path.join(process.env["LOCALAPPDATA"], "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
    process.env["LOCALAPPDATA"]
      ? path.join(process.env["LOCALAPPDATA"], "Google", "Chrome", "Application", "chrome.exe")
      : null,
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fsSync.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Converts a local public image path into a base64 data URI for offline rendering in headless browser.
 */
export async function getPhotoAsBase64(photoPath?: string): Promise<string | null> {
  if (!photoPath) return null;
  try {
    const cleanRelPath = photoPath.startsWith("/") ? photoPath.slice(1) : photoPath;
    const absoluteFilePath = path.join(process.cwd(), "public", cleanRelPath);
    if (!fsSync.existsSync(absoluteFilePath)) return null;

    const data = await fs.readFile(absoluteFilePath);
    const ext = path.extname(absoluteFilePath).toLowerCase().replace(".", "");
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch (error) {
    console.warn("Failed to load photo for PDF export:", error);
    return null;
  }
}

/**
 * Generates a PDF file from an HTML string using an installed headless browser.
 */
export async function renderHtmlToPdf(htmlContent: string, outputPdfPath: string): Promise<void> {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    throw new Error(
      "Kunde inte hitta Microsoft Edge eller Google Chrome på datorn för PDF-generering."
    );
  }

  const tempHtmlPath = path.join(os.tmpdir(), `jobscope_export_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`);

  try {
    await fs.writeFile(tempHtmlPath, htmlContent, "utf-8");
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, "/")}`;

    // Execute headless print to PDF
    await execFileAsync(browserPath, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${outputPdfPath}`,
      fileUrl,
    ]);

    // Verify output existence
    const exists = fsSync.existsSync(outputPdfPath);
    if (!exists) {
      throw new Error("PDF-filen skapades inte av webbläsaren.");
    }
  } finally {
    try {
      if (fsSync.existsSync(tempHtmlPath)) {
        await fs.unlink(tempHtmlPath);
      }
    } catch {
      // Ignore temporary file cleanup failure
    }
  }
}

/**
 * Opens a local directory in Windows File Explorer.
 */
export function openFolderInExplorer(folderPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const resolvedPath = path.resolve(folderPath);
    exec(`explorer.exe "${resolvedPath}"`, (err) => {
      // Note: explorer.exe often exits with code 1 even when succeeding in opening a window
      if (err && err.code !== 1) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Interface representing the tailored application data used during export.
 */
export interface ExportApplicationData {
  jobTitle: string;
  jobCompany: string;
  jobLocation: string;
  jobUrl?: string;
  jobDescription: string;
  notes?: string;
  tailoredSummary: string;
  tailoredExperiences: WorkExperience[];
  tailoredSkills: SkillCategory[];
  coverLetter: string;
  emailSubject?: string;
  emailBody?: string;
  language: "sv" | "en";
  matchScore?: number | null;
  matchAnalysisText?: string;
  includePhotoOnCv?: boolean;
  includePhotoOnLetter?: boolean;
  photoPath?: string;
}

/**
 * Generates plain text version of the CV.
 */
export function formatCvPlainText(
  profile: MasterProfileData,
  data: ExportApplicationData
): string {
  const lang = data.language;
  const labels = EXPORT_LABELS[lang];
  const lines: string[] = [];

  const divider = "=".repeat(60);
  const subDivider = "-".repeat(60);

  // Header
  lines.push(profile.fullName.toUpperCase());
  lines.push(translateJobTitle(profile.title || data.jobTitle, lang));
  lines.push(divider);

  const contactDetails: string[] = [];
  if (profile.email) contactDetails.push(`E-post: ${profile.email}`);
  if (profile.phone) contactDetails.push(`Telefon: ${profile.phone}`);
  if (profile.location) contactDetails.push(`Ort: ${translateLocation(profile.location, lang)}`);
  if (profile.linkedin) contactDetails.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.github) contactDetails.push(`GitHub: ${profile.github}`);
  if (profile.website) contactDetails.push(`Portfolio/Webb: ${profile.website}`);
  lines.push(contactDetails.join(" | "));
  lines.push("");

  // Summary
  lines.push(labels.summary.toUpperCase());
  lines.push(subDivider);
  lines.push(data.tailoredSummary || profile.summary || "");
  lines.push("");

  // Experience
  lines.push(labels.experience.toUpperCase());
  lines.push(subDivider);
  const exps = data.tailoredExperiences.length > 0 ? data.tailoredExperiences : profile.experiences || [];
  for (const exp of exps) {
    const dates = `${exp.startDate} - ${exp.endDate || labels.present}`;
    lines.push(`${exp.role} — ${exp.company} (${dates})`);
    if (exp.description) {
      lines.push(exp.description);
    }
    if (exp.achievements && exp.achievements.length > 0) {
      for (const ach of exp.achievements) {
        lines.push(`  * ${ach}`);
      }
    }
    lines.push("");
  }

  // Skills
  lines.push(labels.skills.toUpperCase());
  lines.push(subDivider);
  const skills = data.tailoredSkills.length > 0 ? data.tailoredSkills : profile.skills || [];
  for (const cat of skills) {
    const catName = translateSkillCategory(cat.category, lang);
    lines.push(`${catName}: ${cat.items.join(", ")}`);
  }
  lines.push("");

  // Education
  if (profile.education && profile.education.length > 0) {
    lines.push(labels.education.toUpperCase());
    lines.push(subDivider);
    for (const rawEdu of profile.education) {
      const edu = translateEducation(rawEdu, lang);
      lines.push(`${edu.degree} — ${edu.school} (${edu.startDate} - ${edu.endDate})`);
      if (edu.fieldOfStudy) {
        lines.push(`  Inriktning: ${edu.fieldOfStudy}`);
      }
    }
    lines.push("");
  }

  // Projects
  if (profile.projects && profile.projects.length > 0) {
    lines.push(labels.projects.toUpperCase());
    lines.push(subDivider);
    for (const proj of profile.projects) {
      lines.push(`${proj.name}`);
      if (proj.description) lines.push(proj.description);
      if (proj.techStack && proj.techStack.length > 0) {
        lines.push(`  Tekniker: ${proj.techStack.join(", ")}`);
      }
      if (proj.link) lines.push(`  Länk: ${proj.link}`);
      lines.push("");
    }
  }

  return lines.join("\r\n");
}

/**
 * Generates plain text version of the Cover Letter.
 */
export function formatCoverLetterPlainText(
  profile: MasterProfileData,
  data: ExportApplicationData
): string {
  const lang = data.language;
  const labels = EXPORT_LABELS[lang];
  const lines: string[] = [];

  const divider = "=".repeat(60);

  // Header
  lines.push(profile.fullName.toUpperCase());
  lines.push(translateJobTitle(profile.title || data.jobTitle, lang));
  lines.push(`Kontakt: ${profile.phone || ""} | ${profile.email || ""} | ${translateLocation(profile.location, lang)}`);
  lines.push(divider);
  lines.push("");

  // Recipient & Date
  const dateStr = lang === "en"
    ? `Gothenburg, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
    : `Göteborg, ${new Date().toLocaleDateString("sv-SE")}`;

  lines.push(`Mottagare: ${data.jobCompany}`);
  lines.push(`${labels.recipientAtt}${data.jobTitle}`);
  if (data.jobLocation) lines.push(`Ort: ${data.jobLocation}`);
  lines.push(`Datum: ${dateStr}`);
  lines.push("");

  // Subject
  lines.push(`${labels.application} ${data.jobTitle}`);
  lines.push("-".repeat(40));
  lines.push("");

  // Body
  lines.push(data.coverLetter || "");
  lines.push("");

  // Sign-off
  lines.push(labels.signOff);
  lines.push("");
  lines.push(profile.fullName);
  lines.push(`${profile.phone || ""} | ${profile.email || ""}`);

  return lines.join("\r\n");
}

/**
 * Generates an info text file with application notes, elevator pitch, job URL and ATS analysis.
 */
export function formatApplicationInfoPlainText(
  profile: MasterProfileData,
  data: ExportApplicationData
): string {
  const lines: string[] = [];
  const divider = "=".repeat(60);
  const subDivider = "-".repeat(60);

  lines.push(`ANSÖKNINGSINFO & MEJLMALL: ${data.jobCompany} - ${data.jobTitle}`);
  lines.push(divider);
  lines.push(`Företag:        ${data.jobCompany}`);
  lines.push(`Roll:           ${data.jobTitle}`);
  lines.push(`Plats:          ${data.jobLocation}`);
  lines.push(`Språk:          ${data.language === "en" ? "Engelska (en)" : "Svenska (sv)"}`);
  lines.push(`Exporterad:     ${new Date().toLocaleString("sv-SE")}`);
  if (data.jobUrl) {
    lines.push(`Länk till jobb: ${data.jobUrl}`);
  }
  if (data.matchScore !== undefined && data.matchScore !== null) {
    lines.push(`ATS Match Score: ${data.matchScore}%`);
  }
  lines.push("");

  // Email Pitch
  lines.push("E-POSTMALL / HISSPITCH");
  lines.push(subDivider);
  lines.push(`Ämnesrad: ${data.emailSubject || `Ansökan: ${data.jobTitle} - ${profile.fullName}`}`);
  lines.push("");
  lines.push(data.emailBody || "Ingen hisspitch genererad. Klistra in ditt personliga brev eller bifoga PDF.");
  lines.push("");

  // Notes
  if (data.notes) {
    lines.push("PERSONLIGA ANTECKNINGAR");
    lines.push(subDivider);
    lines.push(data.notes);
    lines.push("");
  }

  // ATS Analysis Details
  if (data.matchAnalysisText) {
    lines.push("ATS MATCHNINGSANALYS");
    lines.push(subDivider);
    lines.push(data.matchAnalysisText);
    lines.push("");
  }

  return lines.join("\r\n");
}

/**
 * Generates HTML for CV matching Jobscope's ATS-optimized A4 print template.
 */
export function generateCvHtml(
  profile: MasterProfileData,
  data: ExportApplicationData,
  photoBase64?: string | null
): string {
  const lang = data.language;
  const labels = EXPORT_LABELS[lang];

  const exps = data.tailoredExperiences.length > 0 ? data.tailoredExperiences : profile.experiences || [];
  const skills = data.tailoredSkills.length > 0 ? data.tailoredSkills : profile.skills || [];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>CV - ${profile.fullName} - ${data.jobCompany}</title>
<style>
  @page {
    size: A4;
    margin: 15mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #171717;
    background: #ffffff;
    margin: 0;
    padding: 0;
    line-height: 1.4;
    font-size: 9.5pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #171717;
    padding-bottom: 14px;
    gap: 16px;
  }
  .header-left {
    flex: 1;
  }
  .name {
    font-size: 20pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.5px;
    margin: 0;
    color: #0a0a0a;
  }
  .title {
    font-size: 10.5pt;
    font-weight: 600;
    color: #404040;
    margin-top: 3px;
  }
  .contact-row {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 8.5pt;
    color: #525252;
  }
  .contact-item {
    display: inline-block;
  }
  .photo {
    width: 92px;
    height: 92px;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid #d4d4d4;
    flex-shrink: 0;
  }
  .section-title {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #171717;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 4px;
    margin-top: 18px;
    margin-bottom: 8px;
  }
  .summary-text {
    font-size: 9pt;
    line-height: 1.5;
    color: #262626;
    margin: 0;
  }
  .exp-item {
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .exp-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .exp-role {
    font-weight: 700;
    font-size: 9.5pt;
    color: #0a0a0a;
  }
  .exp-date {
    font-size: 8pt;
    color: #737373;
    font-weight: 500;
  }
  .exp-desc {
    font-size: 8.5pt;
    color: #404040;
    margin: 3px 0;
  }
  .achievements {
    margin: 4px 0 0 0;
    padding-left: 18px;
    font-size: 8.5pt;
    color: #262626;
  }
  .achievements li {
    margin-bottom: 2px;
    line-height: 1.4;
  }
  .skill-row {
    font-size: 8.5pt;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .skill-cat {
    font-weight: 600;
    color: #0a0a0a;
  }
  .skill-items {
    color: #404040;
  }
  .edu-item {
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    margin-bottom: 6px;
    page-break-inside: avoid;
  }
  .edu-degree {
    font-weight: 700;
    color: #0a0a0a;
  }
  .edu-school {
    color: #404040;
  }
  .edu-field {
    font-size: 8pt;
    color: #525252;
  }
  .edu-date {
    font-size: 8pt;
    color: #737373;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1 class="name">${escapeHtml(profile.fullName || "Stefan Lundberg")}</h1>
      <div class="title">${escapeHtml(translateJobTitle(profile.title || data.jobTitle, lang))}</div>
      <div class="contact-row">
        ${profile.email ? `<span class="contact-item">${escapeHtml(profile.email)}</span>` : ""}
        ${profile.phone ? `<span class="contact-item">• ${escapeHtml(profile.phone)}</span>` : ""}
        ${profile.location ? `<span class="contact-item">• ${escapeHtml(translateLocation(profile.location, lang))}</span>` : ""}
        ${profile.website ? `<span class="contact-item">• ${escapeHtml(profile.website)}</span>` : ""}
        ${profile.linkedin ? `<span class="contact-item">• ${escapeHtml(profile.linkedin)}</span>` : ""}
        ${profile.github ? `<span class="contact-item">• ${escapeHtml(profile.github)}</span>` : ""}
      </div>
    </div>
    ${
      data.includePhotoOnCv && photoBase64
        ? `<img class="photo" src="${photoBase64}" alt="Profilbild" />`
        : ""
    }
  </div>

  <div class="section-title">${escapeHtml(labels.summary)}</div>
  <p class="summary-text">${escapeHtml(data.tailoredSummary || profile.summary || "")}</p>

  <div class="section-title">${escapeHtml(labels.experience)}</div>
  ${exps
    .map(
      (exp) => `
    <div class="exp-item">
      <div class="exp-header">
        <span class="exp-role">${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</span>
        <span class="exp-date">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate || labels.present)}</span>
      </div>
      ${exp.description ? `<p class="exp-desc">${escapeHtml(exp.description)}</p>` : ""}
      ${
        exp.achievements && exp.achievements.length > 0
          ? `<ul class="achievements">
              ${exp.achievements.map((ach) => `<li>${escapeHtml(ach)}</li>`).join("")}
            </ul>`
          : ""
      }
    </div>
  `
    )
    .join("")}

  <div class="section-title">${escapeHtml(labels.skills)}</div>
  ${skills
    .map(
      (cat) => `
    <div class="skill-row">
      <span class="skill-cat">${escapeHtml(translateSkillCategory(cat.category, lang))}:</span>
      <span class="skill-items">${escapeHtml(cat.items.join(", "))}</span>
    </div>
  `
    )
    .join("")}

  ${
    profile.education && profile.education.length > 0
      ? `
    <div class="section-title">${escapeHtml(labels.education)}</div>
    ${profile.education
      .map((rawEdu) => {
        const edu = translateEducation(rawEdu, lang);
        return `
      <div class="edu-item">
        <div>
          <span class="edu-degree">${escapeHtml(edu.degree)}</span> — <span class="edu-school">${escapeHtml(edu.school)}</span>
          ${edu.fieldOfStudy ? `<div class="edu-field">${escapeHtml(edu.fieldOfStudy)}</div>` : ""}
        </div>
        <span class="edu-date">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</span>
      </div>
      `;
      })
      .join("")}
  `
      : ""
  }
</body>
</html>`;
}

/**
 * Generates HTML for Cover Letter matching Jobscope's A4 print template.
 */
export function generateCoverLetterHtml(
  profile: MasterProfileData,
  data: ExportApplicationData,
  photoBase64?: string | null
): string {
  const lang = data.language;
  const labels = EXPORT_LABELS[lang];

  const dateStr = lang === "en"
    ? `Gothenburg, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
    : `Göteborg, ${new Date().toLocaleDateString("sv-SE")}`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>Personligt Brev - ${profile.fullName} - ${data.jobCompany}</title>
<style>
  @page {
    size: A4;
    margin: 18mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #171717;
    background: #ffffff;
    margin: 0;
    padding: 0;
    line-height: 1.55;
    font-size: 10pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #d4d4d4;
    padding-bottom: 14px;
    gap: 16px;
  }
  .header-left {
    flex: 1;
  }
  .name {
    font-size: 19pt;
    font-weight: 800;
    margin: 0;
    color: #0a0a0a;
  }
  .title {
    font-size: 10.5pt;
    font-weight: 500;
    color: #404040;
    margin-top: 3px;
  }
  .contact-row {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: 8.5pt;
    color: #525252;
  }
  .photo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #e5e5e5;
    flex-shrink: 0;
  }
  .meta-row {
    margin-top: 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: 9pt;
  }
  .recipient-company {
    font-size: 10.5pt;
    font-weight: 700;
    color: #0a0a0a;
  }
  .recipient-att {
    color: #404040;
    margin-top: 1px;
  }
  .recipient-loc {
    color: #737373;
    font-size: 8.5pt;
  }
  .date {
    color: #737373;
    text-align: right;
  }
  .subject {
    margin-top: 26px;
    font-size: 12pt;
    font-weight: 700;
    color: #0a0a0a;
  }
  .body {
    margin-top: 16px;
    white-space: pre-wrap;
    color: #262626;
    line-height: 1.6;
    font-size: 9.5pt;
  }
  .signoff {
    margin-top: 36px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
    page-break-inside: avoid;
  }
  .signoff-closing {
    font-size: 9pt;
    color: #262626;
  }
  .signoff-name {
    margin-top: 12px;
    font-size: 11pt;
    font-weight: 700;
    color: #0a0a0a;
  }
  .signoff-contact {
    margin-top: 2px;
    font-size: 8.5pt;
    color: #737373;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1 class="name">${escapeHtml(profile.fullName || "Stefan Lundberg")}</h1>
      <div class="title">${escapeHtml(
        translateJobTitle(
          profile.title || (lang === "en" ? "Software Developer & AI Engineer" : "Systemutvecklare & AI-utvecklare"),
          lang
        )
      )}</div>
      <div class="contact-row">
        ${profile.email ? `<span>${escapeHtml(profile.email)}</span>` : ""}
        ${profile.phone ? `<span>• ${escapeHtml(profile.phone)}</span>` : ""}
        ${profile.location ? `<span>• ${escapeHtml(translateLocation(profile.location, lang))}</span>` : ""}
        ${profile.website ? `<span>• ${escapeHtml(profile.website)}</span>` : ""}
        ${profile.linkedin ? `<span>• ${escapeHtml(profile.linkedin)}</span>` : ""}
      </div>
    </div>
    ${
      data.includePhotoOnLetter && photoBase64
        ? `<img class="photo" src="${photoBase64}" alt="Profilbild" />`
        : ""
    }
  </div>

  <div class="meta-row">
    <div>
      <div class="recipient-company">${escapeHtml(data.jobCompany)}</div>
      <div class="recipient-att">${escapeHtml(labels.recipientAtt)}${escapeHtml(data.jobTitle)}</div>
      ${data.jobLocation ? `<div class="recipient-loc">${escapeHtml(data.jobLocation)}</div>` : ""}
    </div>
    <div class="date">${escapeHtml(dateStr)}</div>
  </div>

  <div class="subject">${escapeHtml(labels.application)} ${escapeHtml(data.jobTitle)}</div>

  <div class="body">${escapeHtml(data.coverLetter || "")}</div>

  <div class="signoff">
    <div class="signoff-closing">${escapeHtml(labels.signOff)}</div>
    <div class="signoff-name">${escapeHtml(profile.fullName || "Stefan Lundberg")}</div>
    <div class="signoff-contact">
      ${profile.phone ? escapeHtml(profile.phone) : ""}
      ${profile.email ? ` • ${escapeHtml(profile.email)}` : ""}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escapes characters for secure HTML injection.
 */
function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
