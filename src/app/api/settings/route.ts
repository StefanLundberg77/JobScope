/**
 * API route handlers for /api/settings.
 * Manages user preferences, Gemini API key configuration, and search parameters in SQLite.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/settings
 * Retrieves user settings from SQLite, or initializes default settings with fallback
 * to environment variables. Indicates whether an API key is actively configured.
 */
export async function GET() {
  try {
    let settings = await prisma.userSettings.findFirst();
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          id: "default",
          geminiApiKey: process.env.GEMINI_API_KEY || "",
          aiModel: "gemini-2.5-flash",
          targetRole: "Systemutvecklare & AI-utvecklare",
          targetLocations: "Göteborg",
          workPreference: "any",
          broadItSearch: true,
          minScore: 50,
          searchKeywords: "AI, GenAI, RAG, Python, C#, .NET, Systemutvecklare, Fullstack, DevOps, IT-support",
        },
      });
    }

    return NextResponse.json({
      ...settings,
      hasEnvApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
      isApiKeyConfigured: Boolean(
        settings.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
      ),
    });
  } catch (error) {
    console.error("Failed to get settings:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta inställningar" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Updates user settings, including search keywords, target role, min ATS score, and Gemini API key.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      geminiApiKey,
      aiModel,
      targetRole,
      targetLocations,
      workPreference,
      broadItSearch,
      minScore,
      searchKeywords,
    } = body;

    const settings = await prisma.userSettings.upsert({
      where: { id: "default" },
      update: {
        ...(geminiApiKey !== undefined && { geminiApiKey: geminiApiKey.trim() }),
        ...(aiModel !== undefined && { aiModel: aiModel.trim() }),
        ...(targetRole !== undefined && { targetRole }),
        ...(targetLocations !== undefined && { targetLocations }),
        ...(workPreference !== undefined && { workPreference }),
        ...(broadItSearch !== undefined && { broadItSearch: Boolean(broadItSearch) }),
        ...(minScore !== undefined && { minScore: Number(minScore) }),
        ...(searchKeywords !== undefined && { searchKeywords }),
      },
      create: {
        id: "default",
        geminiApiKey: geminiApiKey?.trim() || "",
        aiModel: aiModel?.trim() || "gemini-2.5-flash",
        targetRole: targetRole || "Systemutvecklare & AI-utvecklare",
        targetLocations: targetLocations || "Göteborg",
        workPreference: workPreference || "any",
        broadItSearch: broadItSearch !== undefined ? Boolean(broadItSearch) : true,
        minScore: minScore !== undefined ? Number(minScore) : 50,
        searchKeywords: searchKeywords || "AI, GenAI, RAG, Python, C#, .NET, Systemutvecklare, Fullstack, DevOps, IT-support",
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Kunde inte spara inställningar" },
      { status: 500 }
    );
  }
}
