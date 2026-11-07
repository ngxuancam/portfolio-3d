"use client";

import { useEffect, useRef } from "react";

/**
 * Liquid Glass refraction for every `.u-glass--lens` / `.u-glass--refract` element.
 *
 * Chromium can run an SVG filter inside `backdrop-filter`, but percentage units do not
 * resolve there — the displacement map must be sized in pixels to the element's box.
 * So each glass element gets its own filter, created once and kept in sync with a
 * ResizeObserver (attributes are updated in place: no React state, no image reloads).
 * CSS reads the filter through `--glass-url`; without it, the blur fallback applies.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SELECTOR = ".u-glass--lens, .u-glass--refract";

const svgUri = (markup: string) => `data:image/svg+xml,${encodeURIComponent(markup)}`;

/**
 * R encodes x-offset, G encodes y-offset, 50% grey = no offset. Stretched to the element
 * (preserveAspectRatio="none").
 *  - edge map: a soft neutral plateau in the middle, gradients only along the rim —
 *    content bends at the edges, text in the centre stays crisp (panels)
 *  - magnify map: gradients across the whole box — every pixel samples toward the
 *    centre, a thick convex lens (controls, cursor)
 */
const GRADIENTS = `<defs>
<linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#000000"/></linearGradient>
<linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="#000000"/></linearGradient>
<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<rect width="100" height="100" fill="#000"/>
<rect width="100" height="100" fill="url(#r)"/>
<rect width="100" height="100" fill="url(#g)" style="mix-blend-mode:screen"/>`;

const EDGE_MAP = svgUri(
  `<svg xmlns="${SVG_NS}" viewBox="0 0 100 100" preserveAspectRatio="none">${GRADIENTS}<rect x="9" y="9" width="82" height="82" rx="18" fill="rgb(128,128,0)" filter="url(#b)"/></svg>`,
);
const MAGNIFY_MAP = svgUri(`<svg xmlns="${SVG_NS}" viewBox="0 0 100 100" preserveAspectRatio="none">${GRADIENTS}</svg>`);

/** Isolates one colour channel so each can be displaced by a slightly different amount. */
const CHANNELS = [
  "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Builds: map → 3 per-channel displacements (dispersion) → additive recombine. */
function createFilter(id: string, map: string): SVGFilterElement {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const image = document.createElementNS(SVG_NS, "feImage");
  image.setAttribute("href", map);
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("result", "map");
  filter.append(image);

  CHANNELS.forEach((matrix, i) => {
    const shift = document.createElementNS(SVG_NS, "feDisplacementMap");
    shift.setAttribute("in", "SourceGraphic");
    shift.setAttribute("in2", "map");
    shift.setAttribute("xChannelSelector", "R");
    shift.setAttribute("yChannelSelector", "G");
    shift.setAttribute("result", `s${i}`);
    const only = document.createElementNS(SVG_NS, "feColorMatrix");
    only.setAttribute("in", `s${i}`);
    only.setAttribute("type", "matrix");
    only.setAttribute("values", matrix);
    only.setAttribute("result", `c${i}`);
    filter.append(shift, only);
  });

  const rg = document.createElementNS(SVG_NS, "feComposite");
  rg.setAttribute("in", "c0");
  rg.setAttribute("in2", "c1");
  rg.setAttribute("operator", "arithmetic");
  rg.setAttribute("k2", "1");
  rg.setAttribute("k3", "1");
  rg.setAttribute("result", "rg");
  const rgb = document.createElementNS(SVG_NS, "feComposite");
  rgb.setAttribute("in", "rg");
  rgb.setAttribute("in2", "c2");
  rgb.setAttribute("operator", "arithmetic");
  rgb.setAttribute("k2", "1");
  rgb.setAttribute("k3", "1");
  rgb.setAttribute("result", "rgb");
  // feDisplacementMap samples without filtering, which stair-steps diagonal edges; a
  // sub-pixel blur restores anti-aliasing without visibly softening the content
  const smooth = document.createElementNS(SVG_NS, "feGaussianBlur");
  smooth.setAttribute("in", "rgb");
  smooth.setAttribute("stdDeviation", "0.6");
  filter.append(rg, rgb, smooth);
  return filter;
}

/** Sizes the filter to the element and scales the refraction to its smaller side. */
function sizeFilter(filter: SVGFilterElement, width: number, height: number, magnify: boolean) {
  const size = { x: "0", y: "0", width: String(width), height: String(height) };
  for (const node of [filter, filter.querySelector("feImage")]) {
    if (!node) continue;
    for (const [key, value] of Object.entries(size)) node.setAttribute(key, value);
  }
  const base = Math.min(width, height);
  const scale = magnify ? clamp(base * 0.42, 16, 60) : -clamp(base * 0.12, 14, 44);
  // panels: red bends least, blue most → a faint, quiet fringe at the rim. A magnifier is
  // read *through*, so it gets no dispersion: colour fringes on every glyph blur the text.
  const spread = magnify ? 0 : Math.abs(scale) * 0.035;
  filter.querySelectorAll("feDisplacementMap").forEach((shift, i) => {
    shift.setAttribute("scale", String(scale + Math.sign(scale) * spread * i));
  });
  // just enough smoothing to hide the magnifier's stair-stepping, no more
  filter.querySelector("feGaussianBlur")?.setAttribute("stdDeviation", magnify ? "0.3" : "0.6");
}

export function GlassLensManager() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !document.documentElement.classList.contains("is-chromium")) return;

    const filters = new Map<HTMLElement, SVGFilterElement>();
    let sequence = 0;

    const sync = (el: HTMLElement) => {
      // offset size ignores transforms (the cursor lens stretches via transform)
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;
      const magnify = el.classList.contains("u-glass--lens");
      let filter = filters.get(el);
      if (!filter) {
        filter = createFilter(`glass-lens-${sequence++}`, magnify ? MAGNIFY_MAP : EDGE_MAP);
        svg.append(filter);
        filters.set(el, filter);
        el.style.setProperty("--glass-url", `url(#${filter.id})`);
      }
      sizeFilter(filter, width, height, magnify);
    };

    const observer = new ResizeObserver((entries) => entries.forEach((entry) => sync(entry.target as HTMLElement)));
    const watched = new WeakSet<HTMLElement>();
    const watch = (root: ParentNode) => {
      const found = [
        ...(root instanceof HTMLElement && root.matches(SELECTOR) ? [root] : []),
        ...root.querySelectorAll<HTMLElement>(SELECTOR),
      ];
      found.forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        observer.observe(el);
      });
    };
    // glass that mounts later (e.g. the idle-loaded loupe cursor) is picked up too
    const mutations = new MutationObserver((records) =>
      records.forEach((record) => record.addedNodes.forEach((node) => node instanceof HTMLElement && watch(node))),
    );
    const start = () => {
      watch(document);
      mutations.observe(document.body, { childList: true, subtree: true });
    };

    // Next hydrates the page in chunks; writing a style onto an element React has not
    // hydrated yet is a hydration mismatch. Wait until the page is loaded and idle.
    let idleId = 0;
    const schedule = () => {
      idleId = window.requestIdleCallback(start, { timeout: 1500 });
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      window.cancelIdleCallback(idleId);
      mutations.disconnect();
      observer.disconnect();
      filters.forEach((filter, el) => {
        filter.remove();
        el.style.removeProperty("--glass-url");
      });
    };
  }, []);

  return <svg ref={svgRef} width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }} />;
}
