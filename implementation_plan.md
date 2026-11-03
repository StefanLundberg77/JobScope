# Implementation Plan: Korrigering av LIA-datum i Master-CV

## 1. Bakgrund & Identifierade felaktigheter
Vid granskning av det bifogade kursbetyget/utdraget från Yrkeshögskolan (NBI / Handelsakademin) framgår de officiella perioderna för LIA-kurserna:
- **Lärande i arbete 1**: `2025-10-13 → 2025-12-12` (45 YH-p, Betyg: VG)
- **Objektsorienterad Programmering Avancerad 2(2)**: `2026-01-05 → 2026-02-13` (30 YH-p, Betyg: VG)
- **Lärande i arbete 2**: `2026-02-16 → 2026-05-22` (70 YH-p, Betyg: VG)

I nuvarande Master-CV (databas och dokumentation) låg datumen helt felaktigt förskjutna:
1. **LIA 1: Spelutvecklare & C#-backend (Northhack Media / Oxide Arena)**:
   - *Tidigare (felaktigt)*: `2025-02` – `2025-04` (Feb 2025 – Apr 2025)
   - *Korrekt*: `2025-10` – `2025-12` (Okt 2025 – Dec 2025, exakt `2025-10-13` – `2025-12-12`)
2. **LIA 2: Fullstack- & AI-utvecklare (Orbislinks)**:
   - *Tidigare (felaktigt)*: `2025-11` – `2026-02` (Nov 2025 – Feb 2026)
   - *Korrekt*: `2026-02` – `2026-05` (Feb 2026 – Maj 2026, exakt `2026-02-16` – `2026-05-22`)

---

## 2. Föreslagna åtgärder

### A. Uppdatering av SQLite-databasen (`dev.db`)
- Uppdatera JSON-kolumnen `experiences` i tabellen `MasterProfile` för `id = 'default'`:
  - `exp-3` (Northhack Media): sätt `startDate: "2025-10"`, `endDate: "2025-12"`
  - `exp-2` (Orbislinks): sätt `startDate: "2026-02"`, `endDate: "2026-05"`

### B. Uppdatering av Seed-skriptet (`src/scripts/seed-profile.mjs`)
- Ändra datumen i `profileData.experiences` så att framtida reseeding behåller de korrekta datumen.

### C. Uppdatering av Master-CV Markdown (`docs/cv_2page_master_content.md`)
- Ändra tidsangivelsen under LIA 2 till: `Feb 2026 – Maj 2026`
- Ändra tidsangivelsen under LIA 1 till: `Okt 2025 – Dec 2025`

### D. Uppdatering av Strategidokument (`docs/cv_and_portfolio_sync_strategy.md`)
- Synka tidsangivelserna i översikten och malltexterna för LIA 1 och LIA 2.

---

## 3. Förfining av LIA 2 (Orbislinks) — Sanningsbarriär & Fullstack-specifikation
Baserat på kandidatens kursreflektion och tekniska designdokument för Orbislinks marknadsplats:
1. **Sanningsbarriär**: Chatboten sattes inte i skarp produktion för allmänheten ("driftsatte" ändrades till implementerad RAG-agent).
2. **Karriärsidan i React**: Byggdes end-to-end (React, Flask, autentisering, MySQL) och är i skarp live-produktion på företagets webbplats.
3. **Logistikmarknadsplats & Asynkron AI**: Plattformen är en crowd-shipping-marknadsplats (kopplar säljare, speditörer och resenärer) med asynkrona AI-insikter via Celery-workers och LLM, samt Sendcloud- och Stripe/Revolut-integrationer.

### Genomförda uppdateringar:
- `docs/cv_2page_master_content.md`: Uppdaterat med de tre kalibrerade punkterna och fullstack/Celery-fokus.
- `docs/cv_and_portfolio_sync_strategy.md`: Synkat med master-CV.
- `src/scripts/seed-profile.mjs`: Uppdaterat med ny beskrivning, prestationer och kompetenstaggar.
- `dev.db`: Körde `seed-profile.mjs` för att synka databasen direkt så att `/api/profile` och profilsidan visar den nya informationen.

---

## 4. Verifiering
1. Verifierade att `dev.db` har uppdaterats med de nya datumen och den kalibrerade Orbislinks-erfarenheten via `@libsql/client`.
2. Kontrollerade att `MasterProfileView` hämtar från `/api/profile` och återspeglar uppdateringarna direkt vid omladdning.
