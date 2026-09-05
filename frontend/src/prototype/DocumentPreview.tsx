import React, { useEffect, useMemo, useState } from "react";

import DocumentArtifactPreviewPanel from "../DocumentArtifactPreviewPanel";
import DocumentCanvasViewer from "./DocumentCanvasViewer";
import {
  getDocumentTemplatePreview,
  getHahitantsoaEventDraftDocumentPreview,
  getReservationDraftDocumentPreview,
} from "../api";

type DocumentType = "proforma" | "facture" | "contrat" | "bon_livraison" | "delivery_note" | "decharge" | "liability_release" | "fiche_preparation" | "preparation_sheet" | string;

export interface DocumentPreviewProps {
  type?: DocumentType;
  domain?: "titan" | "hahitantsoa" | "shared" | string;
  client?: { type?: string; party_type?: string } | null;
  template?: { templateKey?: string; key?: string } | null;
  documentInstanceId?: string | null;
  reservationDraftId?: string | null;
  hahitantsoaEventDraftId?: string | null;
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
  const normalizedType = type?.toLowerCase();
  if (domain === "titan") {
    if (normalizedType === "proforma") return "titan.proforma.v1";
    if (normalizedType === "facture" || normalizedType === "invoice") return "titan.invoice.v1";
    if (normalizedType === "contrat" || normalizedType === "contract") return "titan.material_contract.v1";
    if (normalizedType === "bon_livraison" || normalizedType === "delivery_note") return "titan.delivery_note.v1";
    if (normalizedType === "fiche_preparation" || normalizedType === "preparation_sheet") return "shared.preparation_sheet.v1";
  }
  if (domain === "hahitantsoa") {
    if (normalizedType === "proforma") return "hahitantsoa.proforma.v1";
    if (normalizedType === "facture" || normalizedType === "invoice") return "hahitantsoa.invoice.v1";
    if (normalizedType === "contrat" || normalizedType === "contract" || normalizedType === "annexes") return "hahitantsoa.contract.v1";
    if (normalizedType === "bon_livraison" || normalizedType === "delivery_note") return "hahitantsoa.delivery_note.v1";
    if (normalizedType === "decharge" || normalizedType === "liability_release") return "hahitantsoa.liability_release.v1";
    if (normalizedType === "fiche_preparation" || normalizedType === "preparation_sheet") return "hahitantsoa.preparation_sheet.v1";
  }
  return null;
}

/**
 * Renders only an official backend template or authentic draft preview. Generated documents are shown by
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
    const eventDraftId = props.hahitantsoaEventDraftId;
    const reservationDraftId = props.reservationDraftId;
    if (props.domain === "hahitantsoa" && !eventDraftId && !props.documentInstanceId) {
      setState({
        status: "error",
        message: "Enregistrez le brouillon Hahitantsoa pour afficher le document avec ses données réelles.",
      });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    const preview =
      props.domain === "hahitantsoa" && eventDraftId
        ? getHahitantsoaEventDraftDocumentPreview(
            eventDraftId,
            templateKey,
            controller.signal,
          )
        : (props.domain === "titan" || reservationDraftId) && reservationDraftId
          ? getReservationDraftDocumentPreview(
              reservationDraftId,
              templateKey,
              controller.signal,
            )
          : getDocumentTemplatePreview(
              templateKey,
              controller.signal,
              Boolean(props.showVariables),
              partyType,
            );
    void preview
      .then((html) => setState({ status: "loaded", html }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Le modèle officiel n’a pas pu être chargé.",
        });
      });
    return () => controller.abort();
  }, [
    partyType,
    props.documentInstanceId,
    props.domain,
    props.hahitantsoaEventDraftId,
    props.reservationDraftId,
    props.showVariables,
    templateKey,
  ]);

  if (props.documentInstanceId) {
    return <DocumentArtifactPreviewPanel documentInstanceId={props.documentInstanceId} />;
  }
  if (state.status === "error") return <div className="notice error-notice" role="alert">{state.message}</div>;
  if (state.status === "loading") return <div className="notice loading-notice" role="status">Chargement du modèle officiel…</div>;
  return (
    <DocumentCanvasViewer
      html={state.html}
      title={`Aperçu du modèle officiel ${templateKey}`}
    />
  );
};
