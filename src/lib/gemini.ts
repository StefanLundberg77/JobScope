import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import {
  MasterProfileData,
  MatchAnalysis,
  TailoredCvData,
} from "./types";

/**
 * Retrieves the Gemini API key, prioritizing user-defined settings in the SQLite
 * database before falling back to the GEMINI_API_KEY environment variable.
 *
 * @returns The configured Gemini API key, or null if not found.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  // Check settings table first, fallback to process.env
  try {
    const settings = await prisma.userSettings.findFirst();
    if (settings?.geminiApiKey?.trim()) {
      return settings.geminiApiKey.trim();
    }
  } catch (error) {
    console.error("Failed to read UserSettings for API key:", error);
  }

  return process.env.GEMINI_API_KEY?.trim() || null;
}

/**
 * Instantiates the GoogleGenerativeAI client using the active API key.
 *
 * @throws Error if no valid Gemini API key is configured.
 */
export async function getGeminiClient(): Promise<GoogleGenerativeAI> {
  const key = await getGeminiApiKey();
  if (!key) {
    throw new Error(
      "Ingen Gemini API-nyckel hittades. Vänligen ange din API-nyckel i inställningarna eller i .env (GEMINI_API_KEY)."
    );
  }
  return new GoogleGenerativeAI(key);
}

/**
 * Input payload for profile parsing, supporting raw text or a base64-encoded PDF.
 */
export interface ParseProfileInput {
  rawText?: string;
  pdfBase64?: string;
}

/**
 * Extracts structured candidate profile data from raw text or uploaded PDF (e.g. LinkedIn PDF export).
 * Enforces JSON response formatting and low temperature to prevent hallucination.
 *
 * @param input Object containing rawText or pdfBase64
 * @returns Structured partial profile data ready for database persistence
 */
export async function parseProfileWithAI(
  input: ParseProfileInput
): Promise<Partial<MasterProfileData>> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const baseInstructions = `
Du är en erfaren rekryteringsexpert och dataextraherare.
Analysera följande CV, LinkedIn-profil (PDF-export eller text) eller portfolio och extrahera all information i strikt JSON-format.

Särskilt för LinkedIn PDF-exporter och portfolier:
- LinkedIn-exporter har ofta en vänsterspalt med kontaktuppgifter (namn, e-post, telefon, LinkedIn-länk, ort), primära kompetenser och språk.
- Huvudspalten innehåller sammanfattning/om mig, arbetslivserfarenhet och utbildning.
- Identifiera särskilt utvalda projekt, portfolio-arbeten eller publikationer om sådana nämns, och placera dem i "projects".
- Om portfoliolänkar eller webbplatser finns angivna, extrahera dem till website eller respektive projekts link.

Regler:
1. Hitta inte på fiktiv information som inte finns i källan.
2. Formatera erfarenheter och utbildningar med realistiska eller angivna datum (t.ex. "2021-01" eller "2021").
3. Dela upp kompetenser/färdigheter i relevanta kategorier (t.ex. "Programmeringsspråk", "Ramverk & Bibliotek", "Moln & DevOps", "Verktyg", "Metodik & Mjuka förmågor").
4. För varje roll, dela upp beskrivningen i tydliga prestationer/ansvarsområden (achievements) samt använda teknologier (skills).
5. Extrahera projekt/portfolio med projektnamn, beskrivning, tech stack och eventuella webblänkar.

Svara EXAKT med detta JSON-schema:
{
  "fullName": "Förnamn Efternamn",
  "email": "epost@domän.se",
  "phone": "070-1234567",
  "location": "Stad/Ort",
  "title": "Nuvarande eller huvudsaklig yrkestitel",
  "summary": "Kort sammanfattning av profil och styrkor",
  "website": "URL eller tom sträng",
  "linkedin": "LinkedIn URL eller tom sträng",
  "github": "GitHub URL eller tom sträng",
  "experiences": [
    {
      "id": "exp-1",
      "company": "Företagsnamn",
      "role": "Yrkestitel",
      "location": "Stad eller Remote",
      "startDate": "ÅÅÅÅ-MM",
      "endDate": "ÅÅÅÅ-MM eller pågående",
      "current": true,
      "description": "Övergripande beskrivning",
      "achievements": [
        "Konkret prestation 1 med resultat eller mätvärden om det finns",
        "Konkret prestation 2"
      ],
      "skills": ["Teknik 1", "Teknik 2"]
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "school": "Skola / Universitet",
      "degree": "Examen / Utbildningslinje",
      "fieldOfStudy": "Inriktning",
      "startDate": "ÅÅÅÅ",
      "endDate": "ÅÅÅÅ",
      "description": "Ytterligare info"
    }
  ],
  "skills": [
    {
      "category": "Kategorinamn",
      "items": ["Färdighet 1", "Färdighet 2"]
    }
  ],
  "languages": [
    {
      "language": "Svenska",
      "proficiency": "Modersmål / Flytande / Grundläggande"
    }
  ],
  "projects": [
    {
      "name": "Projektnamn",
      "description": "Beskrivning av projektet och dess syfte",
      "link": "Länk om finns",
      "techStack": ["Teknik 1", "Teknik 2"]
    }
  ]
}
`;

  let result;
  if (input.pdfBase64) {
    result = await model.generateContent([
      {
        inlineData: {
          data: input.pdfBase64,
          mimeType: "application/pdf",
        },
      },
      baseInstructions,
    ]);
  } else if (input.rawText) {
    const prompt = `${baseInstructions}\n\nKälltext:\n"""\n${input.rawText}\n"""`;
    result = await model.generateContent(prompt);
  } else {
    throw new Error("Varken text eller PDF-fil angavs för import.");
  }

  const text = result.response.text();
  return JSON.parse(text);
}

/**
 * Backwards-compatible wrapper to extract structured profile data from raw text.
 *
 * @param rawText Unstructured resume or portfolio text
 * @returns Structured partial profile data
 */
export async function parseRawProfileWithAI(
  rawText: string
): Promise<Partial<MasterProfileData>> {
  return parseProfileWithAI({ rawText });
}

/**
 * Performs ATS semantic match scoring and gap analysis between a candidate's
 * Master-CV and a target job ad description.
 *
 * @param job Target job ad attributes (title, company, description, required/preferred skills)
 * @param profile Candidate MasterProfileData
 * @returns Semantic match analysis containing 0-100 score, matches, transferable skills, and gaps
 */
export async function analyzeJobMatchWithAI(
  job: {
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
    preferredSkills?: string[];
  },
  profile: MasterProfileData
): Promise<MatchAnalysis> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = `
Du är en senior teknisk rekryterare och ATS-expert.
Gör en objektiv matchningsanalys mellan kandidatens Master-CV och en specifik jobbannons.

VIKTIG PROFILKONTEXT & SÖKINSTÄLLNING:
- Kandidaten har en bred teknisk grund (C#/.NET, Python, SQL, REST API-design, Docker/Linux, AI/RAG, databaser) kombinerat med över 10 års beprövad operativ ledar-, samordnings- och drifterfarenhet från restaurangbranschen.
- Kandidaten söker BRETT och är fullt öppen för hela spektrumet av roller inom IT och tech:
  * Mjukvaruutveckling (backend, frontend, fullstack, junior utvecklare, systemutvecklare)
  * Applikationsdrift, systemförvaltning, IT-tekniker och drifttekniker
  * IT-support, servicedesk, applikationssupport och teknisk kundsupport
  * Testning, kvalitetssäkring (QA) och mjukvaruverifiering
  * DevOps, moln (Cloud), infrastruktur och nätverk
  * Datateknik, dataanalys och AI/automation
  * IT-konsult och teknisk projektkoordinering
- BEDÖMNINGSPRINCIP FÖR BREDA IT-ROLLER:
  * Sätt INTE ett lågt matchningsscore enbart för att rollens titel inte heter exakt "Systemutvecklare" eller "AI-utvecklare".
  * Om rollen gäller t.ex. IT-support, applikationsdrift, testare eller teknisk samordnare: värdera kandidatens systemförståelse, felsökningsförmåga, programmeringslogik, SQL-vana, Linux/Docker-kunskap samt 10+ års stresstålighet och problemlösning som mycket starka och direkt överförbara meriter.
  * Beräkna en rättvis och realistisk matchningsprocent (0-100) baserat på kärnkrav och hur väl kandidatens samlade tekniska grund och inlärningsförmåga passar rollen.

JOBBANNONS:
Titel: ${job.title}
Företag: ${job.company}
Krav/Önskemål: ${JSON.stringify(job.requiredSkills || [])}
Beskrivning:
"""
${job.description.slice(0, 4000)}
"""

KANDIDATENS MASTER-CV:
Titel: ${profile.title}
Sammanfattning: ${profile.summary}
Färdigheter: ${JSON.stringify(profile.skills)}
Erfarenheter: ${JSON.stringify(
    profile.experiences.map((e) => ({
      role: e.role,
      company: e.company,
      skills: e.skills,
      achievements: e.achievements,
    }))
  )}
Projekt & Portfolio: ${JSON.stringify(
    (profile.projects || []).map((p) => ({
      name: p.name,
      description: p.description,
      techStack: p.techStack,
      link: p.link,
    }))
  )}
Utbildning: ${JSON.stringify(
    (profile.education || []).map((u) => ({
      school: u.school,
      degree: u.degree,
      fieldOfStudy: u.fieldOfStudy,
      description: u.description,
    }))
  )}

Instruktioner:
- Beräkna en realistisk och rättvis matchningsprocent (0-100) baserat på kärnkrav, relevanta teknologier och kandidatens samlade IT-kompetens.
- Identifiera starka matchningar (kompetenser och teknologier kandidaten har som annonsen uttryckligen söker).
- Identifiera överförbara färdigheter (kandidaten har snarlik erfarenhet, projekt eller teknisk grund som kan appliceras).
- Identifiera saknade nyckelord/krav som kandidaten antingen saknar eller inte har explicit nämnt.
- Ge 2-4 konkreta råd för hur ansökan bäst vinklas för denna roll.

Svara EXAKT med detta JSON-schema:
{
  "score": 85,
  "summary": "1-2 meningar om övergripande matchning",
  "strongMatches": ["Match 1", "Match 2"],
  "transferableSkills": ["Färdighet 1", "Färdighet 2"],
  "missingKeywords": ["Nyckelord 1", "Nyckelord 2"],
  "suggestions": ["Råd 1", "Råd 2"]
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}

/**
 * Tailors a candidate's resume and authors a targeted cover letter for a specific job posting.
 * Enforces strict anti-hallucination guardrails: no fabrication of employment, dates,
 * or credentials, focusing strictly on STAR rephrasing and authentic portfolio references.
 *
 * @param job Target job posting details
 * @param profile Candidate MasterProfileData
 * @returns Tailored CV data including reformulated experiences, cover letter, and diff notes
 */
export async function tailorApplicationWithAI(
  job: {
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
  },
  profile: MasterProfileData
): Promise<TailoredCvData> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = `
Du är en senior svensk tech-rekryterare och karriärrådgivare specialiserad på IT- och mjukvarubranschen.
Uppgift: Skräddarsy kandidatens CV och författa ett jordnära, genuint och knivskarpt personligt brev specifikt för nedanstående jobbannons.

STRIKTA ETISKA REGLER (SANNINGSBARRIÄR):
1. Du får ALDRIG hitta på arbetsgivare, utbildningar, fiktiva projekt, certifieringar eller anställningsdatum som inte finns i kandidatens Master-CV.
2. All anpassning ska bygga på verkliga meriter och genuint bevisade färdigheter.

STRIKTA REGLER FÖR TONALITET & SPRÅK (ANTI-FLUFF & INGEN SMÖRIGHET):
Svensk IT- och techkultur (CTO:s, tech-leads och rekryterare) föredrar autenticitet, rakhet och teknisk substans framför amerikansk "corporate fluff" och inställsamhet. Följ dessa principer stenhårt:

1. FÖRBJUDNA FRASER & KLYSCHOR (SVARTLISTA - ANVÄND ALDRIG):
   - ❌ "Med stor entusiasm ansöker jag härmed..."
   - ❌ "Jag har följt er med stort intresse / under en längre tid..." (om inte en specifik faktisk anledning finns)
   - ❌ "Lockas av er unika företagskultur / ambition att vara Sveriges bästa arbetsgivare / flexibla lönemodell" (upprepa ALDRIG företagets marknadsföringsfloskler som en papegoja)
   - ❌ "Jag är övertygad om att min unika kombination av..."
   - ❌ "Som spindeln i nätet / brinner för / hungrig på nya utmaningar / dynamisk lagspelare"
   - ❌ "Även om jag saknar erfarenhet av [X]..." (var ALDRIG defensiv eller ursäktande; fokusera istället proaktivt på en solid teknisk grund och snabb ramp-up).

2. RIKTLINJER FÖR PERSONLIGT BREV:
   - Inledning: Gå RAKT PÅ SAK i första meningen. Ange vilken roll det gäller och sammanfatta kärnan i vad kandidaten erbjuder (t.ex. stark C#-grund, systemarkitektur och 10+ års operativt ledarskap).
   - "Show, Don't Tell" (STAR): Referera till konkreta projekt ur portfolion/erfarenheten (t.ex. No Final Run, Oxide Arena, JobScope, Orbislinks RAG-agenter, PNS, examensarbetet). Förklara VAD som byggdes, vilka utmaningar som löstes (t.ex. prestandaoptimering, nätverkssynkronisering, flertrådning, trådsäkerhet, API-design) och hur det relaterar till annonsens krav.
   - Tidigare ledarerfarenhet (Restaurangbranschen): Presentera den som en konkret operativ styrka – stresstålighet under hög press, tydlig och prestigelös teamkommunikation, samt vana att ta ansvar för drift och leverans.
   - Proaktiv teknikmatchning: Vid nya databaser/ramverk – lyft kandidatens gedigna SQL- och mjukvarugrund och snabba inlärningsförmåga utan att be om ursäkt.
   - Avslutning: Saklig, artig och professionell (1-2 meningar) utan svulstiga löften.
   - Omfång: Håll brevet koncist och lättläst (ca 3-4 korta, kärnfulla stycken).

3. RIKTLINJER FÖR CV-SAMMANFATTNING & PUNKTER:
   - Formulera skräddarsydda punkter med hög teknisk densitet, tydliga mätbara resultat och exakt terminologi.
   - Prioritera de kompetenser som annonsen efterfrågar högst upp.

JOBBANNONS:
Titel: ${job.title}
Företag: ${job.company}
Beskrivning:
"""
${job.description.slice(0, 4000)}
"""

KANDIDATENS MASTER-CV:
${JSON.stringify(profile, null, 2)}

Svara EXAKT med detta JSON-schema:
{
  "tailoredSummary": "Skräddarsydd profilpitch anpassad till rollen och företaget (saklig, hög teknisk densitet, inga floskler)",
  "tailoredExperiences": [
    {
      "id": "samma id som i master-cv",
      "company": "samma företagsnamn",
      "role": "samma rollnamn",
      "location": "plats",
      "startDate": "start",
      "endDate": "slut",
      "current": true,
      "description": "eventuell kort ingress",
      "achievements": [
        "Optimerad punkt 1 med fokus på relevanta tekniska resultat och nyckelord",
        "Optimerad punkt 2"
      ],
      "skills": ["Relevanta teknologier i prioriterad ordning"]
    }
  ],
  "tailoredSkills": [
    {
      "category": "Kategori",
      "items": ["Kompetenser sorterade med annonsens mest eftertraktade först"]
    }
  ],
  "coverLetter": "Fullständigt personligt brev formaterat i stycken med hälsningsfras och avslutning. Jordnära, konkret, genuint och fritt från klyschor och AI-smör.",
  "diffNotes": [
    {
      "section": "Sammanfattning / Erfarenhet X / Färdigheter",
      "change": "Kort beskrivning av ändringen",
      "rationale": "Varför denna förändring förbättrar chanserna hos denna specifika arbetsgivare"
    }
  ],
  "matchAnalysis": {
    "score": 85,
    "summary": "Övergripande matchning",
    "strongMatches": ["Punkt 1", "Punkt 2"],
    "transferableSkills": ["Punkt 1"],
    "missingKeywords": ["Nyckelord 1"],
    "suggestions": ["Förslag 1"]
  }
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}
