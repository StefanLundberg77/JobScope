/**
 * API route handlers for /api/profile/import.
 * Ingests external candidate CV data from uploaded PDFs (e.g. LinkedIn PDF export)
 * or unstructured raw text, using Gemini to extract structured profile entities.
 */

import { NextResponse } from "next/server";
import { parseProfileWithAI } from "@/lib/gemini";

/**
 * POST /api/profile/import
 * Accepts multipart/form-data with a PDF file or rawText, or application/json payloads,
 * extracts text content, and delegates structuring to Gemini AI.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 1. Handle multipart/form-data (PDF file upload or FormData)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const rawText = formData.get("rawText") as string | null;

      if (file && file.size > 0) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
          return NextResponse.json(
            { error: "Endast PDF-filer stöds för filuppladdning." },
            { status: 400 }
          );
        }

        // Limit size to 10 MB
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: "PDF-filen är för stor (max 10 MB)." },
            { status: 400 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        const parsedProfile = await parseProfileWithAI({
          pdfBase64: base64,
        });

        return NextResponse.json({
          success: true,
          profile: parsedProfile,
          source: file.name,
        });
      } else if (rawText && rawText.trim()) {
        const parsedProfile = await parseProfileWithAI({ rawText });
        return NextResponse.json({
          success: true,
          profile: parsedProfile,
        });
      } else {
        return NextResponse.json(
          { error: "Ingen fil eller text angiven för import." },
          { status: 400 }
        );
      }
    }

    // 2. Handle application/json (rawText or pdfBase64)
    const body = await req.json();
    const { rawText, pdfBase64, fileName } = body;

    if (pdfBase64) {
      const parsedProfile = await parseProfileWithAI({ pdfBase64 });
      return NextResponse.json({
        success: true,
        profile: parsedProfile,
        source: fileName || "uploaded.pdf",
      });
    }

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: "Ingen text eller fil angiven för import." },
        { status: 400 }
      );
    }

    const parsedProfile = await parseProfileWithAI({ rawText });

    return NextResponse.json({
      success: true,
      profile: parsedProfile,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Okänt fel vid import";
    console.error("Profile import error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
