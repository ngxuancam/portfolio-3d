import { resume } from "@/content/resume";
import { HeaderMenu } from "./HeaderMenu";
import styles from "./SiteHeader.module.css";

const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  { href: "#experience", label: "Experience" },
  { href: "#projects", label: "Work" },
  { href: "#contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const initials = resume.basics.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <header className={styles["site-header"]}>
      <a href="#main" className={styles["site-header__skip"]}>
        Skip to content
      </a>
      <div className={`${styles["site-header__bar"]} u-glass u-glass--refract`}>
        <a href="#top" className={styles["site-header__logo"]}>
          {initials}
          <span className={styles["site-header__logo-dot"]}>.</span>
          {/* extends (never replaces) the visible text, so the accessible name contains it */}
          <span className="u-visually-hidden"> — {resume.basics.name}, home</span>
        </a>
        <HeaderMenu>
          <nav aria-label="Primary">
          <ul className={styles["site-header__nav"]}>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={styles["site-header__link"]}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          </nav>
        </HeaderMenu>
      </div>
      <div className={styles["site-header__progress"]} aria-hidden="true" />
    </header>
  );
}
