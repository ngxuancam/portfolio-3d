"use client";

import { useEffect, useRef } from "react";
import { disposeAfterCompiles, type Disposable } from "@/lib/three/lifetime";

/**
 * Disposes a memoised GPU resource when the component really unmounts (or the resource is
 * replaced). The dispose is scheduled, not immediate: Strict Mode's unmount → remount runs
 * synchronously, so the remount cancels it and the live resource is never torn down under the
 * renderer. Real disposal also waits for in-flight `compileAsync` calls (see lifetime.ts).
 */
export function useDisposeOnUnmount(resource: Disposable | null | undefined) {
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; resource: Disposable } | null>(null);
  useEffect(() => {
    // only cancel a dispose of THIS resource (Strict Mode remount); a replaced one still goes
    if (pending.current && pending.current.resource === resource) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    if (!resource) return;
    return () => {
      const timer = setTimeout(() => {
        if (pending.current?.timer === timer) pending.current = null;
        disposeAfterCompiles([resource]);
      }, 0);
      pending.current = { timer, resource };
    };
  }, [resource]);
}
