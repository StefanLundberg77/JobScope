"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Briefcase,
  MapPin,
  Sliders,
  Sparkles,
  Cpu,
  Zap,
  HardDrive,
  FolderOpen,
  Trash2,
} from "lucide-react";

/**
 * Settings configuration view.
 * Allows managing Gemini API credentials, AI model selection, target job role, geographic search preferences,
 * minimum ATS match scoring threshold, automated background scan parameters, and export storage management.
 */
export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-3.6-flash");
  const [targetRole, setTargetRole] = useState("Systemutvecklare & AI-utvecklare");
  const [targetLocations, setTargetLocations] = useState("Göteborg");
  const [workPreference, setWorkPreference] = useState("any");
  const [broadItSearch, setBroadItSearch] = useState(true);
  const [minScore, setMinScore] = useState(50);
  const [searchKeywords, setSearchKeywords] = useState(
    "AI, GenAI, RAG, Python, C#, .NET, Systemutvecklare, Fullstack, DevOps, Data Engineer, Datamodellering, Unity"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Export storage states
  const [exportStats, setExportStats] = useState<{
    totalFolders: number;
    totalFiles: number;
    totalSizeBytes: number;
    formattedSize: string;
    folders: Array<{
      name: string;
      fileCount: number;
      sizeBytes: number;
      createdAt: string;
    }>;
  } | null>(null);
  const [clearingExports, setClearingExports] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportActionSuccess, setExportActionSuccess] = useState<string | null>(null);
  const [openingExportsFolder, setOpeningExportsFolder] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setApiKey(data.geminiApiKey || "");
          setHasEnvKey(data.hasEnvApiKey || false);
          if (data.aiModel) {
            const mappedModel =
              data.aiModel === "gemini-2.5-flash"
                ? "gemini-3.6-flash"
                : data.aiModel === "gemini-2.5-pro"
                ? "gemini-3.8-flash"
                : data.aiModel === "gemini-3.5-flash"
                ? "gemini-3.6-flash"
                : data.aiModel;
            setAiModel(mappedModel);
          }
          if (data.targetRole) setTargetRole(data.targetRole);
          if (data.targetLocations) setTargetLocations(data.targetLocations);
          if (data.workPreference) setWorkPreference(data.workPreference);
          if (data.broadItSearch !== undefined) setBroadItSearch(data.broadItSearch);
          if (data.minScore !== undefined) setMinScore(data.minScore);
          if (data.searchKeywords) setSearchKeywords(data.searchKeywords);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }

    async function loadExportStats() {
      try {
        const res = await fetch("/api/exports");
        if (res.ok) {
          const data = await res.json();
          setExportStats(data);
        }
      } catch (err) {
        console.error("Failed to load export stats:", err);
      }
    }

    loadSettings();
    loadExportStats();
  }, []);

  const refreshExportStats = async () => {
    try {
      const res = await fetch("/api/exports");
      if (res.ok) {
        const data = await res.json();
        setExportStats(data);
      }
    } catch (err) {
      console.error("Failed to refresh export stats:", err);
    }
  };

  const handleOpenExportsFolder = async () => {
    setOpeningExportsFolder(true);
    try {
      await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
    } catch (err) {
      console.error("Failed to open exports folder:", err);
    } finally {
      setOpeningExportsFolder(false);
    }
  };

  const handleClearExports = async () => {
    setClearingExports(true);
    try {
      const res = await fetch("/api/exports", { method: "DELETE" });
      if (res.ok) {
        setExportActionSuccess("Export-mappen har rensats!");
        setConfirmClear(false);
        await refreshExportStats();
        setTimeout(() => setExportActionSuccess(null), 3500);
      }
    } catch (err) {
      console.error("Failed to clear exports:", err);
    } finally {
      setClearingExports(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: apiKey,
          aiModel,
          targetRole,
          targetLocations,
          workPreference,
          broadItSearch,
          minScore,
          searchKeywords,
        }),
      });

      if (!res.ok) {
        throw new Error("Kunde inte spara inställningar");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Fel vid sparande av inställningar"
      );
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Inställningar & AI-konfiguration
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Hantera din Gemini API-nyckel och dina standardsökpreferenser. All data
          lagras privat och lokalt i din databas på datorn.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>Inställningarna har sparats lokalt!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gemini API Key Box */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Google Gemini API-nyckel
              </h3>
              <p className="text-xs text-neutral-500">
                Krävs för att automatiskt analysera annonser och skräddarsy ditt CV.
              </p>
            </div>
          </div>

          {hasEnvKey && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                En API-nyckel hittades i din <code>.env</code>-fil. Du kan lämna
                fältet nedan tomt eller ange en nyckel här för att åsidosätta.
              </span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              API-nyckel (Gemini)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasEnvKey
                  ? "Använder nyckel från .env (fyll i här för att byta)"
                  : "AIzaSy..."
              }
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <p className="mt-1.5 text-xs text-neutral-400">
              Har du ingen nyckel ännu? Hämta en gratis på{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google AI Studio
              </a>
              .
            </p>
          </div>
        </div>

        {/* AI Model Selection Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                AI-modell (Google Gemini)
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Välj vilken Gemini-modell JobScope ska använda för ATS-matchning och CV-skräddarsyning.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Gemini 3.5 Flash-Lite */}
            <label
              className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                aiModel === "gemini-3.5-flash-lite"
                  ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/20 shadow-xs"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  3.5 Flash-Lite
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Hög driftsäkerhet
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                Blixtsnabb (&lt; 1 s) med egen separat kvot och maximal drifttillgänglighet. Perfekt när standardmodellerna är hårt belastade.
              </p>
              <div className="mt-auto flex items-center gap-2">
                <input
                  type="radio"
                  name="aiModel"
                  value="gemini-3.5-flash-lite"
                  checked={aiModel === "gemini-3.5-flash-lite"}
                  onChange={() => setAiModel("gemini-3.5-flash-lite")}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Välj Flash-Lite (Hög kvot)
                </span>
              </div>
            </label>

            {/* Gemini 3.6 Flash */}
            <label
              className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                aiModel === "gemini-3.6-flash"
                  ? "border-blue-500 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20 shadow-xs"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  3.6 Flash
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Standard Gratis
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                Balanserad standardmodell på gratisnivån (20 anrop/dygn). Rekommenderas för normal daglig matchning och CV-skräddarsyning.
              </p>
              <div className="mt-auto flex items-center gap-2">
                <input
                  type="radio"
                  name="aiModel"
                  value="gemini-3.6-flash"
                  checked={aiModel === "gemini-3.6-flash"}
                  onChange={() => setAiModel("gemini-3.6-flash")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Välj 3.6 Flash (Standard)
                </span>
              </div>
            </label>

            {/* Gemini 3.8 Flash */}
            <label
              className={`relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                aiModel === "gemini-3.8-flash"
                  ? "border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/20 shadow-xs"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  3.8 Flash
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Resonemang
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                Googles senaste Flash-generation med djupare resonemang. Kan tidvis uppleva tillfälliga kapacitetsspikar (503).
              </p>
              <div className="mt-auto flex items-center gap-2">
                <input
                  type="radio"
                  name="aiModel"
                  value="gemini-3.8-flash"
                  checked={aiModel === "gemini-3.8-flash"}
                  onChange={() => setAiModel("gemini-3.8-flash")}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Välj 3.8 Flash (Senaste)
                </span>
              </div>
            </label>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300 border border-neutral-100 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Kvalitetsfokuserad fallback och skydd:</span>
            </div>
            <p className="leading-relaxed">
              JobScope växlar uteslutande mellan toppmodellerna <strong>Gemini 3.8 Flash</strong> och <strong>Gemini 3.6 Flash</strong> för att garantera maximal precision och anti-fluff i dina brev och CV:n. Vid tillfälliga 503-spikar (high demand) görs automatiska korta återförsök med paus. Du kan när som helst välja <strong>3.5 Flash-Lite</strong> ovan om du medvetet vill köra en separat reservkvot.
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 space-y-5">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Sök- och matchningspreferenser
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Styr hur brett eller snävt JobScope ska bevaka annonser och vilken lägsta matchningsnivå som krävs för att automatiskt spara jobb.
            </p>
          </div>

          {/* Broad IT Toggle */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={broadItSearch}
                onChange={(e) => setBroadItSearch(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Bred utvecklarsökning som standard (Mjukvara, AI & Data)
                </span>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                  Söker automatiskt över mjukvaruutveckling, tillämpad AI, data engineering och kvalitetssäkring (QA). Irrelevanta roller som hårdvarunära IT-tekniker, helpdesk/support, Product Owner, Embedded C++ och affärssystem (SAP/Dynamics) filtreras bort automatiskt.
                </p>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <Briefcase className="h-3.5 w-3.5" />
                Primär yrkestitel / fokusroll
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Fullstack / Systemutvecklare"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <MapPin className="h-3.5 w-3.5" />
                Område på plats
              </label>
              <input
                type="text"
                value={targetLocations}
                onChange={(e) => setTargetLocations(e.target.value)}
                placeholder="Göteborg med pendlingsavstånd"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          {/* Min Match Score Slider */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <Sliders className="h-3.5 w-3.5 text-neutral-400" />
                Minsta ATS-matchningspoäng för automatisk sparning
              </label>
              <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {minScore}%
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="85"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700 accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
              <span>30% (Mycket brett)</span>
              <span>50% (Rekommenderat)</span>
              <span>85% (Strikt specialist)</span>
            </div>
          </div>

          {/* Search Keywords */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Bevakade sökord / teknikfokus
            </label>
            <input
              type="text"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              placeholder="Utvecklare, C#, .NET, Python, Fullstack, DevOps, Data Engineer, AI"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Kommaseparerad lista av teknologier och utvecklarkategorier som bevakas.
            </p>
          </div>
        </div>

        {/* Job Sources & LinkedIn Info Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-2 text-base font-bold text-neutral-900 dark:text-white">
            Jobbkällor & Automatisk bevakning
          </h3>
          <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
            JobScope bevakar annonser från flera källor samtidigt och matchar dem automatiskt mot ditt Master-CV.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/50">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                in
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    LinkedIn Offentlig Sökning
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
                    Aktiv (Gästläge)
                  </span>
                </div>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  Hämtar offentliga jobbannonser i realtid utan inloggning. Inga cookies eller lösenord sparas, vilket ger noll risk för kontospärr.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/50">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                AF
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    Arbetsförmedlingen JobTech API
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
                    Aktiv (Öppet API)
                  </span>
                </div>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  Direktkoppling till Sveriges officiella platsbank med strukturerade skallkrav och meriterande kompetenser.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Storage & Export Management Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-neutral-900 dark:text-white">
                <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Lagring &amp; Exporterade ansökningar
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Lokalt genererade PDF- och textfiler sparade i mappen <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">exports/</code>. Alla dina skräddarsydda CV:n, brev och sparade jobb lagras tryggt i databasen och påverkas inte vid rensning.
              </p>
            </div>
            {exportStats && (
              <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {exportStats.totalFolders} {exportStats.totalFolders === 1 ? "mapp" : "mappar"} ({exportStats.formattedSize})
              </span>
            )}
          </div>

          {exportActionSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{exportActionSuccess}</span>
            </div>
          )}

          {/* Folders Summary Box */}
          <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
            {exportStats && exportStats.totalFolders > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                  <span>Sparade exportpaket på disken:</span>
                  <span>Totalt {exportStats.totalFiles} filer</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {exportStats.folders.slice(0, 5).map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs border border-neutral-200/60 dark:border-neutral-700/60 dark:bg-neutral-800/80"
                    >
                      <span
                        className="truncate font-mono text-[11px] text-neutral-800 dark:text-neutral-200 max-w-[340px]"
                        title={f.name}
                      >
                        {f.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                        {f.fileCount} filer • {(f.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                  {exportStats.totalFolders > 5 && (
                    <div className="text-[11px] text-neutral-400 text-center pt-1">
                      + ytterligare {exportStats.totalFolders - 5} äldre {exportStats.totalFolders - 5 === 1 ? "mapp" : "mappar"}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-neutral-400">
                Mappen <code className="font-mono">exports/</code> är tom. Inga exporterade filer tar upp diskutrymme.
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleOpenExportsFolder}
              disabled={openingExportsFolder}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors cursor-pointer"
              title="Öppna rotmappen exports i Windows Utforskaren"
            >
              {openingExportsFolder ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 text-neutral-500" />
              )}
              <span>Öppna mappen exports</span>
            </button>

            {exportStats && exportStats.totalFolders > 0 && (
              <div>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-600 dark:text-neutral-300">
                      Rensa {exportStats.totalFolders} {exportStats.totalFolders === 1 ? "mapp" : "mappar"}?
                    </span>
                    <button
                      type="button"
                      onClick={handleClearExports}
                      disabled={clearingExports}
                      className="flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {clearingExports ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Ja, rensa nu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 transition-colors cursor-pointer"
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                    title="Ta bort alla genererade PDF- och textfiler från mappen exports/"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Rensa export-mappen</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Spara inställningar
          </button>
        </div>
      </form>
    </div>
  );
}
