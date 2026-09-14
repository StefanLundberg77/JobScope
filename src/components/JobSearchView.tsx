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
} from "lucide-react";
import { JobTechHit } from "@/lib/jobtech";
import { JobItem } from "@/lib/types";

interface JobSearchViewProps {
  onOpenTailorStudio: (jobId: string) => void;
  onRefreshSavedCount: () => void;
}

export function JobSearchView({
  onOpenTailorStudio,
  onRefreshSavedCount,
}: JobSearchViewProps) {
  const [query, setQuery] = useState("Fullstack");
  const [location, setLocation] = useState<
    "goteborg" | "commute" | "region_14" | "all"
  >("goteborg");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [hits, setHits] = useState<JobTechHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<Record<string, string>>({}); // externalId -> localDbId
  const [savingId, setSavingId] = useState<string | null>(null);

  // Search function
  const handleSearch = async (overrideQuery?: string) => {
    setLoading(true);
    try {
      const q = overrideQuery !== undefined ? overrideQuery : query;
      const params = new URLSearchParams({
        q,
        location,
        remote: remoteOnly ? "true" : "false",
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
  }, [location, remoteOnly]);

  // Save job and optionally navigate to tailor studio
  const handleSaveJob = async (hit: JobTechHit, openStudio = false) => {
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
        body: JSON.stringify({ externalId: hit.id }),
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
              placeholder="Sök jobb (t.ex. Fullstack, Frontend, React, Python)..."
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
        </form>

        {/* Location & Remote Filter Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
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
            Pendlingsavstånd (Mölndal, Kungälv, Kungsbacka m.fl.)
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

          <label className="ml-auto flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <Globe className="h-3.5 w-3.5 text-blue-500" />
            Endast Distans / Remote
          </label>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Hittade annonser ({totalHits})
        </h2>
        <span className="text-xs text-neutral-400">
          Källa: Arbetsförmedlingen JobTech API
        </span>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : hits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-neutral-700">
          Inga jobbannonser matchade sökningen. Prova en annan sökfras eller bredda området.
        </div>
      ) : (
        <div className="space-y-4">
          {hits.map((hit) => {
            const isSaved = Boolean(savedJobIds[hit.id]);
            const isSaving = savingId === hit.id;
            const municipality =
              hit.workplace_address?.municipality ||
              hit.workplace_address?.city ||
              "Sverige";

            const mustHaveSkills = hit.must_have?.skills?.map((s) => s.label) || [];
            const niceHaveSkills = hit.nice_to_have?.skills?.map((s) => s.label) || [];

            return (
              <div
                key={hit.id}
                className="group relative rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
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
                    <button
                      onClick={() => handleSaveJob(hit, false)}
                      disabled={isSaving}
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

                    <button
                      onClick={() => handleSaveJob(hit, true)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Optimera CV & Brev
                    </button>
                  </div>
                </div>

                {/* Brief description snippet */}
                <p className="mt-3 text-xs leading-relaxed text-neutral-600 line-clamp-2 dark:text-neutral-400">
                  {hit.description?.text || "Ingen beskrivning tillgänglig."}
                </p>

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
