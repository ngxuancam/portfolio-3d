"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { progress } from "@/lib/loading/progress";
import { fetchModel, SHIP_BYTES, SHIP_URL } from "@/lib/three/fetchModel";
import { detectCapability, type Capability } from "@/lib/three/quality";
import styles from "./StageHost.module.css";

// three.js, R3F and the post stack live in this chunk only: never in the initial bundle
const Stage = dynamic(() => import("./Stage").then((m) => m.Stage), { ssr: false });

const PENDING: Capability = { kind: "pending" };
const noSubscribe = () => () => {};

/**
 * Fixed, full-viewport 3D stage behind the page. Decides on the client whether 3D runs at all
 * (WebGL2, not reduced-data); if not, it completes the loader's 3D stages and renders nothing.
 */
export function StageHost() {
  // a one-shot client read: the server snapshot is "pending", hydration then resolves it
  const capability = useSyncExternalStore(noSubscribe, detectCapability, () => PENDING);

  useEffect(() => {
    if (capability.kind === "off") {
      progress.skip("model");
      progress.skip("build");
      progress.markReady();
    } else if (capability.kind === "on") {
      // start the model download now, in parallel with the 3D chunk itself
      void fetchModel(SHIP_URL, (fraction) => progress.stage("model", fraction), SHIP_BYTES);
    }
  }, [capability]);

  if (capability.kind !== "on") return null;
  return (
    <div aria-hidden="true" className={styles.stage}>
      <Stage quality={capability.quality} />
      <div className={styles.scrim} />
    </div>
  );
}
