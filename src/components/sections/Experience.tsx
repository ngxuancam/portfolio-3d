import { resume } from "@/content/resume";
import { Chapter, chapterStyles as c } from "./Chapter";
import styles from "./Experience.module.css";

/** "2023-03" → "2023.03": log-style stamps read better in mono than month names. */
const stamp = (isoMonth: string) => isoMonth.replace("-", ".");

/** Chapter 03 — the flight log: one entry per role, newest first, on a vertical timeline. */
export function Experience() {
  const { experience } = resume;
  const earliest = experience.reduce((min, e) => (e.startDate < min ? e.startDate : min), experience[0]?.startDate ?? "");

  return (
    <Chapter
      id="experience"
      index={3}
      label="Experience"
      title="Experience"
      readout={`${experience.length} entries · since ${earliest.slice(0, 4)}`}
    >
      <ol className={styles.log}>
        {experience.map((job, i) => (
          <li key={job.id} className={[styles.log__entry, job.endDate ? "" : styles["log__entry--current"], c.reveal].join(" ")}>
            <span className={styles.log__node} aria-hidden="true" />

            <p className={`u-label ${styles.log__dates}`}>
              <span className={styles.log__seq} aria-hidden="true">
                {String(experience.length - i).padStart(2, "0")}
              </span>
              <time dateTime={job.startDate}>{stamp(job.startDate)}</time>
              <span aria-hidden="true"> — </span>
              <span className="u-visually-hidden"> to </span>
              {job.endDate ? (
                <time dateTime={job.endDate}>{stamp(job.endDate)}</time>
              ) : (
                <span className={styles.log__now}>Present</span>
              )}
            </p>

            <div className={styles.log__body}>
              <h3 className={styles.log__role}>{job.role}</h3>
              <p className={styles.log__where}>
                {job.companyUrl ? (
                  <a href={job.companyUrl} target="_blank" rel="noopener" className={styles.log__company}>
                    {job.company}
                    <span className="u-visually-hidden"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className={styles.log__company}>{job.company}</span>
                )}
                <span className={styles.log__place}> · {job.location}</span>
              </p>
              <p className={styles.log__summary}>{job.summary}</p>
              <ul className={styles.log__highlights}>
                {job.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <ul className={c.tags} aria-label={`Stack at ${job.company}`}>
                {job.stack.map((s) => (
                  <li key={s} className={c.tag}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Chapter>
  );
}
