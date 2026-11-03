# Implementation Plan: Automatisk AI-optimering & Ny navigationsknapp "CV-studion"

## 1. Bakgrund & Syfte
1. **Automatisk AI-optimering vid klick på "Optimera" i Jobbsök**:
   - När användaren klickar på "Optimera" i Jobbsök sparas annonsen men hamnade tidigare i ett tomt läge i `TailorStudio` (som visade "Inget skräddarsytt CV genererat ännu").
   - Användaren förväntar sig med rätta att AI-optimeringen ska kicka igång direkt när man trycker "Optimera".
2. **Ny flik "CV-studion" i Navbar**:
   - Användaren har markerat i bifogad skärmdump att det saknas en genväg mellan **"Ansökningar"** och **"Mitt Master-CV"**.
   - Idag förloras kontexten när man lämnar studion för att titta på Master-CV eller Jobbsök, och användaren måste gå via Ansökningar och leta upp rätt annons igen.
   - En ny flik **"CV-studion"** gör det möjligt att hoppa direkt tillbaka till det senast öppnade/optimerade CV:t med ett enda klick.

---

## 2. Arkitektur & Komponentändringar

### A. Uppdatering av Navbar (`src/components/Navbar.tsx`)
- Uppdatera typen `TabType`:
  ```typescript
  export type TabType = "search" | "import" | "tracker" | "studio" | "profile" | "settings";
  ```
- Lägg till ett nytt menyval mellan `tracker` ("Ansökningar") och `profile` ("Mitt Master-CV"):
  ```typescript
  {
    id: "studio" as TabType,
    label: "CV-studion",
    icon: Sparkles,
    badge: hasActiveJob ? "Aktiv" : null, // eller en liten indikator
  }
  ```
- Ta emot en ny prop `hasActiveJob?: boolean` eller `activeJobTitle?: string` för att ge tydlig indikation.

### B. Hantering av aktivt jobb och flikväxling (`src/app/page.tsx`)
- Lägg till tillstånd för senast aktiva jobb:
  ```typescript
  const [lastActiveJobId, setLastActiveJobId] = useState<string | null>(null);
  const [autoOptimize, setAutoOptimize] = useState<boolean>(false);
  ```
- Vid start (i `useEffect`): Läs in `lastActiveJobId` från `localStorage` (om det finns) eller hämta senaste uppdaterade jobb från `/api/jobs`.
- När användaren klickar på "CV-studion" i Navbar:
  - Om `selectedJobId` redan är satt: växla vy till studio.
  - Om `selectedJobId` är `null`: använd `lastActiveJobId` (eller det senast sparade/optimerade jobbet).
  - Om det inte finns några sparade jobb alls: visa ett vänligt tomt tillstånd i studion ("Välj ett jobb i Jobbsök eller Ansökningar för att börja skräddarsy").
- När användaren öppnar ett jobb (via `handleOpenTailorStudio(jobId, shouldAutoOptimize)`):
  - `setSelectedJobId(jobId)`
  - `setLastActiveJobId(jobId)`
  - Spara i `localStorage.setItem("jobscope_last_job_id", jobId)`
  - `setCurrentTab("studio")` (så att "CV-studion" markeras som aktiv i Navbaren istället för att "Jobbsök" felaktigt är markerad)
  - `setAutoOptimize(shouldAutoOptimize)`

### C. Automatisk optimeringstrigger (`src/components/TailorStudio.tsx`)
- Ta emot prop `autoOptimize?: boolean`.
- När komponenten har laddat jobbet:
  - Om `autoOptimize === true` och jobbet ännu inte har någon skräddarsydd ansökan (`!j.applications || j.applications.length === 0`):
  - Kör automatiskt `handleGenerateTailored()`.
  - Visa snurrande laddare `"Optimerar med AI..."` och tydlig laddningsstatus.
  - När AI:n är klar uppdateras gränssnittet direkt med genererat innehåll och statusen sätts till `"Optimerad"`.

### D. Snabb och tydlig UX i Jobbsök (`src/components/JobSearchView.tsx`)
- Lägg till `optimizingId`-state så att "Optimera"-knappen visar snurrande laddare (`<Loader2 className="animate-spin" />`) och texten `"Optimerar..."`.
- Anropa `onOpenTailorStudio(saved.id, true)`.

---

## 3. Verifiering & Testning
1. **Test av "CV-studion"-fliken**:
   - Öppna Syntronic-annonsen i studion.
   - Klicka på "Mitt Master-CV" i Navbaren -> Vyn växlar till profilen.
   - Klicka på "CV-studion" i Navbaren -> Vyn växlar omedelbart tillbaka till Syntronic i TailorStudio!
   - Klicka på "Jobbsök" -> Vyn växlar till sökningen.
   - Klicka på "CV-studion" -> Vyn växlar tillbaka till Syntronic.
2. **Test av automatisk optimering**:
   - Klicka "Optimera" på en ny annons i Jobbsök.
   - Knappen visar "Optimerar...", öppnar CV-studion och AI:n kör igång genereringen direkt.
3. **Byggkontroll**:
   - Kör `npm run build` för att säkerställa 0 fel i TypeScript och Next.js.
