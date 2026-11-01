/// <reference lib="webworker" />
/**
 * Globals that three.js, R3F and anime.js read *while their modules evaluate*
 * (e.g. anime.js picks requestAnimationFrame vs setImmediate from `typeof window`).
 * stage.worker.ts imports this module first, and ES modules evaluate sibling imports in
 * order, so these exist before any of those libraries load.
 */
const scope = self as unknown as Record<string, unknown>;

if (typeof scope.window === "undefined") scope.window = self;

if (typeof scope.document === "undefined") {
  const noop = () => {};
  scope.document = {
    hidden: false,
    visibilityState: "visible",
    documentElement: { style: {} },
    addEventListener: noop,
    removeEventListener: noop,
  };
}

/**
 * DOM classes the libraries test with `instanceof` (anime.js target parsing, three.js
 * image upload paths). Empty stand-ins make every such test false — correct here, since
 * in the worker every target is a three.js object or an ImageBitmap, never a DOM node.
 */
for (const name of ["NodeList", "HTMLCollection", "SVGElement", "HTMLImageElement", "HTMLCanvasElement", "HTMLVideoElement"]) {
  if (typeof scope[name] === "undefined") scope[name] = class {};
}

/**
 * GLTFLoader's EXT_texture_webp / _avif probe support with `new Image()` + a 1×1 data URI.
 * Workers have no <img>; this stand-in really decodes the URI with createImageBitmap, so
 * the probe stays truthful.
 */
if (typeof scope.Image === "undefined") {
  scope.Image = class WorkerImage {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      fetch(url)
        .then((response) => response.blob())
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => {
          this.width = bitmap.width;
          this.height = bitmap.height;
          bitmap.close();
          this.onload?.();
        })
        .catch(() => this.onerror?.());
    }
  };
}

export {};
