import { resume } from "@/content/resume";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stitching } from "@/components/ui/Stitching";
import styles from "./Experience.module.css";

const monthFormatter = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const formatMonth = (isoMonth: string) => monthFormatter.format(new Date(`${isoMonth}-01T00:00:00Z`));

export function Experience() {
  return (
    <section id="experience" className={styles.experience} aria-labelledby="experience-title">
      <div className="u-container">
        <SectionHeader index="03" eyebrow="Experience" title="Where I've shipped." titleId="experience-title" />

        <div className={styles["experience__timeline"]}>
          <div className={styles["experience__rail"]} aria-hidden="true" />
          <ol className={styles["experience__list"]}>
          {resume.experience.map((job) => (
            <li key={job.id} className={styles["experience__item"]}>
              <article className={`${styles["experience__card"]} u-card`} data-reveal="slideLeft">
                <Stitching />
                <header className={styles["experience__header"]}>
                  <p className={styles["experience__period"]}>
                    <time dateTime={job.startDate}>{formatMonth(job.startDate)}</time>
                    {" — "}
                    {job.endDate ? <time dateTime={job.endDate}>{formatMonth(job.endDate)}</time> : "Present"}
                  </p>
                  <h3 className={styles["experience__role"]}>{job.role}</h3>
                  <p className={styles["experience__company"]}>
                    {job.company} <span aria-hidden="true">·</span> {job.location}
                  </p>
                </header>
                <p className={styles["experience__summary"]}>{job.summary}</p>
                <ul className={styles["experience__highlights"]}>
                  {job.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <ul className={styles["experience__stack"]} aria-label="Tech stack">
                  {job.stack.map((tech) => (
                    <li key={tech}>{tech}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
