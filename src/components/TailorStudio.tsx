"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Sparkles,
  Save,
  CheckCircle2,
  Copy,
  Printer,
  ExternalLink,
  Building,
  MapPin,
  Calendar,
  AlertCircle,
  Loader2,
  FileText,
  Mail,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import {
  JobItem,
  MasterProfileData,
  WorkExperience,
  SkillCategory,
  MatchAnalysis,
  ApplicationStatus,
} from "@/lib/types";

/**
 * Available profile photos for CV layout customization.
 */
const AVAILABLE_PHOTOS = [
  { id: "rum_gron_vaxt", name: "Grön växt (LinkedIn)", path: "/profile/cv_rum_gron_vaxt.jpg" },
  { id: "office_lugnt_rum", name: "Lugnt rum & bokhylla", path: "/profile/cv_office_lugnt_rum.jpg" },
  { id: "office_vanlig_vagg", name: "Enkel vägg", path: "/profile/cv_office_vanlig_vagg.jpg" },
  { id: "studio_portrait", name: "Studioporträtt", path: "/profile/cv_studio_portrait.jpg" },
  { id: "rum_gron_vaxt_bw", name: "Grön växt (Svartvit)", path: "/profile/cv_rum_gron_vaxt_bw.jpg" },
  { id: "office_lugnt_rum_bw", name: "Lugnt rum (Svartvit)", path: "/profile/cv_office_lugnt_rum_bw.jpg" },
  { id: "office_vanlig_vagg_bw", name: "Enkel vägg (Svartvit)", path: "/profile/cv_office_vanlig_vagg_bw.jpg" },
];

/**
 * Bilingual UI labels for CV and cover letter views.
 */
const LABELS = {
  sv: {
    summary: "Sammanfattning",
    experience: "Arbetslivserfarenhet",
    skills: "Teknisk kompetens & Färdigheter",
    education: "Utbildning",
    projects: "Utvalda Projekt & Examensarbete",
    languages: "Språk",
    present: "Pågående",
    recipientAtt: "Att: Rekryteringsteamet / ",
    application: "Ansökan:",
    signOff: "Med vänliga hälsningar,",
  },
  en: {
    summary: "Professional Summary",
    experience: "Professional Experience",
    skills: "Technical Skills & Competencies",
    education: "Education",
    projects: "Featured Projects & Thesis",
    languages: "Languages",
    present: "Present",
    recipientAtt: "Attn: Hiring Team / ",
    application: "Application:",
    signOff: "Sincerely,",
  },
};

/**
 * Props for the TailorStudio component.
 */
interface TailorStudioProps {
  jobId: string;
  onBack: () => void;
  onJobUpdated?: () => void;
}

/**
 * TailorStudio provides an interactive workspace for reviewing AI-driven resume tailoring,
 * examining side-by-side diff rationales, refining cover letters, and exporting ATS-optimized
 * A4 resumes and cover letters for print/PDF with full bilingual (SV/EN) support.
 */
export function TailorStudio({
  jobId,
  onBack,
  onJobUpdated,
}: TailorStudioProps) {
  const [job, setJob] = useState<JobItem | null>(null);
  const [masterProfile, setMasterProfile] = useState<MasterProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cv" | "letter" | "print" | "jobinfo">("cv");

  // Language options: auto-detect or force Swedish/English
  const [languageOption, setLanguageOption] = useState<"auto" | "sv" | "en">("auto");
  const [activeLanguage, setActiveLanguage] = useState<"sv" | "en">("sv");

  // Tailored Application State
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [tailoredSummary, setTailoredSummary] = useState("");
  const [tailoredExperiences, setTailoredExperiences] = useState<WorkExperience[]>([]);
  const [tailoredSkills, setTailoredSkills] = useState<SkillCategory[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [diffNotes, setDiffNotes] = useState<
    { section: string; change: string; rationale: string }[]
  >([]);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [notes, setNotes] = useState("");

  // Print & Photo State
  const [printDoc, setPrintDoc] = useState<"cv" | "letter">("cv");
  const [includePhotoOnCv, setIncludePhotoOnCv] = useState(true);
  const [includePhotoOnLetter, setIncludePhotoOnLetter] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState("/profile/cv_rum_gron_vaxt.jpg");

  // Load Job and Master Profile
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [jobRes, profileRes] = await Promise.all([
          fetch(`/api/jobs/${jobId}`),
          fetch("/api/profile"),
        ]);

        if (jobRes.ok) {
          const j: JobItem = await jobRes.json();
          setJob(j);
          if (j.matchAnalysis) setMatchAnalysis(j.matchAnalysis);

          // If there is an existing tailored application
          if (j.applications && j.applications.length > 0) {
            const app = j.applications[0];
            setApplicationId(app.id);
            setTailoredSummary(app.tailoredSummary || "");
            setTailoredExperiences(app.tailoredExperiences || []);
            setTailoredSkills(app.tailoredSkills || []);
            setCoverLetter(app.coverLetter || "");
            setDiffNotes(app.diffNotes || []);
            setNotes(app.notes || "");
            if (app.language === "en" || app.language === "sv") {
              setActiveLanguage(app.language);
            }
          }
        }

        if (profileRes.ok) {
          const p: MasterProfileData = await profileRes.json();
          setMasterProfile(p);
          if (p.photoUrl) {
            setSelectedPhoto(p.photoUrl);
          }
        }
      } catch (err) {
        console.error("Failed to load tailor studio data:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [jobId]);

  // AI Tailor trigger
  const handleGenerateTailored = async () => {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: languageOption }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kunde inte optimera ansökan");
      }

      setApplicationId(data.applicationId);
      setTailoredSummary(data.tailoredSummary);
      setTailoredExperiences(data.tailoredExperiences);
      setTailoredSkills(data.tailoredSkills);
      setCoverLetter(data.coverLetter);
      setDiffNotes(data.diffNotes || []);
      setMatchAnalysis(data.matchAnalysis);
      if (data.language === "en" || data.language === "sv") {
        setActiveLanguage(data.language);
      }

      if (job) {
        setJob({
          ...job,
          status: job.status === "saved" ? "tailored" : job.status,
          matchScore: data.matchAnalysis?.score,
        });
      }
      if (onJobUpdated) onJobUpdated();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Ett fel uppstod vid optimering"
      );
    } finally {
      setGenerating(false);
    }
  };

  // Save manual edits
  const handleSaveManual = async () => {
    setSavingManual(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          tailoredSummary,
          tailoredExperiences,
          tailoredSkills,
          coverLetter,
          notes,
        }),
      });

      if (!res.ok) {
        throw new Error("Kunde inte spara dina manuella ändringar.");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onJobUpdated) onJobUpdated();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Fel vid sparande av ändringar"
      );
    } finally {
      setSavingManual(false);
    }
  };

  // Change application status
  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok && job) {
        setJob({ ...job, status: newStatus });
        if (onJobUpdated) onJobUpdated();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const copyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopiedLetter(true);
    setTimeout(() => setCopiedLetter(false), 2500);
  };

  if (loading || !job) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasTailoredVersion = Boolean(
    tailoredSummary || tailoredExperiences.length > 0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Header bar */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {job.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
                <Building className="h-3.5 w-3.5" />
                {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
              {job.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Sista dag: {new Date(job.deadline).toLocaleDateString("sv-SE")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-500">Status:</span>
            <select
              value={job.status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ApplicationStatus)
              }
              className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="saved">Sparad</option>
              <option value="tailored">Optimerad</option>
              <option value="applied">Ansökt</option>
              <option value="interview">Intervju</option>
              <option value="offer">Erbjudande</option>
              <option value="rejected">Avslag</option>
            </select>
          </div>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Ansökningssida <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Language Selector Toggle */}
          <div className="flex items-center rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setLanguageOption("auto")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                languageOption === "auto"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-neutral-900 dark:text-blue-400"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
              title="Känner automatiskt av annonsens språk"
            >
              ⚡ Auto
            </button>
            <button
              type="button"
              onClick={() => setLanguageOption("sv")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                languageOption === "sv"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-neutral-900 dark:text-blue-400"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
              title="Generera på svenska med jordnära tech-ton"
            >
              🇸🇪 SV
            </button>
            <button
              type="button"
              onClick={() => setLanguageOption("en")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                languageOption === "en"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-neutral-900 dark:text-blue-400"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
              title="Generera på engelska med internationell impact-ton"
            >
              🇬🇧 EN
            </button>
          </div>

          <button
            onClick={handleGenerateTailored}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Optimerar med AI...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {hasTailoredVersion ? "Kör ny AI-optimering" : "Optimera CV & Brev"}
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="no-print flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Match Score & Analysis Banner */}
      {matchAnalysis && (
        <div className="no-print rounded-2xl border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-950 dark:bg-blue-950/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                <span className="text-xl font-black">{matchAnalysis.score}%</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider">
                  Match
                </span>
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white">
                  ATS Matchningsanalys
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  {matchAnalysis.summary}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {matchAnalysis.strongMatches?.length > 0 && (
                <div className="rounded-lg bg-white/80 p-2 text-green-800 shadow-xs dark:bg-neutral-900 dark:text-green-300">
                  <span className="font-semibold block text-[11px]">
                    Starka matchningar:
                  </span>
                  <span>{matchAnalysis.strongMatches.slice(0, 3).join(", ")}</span>
                </div>
              )}
              {matchAnalysis.missingKeywords?.length > 0 && (
                <div className="rounded-lg bg-white/80 p-2 text-amber-800 shadow-xs dark:bg-neutral-900 dark:text-amber-300">
                  <span className="font-semibold block text-[11px]">
                    Att beakta:
                  </span>
                  <span>{matchAnalysis.missingKeywords.slice(0, 3).join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="no-print flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab("cv")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === "cv"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          }`}
        >
          <FileText className="h-4 w-4" />
          Skräddarsytt CV & Diff
        </button>

        <button
          onClick={() => setActiveTab("letter")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === "letter"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          }`}
        >
          <Mail className="h-4 w-4" />
          Personligt Brev
        </button>

        <button
          onClick={() => setActiveTab("print")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === "print"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          }`}
        >
          <Printer className="h-4 w-4" />
          Förhandsgranska & PDF
        </button>

        <button
          onClick={() => setActiveTab("jobinfo")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
            activeTab === "jobinfo"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
          }`}
        >
          <Building className="h-4 w-4" />
          Originalannons
        </button>
      </div>

      {/* TAB 1: CV & Diff Studio (Human-in-the-loop) */}
      {activeTab === "cv" && (
        <div className="space-y-6">
          {!hasTailoredVersion ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
              <Sparkles className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                Inget skräddarsytt CV genererat ännu
              </h3>
              <p className="mt-1 text-xs text-neutral-500 max-w-md mx-auto">
                Klicka på &quot;Optimera CV & Brev&quot; ovan för att låta AI:n analysera
                annonsens nyckelord och anpassa ditt Master-CV med bibehållen sanning.
              </p>
              <button
                onClick={handleGenerateTailored}
                disabled={generating}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Kör optimering nu
              </button>
            </div>
          ) : (
            <>
              {/* Diff notes summary */}
              {diffNotes.length > 0 && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                    Gjorda anpassningar för denna annons
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {diffNotes.map((dn, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-neutral-50 p-2.5 text-xs dark:bg-neutral-800"
                      >
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {dn.section}:
                        </span>{" "}
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {dn.change}
                        </span>
                        <p className="mt-1 text-[11px] text-neutral-500 italic">
                          Varför: {dn.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Side-by-Side View */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Column 1: Master CV (Reference) */}
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Master-CV (Referens)
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Oförändrad grund
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Master Summary */}
                    <div>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                        Sammanfattning:
                      </span>
                      <p className="rounded-lg bg-white p-3 text-neutral-600 leading-relaxed dark:bg-neutral-800 dark:text-neutral-300">
                        {masterProfile?.summary || "Ingen sammanfattning angiven."}
                      </p>
                    </div>

                    {/* Master Experiences */}
                    <div>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                        Erfarenheter ({masterProfile?.experiences.length || 0}):
                      </span>
                      <div className="space-y-2">
                        {masterProfile?.experiences.map((exp, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-white p-3 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                          >
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {exp.role} @ {exp.company}
                            </div>
                            <div className="text-[11px] text-neutral-400 mb-1">
                              {exp.startDate} - {exp.endDate || "nuvarande"}
                            </div>
                            <ul className="list-disc pl-4 space-y-1">
                              {exp.achievements?.map((ach, ai) => (
                                <li key={ai}>{ach}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Tailored CV (Editable Human-in-the-loop) */}
                <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900/40 dark:bg-neutral-900">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      Skräddarsytt CV (Redigerbart)
                    </span>
                    <button
                      onClick={handleSaveManual}
                      disabled={savingManual}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingManual ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : savedSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {savedSuccess ? "Sparat!" : "Spara ändringar"}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Tailored Summary */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Skräddarsydd profilpitch:
                      </label>
                      <textarea
                        rows={4}
                        value={tailoredSummary}
                        onChange={(e) => setTailoredSummary(e.target.value)}
                        className="w-full rounded-lg border border-blue-200 bg-blue-50/20 p-2.5 text-xs leading-relaxed focus:border-blue-500 focus:outline-none dark:border-blue-900 dark:bg-blue-950/20 dark:text-white"
                      />
                    </div>

                    {/* Tailored Experiences */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Optimerade erfarenhetspunkter:
                      </label>
                      <div className="space-y-3">
                        {tailoredExperiences.map((exp, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800"
                          >
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {exp.role} @ {exp.company}
                            </div>

                            <div className="mt-2">
                              <span className="text-[11px] font-medium text-neutral-500 block mb-1">
                                Punkter (redigera vid behov):
                              </span>
                              <textarea
                                rows={3}
                                value={exp.achievements?.join("\n") || ""}
                                onChange={(e) => {
                                  const updated = [...tailoredExperiences];
                                  updated[idx].achievements = e.target.value
                                    .split("\n")
                                    .filter((l) => l.trim().length > 0);
                                  setTailoredExperiences(updated);
                                }}
                                className="w-full rounded border border-neutral-300 p-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Cover Letter Studio */}
      {activeTab === "letter" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Skräddarsytt Personligt Brev
              </h3>
              <p className="text-xs text-neutral-500">
                Formulerat specifikt för {job.company} och rollen som {job.title}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyCoverLetter}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {copiedLetter ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    Kopierat till urklipp!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Kopiera text
                  </>
                )}
              </button>

              <button
                onClick={handleSaveManual}
                disabled={savingManual}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Save className="h-3.5 w-3.5" />
                Spara ändringar
              </button>
            </div>
          </div>

          <textarea
            rows={16}
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            placeholder="Klicka på 'Optimera CV & Brev' för att generera ett personligt brev..."
            className="w-full rounded-xl border border-neutral-300 p-4 text-sm leading-relaxed focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      )}

      {/* TAB 3: Printable PDF Preview */}
      {activeTab === "print" && (
        <div className="space-y-4">
          {/* Controls toolbar */}
          <div className="no-print space-y-3 rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 dark:border-neutral-800 dark:bg-neutral-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Document switcher */}
              <div className="flex items-center rounded-xl bg-white p-1 shadow-xs dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setPrintDoc("cv")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    printDoc === "cv"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Skräddarsytt CV (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDoc("letter")}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    printDoc === "letter"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Personligt Brev (A4)
                </button>
              </div>

              {/* Print CTA */}
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black dark:bg-white dark:text-black shadow-sm"
              >
                <Printer className="h-4 w-4" />
                Skriv ut / Spara som PDF
              </button>
            </div>

            {/* Photo controls & tips */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-3 dark:border-neutral-700/80 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                {printDoc === "cv" ? (
                  <label className="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300 font-medium">
                    <input
                      type="checkbox"
                      checked={includePhotoOnCv}
                      onChange={(e) => setIncludePhotoOnCv(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Visa profilbild på CV</span>
                  </label>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300 font-medium">
                    <input
                      type="checkbox"
                      checked={includePhotoOnLetter}
                      onChange={(e) => setIncludePhotoOnLetter(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Visa diskret profilbild i brevhuvudet</span>
                  </label>
                )}

                {/* Photo selector dropdown */}
                {((printDoc === "cv" && includePhotoOnCv) ||
                  (printDoc === "letter" && includePhotoOnLetter)) && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 flex items-center gap-1 text-[11px]">
                      <Camera className="h-3.5 w-3.5 text-blue-600" />
                      Aktiv bild:
                    </span>
                    <select
                      value={selectedPhoto}
                      onChange={(e) => setSelectedPhoto(e.target.value)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                    >
                      {AVAILABLE_PHOTOS.map((p) => (
                        <option key={p.id} value={p.path}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <span className="text-[11px] text-neutral-500 italic">
                {printDoc === "cv"
                  ? "Standard i Sverige: Bild i CV-headern ger ett personligt och professionellt intryck."
                  : "Personligt brev: Hålls oftast rent utan bild, men kan väljas för enhetligt brevhuvud."}
              </span>
            </div>
          </div>

          {/* Printable Document Sheet (A4 format) */}
          {printDoc === "cv" ? (
            <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-10 text-black shadow-md print:border-none print:p-0 print:shadow-none">
              {/* Header / Contact */}
              <div className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold uppercase tracking-tight">
                    {masterProfile?.fullName || "Stefan Lundberg"}
                  </h1>
                  <div className="text-sm font-semibold text-neutral-700 mt-0.5">
                    {masterProfile?.title || job.title}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                    {masterProfile?.email && <span>{masterProfile.email}</span>}
                    {masterProfile?.phone && <span>• {masterProfile.phone}</span>}
                    {masterProfile?.location && <span>• {masterProfile.location}</span>}
                    {masterProfile?.website && <span>• {masterProfile.website}</span>}
                    {masterProfile?.linkedin && <span>• {masterProfile.linkedin}</span>}
                    {masterProfile?.github && <span>• {masterProfile.github}</span>}
                  </div>
                </div>

                {includePhotoOnCv && selectedPhoto && (
                  <div className="shrink-0">
                    <img
                      src={selectedPhoto}
                      alt={masterProfile?.fullName || "Profilbild"}
                      className="h-24 w-24 rounded-xl object-cover border border-neutral-300 shadow-xs print:shadow-none print:border-neutral-400"
                    />
                  </div>
                )}
              </div>

              {/* Profile Summary */}
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                  {LABELS[activeLanguage].summary}
                </h2>
                <p className="text-xs leading-relaxed text-neutral-800">
                  {tailoredSummary || masterProfile?.summary}
                </p>
              </div>

              {/* Experience */}
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-3">
                  {LABELS[activeLanguage].experience}
                </h2>
                <div className="space-y-4">
                  {(tailoredExperiences.length > 0
                    ? tailoredExperiences
                    : masterProfile?.experiences || []
                  ).map((exp, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-xs text-neutral-900">
                          {exp.role} — {exp.company}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {exp.startDate} - {exp.endDate || LABELS[activeLanguage].present}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-xs text-neutral-700 mt-0.5">
                          {exp.description}
                        </p>
                      )}
                      <ul className="mt-1 list-disc pl-4 text-xs text-neutral-800 space-y-0.5">
                        {exp.achievements?.map((ach, ai) => (
                          <li key={ai}>{ach}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                  {LABELS[activeLanguage].skills}
                </h2>
                <div className="space-y-1.5 text-xs">
                  {(tailoredSkills.length > 0
                    ? tailoredSkills
                    : masterProfile?.skills || []
                  ).map((cat, ci) => (
                    <div key={ci}>
                      <span className="font-semibold text-neutral-900">
                        {cat.category}:{" "}
                      </span>
                      <span className="text-neutral-700">
                        {cat.items?.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              {masterProfile?.education && masterProfile.education.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                    {LABELS[activeLanguage].education}
                  </h2>
                  <div className="space-y-2">
                    {masterProfile.education.map((edu, ei) => (
                      <div key={ei} className="flex justify-between text-xs">
                        <div>
                          <span className="font-bold">{edu.degree}</span> —{" "}
                          <span>{edu.school}</span>
                          {edu.fieldOfStudy && (
                            <span className="text-neutral-600 block text-[11px]">
                              {edu.fieldOfStudy}
                            </span>
                          )}
                        </div>
                        <span className="text-neutral-500 text-[11px]">
                          {edu.startDate} - {edu.endDate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Printable Letter Sheet (A4 format) */
            <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-12 text-black shadow-md print:border-none print:p-0 print:shadow-none min-h-[850px] flex flex-col justify-between">
              <div>
                {/* Letter Header */}
                <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-5">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                      {masterProfile?.fullName || "Stefan Lundberg"}
                    </h1>
                    <div className="text-sm font-medium text-neutral-700 mt-0.5">
                      {masterProfile?.title || (activeLanguage === "en" ? "Software Developer & AI Engineer" : "Systemutvecklare & AI-utvecklare")}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
                      {masterProfile?.email && <span>{masterProfile.email}</span>}
                      {masterProfile?.phone && <span>• {masterProfile.phone}</span>}
                      {masterProfile?.location && <span>• {masterProfile.location}</span>}
                      {masterProfile?.website && <span>• {masterProfile.website}</span>}
                      {masterProfile?.linkedin && <span>• {masterProfile.linkedin}</span>}
                    </div>
                  </div>

                  {includePhotoOnLetter && selectedPhoto && (
                    <div className="shrink-0">
                      <img
                        src={selectedPhoto}
                        alt={masterProfile?.fullName || "Profilbild"}
                        className="h-16 w-16 rounded-full object-cover border border-neutral-200 shadow-xs print:border-neutral-400"
                      />
                    </div>
                  )}
                </div>

                {/* Recipient & Date */}
                <div className="mt-8 flex justify-between items-start text-xs text-neutral-600">
                  <div>
                    <div className="font-bold text-neutral-900 text-sm">{job.company}</div>
                    <div className="text-neutral-700">
                      {LABELS[activeLanguage].recipientAtt} {job.title}
                    </div>
                    <div className="text-neutral-500">{job.location}</div>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    {activeLanguage === "en"
                      ? `Gothenburg, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                      : `Göteborg, ${new Date().toLocaleDateString("sv-SE")}`}
                  </div>
                </div>

                {/* Subject */}
                <div className="mt-8">
                  <h2 className="text-base font-bold text-neutral-900">
                    {LABELS[activeLanguage].application} {job.title}
                  </h2>
                </div>

                {/* Letter Body */}
                <div className="mt-4 text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap">
                  {coverLetter ||
                    (activeLanguage === "en"
                      ? "No cover letter generated yet. Click 'Optimize CV & Letter' to generate an application tailored for this role."
                      : "Inget personligt brev genererat ännu. Klicka på fliken 'Personligt Brev' eller 'Kör optimering' för att ta fram ett brev för denna roll.")}
                </div>
              </div>

              {/* Sign-off */}
              <div className="mt-12 pt-4 text-xs text-neutral-800 border-t border-neutral-100">
                <div>{LABELS[activeLanguage].signOff}</div>
                <div className="mt-3 text-sm font-bold text-neutral-900">
                  {masterProfile?.fullName || "Stefan Lundberg"}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {masterProfile?.phone} {masterProfile?.email && `• ${masterProfile.email}`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Original Job Ad */}
      {activeTab === "jobinfo" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {job.title}
              </h3>
              <p className="text-xs text-neutral-500">
                {job.company} • {job.location}
              </p>
            </div>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Öppna länk <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="text-xs leading-relaxed text-neutral-700 whitespace-pre-wrap dark:text-neutral-300">
            {job.description}
          </div>
        </div>
      )}
    </div>
  );
}
