"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resume } from "@/content/resume";
import { CHAPTERS, signals } from "@/lib/scroll/signals";
import { ScrambleLabel } from "@/components/ui/ScrambleLabel";
import styles from "./Header.module.css";

/**
 * HUD bar + side rails.
 *
 * Scroll-driven parts (active-chapter indicator, CH/% readout, rail ticks, scroll meter) are
 * written straight to the DOM from a `signals` subscription, and only when the visible value
 * changes — React renders this component once, plus once per menu open/close.
 */

const INITIALS = resume.basics.name
  .split(/\s+/)
  .map((part) => part[0])
  .join("")
  .toUpperCase();

/** chapters 1..N-1 are navigable; chapter 0 is the hero (`#top`, reached via the mark) */
const NAV = CHAPTERS.slice(1).map((id, i) => ({
  id,
  index: String(i + 1).padStart(2, "0"),
  label: id.charAt(0).toUpperCase() + id.slice(1),
}));
const TOTAL = String(CHAPTERS.length).padStart(2, "0");
const pad2 = (n: number) => String(n).padStart(2, "0");

export function Header() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const ticksRef = useRef<HTMLOListElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const meterValueRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── scroll-driven HUD ────────────────────────────────────────────
  useEffect(() => {
    const nav = navRef.current;
    const links = nav ? Array.from(nav.querySelectorAll<HTMLAnchorElement>("a")) : [];
    const ticks = ticksRef.current ? Array.from(ticksRef.current.children) : [];

    // link geometry is cached; reading it per frame would force layout during scroll
    let boxes: { x: number; w: number }[] = [];
    const measure = () => {
      boxes = links.map((a) => ({ x: a.offsetLeft, w: a.offsetWidth }));
      last.chapter = -1; // force a redraw with the new geometry
      update();
    };

    const last = { chapter: -1, page: -1, active: -2, readout: "" };

    const update = () => {
      const chapter = signals.chapter;
      const page = signals.page;

      if (chapter !== last.chapter && boxes.length) {
        last.chapter = chapter;
        // continuous: the bar slides between links as the chapter index moves fractionally
        const t = Math.min(boxes.length - 1, Math.max(0, chapter - 1));
        const i = Math.floor(t);
        const k = t - i;
        const a = boxes[i];
        const b = boxes[Math.min(boxes.length - 1, i + 1)];
        const x = a.x + (b.x - a.x) * k;
        const w = a.w + (b.w - a.w) * k;
        const el = indicatorRef.current;
        if (el) {
          el.style.transform = `translateX(${x.toFixed(1)}px) scaleX(${w.toFixed(1)})`;
          // fades in over the hero → first chapter hand-off
          el.style.opacity = String(Math.min(1, Math.max(0, chapter)));
        }
      }

      const active = Math.round(chapter);
      if (active !== last.active) {
        last.active = active;
        links.forEach((a, i) => {
          if (i === active - 1) a.setAttribute("aria-current", "location");
          else a.removeAttribute("aria-current");
        });
        ticks.forEach((tick, i) => tick.toggleAttribute("data-active", i === active));
      }

      const percent = Math.round(page * 100);
      const readout = `CH ${pad2(active + 1)}/${TOTAL} · ${pad2(percent)}%`;
      if (readout !== last.readout) {
        last.readout = readout;
        if (readoutRef.current) readoutRef.current.textContent = readout;
        if (meterValueRef.current) meterValueRef.current.textContent = `${String(percent).padStart(3, "0")}%`;
      }

      if (page !== last.page) {
        last.page = page;
        if (meterRef.current) meterRef.current.style.transform = `scaleY(${page.toFixed(4)})`;
      }
    };

    const resize = new ResizeObserver(measure);
    if (nav) resize.observe(nav);
    measure();
    const unsubscribe = signals.subscribe(update);
    return () => {
      unsubscribe();
      resize.disconnect();
    };
  }, []);

  // ── mobile menu: Esc, focus in/out, Tab containment, scroll lock ──
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();

    const focusables = () => [
      toggleRef.current,
      ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a") ?? []),
    ].filter((el): el is HTMLElement => el !== null);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        first.focus();
      }
    };
    // the panel only exists below the desktop breakpoint; widening the window closes it
    const desktop = window.matchMedia("(min-width: 56rem)");
    const onDesktop = () => desktop.matches && close(false);

    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      html.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open, close]);

  return (
    <>
      <header className={styles.header} data-open={open || undefined}>
        <div className={styles.header__bar}>
          <a href="#top" className={styles.mark} aria-label={`${resume.basics.name} — back to top`}>
            <ScrambleLabel text={INITIALS} />
          </a>

          <nav className={styles.nav} aria-label="Chapters">
            <ul ref={navRef} className={styles.nav__list}>
              {NAV.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className={styles.nav__link}>
                    <span className={styles.nav__index} aria-hidden="true">
                      {item.index}
                    </span>
                    <ScrambleLabel text={item.label} />
                  </a>
                </li>
              ))}
            </ul>
            <span ref={indicatorRef} className={styles.nav__indicator} aria-hidden="true" />
          </nav>

          <span ref={readoutRef} className={styles.readout} aria-hidden="true">
            CH 01/{TOTAL} · 00%
          </span>

          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className={styles.toggle__label}>{open ? "Close" : "Menu"}</span>
            <span className={styles.toggle__icon} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>

        <div id="site-menu" ref={panelRef} className={styles.panel} hidden={!open}>
          <nav aria-label="Chapters (menu)">
            <ul className={styles.panel__list}>
              {NAV.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className={styles.panel__link} onClick={() => close(false)}>
                    <span className={styles.panel__index} aria-hidden="true">
                      {item.index}
                    </span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className={styles.panel__meta}>
            {resume.basics.label} · {resume.basics.location.city}
          </p>
        </div>
      </header>

      {/* side rails: purely a readout of the scroll state, so hidden from assistive tech */}
      <div className={styles.rails} aria-hidden="true">
        <div className={`${styles.rail} ${styles["rail--left"]}`}>
          <span className={styles.meter}>
            <span ref={meterRef} className={styles.meter__fill} />
          </span>
          <span ref={meterValueRef} className={styles.meter__value}>
            000%
          </span>
        </div>
        <ol ref={ticksRef} className={`${styles.rail} ${styles["rail--right"]}`}>
          {CHAPTERS.map((id, i) => (
            <li key={id} className={styles.tick} data-active={i === 0 || undefined}>
              <span className={styles.tick__index}>{pad2(i)}</span>
              <span className={styles.tick__line} />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
