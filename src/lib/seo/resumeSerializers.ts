import type { Resume } from "@/types/resume";

/**
 * Adapter functions: translate the internal `Resume` model into formats other
 * consumers already understand — llms.txt for AI agents, JSON Resume for ATS
 * tools. Pure functions, so they are trivially cacheable and testable.
 */

const formatRange = (start: string, end?: string) => `${start} – ${end ?? "present"}`;

export function toLlmsTxt(resume: Resume): string {
  const { basics, skillGroups, experience, projects, education, languages } = resume;
  const origin = basics.siteUrl.replace(/\/$/, "");

  return [
    `# ${basics.name}`,
    "",
    `> ${basics.label} based in ${basics.location.city}, ${basics.location.countryCode}. ${basics.summary}`,
    "",
    `Availability: ${basics.availability}`,
    `Contact: ${basics.email}`,
    ...basics.profiles.filter((p) => p.network !== "Email").map((p) => `${p.network}: ${p.url}`),
    "",
    "## Machine-readable",
    "",
    `- [Résumé (JSON Resume schema)](${origin}/resume.json): full structured history`,
    `- [Portfolio page](${origin}/): human-readable version with schema.org Person JSON-LD`,
    "",
    "## Skills",
    "",
    ...skillGroups.map(
      (g) => `- **${g.title}**: ${g.skills.map((s) => `${s.name} (${s.level})`).join(", ")}`,
    ),
    "",
    "## Experience",
    "",
    ...experience.flatMap((job) => [
      `### ${job.role} — ${job.company} (${formatRange(job.startDate, job.endDate)})`,
      "",
      job.summary,
      ...job.highlights.map((h) => `- ${h}`),
      `- Stack: ${job.stack.join(", ")}`,
      "",
    ]),
    "## Projects",
    "",
    ...projects.map(
      (p) => `- **${p.name}** (${p.year}) — ${p.tagline}. ${p.description} Outcome: ${p.outcome}. Stack: ${p.stack.join(", ")}.`,
    ),
    "",
    "## Education",
    "",
    ...education.map(
      (e) => `- ${e.studyType}, ${e.area} — ${e.institution} (${formatRange(e.startDate, e.endDate)})`,
    ),
    "",
    "## Languages",
    "",
    ...languages.map((l) => `- ${l.language}: ${l.fluency}`),
    "",
  ].join("\n");
}

/** https://jsonresume.org/schema */
export function toJsonResume(resume: Resume) {
  const { basics, skillGroups, experience, projects, education, languages } = resume;
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: basics.name,
      label: basics.label,
      email: basics.email,
      url: basics.siteUrl,
      summary: basics.summary,
      location: { city: basics.location.city, region: basics.location.region, countryCode: basics.location.countryCode },
      profiles: basics.profiles
        .filter((p) => p.network !== "Email")
        .map(({ network, username, url }) => ({ network, username, url })),
    },
    work: experience.map((job) => ({
      name: job.company,
      position: job.role,
      url: job.companyUrl,
      startDate: job.startDate,
      endDate: job.endDate,
      summary: job.summary,
      highlights: job.highlights,
    })),
    projects: projects.map((p) => ({
      name: p.name,
      description: p.description,
      highlights: [p.outcome],
      keywords: p.stack,
      startDate: String(p.year),
      url: p.url,
    })),
    education: education.map((e) => ({ ...e })),
    skills: skillGroups.map((g) => ({ name: g.title, keywords: g.skills.map((s) => s.name) })),
    languages: languages.map((l) => ({ ...l })),
    meta: { lastModified: resume.updatedAt },
  };
}
