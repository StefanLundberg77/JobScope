# Implementation Plan: Automatiserad export av CV och Personligt Brev till projektmapp

## 1. Mål & Användarval
- **Format**: PDF + Ren text (`.txt`).
- **Triggning**: Manuell export via knapp ("Exportera ansökningspaket") i `TailorStudio`, så användaren hinner granska och redigera innehållet först.
- **Plats**: Jobscopes projektmapp (`exports/`), organiserad med en undermapp per ansökan.
- **Säkerhet**: `exports/` läggs till i `.gitignore` så personliga ansökningsfiler aldrig oavsiktligt versionshanteras.

---

## 2. Arkitektur & Komponenter

### A. Fil- och Mappstruktur i `exports/`
Vid export av ett jobb skapas mappen:
`exports/YYYY-MM-DD_[Företag]_[Roll]/` (med sanering av ogiltiga tecken i Windows som `\/:*?"<>|`).

I mappen genereras:
1. `CV_[Kandidatnamn]_[Företag].pdf` — Professionell A4-PDF med styling, typsnitt, STAR-punkter och profilbild (om vald).
2. `Personligt_Brev_[Kandidatnamn]_[Företag].pdf` — A4-PDF med officiellt brevhuvud, mottagare, datum och sign-off.
3. `CV_[Kandidatnamn]_[Företag].txt` — Ren textversion formaterad med tydliga sektioner för direkt inklistring i rekryteringssystem (Workday, Teamtailor, m.fl.).
4. `Personligt_Brev_[Kandidatnamn]_[Företag].txt` — Ren textversion av det personliga brevet.
5. `Epost_och_Ansökningsinfo.txt` — Hisspitch/mejltext, annonslänk, kontaktperson, match score och anteckningar.
6. `Originalannons.txt` — Fullständig backup av annonstexten så att man alltid har kvar den inför intervju även om annonsen avpubliceras.

---

### B. PDF- & Text-generator (`src/lib/exportUtils.ts`)
- **HTML/CSS-mallar**: Återanvänder Jobscopes A4 print-layout med ren CSS (ingen beroendedump).
- **Headless Browser**: Använder Windows förinstallerade Microsoft Edge (`msedge.exe`) eller Google Chrome (`--headless --disable-gpu --no-pdf-header-footer --print-to-pdf`) för att generera skarpa A4-PDF:er på ~1 sekund.
- **Bilder**: Konverterar vald profilbild till lokal fil-URI eller base64 så bild renderas offline i PDF:en.
- **Text-formatering**: Rena textmallar med tydliga avgränsare för CV och brev.

---

### C. Backend API-rutter
1. **`POST /api/jobs/[id]/export`**:
   - Tar emot jobb-id och inställningar (t.ex. språk, vald profilbild, huruvida bild ska visas på CV/brev).
   - Skapar målmappen i `exports/`.
   - Genererar alla 6 filer.
   - Returnerar sökväg och fillista.
2. **`POST /api/jobs/[id]/open-folder`**:
   - Öppnar den skapade mappen direkt i Windows Utforskaren via `explorer.exe "<folderPath>"`.
   - Inkluderar säkerhetsvalidering så att endast sökvägar inom `exports/` tillåts öppnas.

---

### D. UI-komponenter i `TailorStudio.tsx`
1. **Export-knapp i toppbaren & i PDF-fliken**:
   - Knapp: `"Exportera till mapp"` (`FolderDown`-ikon).
   - Laddningsindikator under generering (`Loader2`).
2. **Bekräftelse & Öppna-knapp**:
   - När exporten är klar visas en diskret bekräftelse med mappnamnet och en knapp: `"Öppna i Utforskaren"` (`FolderOpen`).
   - Klick på knappen anropar `/api/jobs/[id]/open-folder` och Windows öppnar mappen omedelbart.

---

### E. `.gitignore`
- Lägg till `/exports/` för att skydda alla genererade ansökningar från att checkas in i Git.

---

## 3. Verifiering & Testning
1. **Enhetstest/Skripttest**: Verifiera att PDF-genereringen via headless Edge/Chrome fungerar och producerar läsbara PDF-filer med rätt layout och bild.
2. **Filformat**: Säkerställ att `.txt`-filerna är formaterade med UTF-8 utan konstiga teckenfel (å, ä, ö).
3. **UI-interaktion**: Testa knappen i `TailorStudio`, verifiera att filerna hamnar i `exports/<mapp>` och att "Öppna i Utforskaren" öppnar mappen i Windows.
4. **Byggkontroll**: Kör `npm run build` eller TypeScript-kontroll för att verifiera att det inte finns några kompileringfel.
