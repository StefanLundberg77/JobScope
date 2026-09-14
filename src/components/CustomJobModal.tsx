"use client";

import React, { useState } from "react";
import { PlusCircle, Link, FileText, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { JobItem } from "@/lib/types";

interface CustomJobModalProps {
  onJobSaved: (job: JobItem) => void;
}

export function CustomJobModal({ onJobSaved }: CustomJobModalProps) {
  const [activeMode, setActiveMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = activeMode === "url" ? { url } : { rawText };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kunde inte spara jobbannonsen");
      }

      onJobSaved(data);
      setUrl("");
      setRawText("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Ett fel uppstod vid import"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Klistra in valfri jobbannons
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Har du hittat en annons på LinkedIn, Indeed, Blocket Jobb eller en specifik karriärsida?
          Klistra in länken eller texten så analyserar AI:n kraven och förbereder ditt skräddarsydda CV.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {/* Toggle Mode */}
        <div className="mb-6 flex gap-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveMode("url")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeMode === "url"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Link className="h-4 w-4" />
            Länk till webbannons
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("text")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeMode === "text"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <FileText className="h-4 w-4" />
            Klistra in råtext
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeMode === "url" ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Annonsens URL
              </label>
              <div className="relative">
                <Link className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/... eller karriärsida"
                  className="w-full rounded-xl border border-neutral-300 pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-400">
                JobScope hämtar webbsidan och extraherar roll, företag, beskrivning och krav.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Klistra in hela annonstexten
              </label>
              <textarea
                rows={12}
                required
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Kopiera texten från annonsen och klistra in här..."
                className="w-full rounded-xl border border-neutral-300 p-3 text-xs leading-relaxed focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || (activeMode === "url" ? !url.trim() : !rawText.trim())}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyserar annonsen...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Spara & Förbered optimering
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
