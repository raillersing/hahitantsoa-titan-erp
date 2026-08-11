import React, { useEffect, useRef, useState } from "react";
import {
  getDocumentTemplates,
  getDocumentTemplatePreview,
} from "../api";
import type { DocumentTemplateDefinition } from "../types";
import { XIcon } from "../components/icons";
import { DocumentPreviewDispatcher } from "../documents/document-preview-dispatcher";

const VARIABLE_MAP: Record<string, string> = {
  "client.name": "Nom du client",
  "client.address": "Adresse",
  "client.phone": "Telephone",
  "client.email": "Email",
  "dossier.ref": "Reference dossier",
  "dossier.date": "Date evenement",
  "event.date": "Date",
  "event.venue": "Lieu",
  "finance.totalAmount": "Montant total",
  "finance.depositAmount": "Acompte",
  "company.name": "Societe",
  "company.bankName": "Banque",
  "company.bankIban": "IBAN",
  "document.date": "Date edition",
};

type PaperSize = "A4";

const EXCLUDED_CATALOG_TEMPLATE_KEYS = new Set(["hahitantsoa.house_rules.v1"]);
const WORKFLOW_PREVIEW_KEYS = new Set([
  "hahitantsoa.contract.v1",
  "titan.material_contract.v1",
  "hahitantsoa.proforma.v1",
  "titan.proforma.v1",
]);

const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
};

function extractVariables(html: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

function detectPaperSize(_html: string): PaperSize {
  // All ERP documents are emitted and previewed on the normalized A4 canvas.
  return "A4";
}

function detectPageCount(html: string): number {
  const pageMarkers = html.match(/class=["'][^"']*\bdocument-page\b[^"']*["']/g);
  return Math.max(1, pageMarkers?.length ?? 1);
}

function workflowPreviewPageCount(templateKey: string): number {
  if (templateKey.endsWith("contract.v1") || templateKey.endsWith("material_contract.v1")) {
    return templateKey.startsWith("hahitantsoa.") ? 8 : 3;
  }
  return 1;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export default function DocumentsTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);
  const [partyType, setPartyType] = useState<"individual" | "company">("individual");
  const [vars, setVars] = useState<string[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [pageCount, setPageCount] = useState(1);
  const previewFrameContainerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const previewIndex = templates.findIndex((template) => template.key === previewKey);
  const currentTemplate = previewIndex >= 0 ? templates[previewIndex] : undefined;
  const usesWorkflowPreview = Boolean(currentTemplate && WORKFLOW_PREVIEW_KEYS.has(currentTemplate.key));
  const paperDimensions = PAPER_DIMENSIONS[paperSize];

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    getDocumentTemplates(ctrl.signal)
      .then((data) => {
        setError(null);
        setTemplates(data.filter((template) => !EXCLUDED_CATALOG_TEMPLATE_KEYS.has(template.key)));
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError("Impossible de charger les modeles.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!previewKey) return;
    const ctrl = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(null);
    setVars([]);
    if (WORKFLOW_PREVIEW_KEYS.has(previewKey)) {
      setPaperSize("A4");
      setPageCount(workflowPreviewPageCount(previewKey));
      setPreviewLoading(false);
      return () => ctrl.abort();
    }
    getDocumentTemplatePreview(previewKey, ctrl.signal, showVars, partyType)
      .then((html) => {
        setPreviewHtml(html);
        setPaperSize(detectPaperSize(html));
        setPageCount(detectPageCount(html));
        setVars(extractVariables(html));
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setPreviewError("Apercu non disponible.");
      })
      .finally(() => setPreviewLoading(false));
    return () => ctrl.abort();
  }, [previewKey, showVars, partyType]);

  useEffect(() => {
    if (!previewKey) return;
    dialogTitleRef.current?.focus();
  }, [previewKey]);

  useEffect(() => {
    const container = previewFrameContainerRef.current;
    if (!container) return;

    const updateScale = () => {
      setPreviewScale(Math.min(1, container.clientWidth / paperDimensions.width));
    };

    updateScale();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [previewHtml, paperSize, paperDimensions.width]);

  const closePreview = () => {
    setPreviewKey(null);
    lastTriggerRef.current?.focus();
  };

  const openPreview = (template: DocumentTemplateDefinition, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setPreviewKey(template.key);
    setShowVars(false);
    setPartyType("individual");
    setPaperSize("A4");
    setPageCount(1);
  };

  const movePreview = (offset: -1 | 1) => {
    if (previewIndex < 0) return;
    const nextIndex = previewIndex + offset;
    if (nextIndex < 0 || nextIndex >= templates.length) return;
    setPreviewKey(templates[nextIndex].key);
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePreview();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      movePreview(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      movePreview(1);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const scopeColor = (scope: string) =>
    scope === "titan"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : scope === "hahitantsoa"
        ? "bg-pink-50 text-pink-700 border-pink-200"
        : "bg-slate-50 text-slate-700 border-slate-200";

  const typeIcon = (type: string) => {
    const map: Record<string, string> = {
      proforma: "P",
      invoice: "F",
      contract: "C",
      contract_amendment: "A",
      delivery_note: "B",
      amendment: "A",
      material_amendment: "A",
      breakage_repair: "X",
      liability_release: "D",
    };
    return map[type] || "?";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Modeles de documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            {templates.length} modeles disponibles — proforma, facture, contrat, BL, avenant, casse, decharge
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
          <span className="font-semibold">Conseil :</span> sélectionnez un modèle pour l’ouvrir en grand et naviguer avec ← →.
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500" role="status" aria-live="polite">Chargement des modeles...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                aria-label={`Prévisualiser ${template.label}`}
                className="group min-h-44 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                onClick={(event) => openPreview(template, event.currentTarget)}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${scopeColor(template.business_scope)}`}>
                    {typeIcon(template.document_type)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${scopeColor(template.business_scope)}`}>
                    {template.business_scope}
                  </span>
                </div>
                <h3 className="mb-1 font-semibold text-slate-900 text-sm group-hover:text-indigo-700">{template.label}</h3>
                <p className="text-xs text-slate-500 capitalize">{template.document_type.replace(/_/g, " ")}</p>
                <div className="mt-3 flex items-center gap-2">
                  {template.validated_by_client && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Source validee
                    </span>
                  )}
                  {template.source_kind === "source_pdf" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      PDF source
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {previewKey && currentTemplate && (
            <>
              <div className="fixed inset-0 bg-slate-950/30 z-40" onClick={closePreview} />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-preview-title"
                className="fixed inset-3 sm:inset-5 lg:inset-8 bg-white shadow-2xl z-50 border border-slate-200 rounded-xl flex flex-col overflow-hidden"
                onKeyDown={handleDialogKeyDown}
              >
                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 id="document-preview-title" ref={dialogTitleRef} tabIndex={-1} className="font-bold text-slate-900 truncate">
                      {currentTemplate.label}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentTemplate.document_type.replace(/_/g, " ")} · {paperSize}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="sr-only">Variante client</span>
                      <select
                        aria-label="Variante client"
                        value={partyType}
                        onChange={(event) => setPartyType(event.target.value === "company" ? "company" : "individual")}
                        className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <option value="individual">Particulier</option>
                        <option value="company">Entreprise</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowVars((value) => !value)}
                      aria-pressed={showVars}
                      className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${showVars ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {showVars ? "Masquer variables" : "Voir variables"}
                    </button>
                    <button type="button" onClick={closePreview} aria-label="Fermer l’aperçu" className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
                      <XIcon size={20} />
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center gap-3" role="region" aria-label="Navigation des modèles">
                  <button type="button" onClick={() => movePreview(-1)} disabled={previewIndex <= 0} aria-label="Document précédent" className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    <span aria-hidden="true">←</span>
                  </button>
                  <div className="flex-1 overflow-x-auto" aria-live="polite" aria-atomic="true">
                    <div className="flex items-center justify-center gap-2 min-w-max">
                      {templates.map((template, index) => (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => setPreviewKey(template.key)}
                          aria-label={`Afficher ${template.label}`}
                          aria-current={template.key === previewKey ? "true" : undefined}
                          className={`min-h-11 max-w-52 truncate rounded-lg px-3 text-xs font-semibold border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${template.key === previewKey ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                        >
                          <span className="sr-only">{index + 1}. </span>{template.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => movePreview(1)} disabled={previewIndex < 0 || previewIndex >= templates.length - 1} aria-label="Document suivant" className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    <span aria-hidden="true">→</span>
                  </button>
                  <span className="hidden sm:inline text-xs font-semibold text-slate-500 whitespace-nowrap" aria-label={`Document ${previewIndex + 1} sur ${templates.length}`}>
                    {previewIndex + 1} / {templates.length}
                  </span>
                </div>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="relative min-h-0 overflow-y-auto bg-slate-100 p-4 sm:p-6">
                  {previewLoading ? (
                    <div className="py-20 text-center text-slate-500" role="status" aria-live="polite">Chargement...</div>
                  ) : previewError ? (
                    <div className="py-20 text-center text-red-700" role="alert">{previewError}</div>
                  ) : previewHtml || usesWorkflowPreview ? (
                    <div className="relative mx-auto max-w-[210mm]">
                      <div
                        ref={previewFrameContainerRef}
                        data-testid="document-template-preview"
                        data-paper-size={paperSize}
                        className={`border border-slate-200 rounded-lg bg-slate-100 flex justify-center mx-auto ${usesWorkflowPreview ? "overflow-visible" : "overflow-hidden"}`}
                        style={usesWorkflowPreview
                          ? { minHeight: `${paperDimensions.height * pageCount * previewScale}px`, maxWidth: `${paperDimensions.width}px` }
                          : { height: `${paperDimensions.height * pageCount * previewScale}px`, maxWidth: `${paperDimensions.width}px` }}
                      >
                        {usesWorkflowPreview ? (
                          <div
                            className="block shrink-0 bg-white"
                            style={{
                              width: `${paperDimensions.width}px`,
                              minHeight: `${paperDimensions.height * pageCount}px`,
                              transform: `scale(${previewScale})`,
                              transformOrigin: "top left",
                            }}
                          >
                            <DocumentPreviewDispatcher
                              templateKey={currentTemplate.key}
                              businessScope={currentTemplate.business_scope as "titan" | "hahitantsoa"}
                              documentType={currentTemplate.document_type}
                              client={{
                                type: partyType === "company" ? "Entreprise" : "Particulier",
                                name: "",
                                address: "",
                                phone: "",
                                email: "",
                                status: "Client",
                              }}
                              date=""
                              refNumber=""
                              eventDate=""
                              materials={[]}
                              services={[]}
                              totalAmount={0}
                              discountAmount={0}
                              subTotalAmount={0}
                              paidAmount={0}
                              showVariables={showVars}
                            />
                          </div>
                        ) : (
                          <iframe
                            title={`Aperçu du modèle de document : ${currentTemplate.label}`}
                            srcDoc={previewHtml || ""}
                            className="block border-0 bg-white shrink-0"
                            style={{
                              width: `${paperDimensions.width}px`,
                              height: `${paperDimensions.height * pageCount}px`,
                              transform: `scale(${previewScale})`,
                              transformOrigin: "top left",
                            }}
                          />
                        )}
                      </div>

                      {showVars && vars.length > 0 && (
                        <div className="mt-4 bg-indigo-50 rounded-lg border border-indigo-200 p-4">
                          <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-3">
                            Variables detectees ({vars.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {vars.map((variable) => (
                              <div key={variable} className="flex items-center gap-2 bg-white rounded px-3 py-2 border border-indigo-100">
                                <code className="text-xs font-mono text-indigo-700">{"{{"}{variable}{"}}"}</code>
                                <span className="text-xs text-slate-500">{VARIABLE_MAP[variable] || variable}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <aside className="max-h-56 overflow-y-auto border-t border-slate-200 bg-white p-4 sm:p-5 lg:max-h-none lg:border-l lg:border-t-0">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Fiche du modèle</h4>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm lg:block lg:space-y-4">
                    <div><dt className="text-xs text-slate-500">Volet</dt><dd className="mt-1 font-semibold capitalize text-slate-900">{currentTemplate.business_scope}</dd></div>
                    <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-1 font-semibold capitalize text-slate-900">{currentTemplate.document_type.replace(/_/g, " ")}</dd></div>
                    <div><dt className="text-xs text-slate-500">Format</dt><dd className="mt-1 font-semibold text-slate-900">{paperSize} · {pageCount} page{pageCount > 1 ? "s" : ""}</dd></div>
                    <div><dt className="text-xs text-slate-500">Version</dt><dd className="mt-1 font-semibold text-slate-900">{currentTemplate.version || "—"}</dd></div>
                  </dl>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs leading-5 text-slate-500">Le canvas respecte le format A4 et conserve le rendu du document source. Les variantes particulier/entreprise sont disponibles quand le modèle les prévoit.</p>
                  </div>
                </aside>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
