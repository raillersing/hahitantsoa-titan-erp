import React, { useEffect, useMemo, useState } from "react";

import DocumentArtifactPreviewPanel from "../DocumentArtifactPreviewPanel";
import { getDocumentTemplatePreview } from "../api";

type DocumentType = "proforma" | "facture" | "contrat" | string;

export interface DocumentPreviewProps {
  type?: DocumentType;
  domain?: "titan" | "hahitantsoa" | "shared" | string;
  client?: { type?: string; party_type?: string } | null;
  template?: { templateKey?: string; key?: string } | null;
  documentInstanceId?: string | null;
  showVariables?: boolean;
  [key: string]: unknown;
}

type PreviewState =
  | { status: "loading" }
  | { status: "loaded"; html: string }
  | { status: "error"; message: string };

function resolveTemplateKey({ type, domain, template }: DocumentPreviewProps): string | null {
  const explicitKey = template?.templateKey || template?.key;
  if (explicitKey) return explicitKey;
  if (domain === "titan") {
    if (type === "proforma") return "titan.proforma.v1";
    if (type === "facture") return "titan.invoice.v1";
    if (type === "contrat") return "titan.material_contract.v1";
  }
  if (domain === "hahitantsoa") {
    if (type === "proforma") return "hahitantsoa.proforma.v1";
    if (type === "facture") return "hahitantsoa.invoice.v1";
    if (type === "contrat" || type === "annexes") return "hahitantsoa.contract.v1";
  }
  return null;
}

/**
 * Renders only an official backend template. Generated documents are shown by
 * DocumentArtifactPreviewPanel; React never composes commercial document content.
 */
export const DocumentPreview: React.FC<DocumentPreviewProps> = (props) => {
  const templateKey = useMemo(
    () => resolveTemplateKey(props),
    [props.domain, props.template, props.type],
  );
  const partyType =
    props.client?.party_type === "company" || props.client?.type === "Entreprise"
      ? "company"
      : "individual";
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    if (props.documentInstanceId) return;
    if (!templateKey) {
      setState({ status: "error", message: "Aucun modèle officiel n’est associé à ce document." });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    void getDocumentTemplatePreview(templateKey, controller.signal, Boolean(props.showVariables), partyType)
      .then((html) => setState({ status: "loaded", html }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Le modèle officiel n’a pas pu être chargé.",
        });
      });
    return () => controller.abort();
  }, [partyType, props.documentInstanceId, props.showVariables, templateKey]);

  if (props.documentInstanceId) {
    return <DocumentArtifactPreviewPanel documentInstanceId={props.documentInstanceId} />;
  }
  if (state.status === "error") return <div className="notice error-notice" role="alert">{state.message}</div>;
  if (state.status === "loading") return <div className="notice loading-notice" role="status">Chargement du modèle officiel…</div>;
  return (
    <iframe
      className="artifact-preview-frame w-full min-h-[720px] border-0"
      loading="lazy"
      sandbox=""
      srcDoc={state.html}
      title={`Aperçu du modèle officiel ${templateKey}`}
    />
  );
};
