/**
 * Utilities for language detection, localization, and domain-specific
 * translation of profile credentials (titles, degrees, universities, locations)
 * between Swedish and English.
 */

import { Education } from "./types";

/**
 * Detects whether text is primarily Swedish or English based on frequency
 * of high-signal function words.
 */
export function detectLanguage(text: string): "sv" | "en" {
  if (!text) return "sv";
  const sample = text.toLowerCase().slice(0, 3000);
  const swedishWords = [
    "och", "att", "som", "på", "för", "med", "är", "av", "till", "ett", "den",
    "vi", "du", "har", "arbete", "erfarenhet", "utvecklare", "krav", "meriterande", "tjänsten", "ansökan"
  ];
  const englishWords = [
    "and", "the", "to", "in", "for", "with", "is", "of", "you", "we", "are",
    "have", "experience", "developer", "requirements", "skills", "responsibilities", "looking", "role", "position"
  ];

  let svScore = 0;
  let enScore = 0;

  for (const w of swedishWords) {
    const matches = sample.match(new RegExp(`\\b${w}\\b`, "gi"));
    if (matches) svScore += matches.length;
  }

  for (const w of englishWords) {
    const matches = sample.match(new RegExp(`\\b${w}\\b`, "gi"));
    if (matches) enScore += matches.length;
  }

  return enScore > svScore ? "en" : "sv";
}

/**
 * Common English translations for Swedish professional role titles.
 */
const TITLE_TRANSLATIONS: Record<string, string> = {
  "Systemutvecklare & AI-utvecklare": "Software Developer & AI Engineer",
  "Systemutvecklare": "Software Developer",
  "Mjukvaruutvecklare": "Software Developer",
  "Fullstackutvecklare": "Fullstack Developer",
  "Backendutvecklare": "Backend Developer",
  "Frontendutvecklare": "Frontend Developer",
  "C#/.NET-utvecklare": "C#/.NET Developer",
  "AI-utvecklare": "AI Developer",
  "Spelutvecklare": "Game Developer",
  "Driftansvarig": "Operations Manager",
  "Restaurangchef": "General Manager / Operations Lead",
};

/**
 * Translates a professional title into the target language.
 */
export function translateJobTitle(title: string, targetLang: "sv" | "en"): string {
  if (!title) return "";
  if (targetLang === "sv") return title;

  // Direct lookup
  if (TITLE_TRANSLATIONS[title]) {
    return TITLE_TRANSLATIONS[title];
  }

  // Regex replacements for common patterns
  let translated = title;
  translated = translated.replace(/\bSystemutvecklare\b/gi, "Software Developer");
  translated = translated.replace(/\bMjukvaruutvecklare\b/gi, "Software Developer");
  translated = translated.replace(/\bAI-utvecklare\b/gi, "AI Engineer");
  translated = translated.replace(/\bFullstack-utvecklare\b/gi, "Fullstack Developer");
  translated = translated.replace(/\bBackend-utvecklare\b/gi, "Backend Developer");
  translated = translated.replace(/\bFrontend-utvecklare\b/gi, "Frontend Developer");
  translated = translated.replace(/\bDriftansvarig\b/gi, "Operations Manager");
  translated = translated.replace(/\bRestaurangchef\b/gi, "General Manager");

  return translated;
}

/**
 * Translates location for international resume presentations.
 */
export function translateLocation(location: string, targetLang: "sv" | "en"): string {
  if (!location) return "";
  if (targetLang === "sv") return location;

  const loc = location.trim();
  if (loc.toLowerCase() === "göteborg" || loc.toLowerCase() === "goteborg") {
    return "Gothenburg, Sweden";
  }
  if (loc.toLowerCase() === "stockholm") {
    return "Stockholm, Sweden";
  }
  if (loc.toLowerCase() === "malmö" || loc.toLowerCase() === "malmo") {
    return "Malmö, Sweden";
  }

  // If already contains country or other format, return as is
  return loc;
}

/**
 * Dictionary for Swedish education credentials translated to English equivalents.
 */
const DEGREE_TRANSLATIONS: Record<string, string> = {
  "Yrkeshögskoleexamen (YH)": "Higher Vocational Diploma",
  "Yrkeshögskoleexamen": "Higher Vocational Diploma",
  "Högskolekurs": "University Course",
  "Kandidatexamen": "Bachelor's Degree",
  "Masterexamen": "Master's Degree",
  "Civilingenjörsexamen": "Master of Science in Engineering",
  "Högskoleingenjörsexamen": "Bachelor of Science in Engineering",
  "Gymnasieexamen": "Upper Secondary School Diploma",
};

const FIELD_TRANSLATIONS: Record<string, string> = {
  "Objektorienterad programmering med AI": "Object-Oriented Programming with AI",
  "Lärandeteorier och yrkeskunnande": "Learning Theories and Vocational Knowledge",
  "Datavetenskap": "Computer Science",
  "Systemvetenskap": "Information Systems",
  "Mjukvaruutveckling": "Software Engineering",
  "Webbutveckling": "Web Development",
};

const SCHOOL_TRANSLATIONS: Record<string, string> = {
  "Göteborgs universitet": "University of Gothenburg",
  "Chalmers tekniska högskola": "Chalmers University of Technology",
  "KTH": "KTH Royal Institute of Technology",
  "Lunds universitet": "Lund University",
  "Stockholms universitet": "Stockholm University",
  "NBI / Handelsakademin, Göteborg": "NBI / Handelsakademin, Gothenburg",
};

/**
 * Translates an education item into the target language.
 */
export function translateEducation(
  edu: Education,
  targetLang: "sv" | "en"
): Education {
  if (targetLang === "sv") {
    return edu;
  }

  return {
    ...edu,
    degree: DEGREE_TRANSLATIONS[edu.degree] || edu.degree,
    fieldOfStudy: edu.fieldOfStudy
      ? FIELD_TRANSLATIONS[edu.fieldOfStudy] || edu.fieldOfStudy
      : edu.fieldOfStudy,
    school: SCHOOL_TRANSLATIONS[edu.school] || edu.school,
  };
}

/**
 * Translates skill category headings if they are in Swedish.
 */
const SKILL_CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Programmeringsspråk": "Programming Languages",
  "Programmeringsspråk & Backend": "Programming Languages & Backend",
  "Frontend & Webb": "Frontend Development",
  "Frontend-utveckling": "Frontend Development",
  "Backend & API": "Backend & API Design",
  "Databaser": "Databases",
  "Moln & DevOps": "Cloud & DevOps",
  "Systemarkitektur & Prestanda": "System Architecture & Performance",
  "AI & Maskininlärning": "AI & Machine Learning",
  "AI & Data": "AI & Data",
  "Metoder & Verktyg": "Methodologies & Tools",
};

export function translateSkillCategory(
  category: string,
  targetLang: "sv" | "en"
): string {
  if (targetLang === "sv") return category;
  return SKILL_CATEGORY_TRANSLATIONS[category] || category;
}
