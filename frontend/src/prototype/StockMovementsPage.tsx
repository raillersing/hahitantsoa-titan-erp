import React, { useEffect, useState, useMemo } from "react";
import { getStockMovements, getInventoryItems, createStockMovement } from "../api";
import type {
  InventoryStockMovement,
  InventoryItem,
  InventoryStockMovementType,
  InventoryStockMovementDirection,
} from "../types";
import { useTableSort, SortableHeader } from "./tableSortUtils";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  outbound_delivery: "Sortie",
  inbound_return: "Retour",
  adjustment_in: "Entrée",
  adjustment_out: "Ajustement",
  damage: "Casse",
  loss: "Perte",
  other: "Autre",
};

function getMovementLabel(m: InventoryStockMovement): string {
  return MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type;
}

type MovementSortKey =
  | "created_at"
  | "type"
  | "inventory_item"
  | "quantity"
  | "notes"
  | "reservation_draft"
  | "validated_by";

export default function StockMovementsPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  // Movement creation & compensation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formItemId, setFormItemId] = useState("");
  const [formType, setFormType] = useState<InventoryStockMovementType>("adjustment_in");
  const [formQuantity, setFormQuantity] = useState(1);
  const [formNotes, setFormNotes] = useState("");

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const openCreateModal = () => {
    setFormItemId(items[0]?.id || "");
    setFormType("adjustment_in");
    setFormQuantity(1);
    setFormNotes("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openCompensateModal = (m: InventoryStockMovement) => {
    setFormItemId(m.inventory_item);
    const compType: InventoryStockMovementType = m.direction === "inbound" ? "adjustment_out" : "adjustment_in";
    setFormType(compType);
    setFormQuantity(m.quantity);
    setFormNotes(`Correction compensatoire pour mouvement ${m.id}`);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemId) {
      setModalError("Veuillez sélectionner un article.");
      return;
    }
    if (!formQuantity || formQuantity < 1) {
      setModalError("La quantité doit être supérieure ou égale à 1.");
      return;
    }
    setModalSubmitting(true);
    setModalError(null);
    try {
      const direction: InventoryStockMovementDirection =
        formType === "adjustment_in" || formType === "inbound_return" ? "inbound" : "outbound";
      await createStockMovement({
        inventory_item: formItemId,
        movement_type: formType,
        direction,
        quantity: Number(formQuantity),
        notes: formNotes.trim(),
      });
      showToast("Mouvement de stock enregistré avec succès.", "success");
      setIsModalOpen(false);
      const updated = await getStockMovements();
      setMovements(updated);
    } catch (err: any) {
      setModalError(err?.message || "Erreur lors de l'enregistrement du mouvement.");
    } finally {
      setModalSubmitting(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      try {
        const [movementsData, itemsData] = await Promise.all([
          getStockMovements(controller.signal),
          getInventoryItems(controller.signal),
        ]);
        setMovements(movementsData);
        setItems(itemsData);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setLoadError("Impossible de charger les mouvements de stock. Réessayez.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    return () => controller.abort();
  }, []);

  const itemsMap = React.useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const filteredData = movements.filter(m => {
    if (filterType === "Tous") return true;
    if (filterType === "Réservation") return m.reservation_draft != null;
    return getMovementLabel(m) === filterType;
  });

  const { sortConfig, handleSort, resetSort, sortItems } = useTableSort<InventoryStockMovement, MovementSortKey>({
    extractors: {
      type: (m) => getMovementLabel(m),
      inventory_item: (m) => itemsMap.get(m.inventory_item)?.name || m.inventory_item,
    },
  });

  const sortedData = useMemo(() => sortItems(filteredData), [sortItems, filteredData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-slate-500 dark:text-slate-400 text-sm">Chargement des mouvements…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "Entrée", "Sortie", "Retour", "Réservation", "Casse", "Perte"].map(f => (
              <button 
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filterType === f ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700" onClick={openCreateModal}>
            <i className="fas fa-plus mr-2"></i>Nouveau Mouvement
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <SortableHeader label="Date" sortKey="created_at" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <SortableHeader label="Type" sortKey="type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <SortableHeader label="Article" sortKey="inventory_item" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <SortableHeader label="Quantité" sortKey="quantity" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} align="right" />
                <SortableHeader label="Motif" sortKey="notes" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <SortableHeader label="Dossier" sortKey="reservation_draft" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <SortableHeader label="Opérateur" sortKey="validated_by" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} />
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {sortedData.map(m => {
                const label = getMovementLabel(m);
                const article = itemsMap.get(m.inventory_item);
                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:bg-slate-900/50">
                    <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{m.created_at}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                        label === "Entrée" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" :
                        label === "Sortie" ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400" :
                        label === "Retour" ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400" :
                        label === "Réservation" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>{label}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-tit-600 dark:text-tit-400" onClick={() => onNavigate("inventory-item", m.inventory_item)}>
                      {article ? article.name : m.inventory_item}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 text-right">{m.quantity}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{m.notes || m.source_label}</td>
                    <td className="p-4 text-tit-600 dark:text-tit-400 hover:underline cursor-pointer font-medium">{m.reservation_draft || "-"}</td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">{m.validated_by || "-"}</td>
                    <td className="p-4">
                      <button 
                        className="text-slate-400 hover:text-tit-600 dark:text-tit-400 px-2"
                        title="Compenser / ajuster ce mouvement"
                        onClick={() => openCompensateModal(m)}
                      >
                        <i className="fas fa-undo"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">Aucun mouvement trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-stock-movement-title">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-stock-movement-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Enregistrer un mouvement de stock
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                <i className="fas fa-exclamation-circle mr-1.5"></i>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Article concerné
                </label>
                <select
                  value={formItemId}
                  onChange={(e) => setFormItemId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 outline-none"
                  required
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.code ? `(${item.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Type d'opération
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as InventoryStockMovementType)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 outline-none"
                  >
                    <option value="adjustment_in">Entrée / Réappro</option>
                    <option value="adjustment_out">Ajustement négatif</option>
                    <option value="damage">Déclaration Casse</option>
                    <option value="loss">Déclaration Perte</option>
                    <option value="other">Autre ajustement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motif / Justification
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Justification de l'ajustement ou référence d'inventaire..."
                  rows={3}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-tit-600 hover:bg-tit-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Enregistrement…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i> Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'warning' ? 'bg-amber-500 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-slate-800 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
