import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { optionalLiveRead, useLiveDataStale, useLiveRefresh } from "./useLiveRefresh";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("reports genuine rejected reads as stale and clears only after a successful retry", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockRejectedValueOnce(new Error("server failed")).mockResolvedValue(undefined);
  const { result } = renderHook(() => { useLiveRefresh(load); return useLiveDataStale(); });
  await act(async () => {});
  expect(result.current).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(result.current).toBe(false);
});

it("expires a slow read, preserves stale status, and aborts on unmount", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  const load = vi.fn((signal: AbortSignal) => { signals.push(signal); return new Promise<void>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))); });
  const { result, unmount } = renderHook(() => { useLiveRefresh(load); return useLiveDataStale(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(signals[0].reason.name).toBe("TimeoutError");
  expect(result.current).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  unmount();
  expect(signals[1].aborted).toBe(true);
});

it("suppresses optional forbidden sections but propagates server failures", async () => {
  await expect(optionalLiveRead(Promise.reject({ status: 403 }))).resolves.toBeNull();
  await expect(optionalLiveRead(Promise.reject({ status: 500 }))).rejects.toEqual({ status: 500 });
});

it("defers hidden/offline reads and resumes on visibility and connectivity", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const load = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => { useLiveRefresh(load); return useLiveDataStale(); });
  expect(load).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  online.mockReturnValue(false);
  await act(async () => { window.dispatchEvent(new Event("offline")); document.dispatchEvent(new Event("visibilitychange")); });
  expect(load).not.toHaveBeenCalled();
  expect(result.current).toBe(true);
  online.mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(load).toHaveBeenCalledTimes(1);
  expect(result.current).toBe(false);
});
