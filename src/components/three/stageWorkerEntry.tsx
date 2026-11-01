/// <reference lib="webworker" />
import { createRoot, extend, type ReconcilerRoot, type RenderProps } from "@react-three/fiber";
import * as THREE from "three";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { StageScene } from "./StageScene";
import { STAGE_CAMERA, STAGE_GL, type StageMessage, type StageReply } from "./stageProps";

const post = (reply: StageReply) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply);

/**
 * Workers have no <img>: route three's ImageLoader through fetch + createImageBitmap
 * (TextureLoader uses it on browsers where GLTFLoader avoids ImageBitmapLoader).
 */
function patchImageLoader() {
  THREE.ImageLoader.prototype.load = function load(url, onLoad, _onProgress, onError) {
    const resolved = this.manager.resolveURL(this.path !== undefined ? this.path + url : url);
    const cached = THREE.Cache.get(resolved);
    this.manager.itemStart(resolved);
    if (cached !== undefined) {
      onLoad?.(cached);
      this.manager.itemEnd(resolved);
      return cached;
    }
    fetch(resolved)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" }))
      .then((bitmap) => {
        THREE.Cache.add(resolved, bitmap);
        onLoad?.(bitmap as unknown as HTMLImageElement);
        this.manager.itemEnd(resolved);
      })
      .catch((error) => {
        onError?.(error);
        this.manager.itemError(resolved);
        this.manager.itemEnd(resolved);
      });
    return {} as HTMLImageElement;
  };
}

/** The bits of an HTMLCanvasElement R3F touches, faked onto the OffscreenCanvas. */
function shimCanvas(canvas: OffscreenCanvas, width: number, height: number) {
  const noop = () => {};
  return Object.assign(canvas, {
    style: {},
    clientWidth: width,
    clientHeight: height,
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    getBoundingClientRect: () => ({ top: 0, left: 0, width, height, right: width, bottom: height, x: 0, y: 0 }),
  }) as unknown as HTMLCanvasElement;
}

/**
 * Hosts the R3F root inside the worker. R3F's configure() applies defaults for every
 * omitted option, so each reconfigure passes the full config (same camera object, so the
 * camera is not recreated).
 */
export function startStage() {
  extend(THREE as unknown as Parameters<typeof extend>[0]);
  patchImageLoader();

  let root: ReconcilerRoot<HTMLCanvasElement> | null = null;
  let config: RenderProps<HTMLCanvasElement> | null = null;

  const reconfigure = (patch: Partial<RenderProps<HTMLCanvasElement>>) => {
    if (!root || !config) return Promise.resolve();
    config = { ...config, ...patch };
    return root.configure(config);
  };

  const init = async (message: Extract<StageMessage, { type: "init" }>) => {
    if (typeof requestAnimationFrame === "undefined") {
      post({ type: "error", message: "requestAnimationFrame unavailable in workers" });
      return;
    }
    const canvas = shimCanvas(message.canvas, message.width, message.height);
    sceneSignals.apply(message.signals);

    root = createRoot(canvas);
    config = {
      size: { width: message.width, height: message.height, top: 0, left: 0 },
      dpr: message.dpr,
      frameloop: "never", // nothing is drawn until the model is baked and compiled
      camera: STAGE_CAMERA,
      gl: STAGE_GL,
    };
    await root.configure(config);

    const onReady = () => {
      void reconfigure({ frameloop: message.reducedMotion ? "demand" : "always" });
      post({ type: "ready" });
    };
    root.render(
      <StageScene
        reducedMotion={message.reducedMotion}
        skipIntro={message.skipIntro}
        burstCount={message.burstCount}
        onReady={onReady}
      />,
    );
  };

  self.onmessage = (event: MessageEvent<StageMessage>) => {
    const message = event.data;
    switch (message.type) {
      case "init":
        init(message).catch((error: unknown) => post({ type: "error", message: String(error) }));
        break;
      case "resize":
        void reconfigure({ size: { width: message.width, height: message.height, top: 0, left: 0 } });
        break;
      case "signals":
        sceneSignals.apply(message.signals);
        break;
    }
  };
}
