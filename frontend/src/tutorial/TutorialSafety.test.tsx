import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialProvider } from "./TutorialProvider";
import AppShell from "../prototype/AppShell";
import { TutorialCenter } from "./TutorialCenter";
import { TutorialExercise } from "./TutorialExercise";
import { clearAllTutorialStorage } from "./progress";
import type { SessionUser } from "../api";

const user: SessionUser = { id: "safe-user", username: "u", display_name: "U", is_staff: false, roles: [], capabilities: {} };
afterEach(cleanup);
describe("tutorial safety", () => {
  it("hides privileged tutorials without their session capability", () => {
    render(<TutorialProvider user={user} activeScope="help"><TutorialCenter /></TutorialProvider>);
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    expect(screen.queryByText("Paramètres généraux, banques et conditions")).not.toBeInTheDocument();
  });
  it("allows operators with canSensitiveWrite to access SETTINGS tutorial", () => {
    const sensitiveOperator = { ...user, capabilities: { canSensitiveWrite: true } };
    render(<TutorialProvider user={sensitiveOperator} activeScope="help"><TutorialCenter /></TutorialProvider>);
    expect(screen.getByText("Paramètres généraux, banques et conditions")).toBeInTheDocument();
  });
  it("does not navigate away from a current form when starting a guide", () => {
    const navigate = vi.fn();
    render(<TutorialProvider user={user} activeScope="help" onNavigate={navigate}><TutorialCenter /></TutorialProvider>);
    fireEvent.click(screen.getAllByRole("button", { name: /démarrer le guide/i })[0]);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("offers a filtered contextual chooser without leaving the current form", () => {
    const navigate = vi.fn();
    const privileged = { ...user, capabilities: { canSensitiveWrite: true } };
    render(<TutorialProvider user={privileged} activeScope="reservation-new" onNavigate={navigate}>
      <AppShell activeScope="reservation-new" onNavigate={navigate}><div>Formulaire en cours</div></AppShell>
    </TutorialProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Guide interactif de cette page" }));
    expect(screen.getByRole("region", { name: "Guides de cette page" })).toBeInTheDocument();
    expect(screen.getByText("Formulaire en cours")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    const chooser = screen.getByRole("region", { name: "Guides de cette page" });
    const button = chooser.querySelector("button");
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    const slot = document.getElementById("tutorial-panel-slot");
    expect(slot?.querySelector("aside[aria-label^='Guide interactif']")).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("invalidates a previously correct response when an incorrect answer is selected", () => {
    const validity = vi.fn();
    render(<TutorialExercise data={{ kind: "multiple-choice", question: "Question ?", choices: [{ id: "ok", label: "Oui", isCorrect: true, explanation: "Correct" }, { id: "no", label: "Non", isCorrect: false, explanation: "Incorrect" }] }} onValidityChange={validity} />);
    fireEvent.click(screen.getByRole("radio", { name: "Oui" }));
    fireEvent.click(screen.getByRole("radio", { name: "Non" }));
    expect(validity.mock.calls.map(call => call[0])).toEqual([true, false]);
  });
  it("clears only tutorial keys", () => {
    localStorage.setItem("customer-draft", "preserve");
    localStorage.setItem("erp:tutorial:v1:user", "{}");
    clearAllTutorialStorage();
    expect(localStorage.getItem("customer-draft")).toBe("preserve");
    expect(localStorage.getItem("erp:tutorial:v1:user")).toBeNull();
  });
});
