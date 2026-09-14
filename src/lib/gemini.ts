import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import {
  MasterProfileData,
  MatchAnalysis,
  TailoredCvData,
} from "./types";

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

export async function getGeminiClient(): Promise<GoogleGenerativeAI> {
  const key = await getGeminiApiKey();
  if (!key) {
    throw new Error(
      "Ingen Gemini API-nyckel hittades. Vänligen ange din API-nyckel i inställningarna eller i .env (GEMINI_API_KEY)."
    );
  }
  return new GoogleGenerativeAI(key);
}

export interface ParseProfileInput {
  rawText?: string;
  pdfBase64?: string;
}

// Extract structured profile data from raw pasted text OR uploaded PDF (e.g. LinkedIn PDF export)
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

// Backwards-compatible wrapper
export async function parseRawProfileWithAI(
  rawText: string
): Promise<Partial<MasterProfileData>> {
  return parseProfileWithAI({ rawText });
}

// Analyze match between job listing and master CV
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
- Beräkna en realistisk matchningsprocent (0-100) baserat på kärnkrav, relevanta teknologier och kandidatens samlade kompetens (inklusive arbetslivserfarenhet, praktiska portfolioprojekt och utbildning).
- Identifiera starka matchningar (kompetenser och teknologier kandidaten har som annonsen uttryckligen söker).
- Identifiera överförbara färdigheter (kandidaten har snarlik erfarenhet eller projekt som kan appliceras).
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

// Tailor CV and write a Cover Letter for a specific job ad
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
Du är en professionell karriärrådgivare och expert på att optimera jobbansökningar.
Uppgift: Skräddarsy kandidatens CV och skriv ett personligt brev specifikt för nedanstående jobbannons.

STRIKTA ETISKA REGLER (SANNINGSBARRIÄR):
1. Du får ALDRIG hitta på arbetsgivare, utbildningar, fiktiva projekt eller år som kandidaten inte har.
2. Du FÅR och SKA:
   - Omformulera erfarenhetspunkter så att de lyfter fram relevanta ansvarsområden och teknologier med samma terminologi som annonsen.
   - Prioritera och sortera färdigheter så att de kompetenser som efterfrågas mest hamnar främst.
   - Skriva en vass, skräddarsydd sammanfattning (profile summary) som direkt adresserar arbetsgivarens behov och kandidatens motivation för just denna roll.
   - Aktivt referera till och lyfta fram relevanta projekt ur kandidatens portfolio/examensarbete (t.ex. PNS, Examensarbetet, JobScope, No Final Run) i det personliga brevet när dessa matchar arbetsgivarens efterfrågade teknologier eller domän.
   - Skriva ett engagerat, personligt och välformulerat personligt brev (på svenska) som bygger en bro mellan kandidatens verkliga meriter, portfolioprojekt och arbetsgivarens mål.

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
  "tailoredSummary": "Skräddarsydd hisspitch/sammanfattning anpassad till rollen och företaget",
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
        "Optimerad punkt 1 med fokus på relevanta resultat och nyckelord",
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
  "coverLetter": "Fullständigt personligt brev formaterat i stycken med hälsningsfras och avslutning, skräddarsytt för företaget och rollen.",
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
