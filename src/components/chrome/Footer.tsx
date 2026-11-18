import { resume } from "@/content/resume";
import { ButtonLink } from "@/components/ui/ButtonLink";
import styles from "./Footer.module.css";

/**
 * Colophon. A server component: everything here is static, and the only interactive bits
 * (button hovers, label scramble) are islands inside ButtonLink.
 */

/** prerendered page → the year of the build, which is what a © line should state */
const YEAR = new Date().getFullYear();

export function Footer() {
  const { name, label, location, profiles } = resume.basics;

  return (
    <footer className={styles.footer}>
      <div className={`u-container ${styles.footer__inner}`}>
        <div className={styles.footer__id}>
          <p className={styles.footer__name}>{name}</p>
          <p className="u-label">
            {label} · {location.city}, {location.countryCode}
          </p>
        </div>

        <ul className={styles.footer__links} aria-label="Profiles">
          {profiles.map((profile) => (
            <li key={profile.network}>
              <ButtonLink href={profile.url} external={!profile.url.startsWith("mailto:")}>
                {profile.network}
              </ButtonLink>
            </li>
          ))}
        </ul>

        <div className={styles.footer__base}>
          <p className="u-label">
            © {YEAR} {name}
          </p>
          <p className="u-label">Built with Next.js, React Three Fiber &amp; a lot of 30 fps frames</p>
          <ButtonLink href="#top" className={styles.footer__top}>
            Back to top
          </ButtonLink>
        </div>
      </div>
    </footer>
  );
}
