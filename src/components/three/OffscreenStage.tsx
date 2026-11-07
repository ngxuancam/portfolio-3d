"use client";

import { useEffect, useRef } from "react";
import { sceneSignals } from "@/lib/three/sceneSignals";
import { STAGE_MAX_DPR, type StageMessage, type StageProps, type StageReply } from "./stageProps";
import styles from "./SceneBackdrop.module.css";

interface OffscreenStageProps extends StageProps {
  /** the worker could not render (no OffscreenCanvas WebGL / rAF in workers) */
  onFallback: () => void;
}

/**
 * Main-thread host for the worker-rendered stage. It imports no three.js: it creates a
 * <canvas>, transfers it to stage.worker.ts and forwards scroll / camera / pointer signals
 * — coalesced to one postMessage per frame. The page's main thread only does DOM work.
 *
 * The canvas is created inside the effect (not rendered by React) because control can be
 * transferred only once; StrictMode's re-run then simply builds a fresh canvas + worker.
 */
export default function OffscreenStage({ reducedMotion, skipIntro, burstCount, onReady, onFallback }: OffscreenStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.className = styles["scene-backdrop__canvas"];
    host.appendChild(canvas);

    let offscreen: OffscreenCanvas;
    try {
      offscreen = canvas.transferControlToOffscreen();
    } catch {
      canvas.remove();
      onFallback();
      return;
    }

    const worker = new Worker(new URL("./stage.worker.ts", import.meta.url), { type: "module" });
    const send = (message: StageMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      worker.terminate();
      canvas.remove();
      onFallback();
    };
    worker.onmessage = (event: MessageEvent<StageReply>) => {
      if (event.data.type === "ready") onReady();
      else fail();
    };
    worker.onerror = fail;

    // The worker is only started once the host has a real size: a page opened while its
    // window is still 0×0 (hidden pane, tab laid out late) would otherwise build the
    // renderer and camera at 0×0 and never draw.
    let started = false;
    const start = (width: number, height: number) => {
      started = true;
      send(
        {
          type: "init",
          canvas: offscreen,
          width,
          height,
          dpr: Math.min(window.devicePixelRatio || 1, STAGE_MAX_DPR),
          reducedMotion,
          skipIntro,
          burstCount,
          signals: sceneSignals.snapshot(),
        },
        [offscreen],
      );
    };

    // scroll / camera / pointer → worker, at most once per frame
    let frame = 0;
    const flush = () => {
      frame = 0;
      send({ type: "signals", signals: sceneSignals.snapshot() });
    };
    const unsubscribe = sceneSignals.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(flush);
    });

    // Follows the host box itself (not just window resizes): catches 0×0 → visible,
    // scrollbar and layout changes. Zero sizes are never forwarded.
    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      if (!started) start(width, height);
      else send({ type: "resize", width, height });
    });
    resizeObserver.observe(host);

    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      worker.terminate();
      canvas.remove();
    };
  }, [reducedMotion, skipIntro, burstCount, onReady, onFallback]);

  return <div ref={hostRef} className={styles["scene-backdrop"]} aria-hidden="true" />;
}
