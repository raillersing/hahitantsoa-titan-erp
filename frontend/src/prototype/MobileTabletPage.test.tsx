import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MobileTabletPage from "./MobileTabletPage";

describe("MobileTabletPage", () => {
  it("affiche les trois modules opérationnels mobiles et tablettes", () => {
    render(<MobileTabletPage onNavigate={vi.fn()} />);

    expect(screen.getByText("Magasinier")).toBeInTheDocument();
    expect(screen.getByText("Accueil tablette")).toBeInTheDocument();
    expect(screen.getByText("Livreur")).toBeInTheDocument();
    expect(screen.getByText("Accès direct aux modules opérationnels")).toBeInTheDocument();
  });

  it("redirige vers la préparation magasinier lors du clic sur le module Magasinier", () => {
    const onNavigate = vi.fn();
    render(<MobileTabletPage onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole("button", { name: /Ouvrir le module/i });
    expect(buttons.length).toBe(3);

    // Click Magasinier (first card)
    fireEvent.click(buttons[0]);
    expect(onNavigate).toHaveBeenCalledWith("stock-preparation");
  });

  it("redirige vers l'agenda des visiteurs lors du clic sur le module Accueil tablette", () => {
    const onNavigate = vi.fn();
    render(<MobileTabletPage onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole("button", { name: /Ouvrir le module/i });
    // Click Accueil tablette (second card)
    fireEvent.click(buttons[1]);
    expect(onNavigate).toHaveBeenCalledWith("agenda-visitors");
  });

  it("redirige vers les expéditions logistiques lors du clic sur le module Livreur", () => {
    const onNavigate = vi.fn();
    render(<MobileTabletPage onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole("button", { name: /Ouvrir le module/i });
    // Click Livreur (third card)
    fireEvent.click(buttons[2]);
    expect(onNavigate).toHaveBeenCalledWith("logistics-dispatch");
  });
});
