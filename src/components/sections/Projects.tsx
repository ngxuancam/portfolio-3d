import type { CSSProperties } from "react";
import { resume } from "@/content/resume";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Chapter, CornerMarks, chapterStyles as c } from "./Chapter";
import styles from "./Projects.module.css";

/** Chapter 04 — builds: one flat instrument card per project, newest first. */
export function Projects() {
  const { projects } = resume;
  const years = projects.map((p) => p.year);
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";

  return (
    <Chapter id="projects" index={4} label="Projects" title="Selected projects" readout={`${projects.length} builds · ${span}`}>
      <ul className={styles.projects}>
        {projects.map((project, i) => {
          const code = String(i + 1).padStart(2, "0");
          const titleId = `project-${project.id}`;
          return (
            <li key={project.id} className={c.reveal}>
              <article className={styles.card} aria-labelledby={titleId} style={{ "--accent": project.accent } as CSSProperties}>
                <CornerMarks />

                {/* No screenshots in the data, so the visual is a generated "schematic plate":
                    the project's accent on a hairline grid, with its log code and year. */}
                <div className={styles.card__media} aria-hidden="true">
                  <div className={styles.card__plate}>
                    <span className={styles.card__code}>{code}</span>
                    <span className={`u-label ${styles.card__plateMeta}`}>
                      {project.id} · {project.year}
                    </span>
                    <span className={styles.card__cross} />
                  </div>
                </div>

                <div className={styles.card__body}>
                  <p className={`u-label ${styles.card__meta}`}>
                    <span className={styles.card__swatch} aria-hidden="true" />
                    <span>{project.year}</span>
                    <span aria-hidden="true">/</span>
                    <span>{project.tagline}</span>
                  </p>
                  <h3 id={titleId} className={styles.card__name}>
                    {project.name}
                  </h3>
                  <p className={styles.card__desc}>{project.description}</p>

                  <div className={styles.card__outcome}>
                    <span className={`u-label ${c.key}`}>Outcome</span>
                    <p>{project.outcome}</p>
                  </div>

                  <ul className={c.tags} aria-label={`${project.name} stack`}>
                    {project.stack.map((s) => (
                      <li key={s} className={c.tag}>
                        {s}
                      </li>
                    ))}
                  </ul>

                  {(project.url || project.repoUrl) && (
                    <div className={styles.card__actions}>
                      {project.url && (
                        <ButtonLink href={project.url} variant="solid" external>
                          Live<span className="u-visually-hidden"> site for {project.name} (opens in a new tab)</span>
                        </ButtonLink>
                      )}
                      {project.repoUrl && (
                        <ButtonLink href={project.repoUrl} external>
                          Source<span className="u-visually-hidden"> code for {project.name} (opens in a new tab)</span>
                        </ButtonLink>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Chapter>
  );
}
