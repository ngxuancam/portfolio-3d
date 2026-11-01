import { resume } from "@/content/resume";
import { MagneticLink } from "@/components/motion/MagneticLink";
import styles from "./Contact.module.css";

export function Contact() {
  const { basics } = resume;
  const socials = basics.profiles.filter((p) => p.network !== "Email");

  return (
    <section id="contact" className={styles.contact} aria-labelledby="contact-title">
      <div className={`${styles["contact__inner"]} u-container`}>
        <p className={styles["contact__eyebrow"]} data-reveal="fade">
          <span>05</span> Contact
        </p>
        <h2 id="contact-title" className={styles["contact__title"]} data-reveal="rise">
          Let&apos;s build something <em className={styles["contact__title-em"]}>remarkable</em>.
        </h2>
        <div data-reveal="scale">
          <MagneticLink href={`mailto:${basics.email}`} className={styles["contact__mail"]} strength={0.25}>
            {basics.email}
          </MagneticLink>
        </div>
        <ul className={styles["contact__socials"]} data-reveal="rise">
          {socials.map((profile) => (
            <li key={profile.network}>
              <a href={profile.url} className={styles["contact__social"]} rel="me noopener" target="_blank">
                {profile.network}
                <span aria-hidden="true"> ↗</span>
              </a>
            </li>
          ))}
          <li>
            <a href="/resume.json" className={styles["contact__social"]}>
              resume.json
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
