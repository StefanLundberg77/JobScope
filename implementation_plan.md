# Implementation Plan: Egna Anteckningar (Minnesanteckningar) i Jobbsökkort, Kanban & Ansökningar

## 1. Bakgrund & Behov
Användaren önskar en funktion för att kunna föra egna anteckningar / minnesanteckningar på:
1. **Jobbsökkorten** (`JobSearchView`) – t.ex. första intryck, kontaktperson, lön, eller noteringar direkt vid sökning. Om man sparar en anteckning på en osökt annons sparas annonsen automatiskt till databasen med anteckningen.
2. **Kanban-korten** (`TrackerView`) – snabb överblick och redigering av minnesanteckningar direkt på Kanban-korten i alla faser (Sparad, Optimerad, Ansökt, Intervju, etc.).
3. **Ansökningarna / TailorStudio** (`TailorStudio`) – en dedikerad flik för minnesanteckningar och förberedelser (kontaktpersoner, intervjufrågor, datum för återkoppling, löneanspråk).

---

## 2. Arkitektur & Datamodell

### A. Prisma Schema (`prisma/schema.prisma`)
- Lägg till fältet `notes String?` på modellen `JobListing`.
- Notera: `TailoredApplication` har redan `notes String?`.
- Kör `npx prisma db push` för att uppdatera SQLite-databasen och regenerera Prisma-klienten i `src/generated/prisma`.

### B. Domäntyper (`src/lib/types.ts`)
- Uppdatera `JobItem`:
  ```ts
  notes?: string | null;
  ```
- Uppdatera `UnifiedJobHit`:
  ```ts
  notes?: string | null;
  ```

---

## 3. Backend & API-ändringar

### A. `src/app/api/jobs/route.ts`
- **POST**: Tillåt `notes` i request payload. Spara `notes` på `JobListing` vid skapande/uppdatering.
- **GET**: Returnerar automatiskt `notes` på alla `JobListing`-objekt.

### B. `src/app/api/jobs/[id]/route.ts`
- **PATCH**: Tillåt uppdatering av `notes` direkt på `JobListing`:
  ```ts
  const updated = await prisma.jobListing.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(dismissReason !== undefined && { dismissReason }),
      ...(notes !== undefined && { notes }),
    },
    ...
  });
  ```
  Synkronisera även med `tailoredApplication.notes` om en ansökan finns.

### C. `src/app/api/jobs/[id]/tailor/route.ts`
- **PUT**: När användaren sparar i TailorStudio, uppdatera både `TailoredApplication.notes` och `JobListing.notes` så att anteckningarna alltid är synkroniserade mellan korten och ansökan.

### D. `src/app/api/jobs/search/route.ts`
- I `savedJobs`-queryn: inkludera `notes: true`.
- Mappa `notes` på respektive träff (`UnifiedJobHit`) så att jobbsöket direkt vet om en annons redan har en minnesanteckning.

---

## 4. Frontend & UI-komponenter

### A. Jobbsökkort (`src/components/JobSearchView.tsx`)
1. **Knapp & Visning på kortet**:
   - Lägg till en anteckningsknapp (`StickyNote`-ikon) bland åtgärderna på varje kort.
   - Om annonsen redan har en anteckning: visa en diskret, snygg anteckningsruta/bricka på kortet med en text-förhandsgranskning.
2. **Antecknings-modal**:
   - Modal för att läsa och redigera anteckningen bekvämt.
   - Snabbvals-chips för att snabbt lägga till vanliga sektioner (t.ex. `📞 Kontaktperson:`, `📅 Uppföljning:`, `💰 Löneanspråk:`).
   - Om annonsen inte var sparad sedan tidigare: när användaren sparar anteckningen sparas annonsen automatiskt till databasen (`POST /api/jobs`) med status `"saved"` och anteckningen kopplad.
   - Om annonsen redan är sparad: sparar via `PATCH /api/jobs/[id]` och uppdaterar UI direkt.

### B. Kanban Tracker-kort (`src/components/TrackerView.tsx`)
1. **Visning på Kanban-kortet**:
   - Om `job.notes` finns: visa en gul/neutral notisruta (`StickyNote`-ikon, kursiv text, max 2 rader) på kortet.
   - En tydlig klickbar knapp för att öppna anteckningseditorn.
   - Om ingen anteckning finns: en diskret `+ Anteckning`-knapp.
2. **Antecknings-modal**:
   - Rymlig modal för att skriva och redigera minnesanteckningar utan att lämna Kanban-tavlan.
   - Snabbvals-chips (`📞 Kontaktperson:`, `📅 Intervjudatum:`, `💬 Frågor till intervju:`, `💰 Löneanspråk:`).
   - "Spara anteckning", "Rensa anteckning" och "Avbryt".
   - Uppdaterar lokalt tillstånd och databasen omedelbart.

### C. TailorStudio / Ansökningsvy (`src/components/TailorStudio.tsx`)
1. **Ny flik i menyn**:
   - Lägg till fliken **"Minnesanteckningar"** (`notes`) med `StickyNote`-ikon.
2. **Innehåll i fliken**:
   - Fullskärms/rymlig anteckningsyta anpassad för ansökningsprocessen.
   - Mallar/hjälpknappar för intervjuförberedelser, referenser, kontaktuppgifter och löneanspråk.
   - "Spara anteckningar"-knapp med grön bekräftelseanimering (`CheckCircle2`).
   - Synkronisering till både `TailoredApplication` och `JobListing`.
3. **Snabb-indikator i brevhuvudet**:
   - En snabbknapp/badge i headern som visar om det finns sparade anteckningar för annonsen, så att användaren enkelt kan snegla på sina anteckningar under tiden man justerar CV eller brev.

---

## 5. Verifieringsplan
1. **Databasmigrering**: Verifiera att `npx prisma db push` körs utan fel och att `notes`-kolumnen skapas.
2. **TypeScript & Byggtest**: Kör `npm run build` för att säkerställa 0 typfel.
3. **Funktionstest i Jobbsök**:
   - Testa att skriva en anteckning på ett osökt kort -> Kontrollera att annonsen sparas och anteckningen visas.
   - Testa att redigera och ta bort anteckning på ett sparat kort.
4. **Funktionstest i Kanban**:
   - Kontrollera att anteckningen syns på Kanban-kortet.
   - Klicka för att redigera anteckning i modalen -> Spara -> Verifiera att kortet uppdateras.
5. **Funktionstest i TailorStudio**:
   - Öppna fliken "Minnesanteckningar" -> Kontrollera att befintlig anteckning laddas.
   - Redigera och spara -> Kontrollera att ändringen slår igenom i både Kanban och Jobbsök.
