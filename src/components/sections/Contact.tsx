import { resume } from "@/content/resume";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Chapter, chapterStyles as c } from "./Chapter";
import styles from "./Contact.module.css";

/** Chapter 05 — open channel: the email as the biggest thing on screen, then the other profiles. */
export function Contact() {
  const { basics } = resume;
  // the address already headlines the chapter; listing it again as a profile would be noise
  const profiles = basics.profiles.filter((p) => p.network !== "Email");

  return (
    <Chapter id="contact" index={5} label="Contact" title="Contact" readout="Channel open">
      <div className={`${styles.contact__status} ${c.reveal}`}>
        <span className={c.signal} aria-hidden="true" />
        <p className="u-label">
          <span className="u-visually-hidden">Status: </span>
          {basics.availability}
        </p>
      </div>

      <div className={c.reveal}>
        <span className={`u-label ${c.key}`}>Write to</span>
        <a href={`mailto:${basics.email}`} className={styles.contact__email}>
          <span className="u-visually-hidden">Email </span>
          {/* a break opportunity at the "@" only: never split the user name or domain */}
          {basics.email.split("@")[0]}
          <wbr />@{basics.email.split("@")[1]}
        </a>
      </div>

      {profiles.length > 0 && (
        <div className={c.reveal}>
          <span className={`u-label ${c.key}`} id="contact-profiles">
            Elsewhere
          </span>
          <ul className={styles.contact__profiles} aria-labelledby="contact-profiles">
            {profiles.map((p) => (
              <li key={p.network}>
                <ButtonLink href={p.url} external>
                  {p.network}
                  <span className={styles.contact__handle}>@{p.username}</span>
                  <span className="u-visually-hidden"> (opens in a new tab)</span>
                </ButtonLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={`u-label ${styles.contact__end} ${c.strike}`}>
        <span aria-hidden="true">■</span> End of log — {basics.name}, {basics.location.city}
      </p>
    </Chapter>
  );
}
