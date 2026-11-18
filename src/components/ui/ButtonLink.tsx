import type { ReactNode } from "react";
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
 * crawlable and works without JS; the hover/press effects are layered on by CSS.
 */
export function ButtonLink({ href, children, variant = "dashed", external, className }: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={[styles.button, styles[`button--${variant}`], className].filter(Boolean).join(" ")}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      <span className={styles.button__label}>{children}</span>
    </a>
  );
}
