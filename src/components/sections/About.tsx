import { resume } from "@/content/resume";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CountUp } from "@/components/motion/CountUp";
import { Stitching } from "@/components/ui/Stitching";
import styles from "./About.module.css";

export function About() {
  const { basics, metrics, languages, education } = resume;

  return (
    <section id="about" className={styles.about} aria-labelledby="about-title">
      <div className="u-container">
        <SectionHeader index="01" eyebrow="About" title="Engineering that feels effortless." titleId="about-title" />

        <div className={styles["about__grid"]}>
          <p className={styles["about__summary"]} data-reveal="rise">
            {basics.summary}
          </p>

          <div className={`${styles["about__facts-card"]} u-card`}>
            <Stitching />
            <dl className={styles["about__facts"]}>
            <div className={styles["about__fact"]} data-reveal="rise">
              <dt>Based in</dt>
              <dd>
                {basics.location.city}, {basics.location.countryCode}
              </dd>
            </div>
            <div className={styles["about__fact"]} data-reveal="rise">
              <dt>Languages</dt>
              <dd>{languages.map((l) => `${l.language} (${l.fluency})`).join(" · ")}</dd>
            </div>
            {education.map((e) => (
              <div key={e.institution} className={styles["about__fact"]} data-reveal="rise">
                <dt>Education</dt>
                <dd>
                  {e.studyType}, {e.area} — {e.institution}
                </dd>
              </div>
            ))}
            </dl>
          </div>
        </div>

        <div className={`${styles["about__metrics-card"]} u-card`}>
          <Stitching />
          <ul className={styles["about__metrics"]}>
          {metrics.map((metric) => (
            <li key={metric.label} className={styles["about__metric"]} data-reveal="scale">
              <CountUp value={metric.value} suffix={metric.suffix} className={styles["about__metric-value"]} />
              <span className={styles["about__metric-label"]}>{metric.label}</span>
            </li>
          ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
