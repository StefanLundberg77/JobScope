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
} from "lucide-react";

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [targetRole, setTargetRole] = useState("Systemutvecklare / Fullstack");
  const [targetLocations, setTargetLocations] = useState("Göteborg");
  const [workPreference, setWorkPreference] = useState("any");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setApiKey(data.geminiApiKey || "");
          setHasEnvKey(data.hasEnvApiKey || false);
          if (data.targetRole) setTargetRole(data.targetRole);
          if (data.targetLocations) setTargetLocations(data.targetLocations);
          if (data.workPreference) setWorkPreference(data.workPreference);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

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
          targetRole,
          targetLocations,
          workPreference,
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

        {/* Preferences */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-4 text-base font-bold text-neutral-900 dark:text-white">
            Sök- och matchningspreferenser
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <Briefcase className="h-3.5 w-3.5" />
                Önskad huvudsaklig yrkesroll
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Fullstack / Frontend Utvecklare"
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
