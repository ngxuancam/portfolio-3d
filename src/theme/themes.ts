/**
 * Single source of truth for every colour (and the 3D formation) of the site.
 *  - CSS:   `themeToCss` emits one rule per theme; <html data-theme="id"> picks one.
 *  - Stage: `theme.stage` is posted to the WebGL worker (lights, shader inks, shape).
 *  - Meta:  OG image, manifest and viewport read the default theme at build time.
 * Components reference roles (`--color-primary`), never a palette name.
 *
 * ponytail: fonts are not themed — next/font needs literal calls in layout.tsx.
 * Add a `fonts` entry when a theme needs different type.
 */

/** Every colour the 3D stage reads; all are hex strings so they cross postMessage as-is. */
export const THREE_COLOR_KEYS = [
  "edge", "rimA", "rimB", // bust: burning edge + holographic rim
  "inkA", "inkB", "inkC", "inkD", // particle inks; each shape decides how it uses them
  "glow", // launch flash of a particle
  "sky", "ground", "key", "fill", "kickLeft", "kickRight", "back", // studio lights
] as const;
export type ThreeColorKey = (typeof THREE_COLOR_KEYS)[number];

export interface StageLook {
  /** particle formation: 0 = flower, 1 = spaceship (fractions blend) */
  readonly shape: number;
  /** speed of the stage's own clock: breathing, bobbing, twinkle, flame flicker (1 = normal) */
  readonly tempo: number;
  /** how fast the formation morphs to this theme (1/s damping rate; higher = snappier) */
  readonly morph: number;
  readonly colors: Readonly<Record<ThreeColorKey, string>>;
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly scheme: "light" | "dark";
  /** CSS custom properties `--color-<kebab-key>` */
  readonly colors: {
    readonly bg: string;
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly textFaint: string;
    readonly primary: string;
    readonly primaryHover: string;
    readonly onPrimary: string;
    readonly accent: string;
    readonly accentDeep: string;
    /** accent readable as small text on `bg` (WCAG AA) */
    readonly accentInk: string;
  };
  readonly line: string;
  /** whether the magnifying-glass cursor (and its switch) exist in this theme */
  readonly loupe: boolean;
  /** strength of the paper-grain overlay, 0..1 */
  readonly grain: number;
  /** how the whole page moves: CSS transitions/animations, GSAP defaults, the 3D stage (`stage`) */
  readonly motion: {
    /** CSS timing function behind every transition and entrance (`--ease`) */
    readonly ease: string;
    /** multiplies every CSS duration (`--motion-time`): <1 is faster */
    readonly time: number;
    /** GSAP defaults for tweens created after a switch */
    readonly gsapEase: string;
    readonly gsapDuration: number;
    /** max horizontal motion blur (px) on the Projects cards while they slide; 0 = none */
    readonly slideBlur: number;
  };
  /** 1 shows the engineering-sheet furniture (ruler, frame, callouts, title block) and the grid */
  readonly sheet: 0 | 1;
  /** extra custom properties for this theme only (fonts, radii, grid colour, ...) */
  readonly css?: Readonly<Record<string, string>>;
  /** Project card art colours, exposed as `--swatch-<key>` */
  readonly swatches: Readonly<Record<string, string>>;
  readonly stage: StageLook;
  /** Open Graph image */
  readonly og: { readonly bg: string; readonly text: string; readonly label: string; readonly sub: string; readonly footer: string; readonly rule: string };
}

const quietLuxury: Theme = {
  id: "quiet-luxury",
  name: "Flower",
  scheme: "light",
  colors: {
    bg: "#fdfbf7",
    surface: "#f5f0e6",
    text: "#1b2430",
    textMuted: "#545c68",
    textFaint: "#8a8f96",
    primary: "#4a0e17",
    primaryHover: "#5e1520",
    onPrimary: "#fdfbf7",
    accent: "#c2a679",
    accentDeep: "#9c8256",
    accentInk: "#7a6340",
  },
  line: "#eae5db",
  loupe: true,
  grain: 1,
  sheet: 0,
  // unhurried: long, soft deceleration
  motion: { ease: "cubic-bezier(0.16, 1, 0.3, 1)", time: 1, gsapEase: "power3.out", gsapDuration: 0.9, slideBlur: 0 },
  swatches: { rust: "#b4541a", primary: "#4a0e17", ink: "#1b2430", brass: "#9c8256", wine: "#6a1a26" },
  stage: {
    shape: 0,
    tempo: 0.8,
    morph: 1.8,
    colors: {
      edge: "#c2a679", rimA: "#c2a679", rimB: "#6a1a26",
      inkA: "#c2a679", // brass: petal tips, stamen
      inkB: "#741c27", // burgundy: petal heart
      inkC: "#1b2430", // navy: inner ring
      inkD: "#595031", // olive: stem, leaves
      glow: "#c2a679",
      sky: "#fff8ee", ground: "#d9cbb4", key: "#fff4e8", fill: "#eef1ff",
      kickLeft: "#ffffff", kickRight: "#f2e6cf", back: "#9fb6e0",
    },
  },
  og: { bg: "#fdfbf7", text: "#1b2430", label: "#4a0e17", sub: "#545c68", footer: "#9c8256", rule: "#c2a679" },
};

const blueprint: Theme = {
  id: "blueprint",
  name: "Spaceship",
  scheme: "dark",
  // royal-blue drafting sheet: white linework, pale-cyan annotations
  colors: {
    bg: "#143a8c",
    surface: "#1b49a8",
    text: "#f2f7ff",
    textMuted: "#c3d5f7",
    textFaint: "#93addf",
    primary: "#f2f7ff",
    primaryHover: "#ffffff",
    onPrimary: "#143a8c",
    accent: "#a9d6ff",
    accentDeep: "#7db8f2",
    accentInk: "#d4e9ff",
  },
  line: "#5f86d1",
  loupe: false,
  grain: 0.12,
  sheet: 1,
  // drafting-pen precision: symmetric ease, no overshoot, plotted a little slower
  motion: { ease: "cubic-bezier(0.65, 0, 0.35, 1)", time: 0.85, gsapEase: "power2.inOut", gsapDuration: 0.7, slideBlur: 16 },
  css: {
    "--font-display": '"Avenir Next", "Century Gothic", "Questrial", "Segoe UI", system-ui, sans-serif',
    "--font-script": 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace',
    "--tracking-display": "0.02em",
    "--radius-lg": "2px",
    "--radius-pill": "2px",
    // a wider margin: the sheet's edge ruler would otherwise touch the first letters of every line
    "--space-gutter": "clamp(1.9rem, 5vw, 4rem)",
    "--grid-line": "rgb(255 255 255 / 0.08)",
    "--grid-line-major": "rgb(255 255 255 / 0.17)",
  },
  swatches: { rust: "#3f73d6", primary: "#2a5cc2", ink: "#0f2f75", brass: "#4c82e0", wine: "#3566c9" },
  stage: {
    shape: 1,
    tempo: 1,
    morph: 1.1,
    colors: {
      edge: "#a9d6ff", rimA: "#a9d6ff", rimB: "#f2f7ff",
      inkA: "#f2f7ff", // plotted lines
      inkB: "#7fa8ff", // translucent hull fill
      inkC: "#3a4a7a", inkD: "#a9d6ff",
      glow: "#a9d6ff",
      sky: "#cfe0ff", ground: "#1a2140", key: "#dbe8ff", fill: "#7aa8ff",
      kickLeft: "#ffffff", kickRight: "#9ad7ff", back: "#6a8bff",
    },
  },
  og: { bg: "#143a8c", text: "#f2f7ff", label: "#a9d6ff", sub: "#c3d5f7", footer: "#d4e9ff", rule: "#a9d6ff" },
};

const lab: Theme = {
  id: "lab",
  name: "Lab",
  scheme: "dark",
  // a lit room at night: near-black concrete, bone-white type, one amber signal colour
  colors: {
    bg: "#07080a",
    surface: "#0f1114",
    text: "#ecebe6",
    textMuted: "#a3a5a8",
    textFaint: "#6c6f73",
    primary: "#f2efe7",
    primaryHover: "#ffffff",
    onPrimary: "#07080a",
    accent: "#ffb23e",
    accentDeep: "#d98e1e",
    accentInk: "#ffc566",
  },
  line: "#1e2125",
  loupe: true,
  grain: 0.4,
  sheet: 0,
  // instrument-quick: a hard expo-out, everything a touch faster
  motion: { ease: "cubic-bezier(0.19, 1, 0.22, 1)", time: 0.85, gsapEase: "expo.out", gsapDuration: 0.8, slideBlur: 10 },
  css: {
    "--font-display": "var(--font-inter), Inter, system-ui, sans-serif",
    "--font-script": "var(--font-mono), ui-monospace, Consolas, monospace",
    "--display-weight": "200",
    "--display-italic": "normal",
    "--tracking-display": "-0.03em",
    "--radius-lg": "4px",
    "--radius-pill": "2px",
  },
  swatches: { rust: "#ff7a3d", primary: "#2a2d33", ink: "#15171b", brass: "#ffb23e", wine: "#3a1e22" },
  stage: {
    shape: 0,
    tempo: 1,
    morph: 1.6,
    colors: {
      edge: "#ffb23e", rimA: "#ffd08a", rimB: "#5ec8ff",
      inkA: "#ffcf7a", // amber: petal tips, stamen
      inkB: "#ff6a3d", // ember: petal heart
      inkC: "#e9edf2", // bone white: inner ring
      inkD: "#3f6b55", // dark green: stem, leaves
      glow: "#ffe2a8",
      sky: "#8fa3b8", ground: "#0b0c0e", key: "#ffe9cf", fill: "#5b7ea8",
      kickLeft: "#ffffff", kickRight: "#ffb23e", back: "#5ec8ff",
    },
  },
  og: { bg: "#07080a", text: "#ecebe6", label: "#ffb23e", sub: "#a3a5a8", footer: "#ffc566", rule: "#ffb23e" },
};

export const themes = { lab, "quiet-luxury": quietLuxury, blueprint } as const;
export type ThemeId = keyof typeof themes;

/** Theme used for the server render and all build-time metadata (OG, manifest, viewport). */
export const defaultThemeId: ThemeId = "lab";
export const defaultTheme: Theme = themes[defaultThemeId];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** One CSS rule declaring every colour token of a theme under `selector`. */
export function themeToCss(t: Theme, selector: string): string {
  const vars = [
    ...Object.entries(t.colors).map(([k, v]) => `--color-${kebab(k)}:${v}`),
    `--color-line:${t.line}`,
    `--grain-opacity:${t.grain}`,
    `--ease:${t.motion.ease}`,
    `--motion-time:${t.motion.time}`,
    `--sheet:${t.sheet}`,
    ...Object.entries(t.css ?? {}).map(([k, v]) => `${k}:${v}`),
    ...Object.entries(t.swatches).map(([k, v]) => `--swatch-${k}:${v}`),
    `color-scheme:${t.scheme}`,
  ];
  return `${selector}{${vars.join(";")}}`;
}

/** CSS for every theme: the default on :root, the others behind <html data-theme>. */
export const allThemesCss = Object.values(themes)
  .map((t) => themeToCss(t, t.id === defaultThemeId ? ":root" : `html[data-theme="${t.id}"]`))
  .join("");
