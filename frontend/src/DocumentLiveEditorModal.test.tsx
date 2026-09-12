import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import DocumentLiveEditorModal from "./DocumentLiveEditorModal";
import * as api from "./api";
import type { DocumentInstance } from "./types";

const mockInstance = {
  id: "doc-inst-123",
  reservation_draft: "draft-456",
  template_key: "hahitantsoa.preparation_sheet.v1",
  document_type: "fiche_preparation",
  status: "generated",
  storage_path: "documents/hahitantsoa_prep.html",
  content_checksum: "abc123hash",
  generated_content_size_bytes: 1024,
  rendered_variables: {},
  prepared_at: "2026-09-12T10:00:00Z",
  created_at: "2026-09-12T10:00:00Z",
  updated_at: "2026-09-12T10:00:00Z",
  voided_at: null,
  void_reason: "",
} as unknown as DocumentInstance;

const sampleHtml = `<!doctype html>
<html>
<head><title>Checking de passation</title></head>
<body>
  <h1>Checking de passation</h1>
  <ul>
    <li><span class="check"></span>2 prises intérieures</li>
  </ul>
</body>
</html>`;

describe("DocumentLiveEditorModal", () => {
  beforeEach(() => {
    vi.spyOn(api, "getDocumentArtifactHtml").mockResolvedValue(sampleHtml);
    vi.spyOn(api, "overrideDocumentInstanceContent").mockResolvedValue(mockInstance);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <DocumentLiveEditorModal
        isOpen={false}
        onClose={vi.fn()}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal shell with complete formatting toolbar and loads document", async () => {
    render(
      <DocumentLiveEditorModal
        isOpen={true}
        onClose={vi.fn()}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
        templateKey="hahitantsoa.preparation_sheet.v1"
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checking de passation" })).toBeInTheDocument();
    expect(screen.getByText("hahitantsoa.preparation_sheet.v1")).toBeInTheDocument();

    // Toolbar checks
    expect(screen.getByTestId("editor-save")).toBeInTheDocument();
    expect(screen.getByTestId("editor-undo")).toBeInTheDocument();
    expect(screen.getByTestId("editor-redo")).toBeInTheDocument();
    expect(screen.getByTestId("editor-heading")).toBeInTheDocument();
    expect(screen.getByTestId("editor-font-family")).toBeInTheDocument();
    expect(screen.getByTestId("editor-font-size")).toBeInTheDocument();
    expect(screen.getByTestId("editor-bold")).toBeInTheDocument();
    expect(screen.getByTestId("editor-italic")).toBeInTheDocument();
    expect(screen.getByTestId("editor-underline")).toBeInTheDocument();
    expect(screen.getByTestId("editor-strike")).toBeInTheDocument();
    expect(screen.getByTestId("editor-text-color-btn")).toBeInTheDocument();
    expect(screen.getByTestId("editor-highlight-btn")).toBeInTheDocument();
    expect(screen.getByTestId("editor-align-left")).toBeInTheDocument();
    expect(screen.getByTestId("editor-align-center")).toBeInTheDocument();
    expect(screen.getByTestId("editor-align-right")).toBeInTheDocument();
    expect(screen.getByTestId("editor-align-justify")).toBeInTheDocument();
    expect(screen.getByTestId("editor-bullet-list")).toBeInTheDocument();
    expect(screen.getByTestId("editor-number-list")).toBeInTheDocument();
    expect(screen.getByTestId("editor-insert-checkbox")).toBeInTheDocument();
    expect(screen.getByTestId("editor-table-menu")).toBeInTheDocument();
    expect(screen.getByTestId("editor-clear-format")).toBeInTheDocument();

    // Iframe editor is present
    await waitFor(() => {
      expect(screen.getByTestId("document-live-editor-iframe")).toBeInTheDocument();
    });
    expect(api.getDocumentArtifactHtml).toHaveBeenCalledWith("doc-inst-123");
  });

  it("opens table menu and displays table insertion and manipulation options", async () => {
    render(
      <DocumentLiveEditorModal
        isOpen={true}
        onClose={vi.fn()}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-live-editor-iframe")).toBeInTheDocument();
    });

    const tableMenuBtn = screen.getByTestId("editor-table-menu");
    fireEvent.click(tableMenuBtn);

    expect(screen.getByTestId("editor-insert-table-2x2")).toBeInTheDocument();
    expect(screen.getByTestId("editor-insert-table-3x3")).toBeInTheDocument();
    expect(screen.getByTestId("editor-insert-table-4x3")).toBeInTheDocument();
    expect(screen.getByTestId("editor-row-above")).toBeInTheDocument();
    expect(screen.getByTestId("editor-row-below")).toBeInTheDocument();
    expect(screen.getByTestId("editor-delete-row")).toBeInTheDocument();
    expect(screen.getByTestId("editor-col-left")).toBeInTheDocument();
    expect(screen.getByTestId("editor-col-right")).toBeInTheDocument();
    expect(screen.getByTestId("editor-delete-col")).toBeInTheDocument();
    expect(screen.getByTestId("editor-delete-table")).toBeInTheDocument();
  });

  it("calls overrideDocumentInstanceContent when clicking Enregistrer", async () => {
    const onSaved = vi.fn();
    render(
      <DocumentLiveEditorModal
        isOpen={true}
        onClose={vi.fn()}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
        onSaved={onSaved}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-live-editor-iframe")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId("editor-save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.overrideDocumentInstanceContent).toHaveBeenCalledWith(
        "doc-inst-123",
        expect.stringContaining("<!doctype html>"),
      );
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(mockInstance);
    });
  });

  it("shows an error banner if document loading fails", async () => {
    vi.spyOn(api, "getDocumentArtifactHtml").mockRejectedValueOnce(
      new Error("Échec de chargement de l'artéfact"),
    );

    render(
      <DocumentLiveEditorModal
        isOpen={true}
        onClose={vi.fn()}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Échec de chargement de l'artéfact");
  });

  it("warns when closing with unsaved changes", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();

    render(
      <DocumentLiveEditorModal
        isOpen={true}
        onClose={onClose}
        documentInstanceId="doc-inst-123"
        title="Checking de passation"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-live-editor-iframe")).toBeInTheDocument();
    });

    // Simulate clicking bold to make dirty
    fireEvent.click(screen.getByTestId("editor-bold"));

    // Click close
    fireEvent.click(screen.getByLabelText("Fermer l'éditeur"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Now accept confirmation
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByLabelText("Fermer l'éditeur"));
    expect(onClose).toHaveBeenCalled();
  });
});
