"use client";

import React, { useState, useEffect } from "react";
import {
  Building,
  MapPin,
  Calendar,
  Sparkles,
  ExternalLink,
  Trash2,
  ChevronRight,
  Loader2,
  CheckCircle,
  FileText,
} from "lucide-react";
import { JobItem, ApplicationStatus } from "@/lib/types";

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
];

/**
 * Visual Kanban application tracking board. Allows moving jobs between stages,
 * reviewing current ATS match scores, launching tailoring, and deleting listings.
 */
export function TrackerView({
  onOpenTailorStudio,
  onRefreshSavedCount,
}: TrackerViewProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    newStatus: ApplicationStatus
  ) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
        );
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
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

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Ansökningsspårare (Kanban)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Håll full koll på alla dina jobb, var i processen du befinner dig och
            vilket skräddarsytt CV som hör till vilken ansökan.
          </p>
        </div>
        <span className="text-xs font-semibold text-neutral-500">
          Totalt: {jobs.length} jobb
        </span>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-start">
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => j.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-2xl border p-3 min-h-[480px] ${col.color} dark:bg-neutral-900 dark:border-neutral-800`}
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
              <div className="space-y-3 flex-1">
                {colJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs transition-all hover:shadow-md dark:border-neutral-800 dark:bg-neutral-850"
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
                      <Building className="h-3 w-3" />
                      <span className="truncate">{job.company}</span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{job.location}</span>
                    </div>

                    {/* Match Score Badge */}
                    {job.matchScore !== null && job.matchScore !== undefined && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        <Sparkles className="h-2.5 w-2.5" />
                        {job.matchScore}% match
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                      <button
                        onClick={() => onOpenTailorStudio(job.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <FileText className="h-3 w-3" />
                        Öppna CV
                      </button>

                      {/* Move to next stage shortcut */}
                      <select
                        value={job.status}
                        onChange={(e) =>
                          handleUpdateStatus(
                            job.id,
                            e.target.value as ApplicationStatus
                          )
                        }
                        className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-700 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        <option value="saved">Sparad</option>
                        <option value="tailored">Optimerad</option>
                        <option value="applied">Ansökt</option>
                        <option value="interview">Intervju</option>
                        <option value="offer">Erbjudande</option>
                        <option value="rejected">Avslag</option>
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
    </div>
  );
}
