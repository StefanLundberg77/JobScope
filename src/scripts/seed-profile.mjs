import { createClient } from "@libsql/client";
import fs from "node:fs";

const client = createClient({ url: "file:dev.db" });

const rawText = fs.existsSync("docs/cv_2page_master_content.md")
  ? fs.readFileSync("docs/cv_2page_master_content.md", "utf8")
  : "";

const profileData = {
  id: "default",
  fullName: "Stefan Lundberg",
  title: "Systemutvecklare & AI-utvecklare",
  email: "bjorn.stefan.lundberg@gmail.com",
  phone: "+46 709 550 666",
  location: "Göteborg",
  website: "https://slundberg.com",
  linkedin: "https://linkedin.com/in/stefan-lundberg-30055584",
  github: "https://github.com/StefanLundberg77",
  summary:
    "Kreativ och analytisk systemutvecklare med specialisering inom C#/.NET, Python, objektorienterad systemarkitektur och tillämpad AI (RAG och intelligenta agenter). Kombinerar djup teknisk förståelse för nätverk, multitrådade system och prestandaoptimering med över tio års beprövat ledarskap och krishantering från restaurangbranschen. Erfarenhet av att leda mjukvaruutveckling från idé och arkitektur hela vägen till skarp produktionsrelease på Steam.",
  experiences: [
    {
      id: "exp-1",
      company: "Nordstern Studio (Northhack Media)",
      role: "Game Director & Utvecklare",
      location: "Göteborg",
      startDate: "2024",
      endDate: "",
      current: true,
      description:
        "Leder den kreativa visionen, speldesignen och den tekniska arkitekturen bakom debut-titeln \"No Final Run\", ett actionfyllt roguelite lanserat på Steam.",
      achievements: [
        "Systemarkitektur & Spelmekanik: Utvecklade centrala spelsystem, procedurgenerering, vapenbalansering och fiende-AI i Unity och C#.",
        "Prestandaoptimering: Profilerade minnesallokering och render-loops för att säkerställa stabil framerate vid intensiva partikelflöden och stora objektmängder.",
        "Agil Projektledning: Samordnade utvecklingsteamet genom Scrum/Kanban samt ansvarade för release- och versionshantering på Steamworks."
      ],
      skills: [
        "C#",
        "Unity Engine",
        "Systemarkitektur",
        "Procedurgenerering",
        "Prestandaoptimering",
        "Steamworks",
        "Agilt / Scrum"
      ]
    },
    {
      id: "exp-2",
      company: "Orbislinks",
      role: "LIA 2: Fullstack- & AI-utvecklare",
      location: "Göteborg",
      startDate: "2025-11",
      endDate: "2026-02",
      current: false,
      description:
        "Arbetade brett med utvecklingen av Orbislinks plattform med fokus på intelligenta tjänster, API-integrationer och fullstack.",
      achievements: [
        "RAG-Chatbot & Agenter: Designade och driftsatte en chatbot-pipeline (Flask/Python) som integrerade företagets interna API:er och externa flygplatsportaler (Swedavia/Aena) med web search som fallback.",
        "B2P2P Marknadsplats (MVP): Ansvarade för utvecklingen av MVP-arkitekturen för marknadsplatsen (KYC-verifiering och säkra transaktionsflöden).",
        "Web Scraping & DevOps: Byggde robusta webscrapers för automatisk datainsamling och satte upp containeriserade utvecklingsmiljöer i WSL/Linux, Docker och Nginx."
      ],
      skills: [
        "Python",
        "Flask",
        "RAG",
        "LLM-agenter",
        "Docker",
        "Nginx",
        "WSL2 / Linux",
        "REST API",
        "Web Scraping"
      ]
    },
    {
      id: "exp-3",
      company: "Northhack Media (Oxide Arena)",
      role: "LIA 1: Spelutvecklare & C#-backend",
      location: "Göteborg",
      startDate: "2025-02",
      endDate: "2025-04",
      current: false,
      description:
        "Fokuserade på backend-programmering, flertrådning, nätverkssynkronisering och fysikoptimering för flerspelarspelet \"Oxide Arena\" i Unity och C#.",
      achievements: [
        "Nätverkssynk & Prediktion: Utvecklade klientside-prediktion (client prediction) och rörelseutjämning (smoothing) med acceleration och snapshots för att eliminera jitter.",
        "Trådsäkerhet: Implementerade trådsäkra mekanismer (locks och atomära operationer) för projektilpooler och spelvärldens tillstånd (world state).",
        "Livscykelarkitektur: Strukturerade om projektilsystemet med tick-loop och tvåstegs-cleanup för ökad stabilitet och minskade garbage collection-spikar."
      ],
      skills: [
        "C#",
        "Unity Engine",
        "Flertrådning",
        "Nätverkssynkronisering",
        "Client Prediction",
        "Fysik & Prestanda"
      ]
    },
    {
      id: "exp-4",
      company: "Stigbergets Restaurang AB, Nefertiti m.fl.",
      role: "Restaurang- & Barchef / Driftansvarig",
      location: "Göteborg",
      startDate: "2014",
      endDate: "2024",
      current: false,
      description:
        "Över 10 års erfarenhet av operativ drift, personalansvar (team upp till 20 medarbetare), schemaläggning, ekonomisk uppföljning och gästupplevelse i högintensiva miljöer.",
      achievements: [
        "Överförbara styrkor: Agil problemlösning under extrem tidspress, tydlig teamkommunikation, konflikthantering och strukturerat kvalitetsarbete.",
        "Ledaransvar: Ledde team på upp till 20 personer med schemaläggning, budget, inventering och leverantörskontakter."
      ],
      skills: [
        "Ledarskap",
        "Krishantering",
        "Teamledning",
        "Problemlösning under press",
        "Kvalitetsarbete"
      ]
    }
  ],
  education: [
    {
      id: "edu-1",
      school: "NBI / Handelsakademin, Göteborg",
      degree: "Yrkeshögskoleexamen (YH)",
      fieldOfStudy: "Objektorienterad programmering med AI",
      startDate: "2024",
      endDate: "2026",
      description:
        "Fördjupning inom C#, .NET, Python, systemarkitektur, databaser och tillämpad maskininlärning."
    },
    {
      id: "edu-2",
      school: "Göteborgs universitet",
      degree: "Högskolekurs",
      fieldOfStudy: "Lärandeteorier och yrkeskunnande",
      startDate: "2021",
      endDate: "2021",
      description: "Pedagogik, handledning och kommunikation."
    }
  ],
  skills: [
    {
      category: "Programmeringsspråk",
      items: [
        "C#",
        "Python",
        "SQL (MySQL, SQLite, SQL Server)",
        "TypeScript",
        "JavaScript",
        "HTML5",
        "CSS3"
      ]
    },
    {
      category: "Backend & Arkitektur",
      items: [
        ".NET Core",
        "FastAPI",
        "Flask",
        "React",
        "Next.js",
        "Unity Engine",
        "Dapper",
        "Alembic",
        "Node.js",
        "RESTful API Design"
      ]
    },
    {
      category: "AI & Data Science",
      items: [
        "RAG (Retrieval-Augmented Generation)",
        "PydanticAI",
        "LanceDB",
        "Scikit-learn",
        "Pandas",
        "DuckDB",
        "dbt",
        "dltHub"
      ]
    },
    {
      category: "Verktyg & DevOps",
      items: [
        "Docker",
        "Nginx",
        "WSL2 / Linux",
        "Git & GitHub",
        "Visual Studio",
        "VS Code",
        "DBeaver",
        "SSMS",
        "Dagster",
        "Snowflake"
      ]
    }
  ],
  languages: [
    { language: "Svenska", proficiency: "Modersmål" },
    { language: "Engelska", proficiency: "Flytande" },
    { language: "Tyska", proficiency: "Grundläggande" }
  ],
  projects: [
    {
      name: "Examensarbete: Multimodal RAG för Kassasystem",
      description:
        "En jämförande teknisk analys mellan lokal Open Source-arkitektur och Azure Cloud för bildbaserad produktregistrering i realtid via kamera (OPA 24). Utvärderade svarstider (latency), molndriftskostnader, feltolerans och dataintegritet.",
      link: "https://slundberg.com",
      techStack: [
        "Python",
        "Multimodal RAG",
        "Computer Vision",
        "Azure Cloud",
        "Open Source LLM",
        "Vektordatabaser"
      ]
    },
    {
      name: "JobScope (Plattform för Kravprofilsanalys & Job Tech)",
      description:
        "Fullstack-applikation för automatiserad bevakning och analys av IT-arbetsmarknaden via Arbetsförmedlingens öppna JobTech API. Byggde analysmotor för att extrahera kravprofiler, identifiera kompetensgap samt lokal SQLite/Prisma 7-arkitektur.",
      link: "https://github.com/StefanLundberg77/JobScope",
      techStack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite",
        "Tailwind CSS",
        "Gemini API",
        "JobTech API"
      ]
    },
    {
      name: "No Final Run (Steam Release)",
      description:
        "Actionfyllt roguelite utvecklat i Unity och C#, släppt på Steam. Omfattar procedurgenerering, realtids-AI, vapensystem, minnesprofilering och Steamworks-integration.",
      link: "https://store.steampowered.com",
      techStack: [
        "C#",
        "Unity Engine",
        "Procedural Generation",
        "AI",
        "Steamworks API"
      ]
    }
  ],
  rawText
};

async function seed() {
  console.log("Seeding MasterProfile into dev.db...");
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO MasterProfile (
      id, fullName, email, phone, location, title, summary, website, linkedin, github,
      experiences, education, skills, languages, projects, rawText, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    ) ON CONFLICT(id) DO UPDATE SET
      fullName=excluded.fullName,
      email=excluded.email,
      phone=excluded.phone,
      location=excluded.location,
      title=excluded.title,
      summary=excluded.summary,
      website=excluded.website,
      linkedin=excluded.linkedin,
      github=excluded.github,
      experiences=excluded.experiences,
      education=excluded.education,
      skills=excluded.skills,
      languages=excluded.languages,
      projects=excluded.projects,
      rawText=excluded.rawText,
      updatedAt=excluded.updatedAt`,
    args: [
      profileData.id,
      profileData.fullName,
      profileData.email,
      profileData.phone,
      profileData.location,
      profileData.title,
      profileData.summary,
      profileData.website,
      profileData.linkedin,
      profileData.github,
      JSON.stringify(profileData.experiences),
      JSON.stringify(profileData.education),
      JSON.stringify(profileData.skills),
      JSON.stringify(profileData.languages),
      JSON.stringify(profileData.projects),
      profileData.rawText,
      now,
      now
    ]
  });

  console.log("MasterProfile seeded successfully!");
}

seed().catch((err) => {
  console.error("Error seeding profile:", err);
  process.exit(1);
});
