import React, { useEffect, useState } from "react";
import {
  getDocumentTemplates,
  getDocumentTemplatePreview,
} from "../api";
import type { DocumentTemplateDefinition } from "../types";
import { XIcon } from "../components/icons";

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

function extractVariables(html: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

export default function DocumentsTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [vars, setVars] = useState<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    getDocumentTemplates(ctrl.signal)
      .then((data) => {
        setTemplates(data);
      })
      .catch(() => setError("Impossible de charger les modeles."))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!previewKey) return;
    const ctrl = new AbortController();
    setPreviewLoading(true);
    setPreviewHtml(null);
    getDocumentTemplatePreview(previewKey, ctrl.signal)
      .then((html) => {
        setPreviewHtml(html);
        setVars(extractVariables(html));
      })
      .catch(() => setPreviewHtml("<p>Apercu non disponible.</p>"))
      .finally(() => setPreviewLoading(false));
    return () => ctrl.abort();
  }, [previewKey]);

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
      delivery_note: "B",
      amendment: "A",
      breakage_repair: "X",
      liability_release: "D",
    };
    return map[type] || "?";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Modeles de documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            {templates.length} modeles disponibles — proforma, facture, contrat, BL, avenant, casse, decharge
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">Chargement des modeles...</div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.key}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setPreviewKey(t.key);
                  setShowVars(false);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${scopeColor(t.business_scope)}`}
                  >
                    {typeIcon(t.document_type)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${scopeColor(t.business_scope)}`}
                  >
                    {t.business_scope}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">{t.label}</h3>
                <p className="text-xs text-slate-500 capitalize">{t.document_type.replace(/_/g, " ")}</p>
                <div className="mt-3 flex items-center gap-2">
                  {t.validated_by_client && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Source validee
                    </span>
                  )}
                  {t.source_kind === "source_pdf" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      PDF source
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Slide-in Preview */}
          {previewKey && (
            <>
              <div
                className="fixed inset-0 bg-slate-950/30 z-40"
                onClick={() => setPreviewKey(null)}
              />
              <div className="fixed top-0 right-0 w-full sm:w-[520px] h-full bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {templates.find((t) => t.key === previewKey)?.label}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {templates.find((t) => t.key === previewKey)?.document_type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowVars((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        showVars
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {showVars ? "Masquer variables" : "Voir variables"}
                    </button>
                    <button
                      onClick={() => setPreviewKey(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <XIcon size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 relative">
                  {previewLoading ? (
                    <div className="py-20 text-center text-slate-500">Chargement...</div>
                  ) : (
                    <div className="relative">
                      {/* HTML Preview */}
                      <div
                        className="border border-slate-200 rounded-lg overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
                      />

                      {/* Variables Overlay */}
                      {showVars && vars.length > 0 && (
                        <div className="mt-4 bg-indigo-50 rounded-lg border border-indigo-200 p-4">
                          <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-3">
                            Variables detectees ({vars.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {vars.map((v) => (
                              <div
                                key={v}
                                className="flex items-center gap-2 bg-white rounded px-3 py-2 border border-indigo-100"
                              >
                                <code className="text-xs font-mono text-indigo-700">{"{{"}{v}{"}}"}</code>
                                <span className="text-xs text-slate-500">
                                  {VARIABLE_MAP[v] || v}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
