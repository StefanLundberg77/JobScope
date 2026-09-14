import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    let settings = await prisma.userSettings.findFirst();
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          id: "default",
          geminiApiKey: process.env.GEMINI_API_KEY || "",
          targetRole: "Systemutvecklare / Fullstack",
          targetLocations: "Göteborg",
          workPreference: "any",
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

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { geminiApiKey, targetRole, targetLocations, workPreference } = body;

    const settings = await prisma.userSettings.upsert({
      where: { id: "default" },
      update: {
        ...(geminiApiKey !== undefined && { geminiApiKey: geminiApiKey.trim() }),
        ...(targetRole !== undefined && { targetRole }),
        ...(targetLocations !== undefined && { targetLocations }),
        ...(workPreference !== undefined && { workPreference }),
      },
      create: {
        id: "default",
        geminiApiKey: geminiApiKey?.trim() || "",
        targetRole: targetRole || "Systemutvecklare",
        targetLocations: targetLocations || "Göteborg",
        workPreference: workPreference || "any",
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
