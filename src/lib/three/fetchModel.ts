/**
 * Streams a model's bytes with progress. Lives outside the three.js chunk so the download starts
 * as soon as the client knows it can render 3D — in parallel with fetching the 3D code itself.
 * Idempotent per URL: Strict Mode's double effects and later consumers share one request.
 */

export const SHIP_URL = "/models/ship.glb";
/** shipped size of ship.glb; only used when the server hides Content-Length */
export const SHIP_BYTES = 206_856;

const requests = new Map<string, Promise<ArrayBuffer | null>>();

export function fetchModel(url: string, onProgress: (fraction: number) => void, expectedBytes = 0) {
  const existing = requests.get(url);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) return null;
      // Content-Length is absent when the server compresses on the fly; fall back to an estimate
      const total = Number(response.headers.get("content-length")) || expectedBytes;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total > 0) onProgress(Math.min(0.99, received / total));
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      onProgress(1);
      return bytes.buffer;
    } catch {
      return null;
    }
  })();

  requests.set(url, request);
  return request;
}
