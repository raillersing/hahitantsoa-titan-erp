import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocumentArtifactPreviewPanel", () => {
  it("renders the controlled preview shell without public URL or PDF controls", () => {
    render(<DocumentArtifactPreviewPanel />);

    expect(
      screen.getByRole("heading", { name: "Document artifact preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load artifact preview" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /public|download|artifact/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /pdf|download/i }),
    ).not.toBeInTheDocument();
  });

  it("rejects an empty document instance identifier", async () => {
    render(<DocumentArtifactPreviewPanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "Load artifact preview" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a document instance identifier before loading a preview.",
    );
  });

  it("loads a private HTML artifact preview in a sandboxed iframe", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        htmlResponse("<html><body><h1>Private artifact</h1></body></html>"),
      );

    render(<DocumentArtifactPreviewPanel />);

    fireEvent.change(screen.getByLabelText("Document instance ID"), {
      target: { value: "doc-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load artifact preview" }),
    );

    const iframe = await screen.findByTitle(
      "Document artifact preview doc-123",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/documents/instances/doc-123/artifact/",
      {
        credentials: "include",
        signal: undefined,
      },
    );
    expect(iframe).toHaveAttribute("sandbox", "");
    expect(iframe).toHaveAttribute(
      "srcdoc",
      "<html><body><h1>Private artifact</h1></body></html>",
    );
    expect(screen.queryByText(/storage_path/i)).not.toBeInTheDocument();
  });

  it.each([401, 403])(
    "shows an access error for HTTP %s responses",
    async (statusCode) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("", statusCode));

      render(<DocumentArtifactPreviewPanel />);

      fireEvent.change(screen.getByLabelText("Document instance ID"), {
        target: { value: "doc-123" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Load artifact preview" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The private artifact preview requires an authenticated session with document access.",
      );
    },
  );

  it("shows a not found error for a missing artifact", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("", 404));

    render(<DocumentArtifactPreviewPanel />);

    fireEvent.change(screen.getByLabelText("Document instance ID"), {
      target: { value: "doc-404" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load artifact preview" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No generated HTML artifact was found for this document instance.",
    );
  });
});
