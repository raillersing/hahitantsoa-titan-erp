import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsHubPage from "./DocumentsHubPage";

describe("DocumentsHubPage", () => {
  it("renders without crashing", () => {
    render(<DocumentsHubPage onNavigate={vi.fn()} />);
    expect(screen.getByText("Hub Documentaire")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<DocumentsHubPage onNavigate={vi.fn()} />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });
});
