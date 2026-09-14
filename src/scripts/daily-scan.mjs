#!/usr/bin/env node

/**
 * JobScope - Daglig Automatisk Jobbskanner
 * Körs manuellt eller schemalagt via Antigravity / cron.
 */

async function runScan() {
  console.log("==========================================");
  console.log("🔍 JobScope: Startar daglig jobbsökning");
  console.log("   Söker i LinkedIn (offentlig) & Arbetsförmedlingen...");
  console.log("==========================================");

  const endpoint = process.env.JOBSCOPE_URL || process.env.WORKALOGIC_URL || "http://localhost:3000/api/jobs/scan";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minScore: 60 }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Skanningen misslyckades (HTTP ${res.status}):`, errorText);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`✅ Skanning klar!`);
    console.log(`- Totalt genomsökta annonser: ${data.scannedTotal}`);
    console.log(`- Nya oupptäckta kandidater: ${data.newCandidates}`);
    console.log(`- Nya jobb sparade i Kanban-tavlan: ${data.savedCount}`);

    if (data.savedJobs && data.savedJobs.length > 0) {
      console.log("\nSparade jobb:");
      data.savedJobs.forEach((j, i) => {
        const score = j.matchScore ? `${j.matchScore}% ATS-match` : "Ej beräknat";
        console.log(`  ${i + 1}. [${j.source.toUpperCase()}] ${j.title} @ ${j.company} (${score})`);
      });
    } else {
      console.log("Inga nya jobb över matchningströskeln sparades den här gången.");
    }
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED" || err.message?.includes("fetch failed")) {
      console.error(
        "\n⚠️  JobScope webbserver körs inte på localhost:3000.\n" +
        "   Starta först servern med:\n" +
        "   > npm run dev\n" +
        "   och kör sedan skanningen igen, eller tryck på 'Kör automatisk bevakning' i webbgränssnittet.\n"
      );
    } else {
      console.error("❌ Ett fel uppstod:", err);
    }
  }
}

runScan();
