"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  StickyNote,
  Check,
  Gauge,
  ArrowUpDown,
  Calendar,
  Search,
  List,
  Columns3,
  CheckCircle2,
  Layers,
  ExternalLink,
  Ban,
  EyeOff,
} from "lucide-react";
import { JobItem, ApplicationStatus, BlockedJobItem } from "@/lib/types";
import {
  buildCompanyCounts,
  matchesBlockedJobQuery,
  matchesJobQuery,
  normalizeCompanyName,
  normalizeSearchText,
} from "@/lib/jobSearch";

/**
 * Formats a timestamp into a localized Swedish readable string (date and time).
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
 * Returns a user-friendly Swedish action label for a given column status stage.
 */
export function getStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "Sparad";
    case "tailored":
      return "Optimerad";
    case "applied":
      return "Skickad";
    case "interview":
      return "Intervju";
    case "offer":
      return "Erbjudande";
    case "rejected":
      return "Avslag";
    case "dismissed":
      return "Inaktuell";
    default:
      return "Uppdaterad";
  }
}

/**
 * Returns styling classes for compact status pill badges.
 */
function getStatusBadgeClasses(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700";
    case "tailored":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60";
    case "applied":
      return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60";
    case "interview":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900/60";
    case "offer":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60";
    case "dismissed":
      return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700";
  }
}

/**
 * Returns the most relevant timestamp for a job item within a specific Kanban column.
 */
export function getColumnStatusDate(
  job: JobItem,
  colStatus: ApplicationStatus
): string {
  if (job.statusUpdatedAt && job.status === colStatus) {
    return job.statusUpdatedAt;
  }
  if (colStatus === "saved") {
    return job.createdAt || "";
  }
  if (colStatus === "tailored") {
    return (
      job.applications?.[0]?.updatedAt ||
      job.applications?.[0]?.createdAt ||
      job.statusUpdatedAt ||
      job.updatedAt ||
      job.createdAt ||
      ""
    );
  }
  return job.statusUpdatedAt || job.updatedAt || job.createdAt || "";
}

/**
 * Supported sorting options for the Kanban pipeline and list view.
 */
export type KanbanSortOption =
  | "stage_date_desc"
  | "stage_date_asc"
  | "match_score_desc"
  | "deadline_asc"
  | "company_asc";

/**
 * Supported status filter presets for narrowing tracked applications.
 */
type StatusFilterOption =
  | "all"
  | "active"
  | "applied"
  | "interview_offer"
  | "rejected"
  | "dismissed";

/**
 * Supported display modes for the tracker view.
 */
type TrackerViewMode = "kanban" | "list";

/**
 * Sorts jobs based on the active sort option and each job's effective stage timestamp.
 */
function sortJobsList(
  jobsList: JobItem[],
  sortOption: KanbanSortOption,
  fixedColStatus?: ApplicationStatus
): JobItem[] {
  return [...jobsList].sort((a, b) => {
    switch (sortOption) {
      case "stage_date_desc": {
        const timeA =
          new Date(getColumnStatusDate(a, fixedColStatus ?? a.status)).getTime() ||
          0;
        const timeB =
          new Date(getColumnStatusDate(b, fixedColStatus ?? b.status)).getTime() ||
          0;
        return timeB - timeA;
      }
      case "stage_date_asc": {
        const timeA =
          new Date(getColumnStatusDate(a, fixedColStatus ?? a.status)).getTime() ||
          0;
        const timeB =
          new Date(getColumnStatusDate(b, fixedColStatus ?? b.status)).getTime() ||
          0;
        return timeA - timeB;
      }
      case "match_score_desc": {
        const scoreA = a.matchScore ?? -1;
        const scoreB = b.matchScore ?? -1;
        return scoreB - scoreA;
      }
      case "deadline_asc": {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      case "company_asc": {
        return (a.company || "").localeCompare(b.company || "", "sv", {
          sensitivity: "base",
        });
      }
      default:
        return 0;
    }
  });
}

/**
 * Checks whether a job satisfies the currently selected status filter chip.
 */
function matchesStatusFilter(
  status: ApplicationStatus,
  filter: StatusFilterOption
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return status !== "dismissed";
    case "applied":
      return status === "applied";
    case "interview_offer":
      return status === "interview" || status === "offer";
    case "rejected":
      return status === "rejected";
    case "dismissed":
      return status === "dismissed";
    default:
      return true;
  }
}

/**
 * Escapes special RegExp characters in a search token.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlights substrings matching active search query tokens.
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return <>{text}</>;
  }

  const tokens = Array.from(
    new Set(
      normalizeSearchText(trimmed)
        .split(" ")
        .filter((t) => t.length >= 2)
    )
  ).sort((a, b) => b.length - a.length);

  if (tokens.length === 0) {
    return <>{text}</>;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        const lowerPart = normalizeSearchText(part);
        const isMatch = tokens.some((t) => lowerPart === t);
        if (isMatch) {
          return (
            <mark
              key={idx}
              className="rounded-xs bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-500/35"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
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
 * Status filter chip definitions displayed in the search toolbar.
 */
const STATUS_FILTER_CHIPS: { id: StatusFilterOption; label: string }[] = [
  { id: "all", label: "Alla" },
  { id: "active", label: "Aktiva" },
  { id: "applied", label: "Skickade" },
  { id: "interview_offer", label: "Intervju & Erbj." },
  { id: "rejected", label: "Avslag" },
  { id: "dismissed", label: "Inaktuella" },
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
 * Common preset quick-snippets for personal notes in Kanban tracker.
 */
const NOTE_SNIPPETS = [
  "Kontaktperson: ",
  "Intervjudatum: ",
  "Frågor till intervju: ",
  "Löneanspråk: ",
  "Att förbereda: ",
];

/**
 * Visual Kanban application tracking board and searchable database list view.
 * Allows searching across all saved/applied/rejected/dismissed jobs, filtering by status,
 * inspecting employer history, moving jobs between stages, launching tailoring, and editing notes.
 */
export function TrackerView({
  onOpenTailorStudio,
  onRefreshSavedCount,
}: TrackerViewProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [blockedJobs, setBlockedJobs] = useState<BlockedJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<KanbanSortOption>(() => {
    if (typeof window === "undefined") return "stage_date_desc";
    try {
      const storedSort = localStorage.getItem(
        "jobscope_kanban_sort"
      ) as KanbanSortOption;
      if (
        storedSort === "stage_date_desc" ||
        storedSort === "stage_date_asc" ||
        storedSort === "match_score_desc" ||
        storedSort === "deadline_asc" ||
        storedSort === "company_asc"
      ) {
        return storedSort;
      }
    } catch {
      // Ignore localStorage read errors
    }
    return "stage_date_desc";
  });
  const [viewMode, setViewMode] = useState<TrackerViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    try {
      const storedView = localStorage.getItem(
        "jobscope_tracker_view_mode"
      ) as TrackerViewMode;
      if (storedView === "kanban" || storedView === "list") {
        return storedView;
      }
    } catch {
      // Ignore localStorage read errors
    }
    return "kanban";
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [includeDescription, setIncludeDescription] = useState(false);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal state for selecting/entering a dismissal reason
  const [dismissModalJobId, setDismissModalJobId] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  // Modal state for viewing/editing personal notes
  const [noteModalJob, setNoteModalJob] = useState<JobItem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);

  // Global keyboard shortcut: press "/" to focus the database search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSortChange = (newSort: KanbanSortOption) => {
    setSortBy(newSort);
    try {
      localStorage.setItem("jobscope_kanban_sort", newSort);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const handleViewModeChange = (mode: TrackerViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("jobscope_tracker_view_mode", mode);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const handleFilterByCompany = (companyName: string) => {
    setSearchQuery(companyName);
    setStatusFilter("all");
    searchInputRef.current?.focus();
  };

  const handleOpenNoteModal = (job: JobItem) => {
    setNoteModalJob(job);
    setNoteText(job.notes || job.applications?.[0]?.notes || "");
  };

  const handleRunMatch = async (jobId: string) => {
    setMatchingJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, {
        method: "POST",
      });
      if (res.ok) {
        const updated = await res.json();
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  matchScore: updated.matchScore,
                  matchAnalysis: updated.matchAnalysis,
                }
              : j
          )
        );
      }
    } catch (err) {
      console.error("Failed to run match in TrackerView:", err);
    } finally {
      setMatchingJobId(null);
    }
  };

  const handleSaveJobNote = async () => {
    if (!noteModalJob) return;
    setSavingNote(true);
    try {
      const trimmed = noteText.trim();
      const res = await fetch(`/api/jobs/${noteModalJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmed || null }),
      });
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === noteModalJob.id ? { ...j, notes: trimmed || null } : j
          )
        );
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
      setNoteModalJob(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialData() {
      try {
        const [jobsRes, blockedRes] = await Promise.allSettled([
          fetch("/api/jobs"),
          fetch("/api/jobs/blocked"),
        ]);

        if (cancelled) return;

        if (jobsRes.status === "fulfilled" && jobsRes.value.ok) {
          const data = await jobsRes.value.json();
          if (!cancelled) setJobs(data);
        }

        if (blockedRes.status === "fulfilled" && blockedRes.value.ok) {
          const blockedData = await blockedRes.value.json();
          if (!cancelled) {
            setBlockedJobs(
              Array.isArray(blockedData.blocked) ? blockedData.blocked : []
            );
          }
        }
      } catch (err) {
        console.error("Failed to load tracker jobs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdateStatus = async (
    jobId: string,
    newStatus: ApplicationStatus,
    reason?: string | null
  ) => {
    const nowIso = new Date().toISOString();
    try {
      const payload: {
        status: ApplicationStatus;
        dismissReason?: string | null;
        statusUpdatedAt: string;
      } = {
        status: newStatus,
        statusUpdatedAt: nowIso,
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
                  statusUpdatedAt: nowIso,
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

  const handleStatusSelectChange = (
    jobId: string,
    targetStatus: ApplicationStatus
  ) => {
    if (targetStatus === "dismissed") {
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

  // Precompute normalized company counts across the full database for employer history badges
  const companyCounts = useMemo(() => buildCompanyCounts(jobs), [jobs]);

  const trimmedQuery = searchQuery.trim();
  const hasSearchQuery = trimmedQuery.length > 0;

  // All jobs matching the text/URL query across ALL statuses (prevents false negatives from status filters)
  const searchMatchedAllStatuses = useMemo(() => {
    if (!hasSearchQuery) return jobs;
    return jobs.filter((job) =>
      matchesJobQuery(job, trimmedQuery, { includeDescription })
    );
  }, [jobs, hasSearchQuery, trimmedQuery, includeDescription]);

  // Jobs visible after applying both text/URL query and status filter chip
  const filteredJobs = useMemo(() => {
    return searchMatchedAllStatuses.filter((job) =>
      matchesStatusFilter(job.status, statusFilter)
    );
  }, [searchMatchedAllStatuses, statusFilter]);

  // Sorted flat list for the compact table view
  const sortedFilteredJobs = useMemo(
    () => sortJobsList(filteredJobs, sortBy),
    [filteredJobs, sortBy]
  );

  // Breakdown of search hits per status across the entire database
  const searchStatusBreakdown = useMemo(() => {
    const counts = new Map<ApplicationStatus, number>();
    for (const job of searchMatchedAllStatuses) {
      counts.set(job.status, (counts.get(job.status) || 0) + 1);
    }
    return COLUMNS.map((col) => ({
      id: col.id,
      title: col.title,
      count: counts.get(col.id) || 0,
    })).filter((item) => item.count > 0);
  }, [searchMatchedAllStatuses]);

  // Cross-check BlockedJob entries that are not already represented in JobListing
  const orphanedBlockedMatches = useMemo(() => {
    if (!hasSearchQuery || blockedJobs.length === 0) return [];
    const existingExternalIds = new Set(
      jobs.map((j) => j.externalId).filter((id): id is string => Boolean(id))
    );
    return blockedJobs.filter(
      (b) =>
        !existingExternalIds.has(b.externalId) &&
        matchesBlockedJobQuery(b, trimmedQuery)
    );
  }, [blockedJobs, jobs, hasSearchQuery, trimmedQuery]);

  // Determine which Kanban columns should be displayed
  const visibleColumns = useMemo(() => {
    return COLUMNS.filter((col) => {
      if (!matchesStatusFilter(col.id, statusFilter)) return false;
      if (hideEmptyColumns && (hasSearchQuery || statusFilter !== "all")) {
        return filteredJobs.some((j) => j.status === col.id);
      }
      return true;
    });
  }, [statusFilter, hideEmptyColumns, hasSearchQuery, filteredJobs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const activeJobsCount = jobs.filter((j) => j.status !== "dismissed").length;
  const dismissedJobsCount = jobs.filter((j) => j.status === "dismissed").length;

  const kanbanGridColsClass =
    visibleColumns.length <= 1
      ? "grid-cols-1 max-w-md"
      : visibleColumns.length === 2
      ? "grid-cols-1 sm:grid-cols-2 max-w-3xl"
      : visibleColumns.length === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : visibleColumns.length === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : visibleColumns.length <= 6
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

  return (
    <div className="space-y-5 pb-16">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Ansökningsspårare (Kanban)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sök i din ansökningsdatabas, kontrollera tidigare ansökningar och håll koll
            på varje steg i processen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 dark:border-neutral-700 dark:bg-neutral-800/80"
            role="group"
            aria-label="Välj visningsläge"
          >
            <button
              type="button"
              onClick={() => handleViewModeChange("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
              title="Kanban-vy"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
              title="Kompakt listvy (databasöversikt)"
            >
              <List className="h-3.5 w-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Sorting control */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="kanban-sort-select"
              className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              <span>Sortera:</span>
            </label>
            <select
              id="kanban-sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as KanbanSortOption)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="stage_date_desc">Nyast först (kolumndatum)</option>
              <option value="stage_date_asc">Äldst först (kolumndatum)</option>
              <option value="match_score_desc">Högst matchning</option>
              <option value="deadline_asc">Närmaste deadline</option>
              <option value="company_asc">Företag (A–Ö)</option>
            </select>
          </div>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />

          {/* Badge counters */}
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {activeJobsCount} aktiva
            </span>
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {dismissedJobsCount} inaktuella
            </span>
          </div>
        </div>
      </div>

      {/* Database Search & Filter Toolbar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (searchQuery) {
                    setSearchQuery("");
                  } else {
                    searchInputRef.current?.blur();
                  }
                }
              }}
              placeholder="Sök företag, roll, ort, teknik, anteckning eller klistra in URL... (tryck /)"
              aria-label="Sök i sparade och sökta jobb i databasen"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 py-2 pl-10 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-white dark:focus:bg-neutral-800 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                title="Rensa sökning (Esc)"
                aria-label="Rensa sökning"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Options Toggles */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={includeDescription}
                onChange={(e) => setIncludeDescription(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 accent-blue-600 cursor-pointer"
              />
              <span>Sök även i annonstext</span>
            </label>

            {viewMode === "kanban" && (hasSearchQuery || statusFilter !== "all") && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-neutral-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={hideEmptyColumns}
                  onChange={(e) => setHideEmptyColumns(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 accent-blue-600 cursor-pointer"
                />
                <span className="inline-flex items-center gap-1">
                  <EyeOff className="h-3 w-3 text-neutral-400" />
                  Dölj tomma kolumner
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTER_CHIPS.map((chip) => {
              const isSelected = statusFilter === chip.id;
              const chipCount = searchMatchedAllStatuses.filter((j) =>
                matchesStatusFilter(j.status, chip.id)
              ).length;

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/70 dark:bg-blue-950/60 dark:text-blue-300"
                      : "border-neutral-200 bg-neutral-50/70 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected
                        ? "bg-blue-600/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200"
                        : "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {chipCount}
                  </span>
                </button>
              );
            })}
          </div>

          {(hasSearchQuery || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setIncludeDescription(false);
              }}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline-offset-2 hover:underline cursor-pointer"
            >
              Återställ filter
            </button>
          )}
        </div>
      </div>

      {/* Live Search Summary / Duplicate Lookup Banner */}
      {hasSearchQuery && (
        <div className="space-y-2">
          {searchMatchedAllStatuses.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-blue-900 dark:text-blue-200">
                  Hittade {searchMatchedAllStatuses.length} av {jobs.length} jobb för &ldquo;{trimmedQuery}&rdquo;:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {searchStatusBreakdown.map((item) => (
                    <span
                      key={item.id}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClasses(
                        item.id
                      )}`}
                    >
                      {item.count} {item.title}
                    </span>
                  ))}
                </div>
              </div>

              {statusFilter !== "all" &&
                filteredJobs.length < searchMatchedAllStatuses.length && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="font-semibold text-blue-700 hover:underline dark:text-blue-300 cursor-pointer"
                  >
                    Visar {filteredJobs.length} pga statusfilter — Visa alla ({searchMatchedAllStatuses.length})
                  </button>
                )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>Inga tidigare träffar</strong> för &ldquo;{trimmedQuery}&rdquo; i dina sparade/sökta jobb.
                </span>
              </div>
              {!includeDescription && (
                <button
                  type="button"
                  onClick={() => setIncludeDescription(true)}
                  className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100 cursor-pointer"
                >
                  Sök även i annonstext
                </button>
              )}
            </div>
          )}

          {/* Cross-check warning for orphaned BlockedJob entries */}
          {orphanedBlockedMatches.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <Ban className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Hittade även {orphanedBlockedMatches.length} blockerad
                  {orphanedBlockedMatches.length > 1 ? "e" : ""} annons
                  {orphanedBlockedMatches.length > 1 ? "er" : ""} i Jobbsök (ej i Kanban):
                </span>
              </div>
              <ul className="mt-1.5 space-y-1 pl-5 list-disc">
                {orphanedBlockedMatches.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <strong>{b.company || "Okänt företag"}</strong>
                    {b.title ? ` – ${b.title}` : ""}
                    {b.reason ? ` (${b.reason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main Content: Kanban Board OR Compact Database List */}
      {viewMode === "kanban" ? (
        visibleColumns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/60 py-14 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
            <Search className="h-7 w-7 text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Inga jobb matchade din filtrering
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Prova ett annat sökord eller återställ statusfiltret.
            </p>
          </div>
        ) : (
          <div className={`grid gap-3 items-start ${kanbanGridColsClass}`}>
            {visibleColumns.map((col) => {
              const totalInCol = jobs.filter((j) => j.status === col.id).length;
              const rawColJobs = filteredJobs.filter((j) => j.status === col.id);
              const colJobs = sortJobsList(rawColJobs, sortBy, col.id);
              const isDismissedCol = col.id === "dismissed";
              const isDimmed = hasSearchQuery && colJobs.length === 0;

              return (
                <div
                  key={col.id}
                  className={`flex flex-col rounded-2xl border p-2.5 sm:p-3 min-h-[480px] transition-opacity ${
                    col.color
                  } dark:bg-neutral-900 dark:border-neutral-800 ${
                    isDimmed ? "opacity-55" : "opacity-100"
                  }`}
                >
                  {/* Column Header */}
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      {col.title}
                    </span>
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-neutral-700 shadow-xs dark:bg-neutral-800 dark:text-neutral-300"
                      title={
                        hasSearchQuery && totalInCol !== colJobs.length
                          ? `${colJobs.length} matchande av ${totalInCol} totalt i ${col.title}`
                          : `${colJobs.length} i ${col.title}`
                      }
                    >
                      {hasSearchQuery && totalInCol !== colJobs.length
                        ? `${colJobs.length}/${totalInCol}`
                        : colJobs.length}
                    </span>
                  </div>

                  {/* Cards in column */}
                  <div className="space-y-2.5 flex-1">
                    {colJobs.map((job) => {
                      const stageDate = getColumnStatusDate(job, col.id);
                      const stageLabel = getStatusLabel(col.id);
                      const companyKey = normalizeCompanyName(job.company);
                      const companyTotal = companyKey
                        ? companyCounts.get(companyKey) || 1
                        : 1;

                      return (
                        <div
                          key={job.id}
                          className={`rounded-xl border bg-white p-3 shadow-xs transition-all hover:shadow-md dark:bg-neutral-800 ${
                            isDismissedCol
                              ? "border-slate-300 opacity-85 hover:opacity-100 dark:border-slate-800 dark:bg-neutral-800/60"
                              : "border-neutral-200 dark:border-neutral-700"
                          }`}
                        >
                          {/* Company name & delete action */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                                <h4
                                  className="text-sm font-bold text-neutral-900 dark:text-white truncate"
                                  title={job.company}
                                >
                                  <HighlightText
                                    text={job.company}
                                    query={searchQuery}
                                  />
                                </h4>
                              </div>
                              {/* Target job title being applied for */}
                              <p
                                className="mt-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 line-clamp-1"
                                title={job.title}
                              >
                                <HighlightText
                                  text={job.title}
                                  query={searchQuery}
                                />
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="text-neutral-400 hover:text-red-500 shrink-0 p-0.5 transition-colors cursor-pointer"
                              title="Radera"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Location */}
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              <HighlightText
                                text={job.location}
                                query={searchQuery}
                              />
                            </span>
                          </div>

                          {/* Stage status timestamp */}
                          {stageDate && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {stageLabel} {formatSavedDate(stageDate)}
                              </span>
                            </div>
                          )}

                          {/* Application deadline if present */}
                          {job.deadline && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                Sista dag:{" "}
                                {new Date(job.deadline).toLocaleDateString(
                                  "sv-SE",
                                  {
                                    day: "numeric",
                                    month: "short",
                                  }
                                )}
                              </span>
                            </div>
                          )}

                          {/* Badges row: Match Score + Employer History Count */}
                          {((job.matchScore !== null &&
                            job.matchScore !== undefined) ||
                            companyTotal > 1) && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {job.matchScore !== null &&
                                job.matchScore !== undefined && (
                                  <div
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      job.matchScore >= 75
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : job.matchScore >= 50
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    }`}
                                  >
                                    <Sparkles className="h-2.5 w-2.5 shrink-0" />
                                    {job.matchScore}% match
                                  </div>
                                )}

                              {companyTotal > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleFilterByCompany(job.company)
                                  }
                                  title={`Visa alla ${companyTotal} jobb hos ${job.company}`}
                                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/70 transition-colors cursor-pointer"
                                >
                                  <Layers className="h-2.5 w-2.5 shrink-0" />
                                  {companyTotal} roller
                                </button>
                              )}
                            </div>
                          )}

                          {/* Dismissal Reason Tag */}
                          {isDismissedCol && job.dismissReason && (
                            <div className="mt-2 flex items-start gap-1 rounded-md bg-slate-100 p-1.5 text-[10px] leading-tight text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Tag className="h-3 w-3 mt-0.5 shrink-0 text-slate-500" />
                              <span className="italic line-clamp-2">
                                {job.dismissReason}
                              </span>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-700/60 flex flex-col gap-1.5">
                            {isDismissedCol ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(job.id, "saved")
                                  }
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/70 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                                  title="Flytta tillbaka till sparade och häv sökblockering"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Återaktivera</span>
                                </button>
                                <button
                                  onClick={() => handleOpenNoteModal(job)}
                                  title={
                                    job.notes || job.applications?.[0]?.notes
                                      ? "Visa eller redigera anteckning"
                                      : "Anteckningar"
                                  }
                                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                                    job.notes || job.applications?.[0]?.notes
                                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                      : "border-neutral-200 bg-neutral-50/70 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                                  }`}
                                >
                                  <StickyNote className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {job.matchScore === null ||
                                job.matchScore === undefined ? (
                                  <button
                                    onClick={() => handleRunMatch(job.id)}
                                    disabled={matchingJobId === job.id}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/70 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 transition-colors cursor-pointer"
                                    title="Kör ATS-matchningsanalys med Gemini"
                                  >
                                    {matchingJobId === job.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                        <span>Matchar...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Gauge className="h-3 w-3 text-neutral-500" />
                                        <span>Kör Matchning</span>
                                      </>
                                    )}
                                  </button>
                                ) : null}

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => onOpenTailorStudio(job.id)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/70 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 transition-colors cursor-pointer"
                                    title="Öppna CV i Skräddarsy-studion"
                                  >
                                    <FileText className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                                    <span>Öppna CV</span>
                                  </button>

                                  <button
                                    onClick={() => handleOpenNoteModal(job)}
                                    title={
                                      job.notes || job.applications?.[0]?.notes
                                        ? "Visa eller redigera anteckning"
                                        : "Anteckningar"
                                    }
                                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                                      job.notes || job.applications?.[0]?.notes
                                        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                        : "border-neutral-200 bg-neutral-50/70 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                                    }`}
                                  >
                                    <StickyNote className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
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
                              aria-label={`Status för ${job.company} – ${job.title}`}
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
                      );
                    })}

                    {colJobs.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-neutral-300/60 text-[11px] text-neutral-400 dark:border-neutral-800">
                        {hasSearchQuery ? "Inga träffar" : "Inga jobb här"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Compact Searchable Database Table View */
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          {sortedFilteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <Search className="h-7 w-7 text-neutral-300 dark:text-neutral-600 mb-2" />
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Inga jobb hittades i listan
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {hasSearchQuery
                  ? `Ingen sparad eller sökt tjänst matchade "${trimmedQuery}".`
                  : "Ändra statusfiltret för att visa andra ansökningar."}
              </p>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Lista över ansökningar i databasen"
              className="overflow-x-auto max-h-[72vh] overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <table className="w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/95 dark:text-neutral-400">
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700"
                    >
                      Företag &amp; Roll
                    </th>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-700"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-700"
                    >
                      Datum
                    </th>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-700"
                    >
                      Match
                    </th>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-700"
                    >
                      Anteckning / Anledning
                    </th>
                    <th
                      scope="col"
                      className="border-b border-neutral-200 px-4 py-3 text-right dark:border-neutral-700"
                    >
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {sortedFilteredJobs.map((job) => {
                    const stageDate = getColumnStatusDate(job, job.status);
                    const stageLabel = getStatusLabel(job.status);
                    const notePreview =
                      job.notes ||
                      job.applications?.[0]?.notes ||
                      job.dismissReason ||
                      "";
                    const companyKey = normalizeCompanyName(job.company);
                    const companyTotal = companyKey
                      ? companyCounts.get(companyKey) || 1
                      : 1;

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <th
                          scope="row"
                          className="px-4 py-3 font-normal align-top max-w-[320px]"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-neutral-900 dark:text-white text-sm">
                              <HighlightText
                                text={job.company}
                                query={searchQuery}
                              />
                            </span>
                            {companyTotal > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleFilterByCompany(job.company)
                                }
                                title={`Visa alla ${companyTotal} jobb hos ${job.company}`}
                                className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                              >
                                <Layers className="h-2.5 w-2.5" />
                                {companyTotal}
                              </button>
                            )}
                          </div>
                          <div
                            className="mt-0.5 font-medium text-neutral-700 dark:text-neutral-300 line-clamp-1"
                            title={job.title}
                          >
                            <HighlightText text={job.title} query={searchQuery} />
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              <HighlightText
                                text={job.location}
                                query={searchQuery}
                              />
                            </span>
                          </div>
                        </th>

                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <select
                            value={job.status}
                            onChange={(e) =>
                              handleStatusSelectChange(
                                job.id,
                                e.target.value as ApplicationStatus
                              )
                            }
                            aria-label={`Ändra status för ${job.company} – ${job.title}`}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer ${getStatusBadgeClasses(
                              job.status
                            )}`}
                          >
                            <option value="saved">Sparad</option>
                            <option value="tailored">Optimerad</option>
                            <option value="applied">Ansökt</option>
                            <option value="interview">Intervju</option>
                            <option value="offer">Erbjudande</option>
                            <option value="rejected">Avslag</option>
                            <option value="dismissed">Inaktuell</option>
                          </select>
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap text-neutral-600 dark:text-neutral-300">
                          {stageDate ? (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Clock className="h-3 w-3 text-neutral-400 shrink-0" />
                              <span>
                                {stageLabel} {formatSavedDate(stageDate)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                          {job.deadline && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>
                                Sista dag:{" "}
                                {new Date(job.deadline).toLocaleDateString(
                                  "sv-SE",
                                  {
                                    day: "numeric",
                                    month: "short",
                                  }
                                )}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          {job.matchScore !== null &&
                          job.matchScore !== undefined ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                job.matchScore >= 75
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : job.matchScore >= 50
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {job.matchScore}%
                            </span>
                          ) : job.status !== "dismissed" ? (
                            <button
                              type="button"
                              onClick={() => handleRunMatch(job.id)}
                              disabled={matchingJobId === job.id}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              {matchingJobId === job.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                              ) : (
                                <Gauge className="h-3 w-3" />
                              )}
                              <span>Matcha</span>
                            </button>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 align-top max-w-[260px]">
                          {notePreview ? (
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(job)}
                              className="text-left text-[11px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white line-clamp-2 cursor-pointer"
                              title={notePreview}
                            >
                              <HighlightText
                                text={notePreview}
                                query={searchQuery}
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(job)}
                              className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
                            >
                              + Lägg till anteckning
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {job.status === "dismissed" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateStatus(job.id, "saved")
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                                title="Återaktivera jobbannons"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Återaktivera</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenTailorStudio(job.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                                title="Öppna i CV-studion"
                              >
                                <FileText className="h-3 w-3" />
                                <span>Öppna CV</span>
                              </button>
                            )}

                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-blue-400"
                                title="Öppna originalannons"
                                aria-label={`Öppna originalannons för ${job.company}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(job)}
                              title="Anteckningar"
                              className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors cursor-pointer ${
                                job.notes || job.applications?.[0]?.notes
                                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                              }`}
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteJob(job.id)}
                              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                              title="Radera"
                              aria-label={`Radera ${job.company} – ${job.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      {/* Note Modal Dialog */}
      {noteModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Anteckningar
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 truncate max-w-[280px] mt-0.5">
                  {noteModalJob.company} • {noteModalJob.title}
                </p>
              </div>
              <button
                onClick={() => setNoteModalJob(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              Fyll i dina personliga anteckningar för denna ansökan (t.ex. datum,
              kontaktperson, intervjufrågor, löneanspråk).
            </p>

            {/* Quick helper chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {NOTE_SNIPPETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setNoteText((prev) =>
                      prev ? `${prev}\n${preset}` : preset
                    );
                  }}
                  className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  + {preset.replace(/: $/, "")}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <textarea
                rows={6}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Skriv dina anteckningar här..."
                className="w-full rounded-xl border border-neutral-300 p-3 text-xs leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {noteModalJob.notes || noteModalJob.applications?.[0]?.notes ? (
                <button
                  type="button"
                  onClick={() => setNoteText("")}
                  className="text-xs text-red-600 hover:underline cursor-pointer"
                >
                  Rensa text
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalJob(null)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleSaveJobNote}
                  disabled={savingNote}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Spara
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
