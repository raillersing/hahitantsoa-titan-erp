import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsTemplatesPage from "./DocumentsTemplatesPage";
import * as api from "../api";

describe("DocumentsTemplatesPage", () => {
  it("renders without crashing", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    render(<DocumentsTemplatesPage />);
    expect(screen.getByText("Modeles de documents")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument());
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    render(<DocumentsTemplatesPage />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });
});
