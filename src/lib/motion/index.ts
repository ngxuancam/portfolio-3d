/**
 * Motion kit — small, dependency-free helpers for the mechanical motion language.
 * Every helper checks `prefers-reduced-motion` itself and degrades to an instant end state.
 */
export { FRAME_MS, f, ignite, cutout, expoOut, quartOut, EASE_EXPO_CSS, EASE_QUART_CSS, prefersReducedMotion } from "./frames";
export { strike, switchOff, blip } from "./flicker";
export { scramble, bindScrambleHover, SCRAMBLE_GLYPHS, type ScrambleOptions } from "./scramble";
