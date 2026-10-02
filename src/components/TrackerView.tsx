"use client";

import React, { useState, useEffect } from "react";
import {
  Building,
  MapPin,
  Sparkles,
  Trash2,
  Loader2,
  FileText,
  RotateCcw,
  Tag,
  Clock,
  X,
} from "lucide-react";
import { JobItem, ApplicationStatus } from "@/lib/types";

/**
 * Formats the saved timestamp into a localized Swedish readable string (date and time).
 */
function formatSavedDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString("sv-SE", {
      month: "short",
      day: "numeric",
    });
    const timePart = d.toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} kl. ${timePart}`;
  } catch {
    return "";
  }
}

/**
 * Props for the TrackerView component.
 */
interface TrackerViewProps {
  onOpenTailorStudio: (jobId: string) => void;
  onRefreshSavedCount: () => void;
}

/**
 * Kanban pipeline column definitions representing the application lifecycle stages.
 */
const COLUMNS: { id: ApplicationStatus; title: string; color: string }[] = [
  { id: "saved", title: "Sparade", color: "border-neutral-200 bg-neutral-50" },
  { id: "tailored", title: "Optimerade", color: "border-blue-200 bg-blue-50/40" },
  { id: "applied", title: "Skickade", color: "border-amber-200 bg-amber-50/40" },
  { id: "interview", title: "Intervju", color: "border-purple-200 bg-purple-50/40" },
  { id: "offer", title: "Erbjudande", color: "border-emerald-200 bg-emerald-50/40" },
  { id: "rejected", title: "Avslag", color: "border-rose-200 bg-rose-50/40" },
  { id: "dismissed", title: "Inaktuella", color: "border-slate-300 bg-slate-100/60" },
];

/**
 * Common preset rejection/dismissal reasons.
 */
const REASON_PRESETS = [
  "Tror inte jag har en chans",
  "Kräver för hög senioritet / saknar krav",
  "Fel roll / ej intressant teknikstack",
  "Otydlig profil eller dåliga villkor",
];

/**
 * Visual Kanban application tracking board. Allows moving jobs between stages,
 * reviewing current ATS match scores, launching tailoring, tagging dismissal reasons,
 * and deleting listings.
 */
export function TrackerView({
  onOpenTailorStudio,
  onRefreshSavedCount,
}: TrackerViewProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for selecting/entering a dismissal reason
  const [dismissModalJobId, setDismissModalJobId] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to load tracker jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleUpdateStatus = async (
    jobId: string,
    newStatus: ApplicationStatus,
    reason?: string | null
  ) => {
    try {
      const payload: { status: ApplicationStatus; dismissReason?: string | null } = {
        status: newStatus,
      };
      if (reason !== undefined) {
        payload.dismissReason = reason;
      }

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: newStatus,
                  ...(reason !== undefined && { dismissReason: reason }),
                }
              : j
          )
        );
        onRefreshSavedCount();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleStatusSelectChange = (jobId: string, targetStatus: ApplicationStatus) => {
    if (targetStatus === "dismissed") {
      // Open modal to prompt for reason
      setDismissModalJobId(jobId);
      setSelectedPreset(REASON_PRESETS[0]);
      setCustomReason("");
    } else {
      handleUpdateStatus(jobId, targetStatus);
    }
  };

  const handleConfirmDismiss = async () => {
    if (!dismissModalJobId) return;
    const finalReason = customReason.trim() || selectedPreset || null;
    await handleUpdateStatus(dismissModalJobId, "dismissed", finalReason);
    setDismissModalJobId(null);
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Vill du ta bort denna jobbannons och dess ansökan?")) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        onRefreshSavedCount();
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const activeJobsCount = jobs.filter((j) => j.status !== "dismissed").length;
  const dismissedJobsCount = jobs.filter((j) => j.status === "dismissed").length;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Ansökningsspårare (Kanban)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Håll full koll på alla dina jobb, var i processen du befinner dig och
            vilka annonser du valt bort som inaktuella.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-neutral-500">
          <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {activeJobsCount} aktiva
          </span>
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {dismissedJobsCount} inaktuella
          </span>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 items-start">
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => j.status === col.id);
          const isDismissedCol = col.id === "dismissed";

          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-2xl border p-2.5 sm:p-3 min-h-[480px] ${col.color} dark:bg-neutral-900 dark:border-neutral-800`}
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  {col.title}
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-700 shadow-xs dark:bg-neutral-800 dark:text-neutral-300">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards in column */}
              <div className="space-y-2.5 flex-1">
                {colJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`rounded-xl border bg-white p-3 shadow-xs transition-all hover:shadow-md dark:bg-neutral-850 ${
                      isDismissedCol
                        ? "border-slate-300 opacity-85 hover:opacity-100 dark:border-slate-800"
                        : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-neutral-900 line-clamp-2 dark:text-white">
                        {job.title}
                      </h4>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-neutral-400 hover:text-red-500 shrink-0"
                        title="Radera"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
                      <Building className="h-3 w-3 shrink-0" />
                      <span className="truncate">{job.company}</span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </div>

                    {/* Saved timestamp */}
                    {job.createdAt && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">Sparad {formatSavedDate(job.createdAt)}</span>
                      </div>
                    )}

                    {/* Match Score Badge */}
                    {job.matchScore !== null && job.matchScore !== undefined && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        <Sparkles className="h-2.5 w-2.5 shrink-0" />
                        {job.matchScore}% match
                      </div>
                    )}

                    {/* Dismissal Reason Tag */}
                    {isDismissedCol && job.dismissReason && (
                      <div className="mt-2 flex items-start gap-1 rounded-md bg-slate-100 p-1.5 text-[10px] leading-tight text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Tag className="h-3 w-3 mt-0.5 shrink-0 text-slate-500" />
                        <span className="italic line-clamp-2">{job.dismissReason}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-1.5">
                      {isDismissedCol ? (
                        <button
                          onClick={() => handleUpdateStatus(job.id, "saved")}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/70 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
                          title="Flytta tillbaka till sparade och häv sökblockering"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Återaktivera</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenTailorStudio(job.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/70 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Öppna CV</span>
                        </button>
                      )}

                      {/* Move to stage select */}
                      <select
                        value={job.status}
                        onChange={(e) =>
                          handleStatusSelectChange(
                            job.id,
                            e.target.value as ApplicationStatus
                          )
                        }
                        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-700 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 cursor-pointer"
                      >
                        <option value="saved">Sparad</option>
                        <option value="tailored">Optimerad</option>
                        <option value="applied">Ansökt</option>
                        <option value="interview">Intervju</option>
                        <option value="offer">Erbjudande</option>
                        <option value="rejected">Avslag</option>
                        <option value="dismissed">Inaktuell</option>
                      </select>
                    </div>
                  </div>
                ))}

                {colJobs.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-neutral-300/60 text-[11px] text-neutral-400 dark:border-neutral-800">
                    Inga jobb här
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dismiss Reason Modal Dialog */}
      {dismissModalJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Markera som inaktuell
              </h3>
              <button
                onClick={() => setDismissModalJobId(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              Välj varför du inte vill söka jobbet. Annonsen sparas i kolumnen{" "}
              <strong>Inaktuella</strong> och blockeras automatiskt från jobbsöket.
            </p>

            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Förvalda anledningar:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset);
                      setCustomReason("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedPreset === preset && !customReason
                        ? "border-blue-500 bg-blue-50 font-medium text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Eller skriv egen anledning:
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="T.ex. För långt pendlingsavstånd..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setDismissModalJobId(null)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleConfirmDismiss}
                className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Markera inaktuell
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
