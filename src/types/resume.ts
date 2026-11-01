/**
 * Domain model for the résumé. Every surface (HTML page, JSON-LD, llms.txt,
 * resume.json) is derived from one `Resume` object, so the data is written once
 * and can never drift between what humans see and what crawlers/agents read.
 */

export interface SocialProfile {
  readonly network: "GitHub" | "LinkedIn" | "X" | "Email" | "Website";
  readonly username: string;
  readonly url: string;
}

export interface Basics {
  readonly name: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly label: string;
  readonly headline: string;
  readonly summary: string;
  readonly email: string;
  readonly location: {
    readonly city: string;
    readonly region: string;
    readonly countryCode: string;
  };
  readonly siteUrl: string;
  readonly availability: string;
  readonly profiles: readonly SocialProfile[];
}

export interface Metric {
  readonly value: number;
  readonly suffix: string;
  readonly label: string;
}

export type SkillLevel = "expert" | "advanced" | "proficient";

export interface SkillGroup {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly skills: readonly { readonly name: string; readonly level: SkillLevel }[];
}

export interface Experience {
  readonly id: string;
  readonly company: string;
  readonly companyUrl?: string;
  readonly role: string;
  /** ISO 8601 (YYYY-MM) */
  readonly startDate: string;
  /** ISO 8601 (YYYY-MM); omitted = current role */
  readonly endDate?: string;
  readonly location: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly stack: readonly string[];
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly year: number;
  readonly url?: string;
  readonly repoUrl?: string;
  readonly stack: readonly string[];
  readonly outcome: string;
  /** CSS color used for the card's accent glow */
  readonly accent: string;
}

export interface Education {
  readonly institution: string;
  readonly area: string;
  readonly studyType: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface Resume {
  readonly basics: Basics;
  readonly metrics: readonly Metric[];
  readonly skillGroups: readonly SkillGroup[];
  readonly experience: readonly Experience[];
  readonly projects: readonly Project[];
  readonly education: readonly Education[];
  readonly languages: readonly { readonly language: string; readonly fluency: string }[];
  /** ISO date the content was last edited — feeds sitemap lastModified */
  readonly updatedAt: string;
}
