import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { RouteNotFoundPage } from "./RouteNotFoundPage";

it("explains an unknown route and offers a dashboard recovery action", () => {
  const onNavigateHome = vi.fn();
  render(<RouteNotFoundPage requestedHash="#missing/route" onNavigateHome={onNavigateHome} />);

  expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
  expect(screen.getByText("#missing/route")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retour au tableau de bord" }));
  expect(onNavigateHome).toHaveBeenCalledOnce();
});
