import { type FormEvent, useState } from "react";

import { getDocumentArtifactHtml } from "./api";

type ArtifactPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; html: string; documentInstanceId: string }
  | { status: "error"; message: string };

function DocumentArtifactPreviewPanel() {
  const [documentInstanceId, setDocumentInstanceId] = useState("");
  const [previewState, setPreviewState] = useState<ArtifactPreviewState>({
    status: "idle",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDocumentInstanceId = documentInstanceId.trim();

    if (!normalizedDocumentInstanceId) {
      setPreviewState({
        status: "error",
        message: "Enter a document instance identifier before loading a preview.",
      });
      return;
    }

    setPreviewState({ status: "loading" });

    try {
      const html = await getDocumentArtifactHtml(normalizedDocumentInstanceId);
      setPreviewState({
        status: "loaded",
        html,
        documentInstanceId: normalizedDocumentInstanceId,
      });
    } catch (error) {
      setPreviewState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The requested document artifact could not be loaded.",
      });
    }
  }

  return (
    <section
      className="artifact-preview-section"
      aria-labelledby="artifact-preview-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private HTML artifacts</p>
          <h2 id="artifact-preview-heading">Document artifact preview</h2>
          <p className="section-helper">
            Controlled frontend preview for generated HTML artifacts only. This
            surface uses the private backend endpoint, exposes no storage path,
            creates no public URL and does not generate PDF output.
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
          Load artifact preview
        </button>
      </form>

      {previewState.status === "loading" ? (
        <div className="notice loading-notice artifact-preview-status" role="status">
          <p className="loading-spinner">Loading private document artifact...</p>
        </div>
      ) : null}

      {previewState.status === "error" ? (
        <div className="notice error-notice artifact-preview-notice" role="alert">
          <div>
            <h3>Document artifact unavailable</h3>
            <p>{previewState.message}</p>
          </div>
        </div>
      ) : null}

      {previewState.status === "loaded" ? (
        <div className="artifact-preview-frame-shell">
          <div className="artifact-preview-meta">
            <strong>
              Previewing document instance{" "}
              {previewState.documentInstanceId}
            </strong>
            <p>
              Rendered from the authenticated private artifact endpoint inside a
              sandboxed iframe.
            </p>
          </div>
          <iframe
            className="artifact-preview-frame"
            loading="lazy"
            sandbox=""
            srcDoc={previewState.html}
            title={`Document artifact preview ${previewState.documentInstanceId}`}
          />
        </div>
      ) : null}
    </section>
  );
}

export default DocumentArtifactPreviewPanel;
