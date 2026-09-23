/**
 * Domain types and data contracts for the JobScope application.
 * Defines shared interfaces across the database layer, API handlers,
 * Gemini AI analysis/tailoring engine, and frontend components.
 */

/**
 * Represents a single employment history entry in the candidate's CV.
 */
export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  achievements: string[];
  skills: string[];
}

/**
 * Represents a formal education, degree, or training program entry.
 */
export interface Education {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

/**
 * Categorized skills container (e.g. Programming Languages, Frameworks, Cloud & DevOps).
 */
export interface SkillCategory {
  category: string;
  items: string[];
}

/**
 * Spoken and written language proficiency entry.
 */
export interface Language {
  language: string;
  proficiency: string;
}

/**
 * Authentic portfolio, open-source, or thesis project entry.
 */
export interface Project {
  name: string;
  description: string;
  link?: string;
  techStack: string[];
}

/**
 * The single source of truth for the candidate's background, CV, and portfolio.
 */
export interface MasterProfileData {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  summary: string;
  website: string;
  linkedin: string;
  github: string;
  experiences: WorkExperience[];
  education: Education[];
  skills: SkillCategory[];
  languages: Language[];
  projects: Project[];
  rawText?: string;
  photoUrl?: string;
}

/**
 * ATS semantic match analysis produced by Gemini comparing a job posting with MasterProfileData.
 */
export interface MatchAnalysis {
  score: number; // Semantic alignment percentage (0-100)
  summary: string;
  strongMatches: string[];
  transferableSkills: string[];
  missingKeywords: string[];
  suggestions: string[];
}

/**
 * AI-tailored resume, cover letter, and diff notes generated specifically for a job opportunity.
 */
export interface TailoredCvData {
  language?: "sv" | "en";
  tailoredSummary: string;
  tailoredExperiences: WorkExperience[];
  tailoredSkills: SkillCategory[];
  coverLetter: string;
  emailSubject: string;
  emailBody: string;
  diffNotes: {
    section: string;
    change: string;
    rationale: string;
  }[];
  matchAnalysis: MatchAnalysis;
}

/**
 * Options for configuring AI resume and cover letter tailoring.
 */
export interface TailorOptions {
  language?: "sv" | "en" | "auto";
  model?: string;
}

/**
 * Application pipeline status stages for the Kanban tracker.
 */
export type ApplicationStatus =
  | "saved"
  | "tailored"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";

/**
 * Persisted job listing entity combining raw metadata, requirements, and tailoring history.
 */
export interface JobItem {
  id: string;
  externalId?: string | null;
  title: string;
  company: string;
  location: string;
  workplaceType: "onsite" | "hybrid" | "remote";
  url?: string | null;
  source: "jobtech" | "linkedin" | "custom_url" | "manual";
  publishedAt?: string | null;
  deadline?: string | null;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  status: ApplicationStatus;
  matchScore?: number | null;
  matchAnalysis?: MatchAnalysis | null;
  applications?: {
    id: string;
    language?: "sv" | "en" | string;
    tailoredSummary: string;
    tailoredExperiences: WorkExperience[];
    tailoredSkills: SkillCategory[];
    coverLetter: string;
    emailSubject?: string;
    emailBody?: string;
    diffNotes?: { section: string; change: string; rationale: string }[];
    notes?: string | null;
    updatedAt: string;
  }[];
}

/**
 * Normalized job posting hit returned by search providers (JobTech Dev API and public LinkedIn).
 */
export interface UnifiedJobHit {
  id: string;
  headline: string;
  employer: {
    name: string;
    workplace?: string;
    url?: string;
  };
  workplace_address?: {
    municipality?: string;
    region?: string;
    city?: string;
  };
  workplace_model?: "remote" | "hybrid" | "onsite" | string;
  publication_date: string;
  application_deadline?: string;
  webpage_url?: string;
  application_details?: {
    url?: string;
    email?: string;
    reference?: string;
  };
  source: "jobtech" | "linkedin";
  description?: {
    text?: string;
  };
  must_have?: {
    skills?: { label: string }[];
  };
  nice_to_have?: {
    skills?: { label: string }[];
  };
  isBlocked?: boolean;
}

/**
 * Entity representing an ignored or blocked job ad.
 */
export interface BlockedJobItem {
  id: string;
  externalId: string;
  title?: string | null;
  company?: string | null;
  createdAt: string;
}

