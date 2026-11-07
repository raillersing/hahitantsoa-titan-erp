import { useEffect, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
const auth = vi.hoisted(() => ({ state: { status: "authenticated", user: { id: "A", username: "A", roles: ["commercial"] }, error: null } }));
const pending = vi.hoisted(() => new Map<string, (value: string) => void>());
vi.mock("./AuthContext", () => ({ useAuth: () => ({ ...auth, isOnline: true }) }));
vi.mock("./prototype/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => children }));
function Dossier({ param }: { param: string }) {
  const [value, setValue] = useState("");
  useEffect(() => { void new Promise<string>((resolve) => pending.set(param, resolve)).then(setValue); }, [param]);
  return <><p>{value}</p><input aria-label="Note privée" defaultValue="" /></>;
}
vi.mock("./prototype/ReservationDetailPage", () => ({ default: Dossier }));
vi.mock("./prototype/HahitantsoaEventDraftDetailPage", () => ({ default: Dossier }));
afterEach(() => { cleanup(); pending.clear(); auth.state.user.id = "A"; });

it.each(["titan", "hahitantsoa"])("isolates a slow %s dossier A response from dossier B", async (domain) => {
  window.history.replaceState(null, "", `/#reservation-detail/${domain}:A`);
  render(<App />);
  await act(async () => { window.location.hash = `reservation-detail/${domain}:B`; window.dispatchEvent(new HashChangeEvent("hashchange")); });
  await act(async () => { pending.get("B")!("Dossier B"); });
  await act(async () => { pending.get("A")!("Dossier A"); });
  expect(screen.getByText("Dossier B")).toBeInTheDocument();
  expect(screen.queryByText("Dossier A")).not.toBeInTheDocument();
});

it("preserves notes for the same user and clears them when authenticated identity changes", () => {
  window.history.replaceState(null, "", "/#reservation-detail/titan:A");
  const { rerender } = render(<App />);
  fireEvent.change(screen.getByLabelText("Note privée"), { target: { value: "confidentiel A" } });
  rerender(<App />);
  expect(screen.getByLabelText("Note privée")).toHaveValue("confidentiel A");
  auth.state.user = { ...auth.state.user, id: "B" };
  rerender(<App />);
  expect(screen.getByLabelText("Note privée")).toHaveValue("");
});
