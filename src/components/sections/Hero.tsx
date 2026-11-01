import type { CSSProperties } from "react";
import { resume } from "@/content/resume";
import { POSTER_MEDIA } from "@/lib/three/stageMedia";
import { MagneticLink } from "@/components/motion/MagneticLink";
import styles from "./Hero.module.css";

/** 1×1 transparent GIF: wide viewports get this instead of the poster (no download). */
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** "Est." year for the script tagline — the first year in the experience history */
const established = Math.min(...resume.experience.map((job) => Number(job.startDate.slice(0, 4))));

export function Hero() {
  const { basics } = resume;

  return (
    <section id="top" className={styles.hero} aria-labelledby="hero-title">
      {/*
        Phones: a still of the 3D bust (captured from the scene at the narrow framing) is in
        the first paint, and the WebGL stage only loads on first interaction — then it
        replaces the poster seamlessly. Wide screens never request the poster.
      */}
      <picture className={styles["hero__poster"]}>
        <source media={POSTER_MEDIA} srcSet="/hero-poster.webp" width={424} height={603} />
        <img src={BLANK_PIXEL} alt="" width={424} height={603} decoding="async" fetchPriority="high" />
      </picture>
      {/* CSS-only entrance: the copy is in the first paint (LCP), no JS needed to reveal it */}
      <div className={`${styles["hero__inner"]} u-container`} data-hero-copy>
        <div className={`${styles["hero__meta"]} ${styles["hero__enter"]}`} style={{ "--i": 0 } as CSSProperties}>
          <p className={`${styles["hero__status"]} u-glass u-glass--lens`}>
            <span className={styles["hero__status-dot"]} aria-hidden="true" />
            {basics.availability}
          </p>
          <p className={`${styles["hero__tagline"]} u-script`}>Est. {established}</p>
        </div>

        <h1 id="hero-title" className={styles["hero__title"]}>
          {basics.name}
        </h1>

        <p className={`${styles["hero__role"]} ${styles["hero__enter"]}`} style={{ "--i": 2 } as CSSProperties}>
          {basics.label}
          <span className={styles["hero__role-sep"]} aria-hidden="true" />
          {basics.location.city}, Vietnam
        </p>

        <p className={`${styles["hero__lead"]} ${styles["hero__enter"]}`} style={{ "--i": 3 } as CSSProperties}>
          {basics.headline}
        </p>

        <div className={`${styles["hero__actions"]} ${styles["hero__enter"]}`} style={{ "--i": 4 } as CSSProperties}>
          <MagneticLink href="#projects" className={`${styles["hero__button"]} ${styles["hero__button--primary"]}`}>
            View selected work
          </MagneticLink>
          <MagneticLink href={`mailto:${basics.email}`} className={`${styles["hero__button"]} u-glass u-glass--lens`}>
            Get in touch
          </MagneticLink>
        </div>
      </div>

      <a href="#about" className={styles["hero__scroll-hint"]}>
        <span className="u-visually-hidden">Scroll to about section</span>
        <span className={styles["hero__scroll-line"]} aria-hidden="true" />
      </a>
    </section>
  );
}
