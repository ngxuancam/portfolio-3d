/**
 * GPU resource lifetime around async shader compilation.
 *
 * `renderer.compileAsync` keeps polling each program's completion status after it returns
 * control. Disposing a material in that window deletes its program under the poll, which the
 * driver reports as GL_INVALID_VALUE ("Program object expected"). React Strict Mode's simulated
 * unmount does exactly that in dev, and a real unmount mid-load can do it in production. So:
 * every compile is tracked, and disposal is deferred until all in-flight compiles settle.
 */

export type Disposable = { dispose(): void };

let inflight: Promise<unknown> = Promise.resolve();

/** register a compile; returns it unchanged (never rejects the chain) */
export function trackCompile<T>(compile: Promise<T>): Promise<T> {
  const settled = compile.catch(() => undefined);
  inflight = Promise.all([inflight, settled]);
  return compile;
}

export function disposeAfterCompiles(items: readonly (Disposable | null | undefined)[]) {
  void inflight.then(() => items.forEach((item) => item?.dispose()));
}
