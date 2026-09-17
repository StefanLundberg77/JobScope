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
- Kandidaten har en bred teknisk grund (C#/.NET, Python, SQL, REST API-design, Docker/Linux, AI/RAG, databaser) kombinerat med flerårig beprövad operativ erfarenhet av drift, samordning och teamledarskap (driftansvarig/chef fram till 2024).
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
  * Om rollen gäller t.ex. IT-support, applikationsdrift, testare eller teknisk samordnare: värdera kandidatens systemförståelse, felsökningsförmåga, programmeringslogik, SQL-vana, Linux/Docker-kunskap samt fleråriga stresstålighet, teamledarvana och problemlösningsförmåga som mycket starka och direkt överförbara meriter.
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

import { detectLanguage } from "./languageUtils";

/**
 * Detects whether the primary language of a job posting is English or Swedish.
 *
 * @param text Combined title and description text of the job ad
 * @returns 'en' if English is the dominant language, otherwise 'sv'
 */
export function detectJobLanguage(text: string): "sv" | "en" {
  return detectLanguage(text);
}

/**
 * Tailors a candidate's resume and authors a targeted cover letter for a specific job posting.
 * Supports bilingual generation (Swedish / English) with language auto-detection and distinct
 * tonal calibration (grounded Swedish tech tone vs international impact-driven tech tone).
 * Enforces strict anti-hallucination guardrails: no fabrication of employment, dates,
 * or credentials, focusing strictly on STAR rephrasing and authentic portfolio references.
 *
 * @param job Target job posting details
 * @param profile Candidate MasterProfileData
 * @param options Optional tailoring configuration (target language: 'sv' | 'en' | 'auto')
 * @returns Tailored CV data including reformulated experiences, cover letter, and diff notes
 */
export async function tailorApplicationWithAI(
  job: {
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
  },
  profile: MasterProfileData,
  options?: {
    language?: "sv" | "en" | "auto";
  }
): Promise<TailoredCvData> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  // Determine active language
  const detectedLang = detectJobLanguage(`${job.title} ${job.description}`);
  const activeLanguage: "sv" | "en" =
    options?.language === "en" || options?.language === "sv"
      ? options.language
      : detectedLang;

  let prompt = "";

  if (activeLanguage === "en") {
    // English International Tech Tone Prompt
    prompt = `
You are a senior technical recruiter and career advisor specializing in the global IT and software engineering market.
Task: Translate and tailor the candidate's Master-CV into professional English technical terminology, and author a concise, high-impact Cover Letter specifically for the job posting below.

STRICT ETHICAL RULES (TRUTH BARRIER):
1. NEVER fabricate employers, degrees, fake projects, certifications, or employment dates not present in the candidate's Master-CV.
2. All tailoring must be strictly grounded in real achievements and demonstrated skills.

INTERNATIONAL TECH TONE & ANTI-FLUFF STANDARD:
International tech hiring leads and engineering managers value confidence, clarity, strong action verbs, and impact over corporate buzzwords. Follow these principles strictly:

1. FORBIDDEN ENGLISH CLICHES (BLACKLIST - NEVER USE):
   - ❌ "with a strong foundation in..." (empty CV filler; state what you build and focus on directly)
   - ❌ "a track record of shipping production software..." (inflated corporate cliché; name the concrete product/release directly)
   - ❌ "Combines deep technical understanding of X with Y" / "deep technical understanding" (avoid self-aggrandizing labels and synthetic bridge sentences)
   - ❌ "pragmatic crisis management" / "crisis management" (consultant buzzword; use grounded phrasing like "operational team leadership and fast-paced prioritization")
   - ❌ "I am writing to express my enthusiastic interest / excited to apply for..."
   - ❌ "I have long admired / followed your company with great interest..." (unless a specific factual reason exists)
   - ❌ "Drawn by your unique company culture / vision / flexible benefits" (NEVER regurgitate company marketing copy)
   - ❌ "I am confident that my unique combination of..." / "unique ability"
   - ❌ "Synergistic self-starter / passionate go-getter / hit the ground running / wear many hats"
   - ❌ "Agile problem solving / agile mindset / solution-oriented / dynamic team player" (empty corporate buzzwords)
   - ❌ "Which provides a strong ability to..." / "combines X with Y to deliver unique..." (avoid inflated, indirect promotional bridge phrases; state concrete actions and delivery value directly)
   - ❌ "Experienced [tech] developer" or senior title inflation (candidate is junior/mid with deep practical project execution; use straightforward titles like "C#/.NET Developer" or "Software Developer").
   - ❌ Attributing software/DevOps capabilities ("from code to deployment") to restaurant leadership (keep code/deployment to technical projects like Steam/Docker/APIs).
   - ❌ "Even though I lack direct experience with [X]..." (NEVER apologize or sound defensive; proactively emphasize solid engineering fundamentals and rapid ramp-up).

2. ACTION VERBS & IMPACT-DRIVEN CV POINTS (STAR):
   - Fully translate all bullet points and summaries into natural, idiomatic technical English.
   - Begin achievement bullets with strong action verbs: Architected, Engineered, Implemented, Streamlined, Spearheaded, Profiled, Benchmarked, Automated, Deployed.
   - Emphasize engineering depth: multi-threading, concurrency locks, client-side prediction, snapshot smoothing, garbage collection optimization, RAG pipelines, Docker containerization, REST API design.

3. CV PROFILE SUMMARY (tailoredSummary) GUIDELINES & ROLE-ADAPTIVE BENCHMARK:
   - Length: Exactly 2 high-impact, factual sentences. High technical density, verb-first style, and zero HR fluff.
   - DYNAMIC ROLE ANCHORING (Adapt the primary focus and identity to what the target posting seeks):
     * If applying for GenAI / AI / Python / Data roles: Lead with applied GenAI/AI development (RAG architectures, agentic workflows, Python, multimodal retrieval) and solid systems engineering. Reference real implementations (Orbislinks, Thesis on Multimodal RAG on Azure, JobScope), reinforced by shipping commercial software to Steam (No Final Run) and operational team leadership.
       Example benchmark: "GenAI and software developer focused on applied AI pipelines (RAG, agentic workflows) and robust system architecture in Python and C#/.NET. Built multimodal retrieval benchmarks on Azure, shipped commercial software to Steam (No Final Run), and brings several years of operational team leadership."
     * If applying for C# / .NET / Backend roles: Lead with C#/.NET backend architecture, multithreading, and performance optimization.
       Example benchmark: "C#/.NET developer focused on backend architecture, performance optimization, and multithreaded systems. Shipped commercial software to Steam (No Final Run), with an earlier background in operational team leadership and fast-paced prioritization."
     * If applying for Fullstack / Broad IT roles: Balance modern fullstack delivery (Python/C#, React/Next.js, SQL/Docker) and operational reliability.
   - Hard Rules:
     * NEVER write "with a strong foundation in..."
     * NEVER write "Combines [X] with [Y]..."
     * NEVER write "deep technical understanding" or "track record"
     * Lead with active engineering focus and concrete shipped systems/pipelines.

4. COVER LETTER GUIDELINES (CONCISE & CONFIDENT):
   - Length: Exactly 3-4 short, punchy paragraphs (approx. 200–250 words total).
   - Opening: Go straight to the point in the first sentence tailored directly to the core nature of the role (e.g. For GenAI: "I am applying for the [Role] at [Company]. My focus is building production-grade GenAI systems—from RAG pipelines and autonomous agents to functional interfaces—backed by solid systems engineering in Python and C#..."; For C#/.NET: "I am applying for the [Role] at [Company]. My focus is performance-critical C# backend architecture and multithreaded systems, having shipped commercial software to Steam (No Final Run)...").
   - Body Paragraph 1 (Technical core): Reference real projects (No Final Run, Oxide Arena, JobScope, Orbislinks, PNS, Thesis on Multimodal RAG) showcasing architecture, performance, and backend depth.
   - Body Paragraph 2 (Databases & DevOps): Relational SQL databases, Docker environments, cloud fundamentals, and rapid adoption of new tech stacks.
   - Body Paragraph 3 (Operational Leadership & Team Experience): Frame previous background as manager/operations lead (up to 2024) as several years of operational drift and team leadership (calm under real-time pressure, fast prioritization, clear unpretentious team communication, delivery ownership). Avoid calling it "10+ years of operational leadership" or using buzzwords like "crisis management".
   - Closing: Professional, direct, and polite (1-2 sentences).

5. STRIPPED-DOWN EMAIL APPLICATION TEMPLATE (emailSubject & emailBody):
   - emailSubject:
     - Clear, professional subject line: "Application: [Exact Role Title] – ${profile.fullName || "Candidate"}" (include ad reference code if present in the posting).
   - emailBody:
     - Purpose: A stripped-down, crisp introductory message for when CV and cover letter are attached as PDFs. It must NEVER duplicate the full cover letter.
     - Length: Exactly 3-4 short, punchy sentences (approx. 50-80 words total).
     - Tone: Authentic developer klarspråk — direct, grounded, concrete, and unpretentious.
     - STRICT FORBIDDEN PHRASES & AI-LINGO (NEVER USE):
       * ❌ "paired with a strong focus on..."
       * ❌ "reliable delivery"
       * ❌ "with a passion for..." / "enthusiastic interest" / "thrilled to apply"
       * ❌ "unique combination" / "unique ability"
       * ❌ "agile mindset" / "solution-oriented" / "dynamic self-starter"
       * ❌ Any apologies or senior title inflation.
     - Content Structure:
       1. Greeting: "Hi [Contact Name if mentioned in the job ad, otherwise Hiring Team],"
       2. Direct hook & core technical match (1-2 sentences): State directly that you are applying for the [Role] at [Company]. Mention your core practical background plainly (e.g. C#/.NET backend and systems development, experience shipping software to production, and background in operational drift and team leadership) matching what they seek without buzzwords.
       3. Reference to attachments & code (1 sentence): "I have attached my CV and cover letter with more details. You can also inspect my code and past projects on GitHub: ${profile.github || "link"}."
       4. Straightforward closing: "Looking forward to hearing from you."
       5. Sign-off with contact details:
          Best regards,
          ${profile.fullName}
          ${profile.phone} | ${profile.email}
          ${profile.linkedin ? profile.linkedin + " | " : ""}${profile.github || ""}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description:
"""
${job.description.slice(0, 4000)}
"""

CANDIDATE'S MASTER-CV (SWEDISH SOURCE):
${JSON.stringify(profile, null, 2)}

Respond EXACTLY with this JSON schema (all string values translated into English):
{
  "tailoredSummary": "Concise, high-impact professional summary in English tailored to the target role",
  "tailoredExperiences": [
    {
      "id": "same id as master-cv",
      "company": "same company name",
      "role": "Translated/Optimized English Role Title (e.g. Lead Developer & Game Director)",
      "location": "location",
      "startDate": "start date",
      "endDate": "end date or 'Present'",
      "current": true,
      "description": "Optional brief role context in English",
      "achievements": [
        "Action-verb bullet 1 (e.g. 'Architected core gameplay and procedural systems in C#...')",
        "Action-verb bullet 2"
      ],
      "skills": ["Relevant technologies prioritized for the ad"]
    }
  ],
  "tailoredSkills": [
    {
      "category": "Category Name in English (e.g. Programming Languages, Backend & Frameworks, Cloud & DevOps)",
      "items": ["Skills prioritized with the ad's most desired first"]
    }
  ],
  "coverLetter": "Full English cover letter formatted with greeting, paragraphs, and closing. Confident, direct, impact-driven, and completely free from AI fluff.",
  "emailSubject": "Application: [Exact Role Title] – ${profile.fullName}",
  "emailBody": "Stripped-down, authentic developer application email (3-4 sentences, no buzzwords, referencing attached CV and letter)",
  "diffNotes": [
    {
      "section": "Summary / Experience X / Skills",
      "change": "Brief description of the translation/tailoring change",
      "rationale": "Why this change optimizes appeal for this specific employer"
    }
  ],
  "matchAnalysis": {
    "score": 85,
    "summary": "Match overview summary in English",
    "strongMatches": ["Match 1", "Match 2"],
    "transferableSkills": ["Skill 1"],
    "missingKeywords": ["Keyword 1"],
    "suggestions": ["Suggestion 1"]
  }
}
`;
  } else {
    // Swedish Grounded Tech Tone Prompt
    prompt = `
Du är en senior svensk tech-rekryterare och karriärrådgivare specialiserad på IT- och mjukvarubranschen.
Uppgift: Skräddarsy kandidatens CV och författa ett jordnära, genuint och knivskarpt personligt brev specifikt för nedanstående jobbannons.

STRIKTA ETISKA REGLER (SANNINGSBARRIÄR):
1. Du får ALDRIG hitta på arbetsgivare, utbildningar, fiktiva projekt, certifieringar eller anställningsdatum som inte finns i kandidatens Master-CV.
2. All anpassning ska bygga på verkliga meriter och genuint bevisade färdigheter.

STRIKTA REGLER FÖR TONALITET & SPRÅK (ANTI-FLUFF & INGEN SMÖRIGHET):
Svensk IT- och techkultur (CTO:s, tech-leads och rekryterare) föredrar autenticitet, rakhet och teknisk substans framför amerikansk "corporate fluff" och inställsamhet. Följ dessa principer stenhårt:

1. FÖRBJUDNA FRASER & KLYSCHOR (SVARTLISTA - ANVÄND ALDRIG):
   - ❌ "med en gedigen grund inom..." / "med en stark grund inom..." (passiv CV-klyscha; formulera vad du bygger och fokuserar på direkt)
   - ❌ "Kombinerar djup teknisk förståelse för X med Y..." (konstlad AI-brygga; skriv raka meningar med aktiva verb)
   - ❌ "djup teknisk förståelse" (beröm inte din egen förståelse med adjektiv; låt konkreta tekniker och projekt bevisa kunnandet)
   - ❌ "krishantering" (konsultord; använd jordnära beskrivning som "snabba prioriteringar under press" eller "lugn i kritiska lägen")
   - ❌ "Med stor entusiasm ansöker jag härmed..."
   - ❌ "Jag har följt er med stort intresse / under en längre tid..." (om inte en specifik faktisk anledning finns)
   - ❌ "Lockas av er unika företagskultur / ambition att vara Sveriges bästa arbetsgivare / flexibla lönemodell" (upprepa ALDRIG företagets marknadsföringsfloskler som en papegoja)
   - ❌ "Jag är övertygad om att min unika kombination av..." / "unik förmåga"
   - ❌ "Som spindeln i nätet / brinner för / hungrig på nya utmaningar / dynamisk lagspelare"
   - ❌ "Agil problemlösning / agilt mindset / agilt tänk / lösningsorienterad / driven och engagerad / många bollar i luften" (tomma konsult- och HR-klyschor)
   - ❌ "Vilket ger en stark förmåga till..." / "kombinerar X med Y vilket ger en unik förmåga..." (undvik distanserade, säljande konstruktioner; formulera konkreta handlingar, arbetssätt och leveransvärde direkt)
   - ❌ "Erfaren C#/.NET-utvecklare" eller annan uppblåst senioritetstitel (använd istället sakliga och nivåanpassade titlar som "C#/.NET-utvecklare" eller "Systemutvecklare inom C#/.NET" och låt skarpa meriter som flertrådning och Steam-release bevisa djupet).
   - ❌ Att tillskriva restaurangledarskap förmågan att "driva projekt från kod till drift" (kod till drift härrör uteslutande från de tekniska mjukvaruprojekten).
   - ❌ "Även om jag saknar erfarenhet av [X]..." (var ALDRIG defensiv eller ursäktande; fokusera istället proaktivt på en solid teknisk grund och snabb ramp-up).

2. RIKTLINJER FÖR PERSONLIGT BREV:
   - Inledning: Gå RAKT PÅ SAK i första meningen anpassad till rollens kärna (t.ex. vid GenAI: "Jag söker rollen som [Roll] hos er på [Företag]. Mitt fokus ligger på tillämpade GenAI- och RAG-system från hämtningslogik till fungerande gränssnitt, med en stabil ingenjörsgrund i Python och C#..."; vid C#/.NET: "Jag söker rollen som [Roll] hos er på [Företag]. Mitt fokus ligger på C#/.NET, systemarkitektur och prestandaoptimering, med erfarenhet av att bygga och släppa kommersiell mjukvara på Steam (No Final Run)...").
   - "Show, Don't Tell" (STAR): Referera till konkreta projekt ur portfolion/erfarenheten (t.ex. No Final Run, Oxide Arena, JobScope, Orbislinks RAG-agenter, PNS, examensarbetet). Förklara VAD som byggdes, vilka utmaningar som löstes (t.ex. prestandaoptimering, nätverkssynkronisering, flertrådning, trådsäkerhet, API-design) och hur det relaterar till annonsens krav.
   - Tidigare ledarerfarenhet (fram till 2024): Presentera den som flerårig erfarenhet av operativ drift och teamledarskap i högintensiva miljöer – stresstålighet under hög press, tydlig och prestigelös teamkommunikation, snabba prioriteringar samt vana att ta ansvar för drift, kvalitet och leverans. Blås INTE upp det till "10+ års operativt ledarskap" och undvik konsultlingo som "krishantering".
   - Proaktiv teknikmatchning: Vid nya databaser/ramverk – lyft kandidatens gedigna SQL- och mjukvarugrund och snabba inlärningsförmåga utan att be om ursäkt.
   - Avslutning: Saklig, artig och professionell (1-2 meningar) utan svulstiga löften.
   - Omfång: Håll brevet koncist och lättläst (ca 3-4 korta, kärnfulla stycken).

3. RIKTLINJER FÖR CV-PROFILTEXT (tailoredSummary) & ROLLANPASSAD GULDSTANDARD:
   - Längd: Exakt 2 kärnfulla, sakliga meningar. Hög teknisk densitet, aktiva verb och absolut noll HR-floskler.
   - DYNAMISK POSITIONERING (Anpassa primär titel och fokus efter annonsens inriktning):
     * Vid GenAI / AI / Data-roller: Led med tillämpad AI (RAG-arkitektur, agentiska arbetsflöden, Python, multimodala modeller) och solid systemutveckling. Lyft skarpa system (Orbislinks RAG-pipeline, examensarbetet med multimodal RAG på Azure, JobScope) och låt C#-grunden och Steam-releasen (No Final Run) samt operativt teamledarskap visa bredd och ingenjörsdisciplin.
       Exempel på förebild: "AI- och systemutvecklare med fokus på tillämpad AI (RAG-pipelines, agentiska flöden) och robust systemarkitektur i Python och C#/.NET. Har byggt multimodala RAG-system på Azure, släppt kommersiell mjukvara på Steam (No Final Run) och har flerårig erfarenhet av operativt teamledarskap under högt tempo."
     * Vid C#/.NET / Backend-roller: Led med backendarkitektur, flertrådning och prestandaoptimering.
       Exempel på förebild: "C#/.NET-utvecklare med fokus på backendarkitektur, flertrådning och prestandaoptimering. Har byggt och släppt kommersiell mjukvara på Steam (No Final Run), med en tidigare bakgrund inom operativt teamledarskap och snabba prioriteringar i högt tempo."
     * Vid Fullstack / Breda IT-roller: Balansera modern webb/backend (React/Next.js, Python, C#, SQL, Docker) och operativ driftsäkerhet.
   - Hårda regler:
     * Skriv ALDRIG "med en gedigen grund inom..."
     * Skriv ALDRIG "Kombinerar [X] med [Y]..."
     * Skriv ALDRIG "djup teknisk förståelse" eller "krishantering"
     * Låt konkreta handlingar, teknologier och projekt tala för sig själva.
   - Erfarenhetspunkter (STAR): Hög teknisk densitet, tydliga mätbara resultat och exakt terminologi. Prioritera kompetenser som annonsen efterfrågar högst upp.

4. RIKTLINJER FÖR AVSKALAT ANSÖKNINGSMEJL (emailSubject & emailBody):
   - Ämnesrad (emailSubject):
     - Format: "Ansökan: [Exakt rollnamn] – ${profile.fullName || "Kandidat"}" (inkludera eventuell annonsreferens/ID om det finns angivet i annonsen).
   - Mejltext (emailBody):
     - Syfte: Följemejl som klistras in när CV och personligt brev bifogas som PDF. Det ska ALDRIG upprepa hela det personliga brevet.
     - Längd: Exakt 3–4 korta, kärnfulla meningar (ca 50–80 ord totalt).
     - Språk & Tonalitet: Äkta utvecklarspråk (klarspråk). Avskalat, konkret och jordnära. Absolut ingen buzzword-sallad, inga CV-floskler och inget AI-lingo.
     - STRIKT FÖRBJUDNA FRASER & AI-LINGO (ANVÄND ALDRIG):
       * ❌ "kombinerat med ett starkt fokus på..." / "paired with a strong focus on..."
       * ❌ "leveranssäkerhet" / "pålitlig leverans" / "reliable delivery"
       * ❌ "brinner för..." / "med stor entusiasm ansöker jag..."
       * ❌ "unik kombination av..." / "unik förmåga..."
       * ❌ "spindeln i nätet" / "lösningsorienterad" / "agilt mindset" / "många bollar i luften"
       * ❌ Inga ursäkter ("även om jag saknar...") och ingen uppblåst senioritet.
     - Innehåll och struktur:
       1. Hälsningsfras: "Hej [Kontaktpersonens förnamn om namngiven i annonsen, annars Rekryteringsteamet],"
       2. Rak inledning & teknisk kärna (1–2 meningar): Ange rakt på sak att kandidaten söker rollen som [Rollnamn] hos [Företag]. Beskriv kort och sakligt den praktiska profilen (t.ex. C#/.NET, databaser, erfarenhet av att bygga och produktionssätta mjukvara samt tidigare erfarenhet av drift och teamledarskap) anpassat till rollen utan buzzwords.
       3. Hänvisning till bilagor & projekt (1 mening): "Bifogat finner ni mitt CV och personliga brev. Se gärna även tidigare projekt och kod på min GitHub: ${profile.github || "länk"}."
       4. Saklig avslutning: "Hör gärna av er om profilen låter intressant, så berättar jag mer vid en intervju."
       5. Signatur med kontaktuppgifter:
          Med vänlig hälsning,
          ${profile.fullName}
          ${profile.phone} | ${profile.email}
          ${profile.linkedin ? profile.linkedin + " | " : ""}${profile.github || ""}

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
  "tailoredSummary": "Skräddarsydd profilpitch anpassad till rollen och företaget (2-3 meningar, saklig, hög teknisk densitet, noll HR-floskler)",
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
  "emailSubject": "Ansökan: [Exakt rollnamn] – ${profile.fullName}",
  "emailBody": "Avskalat och jordnära ansökningsmejl (3-4 meningar, noll floskler, hänvisning till bifogat CV och brev)",
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
  }

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text);
  return {
    language: activeLanguage,
    emailSubject: parsed.emailSubject || "",
    emailBody: parsed.emailBody || "",
    ...parsed,
  };
}
