import { type FormEvent, useEffect, useState } from "react";

import { getDocumentInstancePdfBlob } from "./api";

type PdfPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; objectUrl: string; documentInstanceId: string }
  | { status: "error"; message: string };

function DocumentPdfPreviewPanel() {
  const [documentInstanceId, setDocumentInstanceId] = useState("");
  const [previewState, setPreviewState] = useState<PdfPreviewState>({ status: "idle" });

  useEffect(() => {
    return () => {
      if (previewState.status === "loaded") {
        URL.revokeObjectURL(previewState.objectUrl);
      }
    };
  }, [previewState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDocumentInstanceId = documentInstanceId.trim();
    if (!normalizedDocumentInstanceId) {
      setPreviewState({
        status: "error",
        message: "Enter a document instance identifier before loading a PDF preview.",
      });
      return;
    }

    setPreviewState({ status: "loading" });

    try {
      const blob = await getDocumentInstancePdfBlob(normalizedDocumentInstanceId);
      const objectUrl = URL.createObjectURL(blob);
      setPreviewState({
        status: "loaded",
        objectUrl,
        documentInstanceId: normalizedDocumentInstanceId,
      });
    } catch (error) {
      setPreviewState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The requested PDF artifact could not be loaded.",
      });
    }
  }

  return (
    <section className="artifact-preview-section" aria-labelledby="pdf-preview-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private PDF artifacts</p>
          <h2 id="pdf-preview-heading">Document PDF preview</h2>
          <p className="section-helper">
            Controlled frontend preview for generated PDF artifacts only. This surface uses
            the private backend endpoint and creates no public URL.
          </p>
        </div>
      </div>

      <form className="artifact-preview-form" onSubmit={handleSubmit}>
        <label>
          Document instance ID
          <input
            name="document_instance_id"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={documentInstanceId}
            onChange={(event) => {
              setDocumentInstanceId(event.target.value);
              setPreviewState({ status: "idle" });
            }}
          />
        </label>
        <button type="submit" disabled={previewState.status === "loading"}>
          Load PDF preview
        </button>
      </form>

      {previewState.status === "loading" ? (
        <div className="notice loading-notice artifact-preview-status" role="status">
          <p className="loading-spinner">Loading private PDF artifact...</p>
        </div>
      ) : null}

      {previewState.status === "error" ? (
        <div className="notice error-notice artifact-preview-notice" role="alert">
          <div>
            <h3>PDF artifact unavailable</h3>
            <p>{previewState.message}</p>
          </div>
        </div>
      ) : null}

      {previewState.status === "loaded" ? (
        <div className="artifact-preview-frame-shell">
          <div className="artifact-preview-meta">
            <strong>
              Previewing PDF document instance {previewState.documentInstanceId}
            </strong>
            <p>Rendered from the authenticated private PDF endpoint inside an iframe.</p>
          </div>
          <iframe
            className="artifact-preview-frame"
            loading="lazy"
            src={previewState.objectUrl}
            title={`Document PDF preview ${previewState.documentInstanceId}`}
          />
        </div>
      ) : null}
    </section>
  );
}

export default DocumentPdfPreviewPanel;
