import React from "react";
import {
  DocumentPreview,
  type DocumentPreviewProps,
} from "../prototype/DocumentPreview";

export type DocumentBusinessScope = "titan" | "hahitantsoa" | "shared";

export interface DocumentPreviewDispatcherProps extends DocumentPreviewProps {
  templateKey?: string;
  businessScope?: DocumentBusinessScope;
  documentType?: string;
}

const WORKFLOW_DOCUMENT_TYPES: Readonly<Record<string, "contrat" | "proforma" | "facture">> = {
  "hahitantsoa.contract.v1": "contrat",
  "titan.material_contract.v1": "contrat",
  "hahitantsoa.proforma.v1": "proforma",
  "titan.proforma.v1": "proforma",
  "hahitantsoa.invoice.v1": "facture",
  "titan.invoice.v1": "facture",
};

function inferScope(templateKey?: string): DocumentBusinessScope | undefined {
  if (templateKey?.startsWith("titan.")) return "titan";
  if (templateKey?.startsWith("hahitantsoa.")) return "hahitantsoa";
  if (templateKey?.startsWith("shared.")) return "shared";
  return undefined;
}

function normalizeDocumentType(documentType?: string): "contrat" | "proforma" | "facture" | undefined {
  const normalized = documentType?.trim().toLowerCase();
  if (normalized === "contract" || normalized === "material_contract" || normalized === "contrat") {
    return "contrat";
  }
  if (normalized === "proforma") return "proforma";
  if (normalized === "invoice" || normalized === "facture") return "facture";
  return undefined;
}

/**
 * Single frontend entry point for document previews.
 *
 * The protected workflow contracts and proformas intentionally continue to use
 * the existing pixel-approved renderer. Registry-only documents keep using the
 * backend HTML preview until their faithful renderer is migrated and approved.
 */
export function DocumentPreviewDispatcher({
  templateKey,
  businessScope,
  documentType,
  template,
  type,
  domain,
  ...previewProps
}: DocumentPreviewDispatcherProps) {
  const resolvedTemplateKey = templateKey || template?.templateKey;
  const resolvedScope = businessScope || inferScope(resolvedTemplateKey);
  const protectedType = resolvedTemplateKey ? WORKFLOW_DOCUMENT_TYPES[resolvedTemplateKey] : undefined;
  const resolvedType = protectedType || normalizeDocumentType(documentType) || type;
  const resolvedDomain = resolvedScope === "shared" ? domain : resolvedScope || domain;

  if (protectedType && (resolvedScope === "titan" || resolvedScope === "hahitantsoa")) {
    return (
      <DocumentPreview
        {...previewProps}
        type={protectedType}
        domain={resolvedScope}
      />
    );
  }

  return (
    <DocumentPreview
      {...previewProps}
      type={resolvedType}
      domain={resolvedDomain}
      template={template}
    />
  );
}
