/// <reference lib="webworker" />
/**
 * Off-main-thread portrait geometry (see portraitBakeCore.ts). Results come back as
 * transferable typed arrays; the caller only wraps them in BufferAttributes.
 */
import type { PortraitBakeRequest } from "./portraitBake";
import { resultTransferables, runPortraitBake } from "./portraitBakeCore";

self.onmessage = (event: MessageEvent<PortraitBakeRequest>) => {
  const result = runPortraitBake(event.data);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(result, resultTransferables(result));
};
