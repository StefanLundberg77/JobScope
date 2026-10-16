"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  MapPin,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  Bookmark,
  Check,
  Loader2,
  Filter,
  Globe,
  RefreshCw,
  Layers,
  ArrowUpDown,
  Ban,
  EyeOff,
  RotateCcw,
  Tag,
  X,
  StickyNote,
  Gauge,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { UnifiedJobHit, JobItem } from "@/lib/types";

/**
 * Key used to preserve user filter selections and search hits in sessionStorage.
 */
const SEARCH_SESSION_KEY = "jobscope_search_session_state";

interface SearchSessionCache {
  query: string;
  broadIt: boolean;
  location: "goteborg" | "commute" | "region_14" | "all";
  remoteOnly: boolean;
  source: "all" | "linkedin" | "jobtech";
  sort: "relevance" | "date";
  hideBlocked: boolean;
  excludeWords?: string[];
  hits: UnifiedJobHit[];
  totalHits: number;
}

/**
 * Predefined keywords commonly excluded to filter out senior or lead positions.
 */
const EXCLUDE_PRESETS = ["Senior", "Erfaren", "Lead", "Principal", "Arkitekt"];

/**
 * Predefined geographic search scopes.
 */
const LOCATION_OPTIONS: {
  id: "goteborg" | "commute" | "region_14" | "all";
  label: string;
}[] = [
  { id: "goteborg", label: "Göteborg" },
  { id: "commute", label: "Pendlingsavstånd (Mölndal, Kungälv m.fl.)" },
  { id: "region_14", label: "Västra Götaland" },
  { id: "all", label: "Hela Sverige" },
];

/**
 * Display labels for geographic locations.
 */
const LOCATION_LABELS: Record<string, string> = {
  goteborg: "Göteborg",
  commute: "Pendlingsavstånd",
  region_14: "Västra Götaland",
  all: "Hela Sverige",
};

function getStoredSearchSession(): SearchSessionCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Common preset rejection reasons.
 */
const REASON_PRESETS = [
  "Tror inte jag har en chans",
  "Kräver för hög senioritet / saknar krav",
  "Fel roll / ej intressant teknikstack",
  "Otydlig profil eller dåliga villkor",
];

/**
 * Common preset quick-snippets for personal notes.
 */
const NOTE_SNIPPET_PRESETS = [
  "Kontaktperson: ",
  "Följ upp senast: ",
  "Intervju / dialog: ",
  "Löneanspråk: ",
  "Prioritet: Hög",
];

/**
 * Props for the JobSearchView component.
 */
interface JobSearchViewProps {
  onOpenTailorStudio: (jobId: string) => void;
  onRefreshSavedCount: () => void;
}

/**
 * Predefined quick-filter presets targeting key Swedish IT sectors.
 */
const QUICK_IT_FILTERS = [
  { label: "Alla IT-jobb", query: "", broad: true },
  { label: "GenAI & RAG", query: "GenAI AI RAG", broad: true },
  { label: "Python & AI", query: "Python AI", broad: true },
  { label: "Data Engineering", query: '"Data Engineer" Datamodellering', broad: true },
  { label: "C# / .NET", query: "C# .NET", broad: true },
  { label: "Fullstack", query: "Fullstack", broad: true },
  { label: "Support & Drift", query: "Support Drift", broad: true },
  { label: "DevOps & Cloud", query: "DevOps Cloud", broad: true },
  { label: "Test & QA", query: "Test QA", broad: true },
];

/**
 * Interactive search interface for querying live Swedish IT job postings
 * across Arbetsförmedlingen JobTech Dev API and public LinkedIn guest search.
 */
export function JobSearchView({
  onOpenTailorStudio,
  onRefreshSavedCount,
}: JobSearchViewProps) {
  // Deterministic initial state to match SSR and prevent hydration mismatches
  const [query, setQuery] = useState("");
  const [broadIt, setBroadIt] = useState(true);
  const [location, setLocation] = useState<
    "goteborg" | "commute" | "region_14" | "all"
  >("goteborg");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [source, setSource] = useState<"all" | "linkedin" | "jobtech">("all");
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [hits, setHits] = useState<UnifiedJobHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<Record<string, string>>({}); // externalId -> localDbId
  const [savedJobNotes, setSavedJobNotes] = useState<Record<string, string>>({}); // externalId -> notes
  const [savedMatchScores, setSavedMatchScores] = useState<Record<string, number>>({}); // externalId -> matchScore
  const [savingId, setSavingId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  // Excluded keywords state
  const [excludeWords, setExcludeWords] = useState<string[]>(["Senior", "Erfaren"]);
  const [customExcludeInput, setCustomExcludeInput] = useState("");

  // Blocked job listings state
  const [blockedJobIds, setBlockedJobIds] = useState<Set<string>>(new Set());
  const [hideBlocked, setHideBlocked] = useState(true);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  // Dismiss modal state
  const [dismissModalHit, setDismissModalHit] = useState<UnifiedJobHit | null>(
    null
  );
  const [selectedDismissPreset, setSelectedDismissPreset] = useState(
    REASON_PRESETS[0]
  );
  const [customDismissReason, setCustomDismissReason] = useState("");

  // Note modal state
  const [noteModalHit, setNoteModalHit] = useState<UnifiedJobHit | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Daily scan state
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Collapsible advanced filters panel state
  const [showFilters, setShowFilters] = useState(false);

  // Tracks client session restoration to prevent SSR hydration mismatches
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const hasLoadedInitialFilter = useRef(false);

  // Calculates count of active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (location !== "goteborg") count++;
    if (source !== "all") count++;
    if (!broadIt) count++;
    if (remoteOnly) count++;
    if (!hideBlocked) count++;
    const defaultExcludes = ["senior", "erfaren"];
    const isDefaultExcludes =
      excludeWords.length === 2 &&
      excludeWords.every((w) => defaultExcludes.includes(w.toLowerCase()));
    if (!isDefaultExcludes) count++;
    return count;
  }, [location, source, broadIt, remoteOnly, hideBlocked, excludeWords]);

  // Reset all filters to default baseline
  const handleResetFilters = () => {
    setLocation("goteborg");
    setSource("all");
    setBroadIt(true);
    setRemoteOnly(false);
    setHideBlocked(true);
    setExcludeWords(["Senior", "Erfaren"]);
    handleSearch(
      query,
      "all",
      true,
      sort,
      true,
      "goteborg",
      false,
      ["Senior", "Erfaren"]
    );
  };

  // Search function
  const handleSearch = async (
    overrideQuery?: string,
    overrideSource?: "all" | "linkedin" | "jobtech",
    overrideBroadIt?: boolean,
    overrideSort?: "relevance" | "date",
    overrideHideBlocked?: boolean,
    overrideLocation?: "goteborg" | "commute" | "region_14" | "all",
    overrideRemoteOnly?: boolean,
    overrideExcludeWords?: string[]
  ) => {
    setLoading(true);
    try {
      const q = overrideQuery !== undefined ? overrideQuery : query;
      const s = overrideSource !== undefined ? overrideSource : source;
      const b = overrideBroadIt !== undefined ? overrideBroadIt : broadIt;
      const so = overrideSort !== undefined ? overrideSort : sort;
      const hb = overrideHideBlocked !== undefined ? overrideHideBlocked : hideBlocked;
      const loc = overrideLocation !== undefined ? overrideLocation : location;
      const rem = overrideRemoteOnly !== undefined ? overrideRemoteOnly : remoteOnly;
      const exc = overrideExcludeWords !== undefined ? overrideExcludeWords : excludeWords;
      const params = new URLSearchParams({
        q,
        location: loc,
        remote: rem ? "true" : "false",
        source: s,
        broadIt: b ? "true" : "false",
        sort: so,
        includeBlocked: hb ? "false" : "true",
        limit: "25",
      });
      if (exc.length > 0) {
        params.set("exclude", exc.join(","));
      }

      const res = await fetch(`/api/jobs/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.hits || []);
        setTotalHits(data.total?.value || 0);
        if (data.hits) {
          setSavedJobNotes((prev) => {
            const next = { ...prev };
            data.hits.forEach((h: UnifiedJobHit) => {
              if (h.notes) next[h.id] = h.notes;
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Job search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExcludeWord = (word: string) => {
    const exists = excludeWords.some((w) => w.toLowerCase() === word.toLowerCase());
    const next = exists
      ? excludeWords.filter((w) => w.toLowerCase() !== word.toLowerCase())
      : [...excludeWords, word];
    setExcludeWords(next);
    handleSearch(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next);
  };

  const handleAddCustomExclude = () => {
    const trimmed = customExcludeInput.trim();
    if (!trimmed) return;
    if (!excludeWords.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      const next = [...excludeWords, trimmed];
      setExcludeWords(next);
      handleSearch(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next);
    }
    setCustomExcludeInput("");
  };

  const removeExcludeWord = (word: string) => {
    const next = excludeWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
    setExcludeWords(next);
    handleSearch(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next);
  };

  // Restore session from sessionStorage on client mount (safe from SSR hydration mismatch)
  useEffect(() => {
    // Background load of saved and blocked jobs
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((jobs: JobItem[]) => {
        const idMap: Record<string, string> = {};
        const noteMap: Record<string, string> = {};
        const scoreMap: Record<string, number> = {};
        jobs.forEach((j) => {
          if (j.externalId && j.status !== "dismissed") {
            idMap[j.externalId] = j.id;
            if (j.notes) noteMap[j.externalId] = j.notes;
            if (j.matchScore !== null && j.matchScore !== undefined) {
              scoreMap[j.externalId] = j.matchScore;
            }
          }
        });
        setSavedJobIds(idMap);
        setSavedJobNotes((prev) => ({ ...noteMap, ...prev }));
        setSavedMatchScores((prev) => ({ ...scoreMap, ...prev }));
      })
      .catch(() => {});

    fetch("/api/jobs/blocked")
      .then((r) => r.json())
      .then((data: { blocked?: { externalId: string }[] }) => {
        if (data.blocked) {
          setBlockedJobIds(new Set(data.blocked.map((b) => b.externalId)));
        }
      })
      .catch(() => {});

    const cached = getStoredSearchSession();
    if (cached) {
      if (cached.query !== undefined) setQuery(cached.query);
      if (cached.broadIt !== undefined) setBroadIt(cached.broadIt);
      if (cached.location !== undefined) setLocation(cached.location);
      if (cached.remoteOnly !== undefined) setRemoteOnly(cached.remoteOnly);
      if (cached.source !== undefined) setSource(cached.source);
      if (cached.sort !== undefined) setSort(cached.sort);
      if (cached.hideBlocked !== undefined) setHideBlocked(cached.hideBlocked);
      if (cached.excludeWords !== undefined) setExcludeWords(cached.excludeWords);
      if (cached.hits && cached.hits.length > 0) {
        setHits(cached.hits);
        setTotalHits(cached.totalHits || 0);
      } else {
        handleSearch(
          cached.query,
          cached.source,
          cached.broadIt,
          cached.sort,
          cached.hideBlocked,
          cached.location,
          cached.remoteOnly,
          cached.excludeWords
        );
      }
    } else {
      handleSearch();
    }
    setIsSessionRestored(true);
  }, []);

  // Filter change trigger (runs only after initial session restore)
  useEffect(() => {
    if (!isSessionRestored) return;
    if (!hasLoadedInitialFilter.current) {
      hasLoadedInitialFilter.current = true;
      return;
    }
    handleSearch();
  }, [location, remoteOnly, source, broadIt, sort, hideBlocked, excludeWords]);

  // Sync session state to sessionStorage once restored
  useEffect(() => {
    if (!isSessionRestored || typeof window === "undefined") return;
    try {
      const sessionData: SearchSessionCache = {
        query,
        broadIt,
        location,
        remoteOnly,
        source,
        sort,
        hideBlocked,
        excludeWords,
        hits,
        totalHits,
      };
      sessionStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify(sessionData));
    } catch {
      // Ignore quota errors
    }
  }, [isSessionRestored, query, broadIt, location, remoteOnly, source, sort, hideBlocked, hits, totalHits]);

  // Open dismiss modal
  const handleOpenDismissModal = (hit: UnifiedJobHit) => {
    setDismissModalHit(hit);
    setSelectedDismissPreset(REASON_PRESETS[0]);
    setCustomDismissReason("");
  };

  // Confirm dismissal
  const handleConfirmDismiss = async () => {
    if (!dismissModalHit) return;
    const finalReason = customDismissReason.trim() || selectedDismissPreset || null;
    await handleDismissJob(dismissModalHit, finalReason);
  };

  // Dismiss / block job
  const handleDismissJob = async (hit: UnifiedJobHit, reason: string | null) => {
    setBlockingId(hit.id);
    const municipality =
      hit.workplace_address?.municipality ||
      hit.workplace_address?.city ||
      "Sverige";

    try {
      const res = await fetch("/api/jobs/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: hit.id,
          title: hit.headline,
          company: hit.employer.name,
          location: municipality,
          url: hit.application_details?.url || hit.webpage_url,
          source: hit.source,
          description: hit.description?.text,
          reason,
        }),
      });

      if (res.ok) {
        setBlockedJobIds((prev) => new Set(prev).add(hit.id));
        setSavedJobIds((prev) => {
          const next = { ...prev };
          delete next[hit.id];
          return next;
        });
        onRefreshSavedCount();

        if (hideBlocked) {
          setHits((prev) => prev.filter((h) => h.id !== hit.id));
          setTotalHits((prev) => Math.max(0, prev - 1));
        } else {
          setHits((prev) =>
            prev.map((h) =>
              h.id === hit.id
                ? { ...h, isBlocked: true, dismissReason: reason }
                : h
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to dismiss job:", err);
    } finally {
      setBlockingId(null);
      setDismissModalHit(null);
    }
  };

  // Unblock job
  const handleUnblockJob = async (hit: UnifiedJobHit) => {
    setBlockingId(hit.id);
    try {
      const res = await fetch(
        `/api/jobs/blocked?externalId=${encodeURIComponent(hit.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setBlockedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(hit.id);
          return next;
        });
        setHits((prev) =>
          prev.map((h) =>
            h.id === hit.id ? { ...h, isBlocked: false, dismissReason: null } : h
          )
        );
        onRefreshSavedCount();
      }
    } catch (err) {
      console.error("Failed to unblock job:", err);
    } finally {
      setBlockingId(null);
    }
  };

  // Block or unblock job toggle
  const handleToggleBlock = async (hit: UnifiedJobHit) => {
    const isCurrentlyBlocked = blockedJobIds.has(hit.id) || Boolean(hit.isBlocked);
    if (isCurrentlyBlocked) {
      await handleUnblockJob(hit);
    } else {
      handleOpenDismissModal(hit);
    }
  };

  // Core helper to persist job record to SQLite, optionally triggering ATS match
  const saveJobRecord = async (hit: UnifiedJobHit, runMatchAnalysis = false): Promise<JobItem | null> => {
    const municipality =
      hit.workplace_address?.municipality ||
      hit.workplace_address?.city ||
      "Göteborg";

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId: hit.id,
        url: hit.application_details?.url || hit.webpage_url,
        runMatchAnalysis,
        fallbackData: {
          title: hit.headline,
          company: hit.employer.name,
          location: municipality,
          workplaceType: hit.workplace_model || "onsite",
          description: hit.description?.text,
          publishedAt: hit.publication_date,
          deadline: hit.application_deadline,
        },
      }),
    });

    if (res.ok) {
      const saved: JobItem = await res.json();
      setSavedJobIds((prev) => ({ ...prev, [hit.id]: saved.id }));
      if (saved.matchScore !== null && saved.matchScore !== undefined) {
        setSavedMatchScores((prev) => ({ ...prev, [hit.id]: saved.matchScore! }));
      }
      onRefreshSavedCount();
      return saved;
    }
    return null;
  };

  // 1. Spara: Adds job to applications database WITHOUT any AI call (0 tokens)
  const handleSaveJob = async (hit: UnifiedJobHit) => {
    if (savedJobIds[hit.id]) return; // Already saved
    setSavingId(hit.id);
    try {
      await saveJobRecord(hit, false);
    } catch (err) {
      console.error("Failed to save job:", err);
    } finally {
      setSavingId(null);
    }
  };

  // 2. Matchning: Runs ATS match analysis via Gemini and stores score/analysis
  const handleRunMatch = async (hit: UnifiedJobHit) => {
    setMatchingId(hit.id);
    try {
      const existingId = savedJobIds[hit.id];
      if (existingId) {
        // Already in database, trigger on-demand match endpoint
        const res = await fetch(`/api/jobs/${existingId}/match`, {
          method: "POST",
        });
        if (res.ok) {
          const updated: JobItem = await res.json();
          if (updated.matchScore !== null && updated.matchScore !== undefined) {
            setSavedMatchScores((prev) => ({ ...prev, [hit.id]: updated.matchScore! }));
          }
          onRefreshSavedCount();
        }
      } else {
        // Not yet saved, save with runMatchAnalysis: true
        await saveJobRecord(hit, true);
      }
    } catch (err) {
      console.error("Failed to run ATS match:", err);
    } finally {
      setMatchingId(null);
    }
  };

  // 3. Optimera: Saves job without previous ATS analysis and opens TailorStudio directly
  const handleOptimizeJob = async (hit: UnifiedJobHit) => {
    setSavingId(hit.id);
    try {
      const existingId = savedJobIds[hit.id];
      if (existingId) {
        onOpenTailorStudio(existingId);
        return;
      }

      // Save without running match analysis (TailorStudio will handle full optimization)
      const saved = await saveJobRecord(hit, false);
      if (saved) {
        onOpenTailorStudio(saved.id);
      }
    } catch (err) {
      console.error("Failed to optimize job:", err);
    } finally {
      setSavingId(null);
    }
  };

  // Open note modal for a specific job hit
  const handleOpenNoteModal = (hit: UnifiedJobHit) => {
    setNoteModalHit(hit);
    setCurrentNoteText(savedJobNotes[hit.id] || hit.notes || "");
  };

  // Save personal note for job listing
  const handleSaveNote = async () => {
    if (!noteModalHit) return;
    setSavingNote(true);
    try {
      const noteToSave = currentNoteText.trim();
      const existingJobId = savedJobIds[noteModalHit.id];

      if (existingJobId) {
        const res = await fetch(`/api/jobs/${existingJobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: noteToSave || null }),
        });
        if (res.ok) {
          setSavedJobNotes((prev) => {
            const next = { ...prev };
            if (noteToSave) next[noteModalHit.id] = noteToSave;
            else delete next[noteModalHit.id];
            return next;
          });
          setHits((prev) =>
            prev.map((h) =>
              h.id === noteModalHit.id ? { ...h, notes: noteToSave || null } : h
            )
          );
        }
      } else {
        const municipality =
          noteModalHit.workplace_address?.municipality ||
          noteModalHit.workplace_address?.city ||
          "Göteborg";

        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: noteModalHit.id,
            url: noteModalHit.application_details?.url || noteModalHit.webpage_url,
            notes: noteToSave || null,
            fallbackData: {
              title: noteModalHit.headline,
              company: noteModalHit.employer.name,
              location: municipality,
              workplaceType: noteModalHit.workplace_model || "onsite",
              description: noteModalHit.description?.text,
              publishedAt: noteModalHit.publication_date,
              deadline: noteModalHit.application_deadline,
            },
          }),
        });
        if (res.ok) {
          const saved: JobItem = await res.json();
          setSavedJobIds((prev) => ({ ...prev, [noteModalHit.id]: saved.id }));
          setSavedJobNotes((prev) => {
            const next = { ...prev };
            if (noteToSave) next[noteModalHit.id] = noteToSave;
            return next;
          });
          setHits((prev) =>
            prev.map((h) =>
              h.id === noteModalHit.id
                ? { ...h, notes: noteToSave || null, savedStatus: "saved" }
                : h
            )
          );
          onRefreshSavedCount();
        }
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
      setNoteModalHit(null);
    }
  };

  // Trigger automated scan
  const handleTriggerScan = async () => {
    setScanning(true);
    setScanMessage("Kör automatisk sökning & ATS-analys på LinkedIn & JobTech...");
    try {
      const res = await fetch("/api/jobs/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 60 }),
      });

      const data = await res.json();
      if (res.ok) {
        setScanMessage(
          `Klart! Sökte av ${data.scannedTotal} annonser, sparade ${data.savedCount} relevanta i Kanban-tavlan.`
        );
        onRefreshSavedCount();
        handleSearch();
      } else {
        setScanMessage(`Fel: ${data.error || "Kunde inte genomföra sökningen"}`);
      }
    } catch (err) {
      console.error("Daily scan error:", err);
      setScanMessage("Nätverksfel vid automatisk sökning");
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 8000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Search Bar & Filters Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök IT-jobb (lämna tomt för alla IT-roller, eller t.ex. C#, Python, Support, DevOps)..."
              className="w-full rounded-xl border border-neutral-300 pl-10 pr-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  handleSearch("");
                }}
                className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                title="Rensa sökfält"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                showFilters || activeFilterCount > 0
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                  : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
              title={showFilters ? "Dölj filter" : "Visa filter"}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${
                  showFilters ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Primary Search Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Sök annonser</span>
            </button>
          </div>
        </form>

        {/* Quick IT Focus Chips */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-neutral-400 mr-1 flex items-center gap-1 shrink-0">
              <Sparkles className="h-3 w-3 text-blue-500" /> Snabbval:
            </span>
            {QUICK_IT_FILTERS.map((f) => {
              const isCurrent = query === f.query && (f.broad === undefined || broadIt === f.broad);
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    setQuery(f.query);
                    if (f.broad !== undefined) setBroadIt(f.broad);
                    handleSearch(f.query, undefined, f.broad ?? broadIt);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-2xs font-semibold"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Quick Active Scope Indicator (Location + Remote) */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Klicka för att ändra sökområde i filterpanelen"
            >
              <MapPin className="h-3 w-3 text-neutral-400" />
              <span>{LOCATION_LABELS[location] || location}</span>
            </button>
            {remoteOnly && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Globe className="h-3 w-3" />
                <span>+ Distans</span>
              </span>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
            {/* Drawer Header with Title and Reset */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" />
                Anpassa filter
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title="Återställ alla filter till standardinställningar"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Återställ standardfilter</span>
              </button>
            </div>

            {/* 1. Område (Location) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:w-24 shrink-0">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" /> Område:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {LOCATION_OPTIONS.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setLocation(loc.id);
                      handleSearch(undefined, undefined, undefined, undefined, undefined, loc.id);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      location === loc.id
                        ? "bg-blue-600 text-white shadow-2xs font-semibold"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Källa (Source) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:w-24 shrink-0">
                <Layers className="h-3.5 w-3.5 text-neutral-400" /> Källa:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSource("all");
                    handleSearch(undefined, "all");
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    source === "all"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs font-semibold"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  Alla källor (JobTech + LinkedIn)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSource("linkedin");
                    handleSearch(undefined, "linkedin");
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    source === "linkedin"
                      ? "bg-blue-600 text-white shadow-2xs font-semibold"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  LinkedIn (Offentlig)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSource("jobtech");
                    handleSearch(undefined, "jobtech");
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    source === "jobtech"
                      ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Arbetsförmedlingen
                </button>
              </div>
            </div>

            {/* 3. Alternativ & Växlar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:w-24 shrink-0">
                <Globe className="h-3.5 w-3.5 text-neutral-400" /> Alternativ:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                    broadIt
                      ? "bg-blue-50/90 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 shadow-2xs"
                      : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={broadIt}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setBroadIt(val);
                      handleSearch(undefined, undefined, val);
                    }}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>Bred Data/IT-sökning</span>
                </label>

                <label
                  className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                    remoteOnly
                      ? "bg-blue-50/90 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 shadow-2xs"
                      : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                  }`}
                  title="Visar vanliga jobb på vald ort samt distansjobb från hela landet"
                >
                  <input
                    type="checkbox"
                    checked={remoteOnly}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setRemoteOnly(val);
                      handleSearch(undefined, undefined, undefined, undefined, undefined, undefined, val);
                    }}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <Globe className="h-3.5 w-3.5 text-blue-500" />
                  <span>Inkludera distans</span>
                </label>

                <label
                  className={`flex items-center gap-1.5 cursor-pointer text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                    hideBlocked
                      ? "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hideBlocked}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setHideBlocked(val);
                      handleSearch(undefined, undefined, undefined, undefined, val);
                    }}
                    className="rounded border-neutral-300 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                  />
                  <Ban className="h-3.5 w-3.5 text-red-500" />
                  <span>
                    Dölj blockerade {blockedJobIds.size > 0 && `(${blockedJobIds.size})`}
                  </span>
                </label>
              </div>
            </div>

            {/* 4. Exkludera nyckelord */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:w-24 shrink-0 pt-1">
                <Ban className="h-3.5 w-3.5 text-red-500" /> Exkludera:
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {/* Predefined toggles */}
                {EXCLUDE_PRESETS.map((preset) => {
                  const isExcluded = excludeWords.some(
                    (w) => w.toLowerCase() === preset.toLowerCase()
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => toggleExcludeWord(preset)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isExcluded
                          ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 shadow-2xs"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      }`}
                      title={isExcluded ? `Klicka för att tillåta ${preset}` : `Klicka för att exkludera ${preset}`}
                    >
                      <span>{preset}</span>
                      {isExcluded && <X className="h-3 w-3 text-red-500" />}
                    </button>
                  );
                })}

                {/* Custom exclusion chips */}
                {excludeWords
                  .filter(
                    (w) => !EXCLUDE_PRESETS.some((p) => p.toLowerCase() === w.toLowerCase())
                  )
                  .map((word) => (
                    <span
                      key={word}
                      className="flex items-center gap-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 px-2.5 py-1 text-xs font-medium shadow-2xs"
                    >
                      <span>{word}</span>
                      <button
                        type="button"
                        onClick={() => removeExcludeWord(word)}
                        className="hover:text-red-900 dark:hover:text-red-100 cursor-pointer"
                        title={`Ta bort exkludering av ${word}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                {/* Free text input for adding custom exclusion keyword */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customExcludeInput}
                    onChange={(e) => setCustomExcludeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomExclude();
                      }
                    }}
                    placeholder="+ Fritext (t.ex. trainee)..."
                    className="w-40 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:border-red-500 focus:outline-none"
                  />
                  {customExcludeInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustomExclude}
                      className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 cursor-pointer shadow-2xs"
                    >
                      Lägg till
                    </button>
                  )}
                </div>

                {excludeWords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setExcludeWords([]);
                      handleSearch(undefined, undefined, undefined, undefined, undefined, undefined, undefined, []);
                    }}
                    className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline cursor-pointer"
                  >
                    Rensa alla
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scan Message Notification */}
      {scanMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-xs font-medium text-blue-900 shadow-2xs dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <Sparkles className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Hittade annonser ({totalHits})
          </h2>
          <span className="text-xs text-neutral-400">
            • {LOCATION_LABELS[location] || location} •{" "}
            {source === "all"
              ? "LinkedIn + Arbetsförmedlingen"
              : source === "linkedin"
              ? "LinkedIn"
              : "Arbetsförmedlingen"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {/* Daily Scan Button */}
          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={scanning}
            title="Kör automatisk sökning mot LinkedIn & JobTech och spara matcher med AI i Kanban"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800/80 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span>Kör daglig bevakning</span>
          </button>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </span>
            <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setSort("relevance");
                  handleSearch(undefined, undefined, undefined, "relevance");
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  sort === "relevance"
                    ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-700 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                Relevans
              </button>
              <button
                type="button"
                onClick={() => {
                  setSort("date");
                  handleSearch(undefined, undefined, undefined, "date");
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  sort === "date"
                    ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-700 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                Nyast först
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-neutral-700">
          Inga jobbannonser matchade sökningen. Prova en annan sökfras eller bredda området/källan.
        </div>
      ) : (
        <div className="space-y-4">
          {hits.map((hit) => {
            const isSaved = Boolean(savedJobIds[hit.id]);
            const isSaving = savingId === hit.id;
            const isMatching = matchingId === hit.id;
            const score = savedMatchScores[hit.id];
            const hasScore = score !== undefined && score !== null;
            const isBlocked = blockedJobIds.has(hit.id) || Boolean(hit.isBlocked);
            const isBlocking = blockingId === hit.id;
            const municipality =
              hit.workplace_address?.municipality ||
              hit.workplace_address?.city ||
              "Sverige";

            const mustHaveSkills = hit.must_have?.skills?.map((s) => s.label) || [];
            const niceHaveSkills = hit.nice_to_have?.skills?.map((s) => s.label) || [];
            const isLinkedIn = hit.source === "linkedin";

            return (
              <div
                key={hit.id}
                className={`group relative rounded-xl border p-5 shadow-sm transition-all ${
                  isBlocked
                    ? "border-slate-300 bg-slate-50/50 opacity-75 hover:opacity-100 dark:border-slate-800 dark:bg-slate-900/40"
                    : isSaved
                    ? "border-emerald-200 bg-emerald-50/20 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/40 dark:bg-emerald-950/10"
                    : "border-neutral-200 bg-white hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isLinkedIn ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          LinkedIn
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          JobTech
                        </span>
                      )}
                      <span className="text-xs text-neutral-400">
                        {hit.publication_date ? new Date(hit.publication_date).toLocaleDateString("sv-SE") : ""}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {hit.headline}
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
                        <Building className="h-3.5 w-3.5 text-neutral-400" />
                        {hit.employer.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                        {municipality}
                      </span>
                      {hit.workplace_model === "remote" && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800 dark:bg-green-950/60 dark:text-green-300">
                          Distans
                        </span>
                      )}
                      {hit.workplace_model === "hybrid" && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                          Hybrid
                        </span>
                      )}
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <Tag className="h-3 w-3 text-slate-500" />
                          Inaktuell{hit.dismissReason ? `: ${hit.dismissReason}` : ""}
                        </span>
                      ) : isSaved ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <Check className="h-3 w-3" />
                          Sparad i Kanban
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                          Ny annons
                        </span>
                      )}
                      {hit.application_deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          Sista dag:{" "}
                          {new Date(hit.application_deadline).toLocaleDateString(
                            "sv-SE"
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Block / Dismiss button */}
                    {isBlocked ? (
                      <button
                        onClick={() => handleUnblockJob(hit)}
                        disabled={isBlocking}
                        title="Häv blockering och återaktivera till sparade"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-300"
                      >
                        {isBlocking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        Återaktivera
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenDismissModal(hit)}
                          disabled={isBlocking}
                          title="Markera som inaktuell (vill inte söka)"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-neutral-700 dark:text-neutral-500 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-all"
                        >
                          {isBlocking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>

                        {/* Note button */}
                        <button
                          onClick={() => handleOpenNoteModal(hit)}
                          title="Anteckningar"
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                            savedJobNotes[hit.id]
                              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>

                        {/* 1. Spara button */}
                        <button
                          onClick={() => handleSaveJob(hit)}
                          disabled={isSaving}
                          title={isSaved ? "Sparad i dina ansökningar" : "Spara till ansökningar (utan AI-anrop)"}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            isSaved
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isSaved ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                          <span>{isSaved ? "Sparad" : "Spara"}</span>
                        </button>

                        {/* 2. Matchning (ATS) button */}
                        <button
                          onClick={() => handleRunMatch(hit)}
                          disabled={isMatching}
                          title="Kör ATS-matchningsanalys med Gemini och spara till ansökningar"
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                            hasScore
                              ? score >= 75
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold"
                                : score >= 50
                                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold"
                              : "border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {isMatching ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                              <span>Matchar...</span>
                            </>
                          ) : hasScore ? (
                            <>
                              <Gauge className="h-3.5 w-3.5 shrink-0" />
                              <span>{score}% Match</span>
                            </>
                          ) : (
                            <>
                              <Gauge className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                              <span>Matchning</span>
                            </>
                          )}
                        </button>

                        {/* 3. Optimera button */}
                        <button
                          onClick={() => handleOptimizeJob(hit)}
                          disabled={isSaving || isMatching}
                          title="Öppna optimeringsläget direkt för att skräddarsy CV och brev"
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-blue-700 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Optimera</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>



                {/* Brief description snippet */}
                {hit.description?.text && (
                  <p className="mt-3 text-xs leading-relaxed text-neutral-600 line-clamp-2 dark:text-neutral-400">
                    {hit.description.text}
                  </p>
                )}

                {/* Skills tags */}
                {(mustHaveSkills.length > 0 || niceHaveSkills.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mustHaveSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      >
                        {s}
                      </span>
                    ))}
                    {niceHaveSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      >
                        + {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Links */}
                {(hit.application_details?.url || hit.webpage_url) && (
                  <div className="mt-3 pt-2 border-t border-neutral-100 flex justify-end dark:border-neutral-800">
                    <a
                      href={hit.application_details?.url || hit.webpage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Öppna originalannons <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dismiss Reason Modal Dialog */}
      {dismissModalHit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Markera som inaktuell
                </h3>
                <p className="text-xs text-neutral-500 truncate max-w-[280px]">
                  {dismissModalHit.headline} ({dismissModalHit.employer.name})
                </p>
              </div>
              <button
                onClick={() => setDismissModalHit(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              Välj varför du inte vill söka jobbet. Annonsen sparas till Kanban under{" "}
              <strong>Inaktuella</strong> och blockeras automatiskt från framtida sökningar.
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
                      setSelectedDismissPreset(preset);
                      setCustomDismissReason("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedDismissPreset === preset && !customDismissReason
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
                value={customDismissReason}
                onChange={(e) => setCustomDismissReason(e.target.value)}
                placeholder="T.ex. Inte relevant för min inriktning..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setDismissModalHit(null)}
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
      {noteModalHit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Anteckningar
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 truncate max-w-[340px] mt-0.5">
                  {noteModalHit.headline} ({noteModalHit.employer.name})
                </p>
              </div>
              <button
                onClick={() => setNoteModalHit(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              Skriv egna anteckningar för denna annons (t.ex. intryck, kontaktperson, lön eller datum för uppföljning).
              {!savedJobIds[noteModalHit.id] && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400 font-medium">
                  När du sparar anteckningen läggs annonsen automatiskt till i dina sparade jobb i Kanban.
                </span>
              )}
            </p>

            {/* Preset helper chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {NOTE_SNIPPET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCurrentNoteText((prev) => (prev ? `${prev}\n${preset}` : preset));
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
                value={currentNoteText}
                onChange={(e) => setCurrentNoteText(e.target.value)}
                placeholder="Skriv dina anteckningar här..."
                className="w-full rounded-xl border border-neutral-300 p-3 text-xs leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {savedJobNotes[noteModalHit.id] ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentNoteText("");
                  }}
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
                  onClick={() => setNoteModalHit(null)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
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
