"use client";

import { useEffect, useRef } from "react";
import styles from "./PaperGrain.module.css";

/** 256px tile: the hash-random grain has no visible period at this size */
const TILE = 256;

/** Deterministic PRNG (Park–Miller) so the print looks identical on every visit. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** Paints one static tile: film grain + linen weave + sparse two-ink riso specks. */
function paintTile(ctx: CanvasRenderingContext2D) {
  const image = ctx.createImageData(TILE, TILE);
  const px = image.data;
  const random = createRandom(1918);
  const NAVY = [27, 36, 48];
  const BURGUNDY = [74, 14, 23];
  const PAPER = [253, 251, 247];

  const put = (i: number, rgb: number[], alpha: number) => {
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = Math.max(px[i + 3], Math.min(255, alpha));
  };

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      // film grain: a dark or light fleck per pixel
      const g = random() - 0.5;
      // linen: faint horizontal and vertical threads
      const weave = (y % 3 === 0 ? 5 : 0) + (x % 4 === 0 ? 3 : 0);
      put(i, g < 0 ? NAVY : PAPER, Math.abs(g) * 22 + weave);

      // risograph specks — rare, and the burgundy drum prints 1px off register
      const speck = random();
      if (speck > 0.99925) put(i, NAVY, 80);
      else if (speck > 0.99885 && x + 1 < TILE) put(i + 4, BURGUNDY, 72);
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Static film-grain + risograph paper texture over the whole page. Generated once on
 * mount into a tiling image and then left alone — like a real print, the grain never
 * moves, and it costs nothing per frame (no shader pass, no animation).
 */
export function PaperGrain() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintTile(ctx);
    let url = "";
    // WebP: random noise barely compresses as PNG (~0.5 MB); lossy WebP is a few KB
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        url = URL.createObjectURL(blob);
        el.style.backgroundImage = `url(${url})`;
      },
      "image/webp",
      0.82,
    );
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return <div ref={ref} className={styles.grain} aria-hidden="true" />;
}
