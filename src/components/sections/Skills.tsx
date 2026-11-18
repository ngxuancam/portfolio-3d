import type { CSSProperties } from "react";
import { resume } from "@/content/resume";
import type { SkillLevel } from "@/types/resume";
import { Chapter, chapterStyles as c } from "./Chapter";
import styles from "./Skills.module.css";

/** Segments lit per level on a three-segment meter. */
const LEVEL_SEGMENTS: Record<SkillLevel, number> = { proficient: 1, advanced: 2, expert: 3 };
const SEGMENTS = 3;

/** Chapter 02 — instruments: each skill group is a small readout table with segmented meters. */
export function Skills() {
  const { skillGroups } = resume;
  const total = skillGroups.reduce((sum, g) => sum + g.skills.length, 0);

  return (
    <Chapter
      id="skills"
      index={2}
      label="Skills"
      title="Skills"
      readout={`${skillGroups.length} groups · ${total} instruments`}
    >
      <div className={styles.skills__groups}>
        {skillGroups.map((group, gi) => (
          <table key={group.id} className={`${styles.skills__table} ${c.reveal}`}>
            <caption className={styles.skills__caption}>
              <span className={`u-label ${styles.skills__code}`} aria-hidden="true">
                {String(gi + 1).padStart(2, "0")}.{group.id}
              </span>
              <span className={styles.skills__title}>{group.title}</span>
              <span className={styles.skills__desc}>{group.description}</span>
            </caption>
            <thead className="u-visually-hidden">
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Level</th>
              </tr>
            </thead>
            <tbody>
              {group.skills.map((skill) => {
                const lit = LEVEL_SEGMENTS[skill.level];
                return (
                  <tr key={skill.name} className={styles.skills__row}>
                    <th scope="row" className={styles.skills__name}>
                      {skill.name}
                    </th>
                    <td className={styles.skills__reading}>
                      {/* the meter restates the level text next to it, so it is decorative */}
                      <span className={styles.meter} aria-hidden="true">
                        {Array.from({ length: SEGMENTS }, (_, i) => (
                          <span
                            key={i}
                            className={`${styles.meter__seg} ${i < lit ? styles["meter__seg--on"] : ""}`}
                            style={{ "--s": i } as CSSProperties}
                          />
                        ))}
                      </span>
                      <span className={`u-label ${styles.skills__level}`}>{skill.level}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </Chapter>
  );
}
