import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../api";
import HahitantsoaPage from "./HahitantsoaPage";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it("shows a recoverable error when the initial read expires", async () => {
  vi.useFakeTimers();
  const drafts = vi.spyOn(api, "getHahitantsoaEventDrafts").mockImplementation((_, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason))));
  vi.spyOn(api, "getHahitantsoaDiscoveryItems").mockResolvedValue({ items: [] } as any);
  render(<HahitantsoaPage onNavigate={vi.fn()} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(screen.queryByText("Chargement des réservations Hahitantsoa…")).not.toBeInTheDocument();
  expect(screen.getByText("Lecture trop longue")).toBeInTheDocument();
  drafts.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await act(async () => {});
  expect(screen.queryByText("Lecture trop longue")).not.toBeInTheDocument();
  expect(drafts.mock.calls.at(-1)?.[1]).toBeInstanceOf(AbortSignal);
});
