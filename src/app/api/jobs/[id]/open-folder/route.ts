/**
 * API route handlers for /api/jobs/[id]/open-folder.
 * Opens an exported application directory in Windows File Explorer.
 */

import { NextResponse } from "next/server";
import path from "path";
import fsSync from "fs";
import { openFolderInExplorer } from "@/lib/exportUtils";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await ctx.params;
    let body: { folderPath?: string; folderName?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Optional
    }

    const rawFolder =
      body.folderName ||
      (body.folderPath ? path.basename(body.folderPath) : "");

    if (!rawFolder) {
      return NextResponse.json(
        { error: "Mappsökväg eller mappnamn saknas." },
        { status: 400 }
      );
    }

    const safeFolder = path.basename(rawFolder);
    const targetPath = path.join(process.cwd(), "exports", safeFolder);

    if (!fsSync.existsSync(/* turbopackIgnore: true */ targetPath)) {
      return NextResponse.json(
        { error: "Mappen existerar inte på disken." },
        { status: 404 }
      );
    }

    await openFolderInExplorer(targetPath);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Kunde inte öppna mappen";
    console.error("Open folder error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
