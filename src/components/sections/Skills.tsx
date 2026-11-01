import { resume } from "@/content/resume";
import type { SkillLevel } from "@/types/resume";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stitching } from "@/components/ui/Stitching";
import styles from "./Skills.module.css";

/** Lookup table instead of branching in JSX — adding a level is a one-line change. */
const LEVEL_MODIFIER: Record<SkillLevel, string> = {
  expert: styles["skills__chip--expert"],
  advanced: styles["skills__chip--advanced"],
  proficient: styles["skills__chip--proficient"],
};

export function Skills() {
  const marquee = resume.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name));

  return (
    <section id="skills" className={styles.skills} aria-labelledby="skills-title">
      <div className="u-container">
        <SectionHeader
          index="02"
          eyebrow="Capabilities"
          title="A full stack of craft."
          titleId="skills-title"
          lead="From server-rendered architecture to GPU shaders — each layer measured, typed and built to last."
        />

        <div className={styles["skills__grid"]}>
          {resume.skillGroups.map((group, i) => (
            <article key={group.id} className={`${styles["skills__card"]} u-card`} data-reveal="rise">
              <Stitching />
              <span className={styles["skills__card-index"]}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className={styles["skills__card-title"]}>{group.title}</h3>
              <p className={styles["skills__card-text"]}>{group.description}</p>
              <ul className={styles["skills__chips"]} aria-label={`${group.title} skills`}>
                {group.skills.map((skill) => (
                  <li key={skill.name} className={`${styles["skills__chip"]} ${LEVEL_MODIFIER[skill.level]}`}>
                    {skill.name}
                    <span className="u-visually-hidden"> — {skill.level}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <ul className={styles["skills__legend"]} aria-label="Skill level legend" data-reveal="fade">
          <li className={`${styles["skills__chip"]} ${styles["skills__chip--expert"]}`}>Expert</li>
          <li className={`${styles["skills__chip"]} ${styles["skills__chip--advanced"]}`}>Advanced</li>
          <li className={`${styles["skills__chip"]} ${styles["skills__chip--proficient"]}`}>Proficient</li>
        </ul>
      </div>

      {/* CSS-only marquee: pure compositor animation, no JS cost */}
      <div className={styles["skills__marquee"]} aria-hidden="true">
        <div className={styles["skills__marquee-track"]}>
          {[...marquee, ...marquee].map((name, i) => (
            <span key={i} className={styles["skills__marquee-item"]}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
