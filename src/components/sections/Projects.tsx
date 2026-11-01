import type { CSSProperties } from "react";
import { resume } from "@/content/resume";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stitching } from "@/components/ui/Stitching";
import { HorizontalScroller } from "@/components/motion/HorizontalScroller";
import styles from "./Projects.module.css";

export function Projects() {
  return (
    <section id="projects" className={styles.projects} aria-labelledby="projects-title">
      <div className="u-container">
        <SectionHeader
          index="04"
          eyebrow="Selected work"
          title="Things I've built."
          titleId="projects-title"
          lead="A few projects where performance, motion and architecture had to work together."
        />
      </div>

      <HorizontalScroller className={styles["projects__viewport"]} trackClassName={styles["projects__track"]}>
        {resume.projects.map((project, i) => (
          <article
            key={project.id}
            className={`${styles["projects__card"]} u-card`}
            style={{ "--card-accent": project.accent } as CSSProperties}
            data-card
            data-cursor
          >
            <Stitching />
            <div className={styles["projects__card-top"]}>
              <span className={styles["projects__card-index"]}>{String(i + 1).padStart(2, "0")}</span>
              <span className={styles["projects__card-year"]}>{project.year}</span>
            </div>
            <div className={styles["projects__card-art"]} aria-hidden="true">
              <span className={styles["projects__card-glyph"]}>{project.name.charAt(0)}</span>
            </div>
            <h3 className={styles["projects__card-title"]}>{project.name}</h3>
            <p className={styles["projects__card-tagline"]}>{project.tagline}</p>
            <p className={styles["projects__card-text"]}>{project.description}</p>
            <p className={styles["projects__card-outcome"]}>{project.outcome}</p>
            <ul className={styles["projects__card-stack"]} aria-label="Tech stack">
              {project.stack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </article>
        ))}
      </HorizontalScroller>
    </section>
  );
}
