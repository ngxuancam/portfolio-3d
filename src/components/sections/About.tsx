import { resume } from "@/content/resume";
import { Chapter, chapterStyles as c } from "./Chapter";
import { CountUp } from "./CountUp";
import styles from "./About.module.css";

const year = (isoMonth: string) => isoMonth.slice(0, 4);

/** Chapter 01 — who: the summary, the facts sheet and the headline metrics. */
export function About() {
  const { basics, metrics, languages, education } = resume;
  const { city, region, countryCode } = basics.location;
  const place = city === region ? `${city}, ${countryCode}` : `${city}, ${region}, ${countryCode}`;

  return (
    <Chapter
      id="about"
      index={1}
      label="About"
      title="About"
      readout={`${metrics.length} readings · ${languages.length} languages`}
    >
      <p className={`${styles.about__summary} ${c.reveal}`}>{basics.summary}</p>

      <dl className={`${styles.about__facts} ${c.reveal}`}>
        <div className={styles.about__fact}>
          <dt className={`u-label ${c.key}`}>Location</dt>
          <dd>{place}</dd>
        </div>
        <div className={styles.about__fact}>
          <dt className={`u-label ${c.key}`}>Languages</dt>
          {languages.map((l) => (
            <dd key={l.language}>
              {l.language} <span className={styles.about__muted}>· {l.fluency}</span>
            </dd>
          ))}
        </div>
        <div className={styles.about__fact}>
          <dt className={`u-label ${c.key}`}>Education</dt>
          {education.map((e) => (
            <dd key={e.institution + e.startDate}>
              {e.studyType}, {e.area}
              <span className={styles.about__muted}>
                {" "}
                · {e.institution} · {year(e.startDate)}–{year(e.endDate)}
              </span>
            </dd>
          ))}
        </div>
      </dl>

      <ul className={styles.about__metrics} aria-label="Key metrics">
        {metrics.map((m) => (
          <li key={m.label} className={`${styles.about__metric} ${c.reveal}`}>
            <CountUp value={m.value} suffix={m.suffix} className={styles.about__value} />
            <span className={styles.about__label}>{m.label}</span>
          </li>
        ))}
      </ul>
    </Chapter>
  );
}
