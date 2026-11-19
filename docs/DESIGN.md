# Design brief — "Lab"

A from-scratch rewrite of nguyenxuancam.com. Dark instrument / lab aesthetic: a spaceship is
*built* in front of you as you scroll, inside a dark room, read through a HUD. Everything is
original work — references were studied for technique only; never copy their code, fonts,
wording or branding.

## Palette (CSS tokens in `src/app/globals.css`)

| token | value | use |
|---|---|---|
| `--c-void` | `#050607` | page background, 3D clear colour |
| `--c-panel` | `#0c0e10` | cards, menus |
| `--c-ink` | `#e9e7e1` | primary text, button invert fill |
| `--c-ink-2` | `#a5a7aa` | secondary text (AA on void) |
| `--c-ink-3` | `#6d7074` | tertiary / metadata (large or decorative only) |
| `--c-rule` | `rgb(233 231 225 / 0.12)` | 1px hairlines, frame rules |
| `--c-rule-2` | `rgb(233 231 225 / 0.4)` | dashed button borders |
| `--c-signal` | `#b46bff` | the ONE accent: build edge, active states, progress |
| `--c-signal-2` | `#d7b4ff` | accent text on void (AA) |
| `--c-shield` | `#bfefff` | shield / hologram cool light (3D only, rare in UI) |

No gradients in UI except hairline fades. No rounded pills: corners are square (`--r: 2px` max).

## Type

- Display: Inter, weight 200 (ultralight), tight tracking (`-0.03em`), large sizes, `font-variant-numeric: tabular-nums` for figures.
- UI / labels / data: JetBrains Mono, uppercase, `letter-spacing: 0.14em`, 11–12px.
- Body: Inter 300, 16–17px, line-height 1.6, max ~62ch.

## Layout

- 12-column grid inside a frame: thin rules (`--c-rule`) and small square corner marks.
- Generous negative space; the 3D stage sits behind everything (fixed, full-viewport canvas).
- Sections are "chapters" with a mono index (`01 / ABOUT`) and a HUD readout line.

## Motion language

Durations are counted in **30 fps frames** (`f(n) = n × 33.3 ms`). Two personalities:

- **Mechanical / electric** (chrome, buttons, labels): STEPPED eases, like a lamp igniting.
  - `ignite` levels: 0, .3, .1, .8, .45 → 1 (six equal steps)
  - `cutout` levels: 0, .7, .35, .95, .8 → 1
  - "strike" (appear): opacity 1 @0, .05 @14%, .9 @29%, .1 @41%, 1 @100% over ~280 ms
  - "off" (disappear): .15 → .85 → .08 → .5 → 0 over ~310 ms
- **Physical** (camera, 3D, big reveals): smooth `expo.out` / `quart.out`, damped springs.

Buttons: uppercase mono, 1px dashed `--c-rule-2` border, transparent; hover = invert fill
(bg `--c-ink`, text `--c-void`) with `ignite` in ≈4 frames, `cutout` out ≈8 frames; press = a
2–3 frame brightness flicker; text changes use a glyph scramble (`▪▫/\_<>01#`, per-char random
resolve, updated every frame-tick not every rAF). Keyboard focus only via `:focus-visible`.

`prefers-reduced-motion`: no flicker, no scramble, no camera travel — instant states, static 3D pose.

## 3D (the stage)

- Spaceship `public/models/ship.glb` (CC0, Quaternius), centred, slightly elevated, lit in a dark room.
- **Build sweep** driven by scroll: a noisy threshold climbs the hull's long axis; built part =
  dark solid hull with subtle metal; a thin **burning edge** (`--c-signal`, HDR → bloom); unbuilt part =
  **hologram** (faint shield-blue rim + scrolling grid lines, translucent).
- **Hex shield dome** reveals cell-by-cell later in the scroll (staggered per-cell random).
- **Camera**: scroll-scrubbed spiral (climb → pull back → wide), plus pointer parallax (±0.1 rad, damped).
- **Atmosphere**: drifting dust that the pointer pushes, faint fog, bloom, slight chromatic aberration, vignette, film grain (12 fps).
- Performance: 60 fps on a mid laptop; DPR ≤ 1.5; lighter post-FX on phones; render on demand when idle off-screen.

## Shared modules (already scaffolded — use, don't fork)

- `src/lib/loading/progress.ts` — loading registry (stages → 0..1, monotonic, `ready`, 8 s failsafe).
- `src/lib/scroll/signals.ts` — scroll + pointer signals for DOM and 3D (`signals.page`, `signals.chapter`, `signals.pointer`).
- `src/content/resume.ts` — all text. Never hard-code résumé content in components.
