/// <reference lib="webworker" />
import type { StageReply } from "./stageProps";

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

/**
 * Model download progress for the page loader. three's FileLoader fetches the .glb files,
 * so the worker's fetch is wrapped: a .glb response body is re-streamed through a byte
 * counter and the combined fraction of every model in flight is posted to the page as
 * `{ type: "progress", stage: "model" }`. The caller gets an equivalent Response (same
 * status, headers and bytes), so the loaders' own progress handling keeps working.
 *
 * Without Content-Length (chunked / some CDNs) the fraction is an asymptotic estimate;
 * with compression the decoded bytes can exceed Content-Length — both are clamped below 1
 * until the stream really ends.
 */
const ESTIMATE_BYTES = 1_500_000;
const downloads = new Map<number, { loaded: number; total: number; done: boolean }>();
let nextDownload = 0;
let lastPosted = -1;

function postModelProgress() {
  let loaded = 0;
  let total = 0;
  let allDone = true;
  for (const d of downloads.values()) {
    const size = d.total || Math.max(d.loaded, ESTIMATE_BYTES);
    loaded += d.done ? size : Math.min(d.loaded, size);
    total += size;
    if (!d.done) allDone = false;
  }
  const value = allDone ? 1 : Math.min(total ? loaded / total : 0, 0.99);
  // ~100 messages at most per download; the final 1 always goes out
  if (value < 1 && value - lastPosted < 0.01) return;
  lastPosted = value;
  const reply: StageReply = { type: "progress", stage: "model", value };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply);
}

const nativeFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!/\.glb$/i.test(url.split(/[?#]/)[0]) || !response.ok || !response.body) return response;

  const id = nextDownload++;
  const total = Number(response.headers.get("content-length")) || 0;
  const download = { loaded: 0, total, done: false };
  downloads.set(id, download);
  postModelProgress();

  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        download.loaded += chunk.byteLength;
        postModelProgress();
        controller.enqueue(chunk);
      },
      flush() {
        download.done = true;
        postModelProgress();
      },
    }),
  );
  return new Response(counted, { status: response.status, statusText: response.statusText, headers: response.headers });
};

export {};
