/**
 * API route handlers for /api/exports.
 * Provides statistics, cleanup, and explorer opening for the exports/ folder.
 */

import { NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { openFolderInExplorer } from "@/lib/exportUtils";

interface ExportFolderInfo {
  name: string;
  fileCount: number;
  sizeBytes: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export async function GET() {
  try {
    const exportsBaseDir = path.join(process.cwd(), "exports");

    if (!fsSync.existsSync(exportsBaseDir)) {
      return NextResponse.json({
        totalFolders: 0,
        totalFiles: 0,
        totalSizeBytes: 0,
        formattedSize: "0 KB",
        folders: [],
      });
    }

    const entries = await fs.readdir(exportsBaseDir, { withFileTypes: true });
    const dirEntries = entries.filter((entry) => entry.isDirectory());

    let totalFiles = 0;
    let totalSizeBytes = 0;
    const folders: ExportFolderInfo[] = [];

    for (const dir of dirEntries) {
      const folderPath = path.join(exportsBaseDir, dir.name);
      try {
        const stats = await fs.stat(folderPath);
        const folderFiles = await fs.readdir(folderPath);
        let folderSize = 0;

        for (const file of folderFiles) {
          try {
            const fileStat = await fs.stat(path.join(folderPath, file));
            if (fileStat.isFile()) {
              folderSize += fileStat.size;
              totalFiles += 1;
            }
          } catch {
            // Ignore individual file stat error
          }
        }

        totalSizeBytes += folderSize;
        folders.push({
          name: dir.name,
          fileCount: folderFiles.length,
          sizeBytes: folderSize,
          createdAt: stats.birthtime.toISOString(),
        });
      } catch {
        // Ignore individual folder read error
      }
    }

    // Sort folders by creation date descending
    folders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      totalFolders: folders.length,
      totalFiles,
      totalSizeBytes,
      formattedSize: formatBytes(totalSizeBytes),
      folders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Kunde inte läsa exportmappen";
    console.error("GET /api/exports error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const exportsBaseDir = path.join(process.cwd(), "exports");

    if (!fsSync.existsSync(exportsBaseDir)) {
      await fs.mkdir(exportsBaseDir, { recursive: true });
      return NextResponse.json({
        success: true,
        message: "Export-mappen är redan tom.",
        deletedFolders: 0,
      });
    }

    const entries = await fs.readdir(exportsBaseDir, { withFileTypes: true });
    let deletedCount = 0;

    for (const entry of entries) {
      const targetPath = path.join(exportsBaseDir, entry.name);
      await fs.rm(targetPath, { recursive: true, force: true });
      deletedCount += 1;
    }

    return NextResponse.json({
      success: true,
      message: `Rensade ${deletedCount} objekt från export-mappen.`,
      deletedFolders: deletedCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Kunde inte rensa exportmappen";
    console.error("DELETE /api/exports error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { action?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Optional body
    }

    const exportsBaseDir = path.join(process.cwd(), "exports");
    if (!fsSync.existsSync(exportsBaseDir)) {
      await fs.mkdir(exportsBaseDir, { recursive: true });
    }

    if (body.action === "open" || !body.action) {
      await openFolderInExplorer(exportsBaseDir);
      return NextResponse.json({ success: true, message: "Öppnade exports-mappen i Utforskaren." });
    }

    return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Kunde inte öppna exportmappen";
    console.error("POST /api/exports error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
