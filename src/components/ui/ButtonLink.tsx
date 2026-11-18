import type { ReactNode } from "react";
import { ScrambleLabel } from "./ScrambleLabel";
import styles from "./ButtonLink.module.css";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  /** dashed = outline (default), solid = filled primary action */
  variant?: "dashed" | "solid";
  /** opens in a new tab with rel="noopener" */
  external?: boolean;
  className?: string;
}

/**
 * The one link-as-button of the site (see docs/DESIGN.md › Motion language). A real <a>, so it is
 * crawlable and works without JS; the hover/press effects are layered on by CSS, and a plain-text
 * label additionally decodes through glyphs on hover (a tiny client island — the link itself stays
 * server-rendered).
 */
export function ButtonLink({ href, children, variant = "dashed", external, className }: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={[styles.button, styles[`button--${variant}`], className].filter(Boolean).join(" ")}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {typeof children === "string" ? (
        <ScrambleLabel text={children} className={styles.button__label} />
      ) : (
        <span className={styles.button__label}>{children}</span>
      )}
      <span className={styles.button__tick} aria-hidden="true" />
    </a>
  );
}
