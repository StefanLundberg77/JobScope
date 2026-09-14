import { getGeminiClient } from "./gemini";

export interface ParsedJobAd {
  title: string;
  company: string;
  location: string;
  workplaceType: "onsite" | "hybrid" | "remote";
  url?: string;
  deadline?: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
}

export async function parseJobAdText(text: string, sourceUrl?: string): Promise<ParsedJobAd> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const prompt = `
Analysera följande jobbannonstext och extrahera all relevant information i strikt JSON-format:

ANNONSTEXT:
"""
${text.slice(0, 7000)}
"""

Svara EXAKT med detta JSON-schema:
{
  "title": "Titel på rollen",
  "company": "Företagsnamn",
  "location": "Stad eller ort (t.ex. Göteborg)",
  "workplaceType": "onsite" | "hybrid" | "remote",
  "deadline": "ÅÅÅÅ-MM-DD eller tom sträng om okänt",
  "description": "En ren och sammanhängande text av annonsens innehåll och beskrivning",
  "requiredSkills": ["Skallkrav 1", "Skallkrav 2"],
  "preferredSkills": ["Meriterande 1", "Meriterande 2"]
}
`;

  const result = await model.generateContent(prompt);
  const data = JSON.parse(result.response.text());

  return {
    ...data,
    url: sourceUrl || data.url,
  };
}

export async function fetchAndParseJobUrl(url: string): Promise<ParsedJobAd> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Kunde inte hämta webbsidan (HTTP ${res.status})`);
  }

  const html = await res.text();
  // Strip script, style, and HTML tags for clean text content
  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return parseJobAdText(cleanText, url);
}
