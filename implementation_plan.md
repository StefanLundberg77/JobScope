# Implementation Plan: Tydlig uppdelning av jobbåtgärder och kvalitetsfokuserad Gemini-fallback

## 1. Bakgrund & Problemformulering
1. **Redundanta anrop**: Tidigare körde systemet en automatisk snabb-ATS-matchning via Gemini (`analyzeJobMatchWithAI`) varje gång en annons sparades via `POST /api/jobs`. När en användare klickade "Optimera CV & Brev" i sökvyn kördes två separata AI-anrop mot samma jobb (matchning + fullständig optimering som redan räknar ut matchning).
2. **Kvalitet vs tyst nedgradering**: Istället för att tyst nedgradera personliga brev och CV-texter till enklare Lite-modeller vid tillfälliga 503-spikar eller dygnsgränser på Google, ska systemet prioritera full textkvalitet och anti-fluff genom att uteslutande alternera mellan toppmodellerna (`gemini-3.8-flash` ⇄ `gemini-3.6-flash`), göra automatiska retries vid 503-spikar, och ge ett ärligt felmeddelande om båda är otillgängliga.

---

## 2. Genomförda Ändringar

### A. Uppdelade jobbåtgärder i sökvyn (`JobSearchView.tsx`)
1. **Knapp 1: "Spara" (`Bookmark`)**:
   - Sparar annonsen till användarens ansökningar (`JobListing` med `status: "saved"`).
   - **0 AI-anrop**: Ingen ATS-matchning och ingen optimering körs. Sparar 100% av kvoten.
   - Visar "Sparad" med grön bock när jobbet är sparat.
2. **Knapp 2: "Matchning" (`Gauge` / Procent-badge)**:
   - Sparar annonsen om inte sparad och kör **enbart ATS-matchningsanalys** (`analyzeJobMatchWithAI`).
   - Visar spinner under analys och visar sedan t.ex. "74% Match" direkt på kortet.
   - Förbrukar exakt **1 AI-anrop**.
3. **Knapp 3: "Optimera" (`Sparkles` - Blå primärknapp)**:
   - Sparar annonsen direkt om inte sparad (utan föregående ATS-anrop).
   - Öppnar `TailorStudio` direkt.
   - Inne i `TailorStudio` körs optimeringen (CV, brev, mejl och inbyggd matchning) i **1 samlat AI-anrop**.

### B. Kör ATS-matchning i efterhand i Kanban (`TrackerView.tsx`)
- För sparade jobb som sparats utan matchning (`job.matchScore == null`) visas en knapp `"Kör Matchning"` på kortet i Kanban-tavlan så att användaren kan köra ATS-analys i efterhand med ett klick.

### C. Backend API-stöd
1. **`POST /api/jobs` (`src/app/api/jobs/route.ts`)**:
   - Styrs av flaggan `runMatchAnalysis?: boolean` (standard `false`).
   - `Spara` och `Optimera` skickar `false` (0 AI-anrop). `Matchning` skickar `true`.
2. **`POST /api/jobs/[id]/match` (`src/app/api/jobs/[id]/match/route.ts`)**:
   - Dedikerad endpoint för att köra ATS-matchningsanalys på ett befintligt sparat jobb.

### D. Kvalitetsfokuserad Fallback i `src/lib/gemini.ts`
1. Alternerar uteslutande mellan toppmodellerna: **`gemini-3.8-flash` ⇄ `gemini-3.6-flash`** (såvida inte användaren uttryckligen valt en Lite-modell i Inställningar).
2. Automatisk exponential backoff / retry (1.5 s, sedan 2.5 s) vid tillfälliga 503-spikar ("high demand") på samma modell innan den växlar till den andra toppmodellen.
3. Ärliga, informativa felmeddelanden vid 503 och 429-dygnsgräns istället för tyst nedgradering av textkvaliteten.

---

## 3. Verifiering & Testning
1. Kontrollera att `npm run build` bygger utan fel med TypeScript och Turbopack.
2. Verifiera att fallback-logiken växlar mellan 3.8 och 3.6 och gör retries på 503.
