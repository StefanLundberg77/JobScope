"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { UnifiedJobHit, JobItem } from "@/lib/types";

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
  const [savingId, setSavingId] = useState<string | null>(null);

  // Blocked job listings state
  const [blockedJobIds, setBlockedJobIds] = useState<Set<string>>(new Set());
  const [hideBlocked, setHideBlocked] = useState(true);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  // Daily scan state
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Search function
  const handleSearch = async (
    overrideQuery?: string,
    overrideSource?: "all" | "linkedin" | "jobtech",
    overrideBroadIt?: boolean,
    overrideSort?: "relevance" | "date",
    overrideHideBlocked?: boolean
  ) => {
    setLoading(true);
    try {
      const q = overrideQuery !== undefined ? overrideQuery : query;
      const s = overrideSource !== undefined ? overrideSource : source;
      const b = overrideBroadIt !== undefined ? overrideBroadIt : broadIt;
      const so = overrideSort !== undefined ? overrideSort : sort;
      const hb = overrideHideBlocked !== undefined ? overrideHideBlocked : hideBlocked;
      const params = new URLSearchParams({
        q,
        location,
        remote: remoteOnly ? "true" : "false",
        source: s,
        broadIt: b ? "true" : "false",
        sort: so,
        includeBlocked: hb ? "false" : "true",
        limit: "25",
      });

      const res = await fetch(`/api/jobs/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHits(data.hits || []);
        setTotalHits(data.total?.value || 0);
      }
    } catch (err) {
      console.error("Job search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    handleSearch();
    // Also load already saved jobs to show bookmark state
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((jobs: JobItem[]) => {
        const map: Record<string, string> = {};
        jobs.forEach((j) => {
          if (j.externalId) map[j.externalId] = j.id;
        });
        setSavedJobIds(map);
      })
      .catch(() => {});

    // Load blocked jobs
    fetch("/api/jobs/blocked")
      .then((r) => r.json())
      .then((data: { blocked?: { externalId: string }[] }) => {
        if (data.blocked) {
          setBlockedJobIds(new Set(data.blocked.map((b) => b.externalId)));
        }
      })
      .catch(() => {});
  }, [location, remoteOnly, source, broadIt, sort, hideBlocked]);

  // Block or unblock job
  const handleToggleBlock = async (hit: UnifiedJobHit) => {
    setBlockingId(hit.id);
    const isCurrentlyBlocked = blockedJobIds.has(hit.id) || Boolean(hit.isBlocked);

    try {
      if (isCurrentlyBlocked) {
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
            prev.map((h) => (h.id === hit.id ? { ...h, isBlocked: false } : h))
          );
        }
      } else {
        const res = await fetch("/api/jobs/blocked", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: hit.id,
            title: hit.headline,
            company: hit.employer.name,
          }),
        });
        if (res.ok) {
          setBlockedJobIds((prev) => new Set(prev).add(hit.id));
          // If saved, clear its saved badge
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
              prev.map((h) => (h.id === hit.id ? { ...h, isBlocked: true } : h))
            );
          }
        }
      }
    } catch (err) {
      console.error("Failed to toggle block status:", err);
    } finally {
      setBlockingId(null);
    }
  };

  // Save job and optionally navigate to tailor studio
  const handleSaveJob = async (hit: UnifiedJobHit, openStudio = false) => {
    setSavingId(hit.id);
    try {
      // If already saved, just open studio
      if (savedJobIds[hit.id]) {
        if (openStudio) onOpenTailorStudio(savedJobIds[hit.id]);
        return;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: hit.id,
          url: hit.webpage_url,
        }),
      });

      if (res.ok) {
        const saved: JobItem = await res.json();
        setSavedJobIds((prev) => ({ ...prev, [hit.id]: saved.id }));
        onRefreshSavedCount();
        if (openStudio) {
          onOpenTailorStudio(saved.id);
        }
      }
    } catch (err) {
      console.error("Failed to save job:", err);
    } finally {
      setSavingId(null);
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
          `✅ Klart! Sökte av ${data.scannedTotal} annonser, sparade ${data.savedCount} relevanta i Kanban-tavlan.`
        );
        onRefreshSavedCount();
        handleSearch();
      } else {
        setScanMessage(`❌ Fel: ${data.error || "Kunde inte genomföra sökningen"}`);
      }
    } catch (err) {
      console.error("Daily scan error:", err);
      setScanMessage("❌ Nätverksfel vid automatisk sökning");
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 8000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Search Bar & Filters */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök IT-jobb (lämna tomt för alla IT-roller, eller t.ex. C#, Python, Support, DevOps)..."
              className="w-full rounded-xl border border-neutral-300 pl-11 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Sök annonser
          </button>

          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={scanning}
            title="Kör automatisk sökning mot LinkedIn & JobTech och spara matcher med AI i Kanban"
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
            <span className="hidden md:inline">Kör daglig bevakning</span>
          </button>
        </form>

        {/* Quick IT Focus Chips */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-neutral-400 mr-1 flex items-center gap-1">
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
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Scan Message Notification */}
        {scanMessage && (
          <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            {scanMessage}
          </div>
        )}

        {/* Source Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mr-2">
            <Layers className="h-3.5 w-3.5" /> Källa:
          </span>

          <button
            type="button"
            onClick={() => setSource("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              source === "all"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            Alla källor (JobTech + LinkedIn)
          </button>

          <button
            type="button"
            onClick={() => setSource("linkedin")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              source === "linkedin"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            LinkedIn (Offentlig sökning)
          </button>

          <button
            type="button"
            onClick={() => setSource("jobtech")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              source === "jobtech"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Arbetsförmedlingen
          </button>
        </div>

        {/* Location & Remote Filter Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mr-2">
            <Filter className="h-3.5 w-3.5" /> Område:
          </span>

          <button
            type="button"
            onClick={() => setLocation("goteborg")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              location === "goteborg"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            Göteborg
          </button>

          <button
            type="button"
            onClick={() => setLocation("commute")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              location === "commute"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            Pendlingsavstånd (Mölndal, Kungälv m.fl.)
          </button>

          <button
            type="button"
            onClick={() => setLocation("region_14")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              location === "region_14"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            Västra Götaland
          </button>

          <button
            type="button"
            onClick={() => setLocation("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              location === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            Hela Sverige
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
              <input
                type="checkbox"
                checked={broadIt}
                onChange={(e) => {
                  const val = e.target.checked;
                  setBroadIt(val);
                  handleSearch(undefined, undefined, val);
                }}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Bred Data/IT-sökning</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              Distans / Remote
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={hideBlocked}
                onChange={(e) => {
                  const val = e.target.checked;
                  setHideBlocked(val);
                  handleSearch(undefined, undefined, undefined, undefined, val);
                }}
                className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
              />
              <Ban className="h-3.5 w-3.5 text-red-500" />
              <span>
                Dölj blockerade {blockedJobIds.size > 0 && `(${blockedJobIds.size})`}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Hittade annonser ({totalHits})
          </h2>
          <span className="text-xs text-neutral-400">
            {source === "all"
              ? "Källa: LinkedIn (Offentlig) + Arbetsförmedlingen"
              : source === "linkedin"
              ? "Källa: LinkedIn (Offentliga annonser)"
              : "Källa: Arbetsförmedlingen JobTech API"}
          </span>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5" /> Sortera:
          </span>
          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSort("relevance");
                handleSearch(undefined, undefined, undefined, "relevance");
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                sort === "relevance"
                  ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white"
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
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                sort === "date"
                  ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Nyast först
            </button>
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
                    ? "border-red-200 bg-red-50/20 opacity-70 hover:opacity-100 dark:border-red-950 dark:bg-red-950/15"
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
                      {isBlocked && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          Blockerad
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
                    <button
                      onClick={() => handleToggleBlock(hit)}
                      disabled={isBlocking}
                      title={
                        isBlocked
                          ? "Häv blockering (visa i listan igen)"
                          : "Blockera / Dölj annons (t.ex. redan sökt eller ej relevant)"
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                        isBlocked
                          ? "border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-800 dark:bg-red-950/70 dark:text-red-300"
                          : "border-neutral-200 text-neutral-400 hover:border-red-200 hover:bg-red-50/70 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-500 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      }`}
                    >
                      {isBlocking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isBlocked ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Ban className="h-4 w-4" />
                      )}
                    </button>

                    {/* Save button */}
                    <button
                      onClick={() => handleSaveJob(hit, false)}
                      disabled={isSaving || isBlocked}
                      title={isSaved ? "Sparad i din lista" : "Spara annons"}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                        isSaved
                          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSaved ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>

                    {isBlocked ? (
                      <button
                        onClick={() => handleToggleBlock(hit)}
                        disabled={isBlocking}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-neutral-900 dark:text-red-300"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Häv blockering
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSaveJob(hit, true)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Optimera CV & Brev
                      </button>
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
    </div>
  );
}
