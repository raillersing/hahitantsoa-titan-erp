import React, { useState, useEffect } from "react";
import { getInventoryItem, getStockMovements } from "../api";
import type { InventoryItem, InventoryStockMovement } from "../types";
import { validateStockChange } from "./inventoryStockUtils";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  outbound_delivery: "Sortie",
  inbound_return: "Retour",
  adjustment_in: "Entrée",
  adjustment_out: "Ajustement",
  damage: "Casse",
  loss: "Perte",
  other: "Autre",
};

const KIND_LABELS: Record<string, string> = {
  material: "Location",
  article: "Consommable",
  material_pack: "Uniforme",
};

const KIND_BADGE_CLASSES: Record<string, string> = {
  material: "bg-indigo-100 text-indigo-700",
  article: "bg-amber-100 text-amber-700",
  material_pack: "bg-emerald-100 text-emerald-700",
};

function normalizeNonNegativeIntegerDraft(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return String(Number.parseInt(trimmed, 10));
}

/** Local display shape that bridges real API fields with the UI expectations. */
interface DisplayItem {
  id: string;
  name: string;
  kind: string;
  description: string;
  type: "Location" | "Consommable" | "Uniforme";
  category: string;
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  outStock: number;
  expectedReturnStock: number;
  brokenLostStock: number;
  unitPrice: number;
  breakagePrice: number;
  status: "OK" | "Bas" | "Rupture";
  imageUrl?: string;
}

function toDisplayItem(raw: InventoryItem): DisplayItem {
  const kindLabel = KIND_LABELS[raw.kind] || raw.kind;
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    description: raw.description || "",
    type: kindLabel as "Location" | "Consommable" | "Uniforme",
    category: kindLabel,
    totalStock: 0,
    availableStock: 0,
    reservedStock: 0,
    outStock: 0,
    expectedReturnStock: 0,
    brokenLostStock: 0,
    unitPrice: 0,
    breakagePrice: 0,
    status: "OK",
  };
}

/** Display shape for a stock movement row in the history table. */
interface DisplayMovement {
  id: string;
  type: string;
  date: string;
  quantity: number;
  reason: string;
  dossierRef: string;
  operator: string;
}

function toDisplayMovement(m: InventoryStockMovement): DisplayMovement {
  return {
    id: m.id,
    type: MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type,
    date: m.effective_at || m.created_at,
    quantity: m.quantity,
    reason: m.notes || "",
    dossierRef: m.source_label || "",
    operator: m.validated_by || "",
  };
}

export default function InventoryItemPage({ onNavigate, param, onBack, returnContext }: { onNavigate: (scope: any, param?: string) => void, param?: string, onBack?: () => void, returnContext?: any }) {
  const [toast, setToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [item, setItem] = useState<DisplayItem | null>(null);
  const [movements, setMovements] = useState<DisplayMovement[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<DisplayItem | null>(null);
  const [originalTotalStock, setOriginalTotalStock] = useState(0);
  const [editTotalDraft, setEditTotalDraft] = useState<string>("0");
  const [adjustmentDraft, setAdjustmentDraft] = useState<string>("0");
  const [newTotalDraft, setNewTotalDraft] = useState<string>("");

  const [stockChangeReason, setStockChangeReason] = useState("");
  const [stockError, setStockError] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch item + movements from real API
  useEffect(() => {
    if (!param) {
      setLoadError("Aucun identifiant d'article fourni.");
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const [rawItem, allMovements] = await Promise.all([
          getInventoryItem(param, controller.signal),
          getStockMovements(controller.signal),
        ]);
        const display = toDisplayItem(rawItem);
        setItem(display);
        setNewTotalDraft(String(display.totalStock));

        const itemMovements = allMovements
          .filter(m => m.inventory_item === param)
          .sort((a, b) => (b.effective_at || b.created_at).localeCompare(a.effective_at || a.created_at))
          .map(toDisplayMovement);
        setMovements(itemMovements);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setLoadError("Impossible de charger les détails de l'article. Réessayez.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [param]);

  useEffect(() => {
    if (item) setNewTotalDraft(String(item.totalStock));
  }, [item]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (returnContext?.from === 'inventory') {
      onNavigate('inventory');
    } else {
      onNavigate('inventory-management');
    }
  };

  const backLabel = returnContext?.from === 'inventory' ? "Retour au catalogue" : "Retour à l'inventaire";

  const handleToggleStatus = () => {
    if (!item) return;
    const newStatus = (item.status === "OK" ? "Rupture" : "OK") as "OK" | "Bas" | "Rupture";
    const newItem = { ...item, status: newStatus };
    setItem(newItem);
    setToast(`L'article ${item.name} est maintenant en ${newStatus === "OK" ? "Disponibilité (OK)" : "Rupture/Inactif"}`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !editForm) return;

    const normalizedDraft = normalizeNonNegativeIntegerDraft(editTotalDraft);
    const finalTotal = normalizedDraft === "" ? originalTotalStock : parseInt(normalizedDraft, 10);
    setEditTotalDraft(String(finalTotal));

    const updatedForm = { ...editForm, totalStock: finalTotal };

    if (finalTotal !== originalTotalStock) {
      if (!stockChangeReason) {
        setStockError("Veuillez sélectionner un motif pour la modification du stock total.");
        return;
      }
      const validation = validateStockChange(finalTotal, updatedForm.reservedStock, updatedForm.outStock, updatedForm.expectedReturnStock, updatedForm.brokenLostStock);
      if (!validation.isValid) {
        setStockError(validation.error || "Stock invalide.");
        return;
      }
      updatedForm.availableStock = validation.newAvailable;
    }

    setItem(updatedForm);
    setIsEditing(false);
    setToast("Article modifié avec succès");
  };

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!stockChangeReason) {
      setStockError("Veuillez sélectionner un motif pour la modification du stock total.");
      return;
    }

    if (!/^[+-]?\d+$/.test(adjustmentDraft) && !/^\d+$/.test(newTotalDraft)) {
      setStockError("Veuillez saisir un ajustement ou un stock total valide.");
      return;
    }

    let newTotal = item.totalStock;
    let actualDelta = 0;

    if (/^[+-]?\d+$/.test(adjustmentDraft)) {
      actualDelta = parseInt(adjustmentDraft, 10);
      newTotal = item.totalStock + actualDelta;
    } else if (/^\d+$/.test(newTotalDraft)) {
      newTotal = parseInt(newTotalDraft, 10);
      actualDelta = newTotal - item.totalStock;
    }

    const validation = validateStockChange(newTotal, item.reservedStock, item.outStock, item.expectedReturnStock, item.brokenLostStock);

    if (!validation.isValid) {
      setStockError(validation.error || "Stock invalide.");
      return;
    }

    const newItem = { ...item, totalStock: newTotal, availableStock: validation.newAvailable };
    setItem(newItem);
    setIsAdjustingStock(false);
    setAdjustmentDraft("0");
    setNewTotalDraft(String(newTotal));
    setStockChangeReason("");
    setToast(`Stock ajusté : ${actualDelta > 0 ? '+' : ''}${actualDelta}`);
  };

  const handleConfirmDelete = () => {
    if (!item) return;
    setToast(`L'article ${item.name} a été supprimé.`);
    setIsDeleteOpen(false);
    setTimeout(() => {
      handleBack();
    }, 1000);
  };

  // --- Loading / Error states ---
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <button onClick={handleBack} className="text-slate-500 hover:text-slate-800 transition flex items-center gap-2 font-medium">
          <i className="fas fa-arrow-left"></i> {backLabel}
        </button>
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-3xl text-tit-600 mb-4"></i>
          <p className="text-slate-500 font-medium">Chargement de l'article…</p>
        </div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <button onClick={handleBack} className="text-slate-500 hover:text-slate-800 transition flex items-center gap-2 font-medium">
          <i className="fas fa-arrow-left"></i> {backLabel}
        </button>
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-exclamation-triangle text-3xl text-rose-500 mb-4"></i>
          <p className="text-rose-600 font-medium">{loadError || "Article introuvable."}</p>
          <button onClick={handleBack} className="mt-4 px-4 py-2 bg-tit-600 text-white rounded-lg font-bold hover:bg-tit-700">
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={handleBack} className="text-slate-500 hover:text-slate-800 transition flex items-center gap-2 font-medium">
          <i className="fas fa-arrow-left"></i> {backLabel}
        </button>
        <div className="flex gap-2">
          <button className={`px-4 py-2 ${item.status === 'OK' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} font-bold rounded-lg`} onClick={handleToggleStatus}>
            {item.status === 'OK' ? 'Désactiver' : 'Réactiver'}
          </button>
          <button className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50" onClick={() => { setEditForm(item); setOriginalTotalStock(item.totalStock); setEditTotalDraft(String(item.totalStock)); setStockChangeReason(""); setStockError(""); setIsEditing(true); }}>
            Modifier l'article
          </button>
          <button className="px-4 py-2 border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50" onClick={() => setIsDeleteOpen(true)}>
            Supprimer
          </button>
          <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700" onClick={() => { setAdjustmentDraft("0"); setNewTotalDraft(String(item.totalStock)); setStockChangeReason(""); setStockError(""); setIsAdjustingStock(true); }}>
            Ajuster stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
            <div className="w-48 h-48 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-300 overflow-hidden">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-5xl"></i>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 text-center">{item.name}</h2>
            <div className="mt-2 flex gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${KIND_BADGE_CLASSES[item.kind] || "bg-slate-100 text-slate-700"}`}>
                {item.type}
              </span>
              <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-600">
                {item.category}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-2 font-mono">{item.id}</p>
            {item.description && (
              <p className="text-slate-400 text-xs mt-1 text-center">{item.description}</p>
            )}
            
            <div className="mt-6 w-full space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">Prix unitaire</span>
                <span className="font-bold text-slate-800">{item.unitPrice.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">Prix casse</span>
                <span className="font-bold text-slate-800">{item.breakagePrice.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 text-sm">Statut</span>
                {item.status === "OK" ? (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">OK</span>
                ) : item.status === "Bas" ? (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Bas</span>
                ) : (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Rupture</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stock Total</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{item.totalStock}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Disponible</p>
              <p className="text-3xl font-extrabold text-emerald-700 mt-1">{item.availableStock}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Réservé</p>
              <p className="text-3xl font-extrabold text-blue-700 mt-1">{item.reservedStock}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100">
              <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">Sorti</p>
              <p className="text-3xl font-extrabold text-purple-700 mt-1">{item.outStock}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Historique des mouvements</h3>
            </div>
            <div className="p-0">
              {movements.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b border-slate-200">Date</th>
                      <th className="p-4 font-bold border-b border-slate-200">Type</th>
                      <th className="p-4 font-bold border-b border-slate-200 text-right">Qté</th>
                      <th className="p-4 font-bold border-b border-slate-200">Motif</th>
                      <th className="p-4 font-bold border-b border-slate-200">Dossier</th>
                      <th className="p-4 font-bold border-b border-slate-200">Opérateur</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-600">{m.date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                            m.type === "Entrée" ? "bg-emerald-100 text-emerald-700" :
                            m.type === "Sortie" ? "bg-purple-100 text-purple-700" :
                            m.type === "Retour" ? "bg-amber-100 text-amber-700" :
                            m.type === "Réservation" ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>{m.type}</span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 text-right">{m.quantity}</td>
                        <td className="p-4 text-slate-600">{m.reason}</td>
                        <td className="p-4 text-tit-600 hover:underline cursor-pointer font-medium">{m.dossierRef}</td>
                        <td className="p-4 text-slate-500">{m.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">Aucun mouvement pour cet article.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditing && editForm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 id="modal-title" className="text-xl font-bold text-slate-800">Modifier l'article</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code / ID</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'article</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as "Location" | "Consommable" | "Uniforme"})}>
                    <option value="Location">Location</option>
                    <option value="Consommable">Consommable</option>
                    <option value="Uniforme">Uniforme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Photo de l'article (URL ou Fichier local)</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {editForm.imageUrl ? (
                        <img src={editForm.imageUrl} alt="Prévisualisation" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fas fa-image text-slate-300 text-3xl"></i>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.imageUrl || ''} placeholder="https://... (URL externe)" onChange={e => setEditForm({...editForm, imageUrl: e.target.value})} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-bold uppercase">Ou local</span>
                        <div className="flex-1">
                          <input type="file" accept="image/*" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-tit-50 file:text-tit-700 hover:file:bg-tit-100 cursor-pointer" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setEditForm({ ...editForm, imageUrl: url });
                            }
                          }} />
                        </div>
                        {editForm.imageUrl && (
                          <button type="button" onClick={() => setEditForm({ ...editForm, imageUrl: '' })} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1">Retirer</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix de location/vente (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.unitPrice} onChange={e => setEditForm({...editForm, unitPrice: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix en cas de casse (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.breakagePrice} onChange={e => setEditForm({...editForm, breakagePrice: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div className="col-span-2">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <label htmlFor="stock-total-edit" className="block text-sm font-medium text-slate-700 mb-1">Stock Total</label>
                      <input id="stock-total-edit" type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editTotalDraft} onChange={e => {
                        setEditTotalDraft(e.target.value);
                        setStockError("");
                      }} onBlur={e => {
                        const norm = normalizeNonNegativeIntegerDraft(e.target.value);
                        setEditTotalDraft(norm);
                        if (norm !== "") setEditForm({...editForm, totalStock: parseInt(norm, 10)});
                      }} />
                    </div>
                    <div>
                      <label htmlFor="stock-dispo-edit" className="block text-sm font-medium text-slate-700 mb-1">Stock Disponible (calculé)</label>
                      <input id="stock-dispo-edit" type="number" disabled className="w-full border border-slate-200 bg-slate-100 rounded p-2 text-sm text-slate-500 cursor-not-allowed" value={editForm.totalStock - (editForm.reservedStock + editForm.outStock + editForm.expectedReturnStock + editForm.brokenLostStock)} />
                    </div>
                    {editForm.totalStock !== originalTotalStock && (
                      <div className="col-span-2 mt-2">
                        <div className="text-sm flex gap-4 mb-3">
                          <div>Valeur actuelle : <span className="font-bold">{originalTotalStock}</span></div>
                          <div>Nouvelle valeur : <span className="font-bold text-indigo-600">{editForm.totalStock}</span></div>
                          <div>Différence : <span className={`font-bold ${editForm.totalStock > originalTotalStock ? 'text-emerald-600' : 'text-rose-600'}`}>{editForm.totalStock > originalTotalStock ? '+' : ''}{editForm.totalStock - originalTotalStock}</span></div>
                        </div>
                        <label htmlFor="stock-change-reason-edit" className="block text-sm font-medium text-slate-700 mb-1">Motif de la modification <span className="text-rose-500">*</span></label>
                        <select id="stock-change-reason-edit" className="w-full border border-slate-300 rounded p-2 text-sm" value={stockChangeReason} onChange={e => {
                          setStockChangeReason(e.target.value);
                          setStockError("");
                        }}>
                          <option value="">Sélectionner un motif...</option>
                          <option value="Inventaire physique">Inventaire physique</option>
                          <option value="Nouvel achat">Nouvel achat</option>
                          <option value="Correction de saisie">Correction de saisie</option>
                          <option value="Mise au rebut">Mise au rebut</option>
                          <option value="Perte validée">Perte validée</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {stockError && <div className="mt-2 text-sm text-rose-600 font-medium"><i className="fas fa-exclamation-circle mr-1"></i>{stockError}</div>}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium" onClick={() => setIsEditing(false)}>Annuler</button>
                <button type="submit" className="px-4 py-2 bg-tit-600 text-white rounded font-bold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdjustingStock && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col" role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 id="adjust-stock-title" className="text-xl font-bold text-slate-800">Ajuster le stock</h3>
              <button onClick={() => { setIsAdjustingStock(false); setAdjustmentDraft("0"); setNewTotalDraft(String(item.totalStock)); }} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveStock} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Ajoutez ou retirez du stock total (et disponible) pour <strong>{item.name}</strong>.</p>
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="new-total-draft" className="block text-sm font-medium text-slate-700 mb-1">Nouveau Stock Total</label>
                    <input id="new-total-draft" type="text" className="w-full border border-slate-300 rounded p-2 text-sm mb-3" value={newTotalDraft} onChange={e => {
                      const val = e.target.value;
                      setNewTotalDraft(val);
                      if (/^\d+$/.test(val)) {
                        setAdjustmentDraft(String(parseInt(val, 10) - item.totalStock));
                      }
                      setStockError("");
                    }} />
                    
                    <label htmlFor="adjustment-draft" className="block text-sm font-medium text-slate-700 mb-1">Ajustement (ex: +5, -2)</label>
                    <input id="adjustment-draft" type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={adjustmentDraft} onChange={e => {
                      const val = e.target.value;
                      setAdjustmentDraft(val);
                      if (/^[+-]?\d+$/.test(val)) {
                        setNewTotalDraft(String(item.totalStock + parseInt(val, 10)));
                      }
                      setStockError("");
                    }} />
                  </div>
                  <div>
                    <div className="text-sm bg-slate-50 p-3 rounded border border-slate-200 space-y-2 h-full">
                      <div>Total actuel: <span className="font-bold">{item.totalStock}</span></div>
                      <div>Engagé (min): <span className="font-bold">{item.reservedStock + item.outStock + item.expectedReturnStock + item.brokenLostStock}</span></div>
                      <div>Nouveau dispo: <span className="font-bold text-emerald-600">{/^\d+$/.test(newTotalDraft) ? (parseInt(newTotalDraft, 10) - (item.reservedStock + item.outStock + item.expectedReturnStock + item.brokenLostStock)) : '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="adjust-stock-reason-item" className="block text-sm font-medium text-slate-700 mb-1">Motif de la modification <span className="text-rose-500">*</span></label>
                <select id="adjust-stock-reason-item" className="w-full border border-slate-300 rounded p-2 text-sm" value={stockChangeReason} onChange={e => {
                  setStockChangeReason(e.target.value);
                  setStockError("");
                }}>
                  <option value="">Sélectionner un motif...</option>
                  <option value="Inventaire physique">Inventaire physique</option>
                  <option value="Nouvel achat">Nouvel achat</option>
                  <option value="Correction de saisie">Correction de saisie</option>
                  <option value="Mise au rebut">Mise au rebut</option>
                  <option value="Perte validée">Perte validée</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              {stockError && <div className="text-sm text-rose-600 font-medium"><i className="fas fa-exclamation-circle mr-1"></i>{stockError}</div>}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium" onClick={() => { setIsAdjustingStock(false); setAdjustmentDraft("0"); setNewTotalDraft(String(item.totalStock)); }}>Annuler</button>
                <button type="submit" className="px-4 py-2 bg-tit-600 text-white rounded font-bold">Appliquer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="p-6 border-b border-slate-200">
              <h3 id="delete-title" className="text-xl font-bold text-slate-800">Supprimer l'article ?</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">Cette action supprimera l'article <strong>{item.name}</strong> de l'inventaire.</p>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium focus:outline-none focus:ring-2 focus:ring-slate-400" onClick={() => setIsDeleteOpen(false)} autoFocus>Annuler</button>
              <button className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition-colors" onClick={handleConfirmDelete}>Supprimer l'article</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-3">
          <span>{toast}</span>
          <button className="text-slate-400 hover:text-white" onClick={() => setToast(null)}><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
}
