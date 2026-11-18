import type { CSSProperties } from "react";
import { resume } from "@/content/resume";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CornerMarks, chapterStyles } from "./Chapter";
import styles from "./Hero.module.css";

/** Stagger slot for the entrance: each element reads `--i` to offset its delay by a few frames. */
const slot = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Chapter 00 — the title card. Static server markup; the entrance is pure CSS that waits for the
 * loader to lift (`html[data-loaded]`) and only for visitors flagged `has-motion` by the head
 * script, so no-JS and reduced-motion visitors get the finished page on first paint.
 */
export function Hero() {
  const { basics, updatedAt } = resume;
  const words = basics.name.split(" ");
  const place = `${basics.location.city}, ${basics.location.countryCode}`;

  return (
    <section id="top" data-chapter aria-labelledby="top-title" className={styles.hero}>
      <div className={`u-container ${styles.hero__frame}`}>
        <CornerMarks className={styles.hero__corners} />

        <div className={styles.hero__head} aria-hidden="true">
          <span className={`u-label ${styles.hero__index} ${styles.enterStrike}`} style={slot(0)}>
            <span className={styles.hero__num}>00</span> / Log start
          </span>
          <span className={`${styles.hero__rule} ${styles.enterRule}`} />
          <span className={`u-label ${styles.hero__readout} ${styles.enterStrike}`} style={slot(1)}>
            Rev {updatedAt}
          </span>
        </div>

        <div className={styles.hero__body}>
          <p className={`u-label ${styles.hero__meta} ${styles.enterStrike}`} style={slot(1)}>
            <span>{basics.label}</span>
            <span className={styles.hero__sep} aria-hidden="true">
              /
            </span>
            <span>{place}</span>
          </p>

          <h1 id="top-title" className={styles.hero__name}>
            {words.map((word, i) => (
              // real spaces between the spans keep the accessible name "First Middle Last"
              <span key={word + i}>
                <span className={`${styles.hero__word} ${styles.enter}`} style={slot(2 + i)}>
                  {word}
                </span>
                {i < words.length - 1 ? " " : null}
              </span>
            ))}
          </h1>

          <p className={`${styles.hero__headline} ${styles.enter}`} style={slot(2 + words.length)}>
            {basics.headline}
          </p>

          <p className={`u-label ${styles.hero__status} ${styles.enterStrike}`} style={slot(3 + words.length)}>
            <span className={chapterStyles.signal} aria-hidden="true" />
            <span>
              <span className="u-visually-hidden">Status: </span>
              {basics.availability}
            </span>
          </p>

          <div className={`${styles.hero__actions} ${styles.enter}`} style={slot(4 + words.length)}>
            <ButtonLink href="#projects" variant="solid">
              View work
            </ButtonLink>
            <ButtonLink href="#contact">Get in touch</ButtonLink>
          </div>
        </div>

        <a href="#about" className={`u-label ${styles.hero__cue} ${styles.enterStrike}`} style={slot(6 + words.length)}>
          <span className={styles.hero__cueLine} aria-hidden="true" />
          <span>
            Scroll<span className="u-visually-hidden"> to the About chapter</span>
          </span>
        </a>
      </div>
    </section>
  );
}
