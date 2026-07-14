import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandIdentity from "./BrandIdentity";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("BrandIdentity", () => {
  it("exposes the module hook used for the dark-mode label contrast", () => {
    document.documentElement.classList.add("dark");
    render(<BrandIdentity brand="hahitantsoa" className="module-brand" />);

    const identity = screen.getByRole("img", { name: "Hahitantsoa" });
    expect(identity).toHaveClass("module-brand");
    expect(identity.querySelector(".brand-identity__label")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the light login identity outside the dark module hook", () => {
    document.documentElement.classList.add("dark");
    render(
      <div className="login-identity-chip">
        <BrandIdentity brand="titan" compact />
      </div>,
    );

    const identity = screen.getByRole("img", { name: "Titan Rental" });
    expect(identity).not.toHaveClass("module-brand");
    expect(identity.closest(".login-identity-chip")).toBeInTheDocument();
  });
});
