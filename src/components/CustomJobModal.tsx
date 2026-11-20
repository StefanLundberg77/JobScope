"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Link,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { JobItem } from "@/lib/types";
import { findDuplicateJobsForUrl } from "@/lib/jobSearch";
import { getColumnStatusDate, getStatusLabel } from "@/components/TrackerView";

/**
 * Formats an ISO date string into a compact Swedish date (e.g. "14 nov 2026").
 */
function formatCompactDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Props for the CustomJobModal component.
 */
interface CustomJobModalProps {
  onJobSaved: (job: JobItem) => void;
  onOpenExistingJob?: (jobId: string) => void;
}

/**
 * Ingestion view enabling users to import arbitrary job postings from
 * external links (LinkedIn, Indeed, career sites) or raw pasted text,
 * with proactive duplicate detection against the saved application database.
 */
export function CustomJobModal({
  onJobSaved,
  onOpenExistingJob,
}: CustomJobModalProps) {
  const [activeMode, setActiveMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingJobs, setExistingJobs] = useState<JobItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setExistingJobs(data);
        }
      })
      .catch(() => {
        // Non-fatal: duplicate warning simply stays unavailable if fetch fails
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const duplicateMatches = useMemo(() => {
    if (activeMode !== "url" || !url.trim()) return [];
    return findDuplicateJobsForUrl(existingJobs, url);
  }, [activeMode, url, existingJobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = activeMode === "url" ? { url } : { rawText };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kunde inte spara jobbannonsen");
      }

      onJobSaved(data);
      setUrl("");
      setRawText("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Ett fel uppstod vid import"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Klistra in valfri jobbannons
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Har du hittat en annons på LinkedIn, Indeed, Blocket Jobb eller en specifik karriärsida?
          Klistra in länken eller texten så analyserar AI:n kraven och förbereder ditt skräddarsydda CV.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {/* Toggle Mode */}
        <div className="mb-6 flex gap-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveMode("url")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              activeMode === "url"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Link className="h-4 w-4" />
            Länk till webbannons
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("text")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              activeMode === "text"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <FileText className="h-4 w-4" />
            Klistra in råtext
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeMode === "url" ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Annonsens URL
              </label>
              <div className="relative">
                <Link className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/... eller karriärsida"
                  className="w-full rounded-xl border border-neutral-300 pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-400">
                JobScope hämtar webbsidan och extraherar roll, företag, beskrivning och krav.
              </p>

              {/* Proactive duplicate detection warning */}
              {duplicateMatches.length > 0 && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold">
                        Den här länken finns redan i din ansökningsdatabas:
                      </p>
                      <div className="space-y-1.5">
                        {duplicateMatches.map((dup) => {
                          const stageLabel = getStatusLabel(dup.status);
                          const stageDate = formatCompactDate(
                            getColumnStatusDate(dup, dup.status)
                          );

                          return (
                            <div
                              key={dup.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 dark:border-amber-900/60 dark:bg-neutral-900/70"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-neutral-900 dark:text-white truncate">
                                  {dup.company} – {dup.title}
                                </div>
                                <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
                                  Status: <strong>{stageLabel}</strong>
                                  {stageDate ? ` (${stageDate})` : ""}
                                  {dup.dismissReason
                                    ? ` • ${dup.dismissReason}`
                                    : ""}
                                </div>
                              </div>

                              {onOpenExistingJob && (
                                <button
                                  type="button"
                                  onClick={() => onOpenExistingJob(dup.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
                                >
                                  <span>Öppna befintlig</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Klistra in hela annonstexten
              </label>
              <textarea
                rows={12}
                required
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Kopiera texten från annonsen och klistra in här..."
                className="w-full rounded-xl border border-neutral-300 p-3 text-xs leading-relaxed focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || (activeMode === "url" ? !url.trim() : !rawText.trim())}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyserar annonsen...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {duplicateMatches.length > 0
                    ? "Importera ändå"
                    : "Spara & Förbered optimering"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
