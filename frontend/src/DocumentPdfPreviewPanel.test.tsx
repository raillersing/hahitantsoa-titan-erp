import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentPdfPreviewPanel from "./DocumentPdfPreviewPanel";

function pdfResponse(blob = new Blob(["%PDF-1.4"], { type: "application/pdf" }), status = 200): Response {
  return new Response(blob, {
    status,
    headers: { "Content-Type": "application/pdf" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocumentPdfPreviewPanel", () => {
  it("loads a private PDF artifact preview in an iframe", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(pdfResponse(blob));
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pdf-preview");

    render(<DocumentPdfPreviewPanel />);

    fireEvent.change(screen.getByLabelText("Document instance ID"), {
      target: { value: "doc-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load PDF preview" }));

    const iframe = await screen.findByTitle("Document PDF preview doc-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/documents/instances/doc-123/pdf/",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect((createObjectUrlSpy.mock.calls[0][0] as Blob).type).toBe("application/pdf");
    expect((createObjectUrlSpy.mock.calls[0][0] as Blob).size).toBeGreaterThan(0);
    expect(iframe).toHaveAttribute("src", "blob:pdf-preview");
  });

  it("shows a not found error for a missing PDF artifact", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(pdfResponse(new Blob(), 404));

    render(<DocumentPdfPreviewPanel />);

    fireEvent.change(screen.getByLabelText("Document instance ID"), {
      target: { value: "doc-404" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load PDF preview" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No generated PDF artifact was found for this document instance.",
    );
  });
});
