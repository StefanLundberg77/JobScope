// Domain types for JobScope

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

export interface Education {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Language {
  language: string;
  proficiency: string;
}

export interface Project {
  name: string;
  description: string;
  link?: string;
  techStack: string[];
}

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

export interface MatchAnalysis {
  score: number; // 0-100
  summary: string;
  strongMatches: string[];
  transferableSkills: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export interface TailoredCvData {
  tailoredSummary: string;
  tailoredExperiences: WorkExperience[];
  tailoredSkills: SkillCategory[];
  coverLetter: string;
  diffNotes: {
    section: string;
    change: string;
    rationale: string;
  }[];
  matchAnalysis: MatchAnalysis;
}

export type ApplicationStatus =
  | "saved"
  | "tailored"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";

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
    tailoredSummary: string;
    tailoredExperiences: WorkExperience[];
    tailoredSkills: SkillCategory[];
    coverLetter: string;
    diffNotes?: { section: string; change: string; rationale: string }[];
    notes?: string | null;
    updatedAt: string;
  }[];
}

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
}
