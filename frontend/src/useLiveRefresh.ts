import { useEffect, useRef, useSyncExternalStore } from "react";

import { DATA_CHANGED_EVENT } from "./liveDataEvents";
const failedLoads = new Set<symbol>();
const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
function setFailed(key: symbol, failed: boolean) {
  if (failed === failedLoads.has(key)) return;
  if (failed) failedLoads.add(key); else failedLoads.delete(key);
  notify();
}
export function useLiveDataStale() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => failedLoads.size > 0,
    () => false,
  );
}

// Native polling also works behind a proxy without long-lived connections.
// Reads are serialized; slow responses are never repeatedly cancelled by a timer.
export function useLiveRefresh(
  load: (signal: AbortSignal, background: boolean) => Promise<unknown>,
  resourceKey: string = "",
  enabled = true,
) {
  const currentLoad = useRef(load);
  currentLoad.current = load;
  useEffect(() => {
    if (!enabled) return;
    const key = Symbol();
    let active = true;
    let pending = false;
    let running = false;
    let initial = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const available = () => document.visibilityState !== "hidden" && navigator.onLine !== false;
    const refresh = async () => {
      if (!active || !available()) {
        if (active && navigator.onLine === false) setFailed(key, true);
        return;
      }
      if (running) { pending = true; return; }
      clearTimeout(timer);
      running = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(new DOMException("Lecture trop longue", "TimeoutError")), 10_000);
      let succeeded = false;
      try {
        await currentLoad.current(controller.signal, !initial);
        if (!controller.signal.aborted) {
          succeeded = true;
          if (active) setFailed(key, navigator.onLine === false);
        } else if (active) setFailed(key, true);
      } catch {
        if (active) setFailed(key, true);
      } finally {
        clearTimeout(timeout);
        running = false;
        initial = false;
        if (active) {
          const delay = pending ? 0 : succeeded ? 2_000 : 10_000;
          pending = false;
          timer = setTimeout(() => { void refresh(); }, delay);
        }
      }
    };
    const wake = () => { void refresh(); };
    const offline = () => { setFailed(key, true); };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    window.addEventListener(DATA_CHANGED_EVENT, wake);
    document.addEventListener("visibilitychange", wake);
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      setFailed(key, false);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      window.removeEventListener(DATA_CHANGED_EVENT, wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [resourceKey, enabled]);
}

// An optional section may be forbidden while the dossier itself is readable.
// Other failures must retain the previous facts and report stale data.
export async function optionalLiveRead<T>(request: Promise<T>): Promise<T | null> {
  try { return await request; }
  catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 403) return null;
    throw error;
  }
}
