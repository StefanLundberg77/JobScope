"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  FileText,
  Globe,
  Link as LinkIcon,
  Code,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  MasterProfileData,
  WorkExperience,
  Education,
  SkillCategory,
  Project,
} from "@/lib/types";

export function MasterProfileView() {
  const [profile, setProfile] = useState<MasterProfileData>({
    fullName: "",
    email: "",
    phone: "",
    location: "Göteborg",
    title: "",
    summary: "",
    website: "",
    linkedin: "",
    github: "",
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing profile from API
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Save profile to API
  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error("Kunde inte spara profilen.");
      }

      const updated = await res.json();
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Ett fel uppstod vid sparande"
      );
    } finally {
      setSaving(false);
    }
  };

  // AI Import handler
  const handleImportAI = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/profile/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: importText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Misslyckades att importera profil");
      }

      if (data.profile) {
        setProfile((prev) => ({
          ...prev,
          ...data.profile,
          rawText: importText,
        }));
        setImportModalOpen(false);
        setImportText("");
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Fel vid AI-analys av text"
      );
    } finally {
      setImporting(false);
    }
  };

  // Experience helpers
  const addExperience = () => {
    const newExp: WorkExperience = {
      id: "exp-" + Date.now(),
      company: "",
      role: "",
      location: "Göteborg",
      startDate: "",
      endDate: "",
      current: false,
      description: "",
      achievements: [""],
      skills: [],
    };
    setProfile({ ...profile, experiences: [newExp, ...profile.experiences] });
  };

  const updateExperience = (
    index: number,
    field: keyof WorkExperience,
    val: unknown
  ) => {
    const exps = [...profile.experiences];
    exps[index] = { ...exps[index], [field]: val };
    setProfile({ ...profile, experiences: exps });
  };

  const removeExperience = (index: number) => {
    setProfile({
      ...profile,
      experiences: profile.experiences.filter((_, i) => i !== index),
    });
  };

  // Education helpers
  const addEducation = () => {
    const newEdu: Education = {
      id: "edu-" + Date.now(),
      school: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
    };
    setProfile({ ...profile, education: [newEdu, ...profile.education] });
  };

  const removeEducation = (index: number) => {
    setProfile({
      ...profile,
      education: profile.education.filter((_, i) => i !== index),
    });
  };

  // Skills helpers
  const addSkillCategory = () => {
    const newCat: SkillCategory = {
      category: "Ny kategori",
      items: [],
    };
    setProfile({ ...profile, skills: [...profile.skills, newCat] });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      {/* Top Banner & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Mitt Master-CV
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Ditt kompletta grund-CV. AI:n använder detta som sanningskälla för att
            skräddarsy ansökningar per jobbannons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            Importera med AI
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savedSuccess ? "Sparat!" : "Spara ändringar"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section 1: Grunduppgifter & Kontakt */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
          <User className="h-5 w-5 text-blue-600" />
          Personuppgifter & Kontakt
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              För- och efternamn
            </label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) =>
                setProfile({ ...profile, fullName: e.target.value })
              }
              placeholder="t.ex. Anna Andersson"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Yrkesroll / Huvudtitel
            </label>
            <input
              type="text"
              value={profile.title}
              onChange={(e) =>
                setProfile({ ...profile, title: e.target.value })
              }
              placeholder="t.ex. Senior Fullstack-utvecklare"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              E-post
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                placeholder="namn@epost.se"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Telefon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                placeholder="070-123 45 67"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Plats / Stad
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={profile.location}
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
                placeholder="Göteborg"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Webbplats / Portfolio
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={profile.website}
                onChange={(e) =>
                  setProfile({ ...profile, website: e.target.value })
                }
                placeholder="https://minportfolio.se"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              LinkedIn
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={profile.linkedin}
                onChange={(e) =>
                  setProfile({ ...profile, linkedin: e.target.value })
                }
                placeholder="https://linkedin.com/in/dittnamn"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              GitHub
            </label>
            <div className="relative">
              <Code className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={profile.github}
                onChange={(e) =>
                  setProfile({ ...profile, github: e.target.value })
                }
                placeholder="https://github.com/dittnamn"
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Profilsammanfattning */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Övergripande profilsammanfattning (Elevator pitch)
          </label>
          <textarea
            rows={3}
            value={profile.summary}
            onChange={(e) =>
              setProfile({ ...profile, summary: e.target.value })
            }
            placeholder="Beskriv kort din professionella bakgrund, kärnkompetenser och vad du brinner för..."
            className="w-full rounded-lg border border-neutral-300 p-3 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </div>

      {/* Section 2: Arbetslivserfarenhet */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Arbetslivserfarenhet ({profile.experiences.length})
          </h2>
          <button
            onClick={addExperience}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Lägg till roll
          </button>
        </div>

        <div className="space-y-6">
          {profile.experiences.map((exp, idx) => (
            <div
              key={exp.id || idx}
              className="relative rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50"
            >
              <button
                onClick={() => removeExperience(idx)}
                className="absolute right-3 top-3 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                title="Ta bort erfarenhet"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Roll / Befattning
                  </label>
                  <input
                    type="text"
                    value={exp.role}
                    onChange={(e) =>
                      updateExperience(idx, "role", e.target.value)
                    }
                    placeholder="t.ex. Fullstack Developer"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Företag / Organisation
                  </label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) =>
                      updateExperience(idx, "company", e.target.value)
                    }
                    placeholder="t.ex. Volvo Group"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Startdatum
                  </label>
                  <input
                    type="text"
                    value={exp.startDate}
                    onChange={(e) =>
                      updateExperience(idx, "startDate", e.target.value)
                    }
                    placeholder="2021-01"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Slutdatum (eller pågående)
                  </label>
                  <input
                    type="text"
                    value={exp.endDate}
                    onChange={(e) =>
                      updateExperience(idx, "endDate", e.target.value)
                    }
                    placeholder="Nuvarande eller 2023-08"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Prestationer & punkter */}
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Prestationer & Ansvarsområden (en punkt per rad)
                </label>
                <textarea
                  rows={3}
                  value={exp.achievements?.join("\n") || ""}
                  onChange={(e) =>
                    updateExperience(
                      idx,
                      "achievements",
                      e.target.value.split("\n").filter((l) => l.trim().length > 0)
                    )
                  }
                  placeholder="• Utvecklade mikrotjänster i TypeScript och Node.js&#10;• Optimerade databasfrågor vilket sänkte svarstider med 35%"
                  className="w-full rounded border border-neutral-300 bg-white p-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              {/* Använda teknologier */}
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Använda teknologier (komma-separerade)
                </label>
                <input
                  type="text"
                  value={exp.skills?.join(", ") || ""}
                  onChange={(e) =>
                    updateExperience(
                      idx,
                      "skills",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="React, TypeScript, Next.js, PostgreSQL, Docker"
                  className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>
          ))}

          {profile.experiences.length === 0 && (
            <p className="py-4 text-center text-xs text-neutral-500">
              Inga erfarenheter inlagda ännu. Klicka på &quot;Lägg till roll&quot; eller
              använd &quot;Importera med AI&quot; ovan.
            </p>
          )}
        </div>
      </div>

      {/* Section 3: Färdigheter & Kompetenser */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Färdigheter & Tech Stack
          </h2>
          <button
            onClick={addSkillCategory}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Ny kategori
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profile.skills.map((cat, catIdx) => (
            <div
              key={catIdx}
              className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <input
                  type="text"
                  value={cat.category}
                  onChange={(e) => {
                    const skills = [...profile.skills];
                    skills[catIdx].category = e.target.value;
                    setProfile({ ...profile, skills });
                  }}
                  className="font-medium text-xs text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none dark:text-white"
                />
                <button
                  onClick={() => {
                    setProfile({
                      ...profile,
                      skills: profile.skills.filter((_, i) => i !== catIdx),
                    });
                  }}
                  className="text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <textarea
                rows={2}
                value={cat.items?.join(", ") || ""}
                onChange={(e) => {
                  const skills = [...profile.skills];
                  skills[catIdx].items = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setProfile({ ...profile, skills });
                }}
                placeholder="JavaScript, TypeScript, Python..."
                className="w-full rounded border border-neutral-300 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Utbildning */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            Utbildning & Certifikat ({profile.education.length})
          </h2>
          <button
            onClick={addEducation}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Lägg till utbildning
          </button>
        </div>

        <div className="space-y-4">
          {profile.education.map((edu, idx) => (
            <div
              key={edu.id || idx}
              className="relative rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/50"
            >
              <button
                onClick={() => removeEducation(idx)}
                className="absolute right-3 top-3 text-neutral-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Skola / Universitet
                  </label>
                  <input
                    type="text"
                    value={edu.school}
                    onChange={(e) => {
                      const edus = [...profile.education];
                      edus[idx].school = e.target.value;
                      setProfile({ ...profile, education: edus });
                    }}
                    placeholder="Chalmers tekniska högskola"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Examen / Utbildningslinje
                  </label>
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => {
                      const edus = [...profile.education];
                      edus[idx].degree = e.target.value;
                      setProfile({ ...profile, education: edus });
                    }}
                    placeholder="Civilingenjör Datateknik"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Tidsperiod
                  </label>
                  <input
                    type="text"
                    value={`${edu.startDate || ""} - ${edu.endDate || ""}`}
                    onChange={(e) => {
                      const [start, end] = e.target.value
                        .split("-")
                        .map((s) => s.trim());
                      const edus = [...profile.education];
                      edus[idx].startDate = start || "";
                      edus[idx].endDate = end || "";
                      setProfile({ ...profile, education: edus });
                    }}
                    placeholder="2018 - 2023"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Beskrivning / Notering
                  </label>
                  <input
                    type="text"
                    value={edu.description || ""}
                    onChange={(e) => {
                      const edus = [...profile.education];
                      edus[idx].description = e.target.value;
                      setProfile({ ...profile, education: edus });
                    }}
                    placeholder="Inriktning mot mjukvaruteknik"
                    className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Importera CV eller profil med AI
                </h3>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
              Klistra in all text från ditt befintliga CV, LinkedIn-profil (eller
              export) eller din portfoliosida här. Vår AI strukturerar och mappar
              automatiskt alla roller, datum och kompetenser.
            </p>

            <textarea
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Klistra in din text här... t.ex:&#10;Anna Andersson&#10;Fullstack Developer i Göteborg&#10;&#10;Erfarenhet:&#10;Volvo Group (2021-nuvarande)..."
              className="w-full rounded-lg border border-neutral-300 p-3 text-xs font-mono focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Avbryt
              </button>
              <button
                onClick={handleImportAI}
                disabled={importing || !importText.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyserar och extraherar...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analysera och fyll i mitt CV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
