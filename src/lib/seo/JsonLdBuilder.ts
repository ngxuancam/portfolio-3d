import type { Resume } from "@/types/resume";

type JsonLdNode = Record<string, unknown> & { "@type": string; "@id"?: string };

/**
 * Builder pattern: composes a single schema.org `@graph` so search engines and
 * LLM agents get one connected entity graph (ProfilePage → Person → works,
 * employers, skills) instead of several disconnected blobs.
 *
 * Usage:
 *   new JsonLdBuilder(resume).withWebSite().withProfilePage().withPerson().withProjects().build()
 */
export class JsonLdBuilder {
  private readonly nodes: JsonLdNode[] = [];
  private readonly origin: string;

  constructor(private readonly resume: Resume) {
    this.origin = resume.basics.siteUrl.replace(/\/$/, "");
  }

  private id(fragment: string): string {
    return `${this.origin}/#${fragment}`;
  }

  withWebSite(): this {
    const { basics } = this.resume;
    this.nodes.push({
      "@type": "WebSite",
      "@id": this.id("website"),
      url: this.origin,
      name: `${basics.name} — ${basics.label}`,
      inLanguage: "en",
      publisher: { "@id": this.id("person") },
    });
    return this;
  }

  withProfilePage(): this {
    this.nodes.push({
      "@type": "ProfilePage",
      "@id": this.id("profilepage"),
      url: this.origin,
      name: `${this.resume.basics.name} · Résumé`,
      isPartOf: { "@id": this.id("website") },
      mainEntity: { "@id": this.id("person") },
      dateModified: this.resume.updatedAt,
    });
    return this;
  }

  withPerson(): this {
    const { basics, skillGroups, experience, education, languages } = this.resume;
    const current = experience.find((job) => !job.endDate);

    this.nodes.push({
      "@type": "Person",
      "@id": this.id("person"),
      name: basics.name,
      givenName: basics.givenName,
      familyName: basics.familyName,
      jobTitle: basics.label,
      description: basics.summary,
      email: `mailto:${basics.email}`,
      url: this.origin,
      address: {
        "@type": "PostalAddress",
        addressLocality: basics.location.city,
        addressRegion: basics.location.region,
        addressCountry: basics.location.countryCode,
      },
      sameAs: basics.profiles.filter((p) => p.network !== "Email").map((p) => p.url),
      knowsAbout: skillGroups.flatMap((group) => group.skills.map((skill) => skill.name)),
      knowsLanguage: languages.map((l) => l.language),
      ...(current && {
        worksFor: { "@type": "Organization", name: current.company, url: current.companyUrl },
      }),
      alumniOf: education.map((e) => ({ "@type": "EducationalOrganization", name: e.institution })),
      hasOccupation: experience.map((job) => ({
        "@type": "Role",
        roleName: job.role,
        startDate: job.startDate,
        ...(job.endDate && { endDate: job.endDate }),
        description: job.summary,
        hasOccupation: { "@type": "Occupation", name: job.role, skills: job.stack.join(", ") },
      })),
    });
    return this;
  }

  withProjects(): this {
    this.nodes.push({
      "@type": "ItemList",
      "@id": this.id("projects"),
      name: "Selected projects",
      itemListElement: this.resume.projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "CreativeWork",
          name: project.name,
          headline: project.tagline,
          abstract: project.description,
          dateCreated: String(project.year),
          keywords: project.stack.join(", "),
          creator: { "@id": this.id("person") },
          ...(project.url && { url: project.url }),
        },
      })),
    });
    return this;
  }

  build(): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
    return { "@context": "https://schema.org", "@graph": [...this.nodes] };
  }

  /** Serialised safely for an inline <script> — `<` is escaped to block `</script>` injection. */
  toScriptString(): string {
    return JSON.stringify(this.build()).replace(/</g, "\\u003c");
  }
}
