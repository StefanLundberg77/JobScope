# Implementation Plan: Kalibrering av ATS-matchning och borttagning av glädjekalkyler

## 1. Bakgrund & Problemformulering
Användaren noterade följande ATS-analys för en Data Engineer/BI-roll:
> "80% Match. ATS Matchningsanalys: Kandidaten har en mycket stark teknisk grund inom modern data engineering (SQL, Snowflake, dbt, Dagster, Python) och databashantering, men saknar flera års formell arbetserfarenhet specifikt under titeln Data Engineer eller BI-utvecklare."

Frågan från användaren:
> "80% känns ganska högt med tanke på avsaknad av formell arbetserfarenhet och BI-verktyg. Hur beräknas procenten och är det lite av en "glädjekalkyl"? Jag vill bara ha raka analyser och inga glädjekalkyler."

### Orsak till glädjekalkylen i koden
1. **Saknad av kalibrerad bedömningsskala (Rubrik)**: I `analyzeJobMatchWithAI` och `tailorApplicationWithAI` har modellen instruerats att inte ge låga betyg enbart på grund av rolltitlar, men saknar strikta procentspann och avdragskriterier.
2. **Överdriven viktning av verktygslistor vs yrkeserfarenhet**: Modellen ser tekniska nyckelord (SQL, dbt, Snowflake) och sätter 80% enbart på stack-matchning, trots att formella anställningsår i rollen och specifika BI-sviter saknas.
3. **Anchoring Bias i JSON-schemat**: Exempel-schemat i promptarna hårdkodade `"score": 85`, vilket styrde modellens gissning mot 80–85%.
4. **Tailor-prompten saknade bedömningskriterier**: I `tailorApplicationWithAI` (när användaren optimerar ansökan) fanns inga bedömningsregler alls för `matchAnalysis.score`, vilket gav fri lejd för LLM-optimism.

---

## 2. Åtgärdsplan & Design

### A. Kalibrerad ATS-matris i `src/lib/gemini.ts`
Implementera ett enhetligt, strängt och verklighetsförankrat bedömningssystem för både `analyzeJobMatchWithAI` och `tailorApplicationWithAI`:

#### 1. Strikt poängskala (Rubric):
* **85–100% (Exceptionell direktmatchning)**:
  - Uppfyller i princip alla skallkrav OCH har dokumenterad, formell yrkeserfarenhet i exakt eller direkt närliggande roll.
  - Behärskar produktionstester, arkitektur och kärnstacken.
* **70–84% (Stark matchning med mindre luckor)**:
  - Uppfyller alla centrala tekniska skallkrav OCH har relevant IT-yrkeserfarenhet.
  - Mindre luckor i enstaka önskemål eller något färre erfarenhetsår än annonsens idealkrav.
* **50–69% (Partiell / Överförbar matchning)**:
  - Har relevant teknisk grund (t.ex. programmering, SQL, relationsdatabaser, projekt) men **saknar formell yrkeserfarenhet i rollen**, eller saknar centrala domänverktyg (t.ex. Power BI/Tableau vid BI-roller).
  - Detta är det realistiska spannet för en kandidat med stark mjukvarubakgrund/projekt som söker en roll utan att tidigare ha haft titeln.
* **30–49% (Svag matchning)**:
  - Betydande kompetensgap, felaktig senioritetsnivå (t.ex. kräver 5-8 års specialistledarskap), eller en helt annan teknisk inriktning.
* **< 30% (Ej relevant)**:
  - Rollen matchar inte kandidatens profil.

#### 2. Hårda avdragsregler (Mandatory Deductions):
* **-15 till -25 procentenheter** om annonsen förutsätter/kräver yrkeserfarenhet i rollen och kandidaten endast har projekt/självstudier/skolmeriter.
* **-10 till -15 procentenheter** om centrala verktyg för rollen saknas i kandidatens profil (t.ex. BI-rapporteringsverktyg för en BI-utvecklare).
* Överförbara meriter (operativ drift, problemlösning, generell programmering) ska förklaras i `transferableSkills` och kan höja från bottenbetyg till ett stabilt 50–65%, men får **ALDRIG** lyfta en ansökan till 75–90% om formell yrkeserfarenhet eller kärnverktyg saknas.

#### 3. Neutralisering av scheman:
* Ersätt `"score": 85` i alla JSON-mockexempel med `"score": 62` (eller liknande kalibrerat mittvärde) i:
  - `analyzeJobMatchWithAI`
  - `tailorApplicationWithAI` (svensk prompt)
  - `tailorApplicationWithAI` (engelsk prompt)

---

## 3. Verifiering & Testning
1. **TypeScript-kontroll**: Kör `npm run build` för att verifiera att alla typer och syntax är korrekta.
2. **Promptinspektion**: Säkerställ att inga motstridiga instruktioner ("sätt inte lågt score...") underminerar de nya reglerna.
3. **English Code Comments**: Säkerställ att alla kommentarer och docstrings förblir på engelska enligt `AGENTS.md`.
