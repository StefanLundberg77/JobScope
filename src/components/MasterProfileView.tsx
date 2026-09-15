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
  UploadCloud,
  FileUp,
  FolderGit2,
  X,
  Camera,
} from "lucide-react";
import {
  MasterProfileData,
  WorkExperience,
  Education,
  SkillCategory,
  Project,
} from "@/lib/types";

const AVAILABLE_PHOTOS = [
  {
    id: "rum_gron_vaxt",
    name: "Grön växt (LinkedIn)",
    path: "/profile/cv_rum_gron_vaxt.jpg",
    tag: "Aktiv på LinkedIn",
  },
  {
    id: "office_lugnt_rum",
    name: "Lugnt rum & bokhylla",
    path: "/profile/cv_office_lugnt_rum.jpg",
    tag: "Sober & professionell",
  },
  {
    id: "office_vanlig_vagg",
    name: "Enkel vägg",
    path: "/profile/cv_office_vanlig_vagg.jpg",
    tag: "Neutral",
  },
  {
    id: "studio_portrait",
    name: "Studioporträtt",
    path: "/profile/cv_studio_portrait.jpg",
    tag: "Studioljus",
  },
  {
    id: "rum_gron_vaxt_bw",
    name: "Grön växt (Svartvit)",
    path: "/profile/cv_rum_gron_vaxt_bw.jpg",
    tag: "Monokrom för utskrift",
  },
  {
    id: "office_lugnt_rum_bw",
    name: "Lugnt rum (Svartvit)",
    path: "/profile/cv_office_lugnt_rum_bw.jpg",
    tag: "Monokrom",
  },
  {
    id: "office_vanlig_vagg_bw",
    name: "Enkel vägg (Svartvit)",
    path: "/profile/cv_office_vanlig_vagg_bw.jpg",
    tag: "Monokrom",
  },
];

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
    photoUrl: "/profile/cv_rum_gron_vaxt.jpg",
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
  const [importMode, setImportMode] = useState<"pdf" | "text">("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    setImporting(true);
    setErrorMessage(null);
    try {
      let res: Response;

      if (importMode === "pdf") {
        if (!selectedFile) {
          throw new Error("Vänligen välj en PDF-fil att ladda upp.");
        }
        const formData = new FormData();
        formData.append("file", selectedFile);

        res = await fetch("/api/profile/import", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!importText.trim()) {
          throw new Error("Vänligen klistra in text att analysera.");
        }
        res = await fetch("/api/profile/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: importText }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Misslyckades att importera profil");
      }

      if (data.profile) {
        setProfile((prev) => ({
          ...prev,
          ...data.profile,
          rawText:
            importMode === "pdf"
              ? `[Importerad från PDF: ${selectedFile?.name}]`
              : importText,
        }));
        setImportModalOpen(false);
        setImportText("");
        setSelectedFile(null);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Fel vid AI-analys av profil"
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

  // Project / Portfolio helpers
  const addProject = () => {
    const newProj: Project = {
      name: "",
      description: "",
      link: "",
      techStack: [],
    };
    setProfile({
      ...profile,
      projects: [newProj, ...(profile.projects || [])],
    });
  };

  const updateProject = (
    index: number,
    field: keyof Project,
    val: unknown
  ) => {
    const projs = [...(profile.projects || [])];
    projs[index] = { ...projs[index], [field]: val };
    setProfile({ ...profile, projects: projs });
  };

  const removeProject = (index: number) => {
    setProfile({
      ...profile,
      projects: (profile.projects || []).filter((_, i) => i !== index),
    });
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

        {/* Profilbild Väljare */}
        <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <img
                src={profile.photoUrl || "/profile/cv_rum_gron_vaxt.jpg"}
                alt="Aktiv profilbild"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-white shadow-md dark:border-neutral-700"
              />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-blue-600" />
                  Profilbild för CV & Ansökningar
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  Synkas till A4 PDF
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                Klicka på fotot du vill använda i ditt CV och utskrifter. Bilderna är hämtade från din lokala <code className="text-[11px] font-mono bg-neutral-200 dark:bg-neutral-700 px-1 py-0.5 rounded">Assets</code>-mapp.
              </p>

              {/* Thumbnails grid */}
              <div className="mt-3 flex flex-wrap gap-2">
                {AVAILABLE_PHOTOS.map((p) => {
                  const isSelected =
                    (profile.photoUrl || "/profile/cv_rum_gron_vaxt.jpg") === p.path;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfile({ ...profile, photoUrl: p.path })}
                      className={`group relative flex items-center gap-2 rounded-lg border p-1.5 transition-all text-left ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 shadow-xs dark:border-blue-500 dark:bg-blue-950/50"
                          : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
                      }`}
                    >
                      <img
                        src={p.path}
                        alt={p.name}
                        className="h-8 w-8 rounded-md object-cover"
                      />
                      <div className="pr-1">
                        <div className="text-[11px] font-medium text-neutral-900 dark:text-white">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          {p.tag}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="ml-auto flex h-2 w-2 rounded-full bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

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

      {/* Section 5: Projekt & Portfolio */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
              <FolderGit2 className="h-5 w-5 text-blue-600" />
              Projekt & Portfolio ({profile.projects?.length || 0})
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Egna projekt, kundcase eller utvalda arbeten från LinkedIn och portfolio.
            </p>
          </div>
          <button
            onClick={addProject}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Lägg till projekt
          </button>
        </div>

        {(!profile.projects || profile.projects.length === 0) ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            Inga projekt tillagda än. Klicka på ”Lägg till projekt” eller ladda upp din LinkedIn-PDF med AI.
          </div>
        ) : (
          <div className="space-y-4">
            {profile.projects.map((proj, idx) => (
              <div
                key={idx}
                className="relative rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50"
              >
                <button
                  onClick={() => removeProject(idx)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-red-600"
                  title="Ta bort projekt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Projektnamn
                    </label>
                    <input
                      type="text"
                      value={proj.name}
                      onChange={(e) =>
                        updateProject(idx, "name", e.target.value)
                      }
                      placeholder="t.ex. E-handelsplattform eller Portfoliosida"
                      className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Länk / URL
                    </label>
                    <input
                      type="text"
                      value={proj.link || ""}
                      onChange={(e) =>
                        updateProject(idx, "link", e.target.value)
                      }
                      placeholder="https://github.com/... eller https://demo.se"
                      className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Beskrivning
                    </label>
                    <textarea
                      rows={2}
                      value={proj.description}
                      onChange={(e) =>
                        updateProject(idx, "description", e.target.value)
                      }
                      placeholder="Beskriv vad projektet gör, din roll och vilka resultat som uppnåddes..."
                      className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Teknologier (separera med komma)
                    </label>
                    <input
                      type="text"
                      value={proj.techStack?.join(", ") || ""}
                      onChange={(e) => {
                        const items = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        updateProject(idx, "techStack", items);
                      }}
                      placeholder="React, TypeScript, Next.js, Tailwind CSS"
                      className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Importera CV & LinkedIn-portfolio med AI
                </h3>
              </div>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setSelectedFile(null);
                  setErrorMessage(null);
                }}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mb-4 flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setImportMode("pdf")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition ${
                  importMode === "pdf"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-900 dark:text-blue-400"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                <FileUp className="h-4 w-4" />
                Ladda upp PDF (LinkedIn / CV)
              </button>
              <button
                type="button"
                onClick={() => setImportMode("text")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition ${
                  importMode === "text"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-neutral-900 dark:text-blue-400"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                <FileText className="h-4 w-4" />
                Klistra in text
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {importMode === "pdf" ? (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (
                        file.type === "application/pdf" ||
                        file.name.toLowerCase().endsWith(".pdf")
                      ) {
                        setSelectedFile(file);
                        setErrorMessage(null);
                      } else {
                        setErrorMessage("Endast PDF-filer stöds.");
                      }
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-800/30"
                  }`}
                >
                  <input
                    type="file"
                    id="pdf-upload-input"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        setErrorMessage(null);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50/80 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {(selectedFile.size / 1024).toFixed(0)} KB • PDF redo för analys
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"
                        title="Välj en annan fil"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="pdf-upload-input"
                      className="flex cursor-pointer flex-col items-center justify-center gap-2"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Dra och släpp din LinkedIn PDF här, eller{" "}
                        <span className="text-blue-600 hover:underline dark:text-blue-400">
                          bläddra på datorn
                        </span>
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Stödjer PDF-exporter från LinkedIn, CV eller portfoliosammanställning (max 10 MB)
                      </p>
                    </label>
                  )}
                </div>

                {/* LinkedIn Tips Box */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-950 dark:border-blue-950/60 dark:bg-blue-950/20 dark:text-blue-200">
                  <p className="font-semibold mb-1">
                    💡 Så sparar du din LinkedIn-profil som PDF:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-blue-900/80 dark:text-blue-300">
                    <li>Gå till din profil på LinkedIn i webbläsaren.</li>
                    <li>Klicka på knappen <strong>Mer</strong> (eller <em>More</em>) bredvid profilbilden.</li>
                    <li>Välj <strong>Spara som PDF</strong> (<em>Save to PDF</em>).</li>
                    <li>Ladda upp den sparade filen i rutan ovanför!</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
                  Klistra in all text från ditt befintliga CV, LinkedIn-profil eller din portfoliosida här. Vår AI strukturerar och mappar automatiskt alla roller, datum och kompetenser.
                </p>
                <textarea
                  rows={10}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Klistra in din text här... t.ex:&#10;Anna Andersson&#10;Fullstack Developer i Göteborg&#10;&#10;Erfarenhet:&#10;Volvo Group (2021-nuvarande)..."
                  className="w-full rounded-lg border border-neutral-300 p-3 text-xs font-mono focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setSelectedFile(null);
                  setErrorMessage(null);
                }}
                disabled={importing}
                className="rounded-lg px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleImportAI}
                disabled={
                  importing ||
                  (importMode === "pdf" && !selectedFile) ||
                  (importMode === "text" && !importText.trim())
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {importMode === "pdf"
                      ? "Analyserar LinkedIn PDF med AI..."
                      : "Analyserar och extraherar..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {importMode === "pdf"
                      ? "Importera och analysera PDF"
                      : "Analysera och fyll i mitt CV"}
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
