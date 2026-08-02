import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as api from "../api";
import ImportExcelPage from "./ImportExcelPage";

describe("ImportExcelPage", () => {
  it("renders the mapping returned by the upload API", async () => {
    vi.spyOn(api, "uploadImportFile").mockResolvedValue({
      id: "job-1",
      filename: "inventory.csv",
      status: "mapping",
      column_mapping: { name: "", kind: "", description: "" },
      total_rows: 1,
      valid_rows: 0,
      error_rows: 0,
      error_log: [],
      target_model: "inventory_item",
      created_at: "2026-07-31T00:00:00Z",
    });

    render(<ImportExcelPage onNavigate={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["name,kind,description\nLamp,material,Test"], "inventory.csv", {
      type: "text/csv",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Mapping colonnes")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("name")).toHaveLength(2));
    expect(screen.getAllByText("kind")).toHaveLength(2);
    expect(screen.getAllByText("description")).toHaveLength(2);
  });

  it("does not crash when the API omits the column mapping", async () => {
    vi.spyOn(api, "uploadImportFile").mockResolvedValue({
      id: "job-2",
      filename: "inventory.csv",
      status: "mapping",
      column_mapping: undefined as never,
      total_rows: 0,
      valid_rows: 0,
      error_rows: 0,
      error_log: [],
      target_model: "inventory_item",
      created_at: "2026-07-31T00:00:00Z",
    });

    render(<ImportExcelPage onNavigate={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([""], "empty.csv", { type: "text/csv" })] },
    });

    expect(await screen.findByText("Mapping colonnes")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
