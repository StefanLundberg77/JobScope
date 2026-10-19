# Implementation Plan: Förenklade filnamn vid export och rensningsfunktion för exports-mappen

## 1. Mål & Användarval
- **Förenklade filnamn vid export**:
  - Ändra namngivningen av de genererade filerna inuti varje exportmapp så att de inte innehåller arbetsgivarens namn.
  - Genererade filer inuti `exports/YYYY-MM-DD_[Företag]_[Roll]/`:
    - `CV_[Kandidatnamn].pdf` (t.ex. `CV_Stefan_Lundberg.pdf`)
    - `Personligt_Brev_[Kandidatnamn].pdf` (t.ex. `Personligt_Brev_Stefan_Lundberg.pdf`)
    - `CV_[Kandidatnamn].txt`
    - `Personligt_Brev_[Kandidatnamn].txt`
    - `Epost_och_Ansökningsinfo.txt`
    - `Originalannons.txt`
  - Mappnamnet behåller datum, företag och roll för enkel och tydlig lokal sortering i Utforskaren.
- **Rensningsfunktion för `exports/`**:
  - Implementera en hanterare för exportmappen så att användaren kan överblicka hur många mappar och hur mycket diskutrymme som används.
  - Möjlighet att öppna rotmappen `exports/` direkt i Windows Utforskaren.
  - Möjlighet att rensa alla genererade exportmappar med en bekräftelsedialog, utan att påverka sparade ansökningar eller data i JobScope-databasen.

---

## 2. Arkitektur & Komponenter

### A. Justering av Export API (`src/app/api/jobs/[id]/export/route.ts`)
- Ändra `cvPdfName`, `letterPdfName`, `cvTxtName` och `letterTxtName` till att enbart använda `safeCandidate`:
  - `CV_${safeCandidate}.pdf`
  - `Personligt_Brev_${safeCandidate}.pdf`
  - `CV_${safeCandidate}.txt`
  - `Personligt_Brev_${safeCandidate}.txt`
- Mappnamnet `folderName` behålls oförändrat (`${today}_${safeCompany}_${safeTitle}`).

### B. Nytt API för exporthantering (`src/app/api/exports/route.ts`)
- **`GET /api/exports`**:
  - Läser av `exports/`-katalogen.
  - Räknar antal mappar, antal filer och sammanlagd storlek i bytes/KB/MB.
  - Returnerar statusen till frontend.
- **`DELETE /api/exports`**:
  - Raderar alla mappar och filer inuti `exports/` på ett säkert sätt.
  - Återskapar en tom `exports/`-mapp vid behov.
- **`POST /api/exports`**:
  - Öppnar rotmappen `exports/` i Windows Utforskaren via `openFolderInExplorer`.

### C. UI i Inställningar (`src/components/SettingsView.tsx`)
- Lägg till ett nytt sektionskort: **Lagring & Exporterade ansökningar**.
- Visar aktuellt antal exportmappar och förbrukad diskstorlek.
- Knappar:
  - **"Öppna mappen exports"** (öppnar mappen i Utforskaren).
  - **"Rensa alla exporter"** (visar bekräftelseläge för att förhindra oavsiktlig radering).
- Tydlig förklarande text om att sparad data i JobScope inte påverkas.

---

## 3. Verifiering & Testning
1. **API-verifiering**:
   - Verifiera att `GET /api/exports` returnerar korrekt statistik.
   - Verifiera att `POST /api/jobs/[id]/export` genererar `CV_Stefan_Lundberg.pdf` och `Personligt_Brev_Stefan_Lundberg.pdf` utan arbetsgivarnamn.
   - Verifiera att `DELETE /api/exports` tömmer mappen och nollställer statistiken.
2. **UI-test**:
   - Kontrollera att `SettingsView` visar rätt data, att bekräftelse fungerar och att mappen rensas.
3. **Byggkontroll**:
   - Kör `npm run build` för att säkerställa inga TypeScript- eller lint-fel.
