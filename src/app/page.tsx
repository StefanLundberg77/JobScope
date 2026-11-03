"use client";

import React, { useState, useEffect } from "react";
import { Navbar, TabType } from "@/components/Navbar";
import { JobSearchView } from "@/components/JobSearchView";
import { CustomJobModal } from "@/components/CustomJobModal";
import { TrackerView } from "@/components/TrackerView";
import { MasterProfileView } from "@/components/MasterProfileView";
import { SettingsView } from "@/components/SettingsView";
import { TailorStudio } from "@/components/TailorStudio";
import { JobItem } from "@/lib/types";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Main dashboard coordinator for the JobScope web application.
 * Manages active navigation tabs ('search', 'import', 'tracker', 'studio', 'profile', 'settings'),
 * drill-down state for the TailorStudio, and global saved jobs count synchronization.
 */
export default function Home() {
  const [currentTab, setCurrentTab] = useState<TabType>("search");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [lastActiveJobId, setLastActiveJobId] = useState<string | null>(null);
  const [autoOptimize, setAutoOptimize] = useState<boolean>(false);
  const [savedCount, setSavedCount] = useState<number>(0);

  /**
   * Refreshes the total count of saved jobs from the backend to keep badge counters current.
   * If lastActiveJobId is not set, automatically selects the most recently updated active job.
   */
  const fetchSavedCount = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const jobs: JobItem[] = await res.json();
        const activeJobs = jobs.filter((j) => j.status !== "dismissed");
        setSavedCount(activeJobs.length);

        setLastActiveJobId((prev) => {
          if (prev) return prev;
          if (activeJobs.length > 0) {
            return activeJobs[0].id;
          }
          return null;
        });
      }
    } catch (err) {
      console.error("Failed to fetch jobs count:", err);
    }
  };

  useEffect(() => {
    try {
      const storedLastId = localStorage.getItem("jobscope_last_job_id");
      if (storedLastId) {
        setLastActiveJobId(storedLastId);
      }
    } catch {
      // Ignore localStorage read errors
    }
    fetchSavedCount();
  }, []);

  const handleSelectTab = (tab: TabType) => {
    if (tab === "studio") {
      // If no job currently selected, restore the last active job
      const targetJobId = selectedJobId || lastActiveJobId;
      if (targetJobId) {
        setSelectedJobId(targetJobId);
      }
      setAutoOptimize(false);
      setCurrentTab("studio");
      return;
    }

    // When leaving studio to check another view (e.g. Master-CV or Jobbsök),
    // remember the active job so the user can easily return via the "CV-studion" tab!
    setAutoOptimize(false);
    setCurrentTab(tab);
  };

  const handleOpenTailorStudio = (jobId: string, shouldAutoOptimize = false) => {
    setSelectedJobId(jobId);
    setLastActiveJobId(jobId);
    setAutoOptimize(shouldAutoOptimize);
    setCurrentTab("studio");
    try {
      localStorage.setItem("jobscope_last_job_id", jobId);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const handleJobSaved = (job: JobItem) => {
    fetchSavedCount();
    handleOpenTailorStudio(job.id, false);
  };

  const handleStudioBack = () => {
    setCurrentTab("tracker");
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        savedCount={savedCount}
        hasActiveStudioJob={Boolean(selectedJobId || lastActiveJobId)}
      />

      <main
        className={`mx-auto ${
          currentTab === "tracker"
            ? "max-w-[1600px]"
            : "max-w-7xl"
        } px-4 py-8 sm:px-6 lg:px-8 transition-all duration-200`}
      >
        {currentTab === "studio" && (
          selectedJobId ? (
            <TailorStudio
              jobId={selectedJobId}
              autoOptimize={autoOptimize}
              onBack={handleStudioBack}
              onJobUpdated={fetchSavedCount}
            />
          ) : (
            <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Ingen aktiv ansökan i CV-studion
              </h2>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                Välj en sparad annons från dina ansökningar eller sök efter nya jobb för att börja skräddarsy ditt CV och personliga brev.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setCurrentTab("search")}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <span>Sök jobb</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setCurrentTab("tracker")}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 transition-colors cursor-pointer"
                >
                  <span>Öppna Ansökningar</span>
                </button>
              </div>
            </div>
          )
        )}

        {currentTab === "search" && (
          <JobSearchView
            onOpenTailorStudio={handleOpenTailorStudio}
            onRefreshSavedCount={fetchSavedCount}
          />
        )}

        {currentTab === "import" && (
          <CustomJobModal onJobSaved={handleJobSaved} />
        )}

        {currentTab === "tracker" && (
          <TrackerView
            onOpenTailorStudio={handleOpenTailorStudio}
            onRefreshSavedCount={fetchSavedCount}
          />
        )}

        {currentTab === "profile" && <MasterProfileView />}

        {currentTab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
