# Implementation Plan: Kolumnbaserad datumsortering och statusmärkning i Kanban

## 1. Bakgrund & Användarens förtydligande

Användaren förtydligade:
> *"jag vill faktiskt sortera dom efter datum ny/äldst per kolumn tex Optimerad 3 nov eller skickad 12 okt osv."*

### Identifierade problem från skärmdumpen:
1. **Samma felaktiga etikett i alla kolumner**:
   - I kolumnen **Optimerade** står det t.ex. *"Sparad 3 nov"* istället för *"Optimerad 3 nov"*.
   - I kolumnen **Skickade** står det t.ex. *"Sparad 19 okt"* eller *"Sparad 12 okt"* istället för *"Skickad 19 okt"* / *"Skickad 12 okt"*.
   - Koden har hårdkodat texten `Sparad {formatSavedDate(job.createdAt)}` för alla kort oavsett vilken kolumn de befinner sig i.
2. **Sorteringen måste matcha kolumnens datum**:
   - I **Sparade**: Sortera efter när jobbet sparades (`createdAt`).
   - I **Optimerade**: Sortera efter när ansökan optimerades (skräddarsyddes).
   - I **Skickade**: Sortera efter när ansökan skickades / flyttades till skickad.
   - I **Intervju**: Sortera efter när jobbet flyttades till intervju.
   - I **Avslag**: Sortera efter när avslaget registrerades.
   - I **Inaktuella**: Sortera efter när jobbet markerades som inaktuellt.

---

## 2. Arkitektur & Datamodell

### A. Ny kolumn i databasen: `statusUpdatedAt`
I `prisma/schema.prisma` på modellen `JobListing`:
```prisma
model JobListing {
  ...
  status          String                @default("saved")
  statusUpdatedAt DateTime?             @default(now())
  ...
}
```
- **Varför detta behövs**: Om vi bara använde `updatedAt`, skulle en sparad anteckning ("Kontaktade rekryteraren idag...") ändra "Skickad 12 okt" till dagens datum! Med ett dedikerat `statusUpdatedAt` uppdateras datumet **endast** när statusen byts, aldrig vid redigering av anteckningar.
- **Pusha schema**: Körs via `npx prisma db push`.
- **Typuppdatering**: Lägg till `statusUpdatedAt?: string | null;` i `src/lib/types.ts`.

### B. Backfill av befintliga jobb i `dev.db`
Ett snabbt engångsskript sätter `statusUpdatedAt` för befintliga jobb:
- Status `saved`: `createdAt`
- Status `tailored`: `applications[0]?.createdAt` (eller `updatedAt`)
- Status `applied`, `interview`, `offer`, `rejected`, `dismissed`: `updatedAt`

### C. Uppdatering av API-rutter
1. `src/app/api/jobs/[id]/route.ts` (`PATCH`):
   - När `status` ändras sätts `statusUpdatedAt = new Date()`.
   - Om endast `notes` eller `dismissReason` ändras rörs inte `statusUpdatedAt`.
2. `src/app/api/jobs/[id]/tailor/route.ts` (`POST`):
   - När ett jobb optimeras och status går från `saved` till `tailored` sätts `statusUpdatedAt = new Date()`.
3. `src/app/api/jobs/route.ts` (`POST`):
   - Nya jobb initieras med `statusUpdatedAt = new Date()`.

---

## 3. Frontend-logik i `TrackerView.tsx`

### A. Kolumn-specifik datum- och etiketthjälpare
```ts
export function getColumnStatusDate(job: JobItem, colStatus: ApplicationStatus): string {
  if (job.statusUpdatedAt && job.status === colStatus) {
    return job.statusUpdatedAt;
  }
  if (colStatus === "saved") {
    return job.createdAt || "";
  }
  if (colStatus === "tailored") {
    return (
      job.applications?.[0]?.updatedAt ||
      job.applications?.[0]?.createdAt ||
      job.updatedAt ||
      job.createdAt ||
      ""
    );
  }
  return job.updatedAt || job.createdAt || "";
}

export function getStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "Sparad";
    case "tailored":
      return "Optimerad";
    case "applied":
      return "Skickad";
    case "interview":
      return "Intervju";
    case "offer":
      return "Erbjudande";
    case "rejected":
      return "Avslag";
    case "dismissed":
      return "Inaktuell";
    default:
      return "Uppdaterad";
  }
}
```

### B. Visning på kortet
Ersätter den hårdkodade koden med:
```tsx
{/* Status timestamp per column */}
{stageDate && (
  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
    <Clock className="h-3 w-3 shrink-0" />
    <span className="truncate">
      {getStatusLabel(col.id)} {formatSavedDate(stageDate)}
    </span>
  </div>
)}
```

### C. Sortering per kolumn
- **Nyast först** (standard): Korten i VARJE kolumn sorteras fallande efter sitt relevanta kolumndatum (`stageDate`).
  - Sparade: nyast sparade överst.
  - Optimerade: nyast optimerade överst.
  - Skickade: nyast skickade överst.
  - Intervju: nyast intervjuer överst.
  - Avslag: nyast avslag överst.
  - Inaktuella: senast bortvalda överst.
- **Äldst först**: Korten i varje kolumn sorteras stigande (äldst överst).
- Valet sparas i `localStorage` (`jobscope_kanban_sort`).

---

## 4. Filer som modifieras
1. `prisma/schema.prisma` – Ny kolumn `statusUpdatedAt`.
2. `src/lib/types.ts` – Fält i `JobItem`.
3. `src/app/api/jobs/[id]/route.ts` – Uppdatera `statusUpdatedAt` vid statusbyte.
4. `src/app/api/jobs/[id]/tailor/route.ts` – Uppdatera `statusUpdatedAt` vid optimering.
5. `src/app/api/jobs/route.ts` – Sätt `statusUpdatedAt` vid skapande.
6. `src/components/TrackerView.tsx` – Dynamisk datumetikett per kolumn och kolumnbaserad sortering ("Nyast först" / "Äldst först").

---

## 5. Verifiering
1. Kör `npx prisma db push` och backfilla befintliga rader.
2. Kör `npm run build` för att säkerställa att Next.js-bygget och typerna kompilerar felfritt.
3. Kontrollera att kort i Optimerade visar "Optimerad [datum]" och i Skickade visar "Skickad [datum]".
4. Verifiera att korten sorteras med nyast överst i varje kolumn baserat på respektive kolumndatum.
5. Verifiera att redigering av en anteckning inte ändrar kolumndatumet.
