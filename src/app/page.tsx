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

export default function Home() {
  const [currentTab, setCurrentTab] = useState<TabType>("search");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number>(0);

  const fetchSavedCount = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const jobs: JobItem[] = await res.json();
        setSavedCount(jobs.length);
      }
    } catch (err) {
      console.error("Failed to fetch jobs count:", err);
    }
  };

  useEffect(() => {
    fetchSavedCount();
  }, []);

  const handleSelectTab = (tab: TabType) => {
    setSelectedJobId(null);
    setCurrentTab(tab);
  };

  const handleOpenTailorStudio = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleJobSaved = (job: JobItem) => {
    fetchSavedCount();
    setSelectedJobId(job.id);
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        savedCount={savedCount}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {selectedJobId ? (
          <TailorStudio
            jobId={selectedJobId}
            onBack={() => setSelectedJobId(null)}
            onJobUpdated={fetchSavedCount}
          />
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
