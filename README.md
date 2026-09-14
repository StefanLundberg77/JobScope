# JobScope

JobScope är en modern webbapplikation byggd för intelligent bevakning av IT-arbetsmarknaden, kravprofilsanalys och matchning. Appen söker och bevakar relevanta jobbannonser via officiella öppna API:er (Arbetsförmedlingen JobTech Dev), analyserar kravprofiler och mappar kompetenser mot ett lokalt Master-CV med full transparens och mänsklig kontroll (human-in-the-loop).

## Huvudfunktioner

1. **Jobbsökning & Filter**:
   - Integrerad direkt mot Arbetsförmedlingens öppna JobTech Dev Search API (inga API-nycklar krävs för sökning).
   - Smarta snabbfilter för Göteborg, pendlingsavstånd (Mölndal, Kungälv, Kungsbacka, Borås etc.), Västra Götaland, distansarbete (remote) samt hela Sverige.
   - Möjlighet att klistra in en webblänk eller råtext från externa källor som LinkedIn, Indeed eller specifika karriärsidor.

2. **Master-CV & AI-Import**:
   - Central profil som fungerar som enda sanningskälla för din erfarenhet och utbildning.
   - Stöd för att klistra in råtext från ditt befintliga CV, LinkedIn-profil eller portfolio och automatiskt strukturera datan med hjälp av AI.

3. **AI-driven Matchning & Kravprofilsanalys**:
   - ATS-analys: matchningsprocent, starka träffar, överförbara färdigheter och saknade nyckelord.
   - Skräddarsydd profilpitch och omformulerade erfarenhetspunkter (STAR-metod) som lyfter fram dina faktiska prestationer i linje med annonsens språk.
   - Generering av personligt brev anpassat till rollen och företaget.
   - Fullständig diff-granskning (original vs optimerat) med förklarande motiveringar för varje förändring.
   - Inline-redigering: du har alltid sista ordet och kan justera alla texter direkt i gränssnittet.

4. **Utskrift & PDF-Export**:
   - Ren och ATS-optimerad enkelsidig/flersidig A4-layout för omedelbar utskrift eller sparande som PDF.

5. **Ansökningsspårare (Kanban)**:
   - Visuell tavla för att följa status: Sparade, Optimerade, Skickade, Intervju, Erbjudande och Avslag.

## Etiska Riktlinjer & Integritet

- **Sanningsbarriär (Anti-hallucination)**: Modellen är strikt instruerad att aldrig hitta på tidigare arbetsgivare, utbildningar, fiktiva projekt eller år som inte finns i ditt Master-CV. Syftet är att lyfta fram och belysa dina verkliga meriter med samma terminologi som arbetsgivaren efterfrågar.
- **Human-in-the-loop**: Inga ansökningar skickas automatiskt i blindo. Du granskar alltid förändringarna sida vid sida innan något exporteras eller skickas.
- **Lokal & Privat Lagring**: All personlig information, historik och API-nycklar sparas lokalt i en SQLite-databas på din dator. Ingen extern molndatabas krävs.

## Teknisk Arkitektur

- **Fullstack-ramverk**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS (med stöd för mörkt läge och utskriftsmedia)
- **Databas & ORM**: SQLite (`dev.db`) med Prisma 7 och `@prisma/adapter-libsql`
- **AI-motor**: Google Gemini API via `@google/generative-ai`
- **Öppna API:er**: Arbetsförmedlingen JobTech Dev Search API

## Installation och Start

### Förutsättningar
- Node.js version 20 eller högre
- npm

### 1. Klona och installera beroenden
```bash
git clone <repo-url>
cd JobScope
npm install
```

### 2. Konfigurera miljövariabler
Kopiera `.env.example` till `.env`:
```bash
cp .env.example .env
```
Ange din Google Gemini API-nyckel i `.env` eller direkt via appens inställningsflik:
```env
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY="din-gemini-api-nyckel"
```
*(En gratis API-nyckel kan hämtas från Google AI Studio).*

### 3. Initiera databasen
```bash
npx prisma db push
```

### 4. Starta utvecklingsservern
```bash
npm run dev
```
Applikationen finns tillgänglig på [http://localhost:3000](http://localhost:3000).

## Projektstruktur

```
src/
├── app/
│   ├── api/
│   │   ├── jobs/           # Endpoints för jobbhantering och detaljer
│   │   │   └── [id]/tailor # AI-optimering och diff-uppdateringar
│   │   ├── profile/        # Master-CV hantering och AI-import
│   │   └── settings/       # Inställningar och API-nycklar
│   ├── globals.css         # Tailwind och print-regler för A4 PDF
│   ├── layout.tsx
│   └── page.tsx            # Huvudvy och flödeshantering
├── components/
│   ├── CustomJobModal.tsx  # Ingest via länk eller råtext
│   ├── JobSearchView.tsx   # Sökning mot JobTech API med Göteborg-filter
│   ├── MasterProfileView.tsx # CV-editor och importmodal
│   ├── Navbar.tsx          # Navigering och statusräknare
│   ├── SettingsView.tsx    # Inställningar och API-konfiguration
│   ├── TailorStudio.tsx    # Sida-vid-sida diff, brev och PDF-preview
│   └── TrackerView.tsx     # Kanban-tavla för ansökningsstatus
└── lib/
    ├── db.ts               # Prisma-klient singleton med SQLite adapter
    ├── gemini.ts           # AI-prompts, analys och optimeringsmotor
    ├── jobtech.ts          # Klient för Arbetsförmedlingens API
    ├── parser.ts           # Extraherare för externa länkar och text
    └── types.ts            # Domäntyper och gränssnitt
```

## Licens
MIT
