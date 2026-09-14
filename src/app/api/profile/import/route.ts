import { NextResponse } from "next/server";
import { parseRawProfileWithAI } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { rawText } = await req.json();

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: "Ingen text angiven för import." },
        { status: 400 }
      );
    }

    const parsedProfile = await parseRawProfileWithAI(rawText);

    return NextResponse.json({
      success: true,
      profile: parsedProfile,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Okänt fel vid import";
    console.error("Profile import error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
