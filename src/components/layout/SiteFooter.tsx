import { resume } from "@/content/resume";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles["site-footer"]}>
      <div className={`${styles["site-footer__inner"]} u-container`}>
        <p>
          © {resume.updatedAt.slice(0, 4)} {resume.basics.name}
        </p>
        <p className={styles["site-footer__meta"]}>
          Next.js · React Three Fiber · GSAP · anime.js — updated{" "}
          <time dateTime={resume.updatedAt}>{resume.updatedAt}</time>
        </p>
      </div>
    </footer>
  );
}
