import React, { useEffect, useMemo, useState } from "react";
import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  getDocumentTemplatePreview,
  getDocumentTemplates,
  getDocumentTemplateVersions,
} from "../api";
import { DocumentPreviewDispatcher } from "../documents/document-preview-dispatcher";
import { DocumentTemplateDefinition, DocumentTemplateVersion } from "../types";

type Scope = "titan" | "hahitantsoa" | "shared";
type PageMode = "templates" | "generated";
type StatusFilter = "Tous" | "Actif" | "Brouillon" | "Source validée" | "À valider";

type TemplateRow = DocumentTemplateDefinition & {
  id: string;
  displayStatus: Exclude<StatusFilter, "Tous">;
  isRegistrySource: boolean;
};

const VARIABLE_DICTIONARY = [
  ["client.name", "Nom complet du client"], ["client.address", "Adresse de facturation"],
  ["dossier.ref", "Numéro de dossier"], ["event.date", "Date de l’événement"],
  ["event.venue", "Lieu de l’événement"], ["event.usage", "Type d’événement"],
  ["finance.totalAmount", "Montant total TTC"], ["finance.depositAmount", "Acompte versé"],
  ["finance.balanceAmount", "Solde restant"], ["finance.cautionAmount", "Dépôt de garantie"],
  ["inventory.articles", "Articles"], ["inventory.packs", "Packs"],
  ["logistics.deliveryDate", "Date de livraison"], ["logistics.returnDate", "Date de reprise"],
  ["company.name", "Nom de la société"], ["company.bankName", "Banque"],
  ["company.bankIban", "IBAN"], ["company.bankBic", "BIC"], ["document.date", "Date d’édition"],
] as const;

function statusLabel(status: string, validated: boolean): TemplateRow["displayStatus"] {
  if (validated || status === "validated_source_template") return "Source validée";
  if (status === "generated_draft_template" || status === "draft") return "À valider";
  return status === "active" ? "Actif" : "Brouillon";
}

function scopeLabel(scope: Scope) {
  return scope === "titan" ? "Titan" : scope === "hahitantsoa" ? "Hahitantsoa" : "Commun";
}

function mapTemplate(definition: DocumentTemplateDefinition, index: number): TemplateRow {
  return {
    ...definition,
    id: `registry-${definition.key || index}`,
    displayStatus: statusLabel(definition.status, definition.validated_by_client),
    isRegistrySource: true,
  };
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{children}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-xl text-indigo-600">□</div>
    <h3 className="font-semibold text-slate-900">{title}</h3><p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">{body}</p>
  </div>;
}

function GeneratedDocuments({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  return <section aria-labelledby="generated-title" className="space-y-5">
    <div><h2 id="generated-title" className="text-xl font-bold text-slate-900">Documents générés</h2>
      <p className="mt-1 text-sm text-slate-500">Les documents produits sont rattachés à leur dossier métier pour garantir leur traçabilité.</p></div>
    <Empty title="Accès depuis les dossiers métier" body="La liste globale des documents générés n’est pas exposée par l’API actuelle. Ouvrez un dossier pour consulter son contrat, sa proforma, sa facture ou ses pièces privées." />
    <div className="grid gap-4 md:grid-cols-2">
      <button onClick={() => onNavigate("commercial-ops")} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md">
        <span className="text-sm font-semibold text-indigo-700">Opérations commerciales</span><h3 className="mt-2 font-semibold text-slate-900">Documents commerciaux</h3><p className="mt-1 text-sm text-slate-500">Retrouver les documents liés aux parcours de vente et de réservation.</p><span className="mt-4 inline-block text-sm font-semibold text-indigo-600">Ouvrir les opérations →</span>
      </button>
      <button onClick={() => onNavigate("reservations")} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md">
        <span className="text-sm font-semibold text-indigo-700">Réservations</span><h3 className="mt-2 font-semibold text-slate-900">Documents d’un dossier</h3><p className="mt-1 text-sm text-slate-500">Consulter les instances générées et leurs aperçus dans le contexte du dossier.</p><span className="mt-4 inline-block text-sm font-semibold text-indigo-600">Ouvrir les réservations →</span>
      </button>
    </div>
  </section>;
}

function CreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (row: TemplateRow) => void }) {
  const [name, setName] = useState(""); const [scope, setScope] = useState<"titan" | "hahitantsoa">("hahitantsoa"); const [type, setType] = useState("Contrat"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!name.trim()) { setError("Le nom du modèle est obligatoire."); return; } setBusy(true); setError(null); try { const created = await createDocumentTemplate({ code: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), name: name.trim(), business_scope: scope, document_type: type, status: "draft" }); onCreated(mapTemplate(created, 0)); } catch { setError("La création n’a pas abouti. Vérifiez vos droits et réessayez."); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6"><h2 className="text-xl font-bold text-slate-900">Nouveau modèle</h2><p className="mt-1 text-sm text-slate-500">Créez la fiche du modèle. Son contenu fidèle sera versionné dans le registre documentaire.</p></div>
    {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Nom<input autoFocus value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
      <label className="text-sm font-semibold text-slate-700">Volet métier<select value={scope} onChange={e => setScope(e.target.value as typeof scope)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="hahitantsoa">Hahitantsoa</option><option value="titan">Titan</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Type<select value={type} onChange={e => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option>Contrat</option><option>Proforma</option><option>Facture</option><option>Avenant</option><option>Bon de livraison</option></select></label>
    </div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Création…" : "Créer le modèle"}</button></div>
  </form>;
}

function TemplateDetail({ row, onBack, onDelete }: { row: TemplateRow; onBack: () => void; onDelete: () => Promise<void> }) {
  const [showVariables, setShowVariables] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentTemplateVersion[]>([]);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const variables = VARIABLE_DICTIONARY.filter(([key]) => row.business_scope !== "titan" || key !== "event.venue");
  const usesSourceHtmlPreview = row.source_kind === "source_pdf" && !row.key.includes("contract.v1") && !row.key.includes("proforma.v1");

  useEffect(() => {
    if (row.isRegistrySource) return;
    getDocumentTemplateVersions(row.id).then(setVersions).catch(() => setVersionError("Les versions ne sont pas disponibles."));
  }, [row]);

  useEffect(() => {
    if (!usesSourceHtmlPreview) return;
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    getDocumentTemplatePreview(row.key, controller.signal)
      .then(setPreviewHtml)
      .catch(error => {
        if (error?.name !== "AbortError") setPreviewError("L’aperçu HTML source n’est pas disponible.");
      })
      .finally(() => setPreviewLoading(false));
    return () => controller.abort();
  }, [row.key, usesSourceHtmlPreview]);

  async function remove() {
    if (!window.confirm(`Supprimer « ${row.label} » ?`)) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button onClick={onBack} className="min-h-11 text-left text-sm font-semibold text-indigo-700">← Retour aux modèles</button>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={showVariables} onChange={event => setShowVariables(event.target.checked)} className="h-4 w-4 accent-indigo-600" />
          Afficher les variables
        </label>
        {!row.isRegistrySource && row.displayStatus !== "Actif" && <button disabled={deleting} onClick={remove} className="min-h-11 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700">Supprimer</button>}
      </div>
    </div>

    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge>{scopeLabel(row.business_scope)}</Badge><Badge>{row.document_type}</Badge><Badge>{row.displayStatus}</Badge></div>
      <h2 className="mt-3 text-2xl font-bold text-slate-900">{row.label}</h2>
      <p className="mt-1 text-sm text-slate-500">Clé : <code>{row.key}</code> · Version {row.version}</p>
    </header>

    {row.isRegistrySource && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Modèle de référence.</strong> Cette fiche vient du registre source validé et reste en lecture seule pour protéger la réplique utilisée dans les parcours.</div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section aria-labelledby="document-preview-title" className="min-w-0">
        <div className="mb-3 flex items-center justify-between"><div><h3 id="document-preview-title" className="text-lg font-bold text-slate-900">Aperçu</h3><p className="text-sm text-slate-500">{showVariables ? "Les emplacements de variables sont surlignés." : "Mode fidèle du document."}</p></div><span aria-live="polite" className="text-xs font-semibold text-slate-500">{showVariables ? "Variables visibles" : "Variables masquées"}</span></div>
        <div className="min-h-[800px] max-h-[calc(100vh-10rem)] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 sm:p-8">
          {usesSourceHtmlPreview ? (previewLoading ? <div role="status" className="p-10 text-center text-sm text-slate-500">Chargement de l’aperçu source…</div> : previewError ? <div role="alert" className="p-10 text-center text-sm text-red-700">{previewError}</div> : previewHtml ? <iframe title={`Aperçu source de ${row.label}`} sandbox="" srcDoc={previewHtml} className="min-h-[900px] w-full border-0 bg-white" /> : null) : <DocumentPreviewDispatcher templateKey={row.key} businessScope={row.business_scope} documentType={row.document_type} domain={row.business_scope === "titan" ? "titan" : "hahitantsoa"} showVariables={showVariables} />}
        </div>
      </section>

      <aside aria-labelledby="document-info-title" className="space-y-4 xl:sticky xl:top-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 id="document-info-title" className="font-semibold text-slate-900">Informations</h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Origine</dt><dd className="font-medium text-slate-800">{row.source_kind || "Non renseignée"}</dd></div><div><dt className="text-slate-500">Référence source</dt><dd className="break-words font-medium text-slate-800">{row.source_reference || "Non renseignée"}</dd></div><div><dt className="text-slate-500">Validation client</dt><dd className="font-medium text-slate-800">{row.validated_by_client ? "Validé" : "À confirmer"}</dd></div><div><dt className="text-slate-500">Versions disponibles</dt><dd className="font-medium text-slate-800">{row.isRegistrySource ? "Gérées par le registre source" : versions.length || "Aucune"}</dd></div></dl></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-slate-900">Variables du modèle</h3><p className="mt-1 text-xs leading-5 text-slate-500">Activez l’affichage pour les voir directement à leur emplacement dans l’aperçu.</p><div className="mt-3 max-h-80 space-y-2 overflow-auto">{variables.map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 px-3 py-2"><code className="text-xs text-indigo-700">{`{{${key}}}`}</code><p className="mt-1 text-xs text-slate-600">{label}</p></div>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-slate-900">Notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{row.notes || "Aucune note."}</p>{versionError && <p role="alert" className="mt-3 text-sm text-red-700">{versionError}</p>}</div>
      </aside>
    </div>
  </section>;
}

export interface DocumentsPageProps { onNavigate: (scope: any, param?: string) => void; }

export default function DocumentsPage({ onNavigate }: DocumentsPageProps) {
  const [mode, setMode] = useState<PageMode>("templates"); const [templates, setTemplates] = useState<TemplateRow[]>([]); const [selected, setSelected] = useState<TemplateRow | null>(null); const [creating, setCreating] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [search, setSearch] = useState(""); const [scope, setScope] = useState("Tous"); const [type, setType] = useState("Tous"); const [status, setStatus] = useState<StatusFilter>("Tous");
  useEffect(() => { const controller = new AbortController(); getDocumentTemplates(controller.signal).then(definitions => setTemplates(definitions.map(mapTemplate))).catch(err => { if (err?.name !== "AbortError") setError("Impossible de charger les modèles. Vérifiez votre connexion."); }).finally(() => setLoading(false)); return () => controller.abort(); }, []);
  const filtered = useMemo(() => templates.filter(row => { const query = search.trim().toLowerCase(); return (!query || `${row.label} ${row.key} ${row.notes}`.toLowerCase().includes(query)) && (scope === "Tous" || scopeLabel(row.business_scope) === scope) && (type === "Tous" || row.document_type === type) && (status === "Tous" || row.displayStatus === status); }), [templates, search, scope, type, status]);
  async function deleteSelected() { if (!selected) return; await deleteDocumentTemplate(selected.id); setTemplates(items => items.filter(item => item.id !== selected.id)); setSelected(null); }
  if (selected) return <div className="page active min-w-0 space-y-6 pb-10"><TemplateDetail row={selected} onBack={() => setSelected(null)} onDelete={deleteSelected} /></div>;
  if (creating) return <div className="page active min-w-0 space-y-6 pb-10"><CreateForm onCancel={() => setCreating(false)} onCreated={row => { setTemplates(items => [row, ...items]); setCreating(false); setSelected(row); }} /></div>;
  const counts = { total: templates.length, active: templates.filter(row => row.displayStatus === "Actif").length, validated: templates.filter(row => row.displayStatus === "Source validée").length, review: templates.filter(row => row.displayStatus === "À valider").length };
  return <div className="page active min-w-0 space-y-6 pb-10"><header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Référentiel documentaire</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Documents</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Gérez les modèles de référence et retrouvez les documents générés dans leur dossier métier.</p></div><button onClick={() => setCreating(true)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm">+ Nouveau modèle</button></header>
    <nav aria-label="Vue des documents" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button onClick={() => setMode("templates")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === "templates" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>Modèles <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{counts.total}</span></button><button onClick={() => setMode("generated")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === "generated" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>Documents générés</button></nav>
    {mode === "generated" ? <GeneratedDocuments onNavigate={onNavigate} /> : <><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Total</p><p className="mt-1 text-2xl font-bold text-slate-900">{counts.total}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Actifs</p><p className="mt-1 text-2xl font-bold text-emerald-700">{counts.active}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Sources validées</p><p className="mt-1 text-2xl font-bold text-blue-700">{counts.validated}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">À valider</p><p className="mt-1 text-2xl font-bold text-amber-700">{counts.review}</p></div></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row"><label className="flex-1 text-sm font-semibold text-slate-700">Rechercher<input aria-label="Rechercher un modèle" placeholder="Nom, clé ou note…" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Volet<select aria-label="Filtrer par volet" value={scope} onChange={e => setScope(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option>Tous</option><option>Hahitantsoa</option><option>Titan</option><option>Commun</option></select></label><label className="text-sm font-semibold text-slate-700">Statut<select aria-label="Filtrer par statut" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option>Tous</option><option>Actif</option><option>Source validée</option><option>À valider</option><option>Brouillon</option></select></label><label className="text-sm font-semibold text-slate-700">Type<select aria-label="Filtrer par type" value={type} onChange={e => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option>Tous</option>{Array.from(new Set(templates.map(row => row.document_type))).sort().map(item => <option key={item}>{item}</option>)}</select></label></div>{loading ? <div role="status" className="p-10 text-center text-sm text-slate-500">Chargement des modèles…</div> : error ? <div role="alert" className="p-10 text-center text-sm text-red-700">{error}</div> : filtered.length === 0 ? <div className="p-6"><Empty title="Aucun modèle trouvé" body="Modifiez les filtres ou vérifiez le registre documentaire." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Modèle</th><th className="px-5 py-3">Volet</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Version</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-4"><button onClick={() => setSelected(row)} aria-label={`Ouvrir le modèle ${row.label}`} className="text-left font-semibold text-indigo-700 hover:underline">{row.label}</button><div className="mt-1 text-xs text-slate-500"><code>{row.key}</code></div></td><td className="px-5 py-4"><Badge>{scopeLabel(row.business_scope)}</Badge></td><td className="px-5 py-4 text-slate-700">{row.document_type}</td><td className="px-5 py-4 text-slate-700">v{row.version}</td><td className="px-5 py-4"><Badge>{row.displayStatus}</Badge></td><td className="px-5 py-4 text-right"><button onClick={() => setSelected(row)} className="font-semibold text-indigo-700 hover:underline">Ouvrir</button></td></tr>)}</tbody></table></div>}<div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{filtered.length} modèle{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}</div></section></>}
  </div>;
}
