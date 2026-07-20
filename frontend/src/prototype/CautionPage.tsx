import React, { useState, useEffect } from "react";
import {
  getCashboxSessions,
  getCashboxMovements,
  openCashboxSession,
  createCashboxMovement,
  closeCashboxSession,
} from "../api";
import type { CashboxSession, CashboxMovement } from "../types";

type CautionStatus = "Conservée" | "Restituée" | "Partiellement retenue" | "Totalement retenue";
type CautionType = "Chèque" | "Espèces" | "Virement";

type Caution = {
  id: string;
  dossierRef: string;
  clientName: string;
  type: CautionType;
  amount: number;
  status: CautionStatus;
  retainedAmount: number;
  refundedAmount: number;
  notes?: string;
};

type CautionFormData = {
  clientName: string;
  amount: string;
  dossierRef: string;
  type: CautionType;
  status: CautionStatus;
  notes: string;
};

const EMPTY_FORM: CautionFormData = {
  clientName: "",
  amount: "",
  dossierRef: "",
  type: "Espèces",
  status: "Conservée",
  notes: "",
};

function mapSessionsToCautions(sessions: CashboxSession[], movements: CashboxMovement[]): Caution[] {
  const movementBySession = new Map<string, CashboxMovement[]>();
  for (const m of movements) {
    const list = movementBySession.get(m.session) || [];
    list.push(m);
    movementBySession.set(m.session, list);
  }

  return sessions.map((session) => {
    const sessionMovements = movementBySession.get(session.id) || [];
    const cashIn = sessionMovements
      .filter((m) => m.direction === "cash_in")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const cashOut = sessionMovements
      .filter((m) => m.direction === "cash_out")
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalAmount = cashIn;
    const retainedAmount = cashOut;
    const refundedAmount = 0;

    let status: Caution["status"] = "Conservée";
    if (session.closed_at) {
      if (retainedAmount === 0) {
        status = "Restituée";
      } else if (retainedAmount >= totalAmount) {
        status = "Totalement retenue";
      } else if (retainedAmount > 0) {
        status = "Partiellement retenue";
      }
    } else if (retainedAmount > 0) {
      status = "Partiellement retenue";
    }

    return {
      id: session.id,
      dossierRef: session.opening_note || session.id.slice(0, 8),
      clientName: session.operator,
      type: "Espèces",
      amount: totalAmount,
      status,
      retainedAmount,
      refundedAmount,
      notes: session.closing_note || undefined,
    };
  });
}

export default function CautionPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Toutes");
  const [cautions, setCautions] = useState<Caution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CautionFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Status toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getCashboxSessions(undefined, controller.signal),
      getCashboxMovements(undefined, controller.signal),
    ])
      .then(([sessions, movements]) => {
        setCautions(mapSessionsToCautions(sessions, movements));
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Erreur lors du chargement des cautions");
          setLoading(false);
        }
      });

    return () => controller.abort();
  };

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, []);

  // Open create modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (caution: Caution) => {
    setEditingId(caution.id);
    setFormData({
      clientName: caution.clientName,
      amount: caution.amount.toString(),
      dossierRef: caution.dossierRef,
      type: caution.type,
      status: caution.status,
      notes: caution.notes || "",
    });
    setShowModal(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  // Submit form - Create or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim() || !formData.amount || Number(formData.amount) <= 0) {
      showToast("Veuillez remplir tous les champs obligatoires", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Edit: update local state (caution is derived from session/movements)
        setCautions((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  clientName: formData.clientName.trim(),
                  dossierRef: formData.dossierRef.trim() || c.dossierRef,
                  type: formData.type,
                  amount: Number(formData.amount),
                  status: formData.status,
                  notes: formData.notes || undefined,
                }
              : c
          )
        );
        showToast("Caution mise à jour avec succès", "success");
      } else {
        // Create: open a cashbox session + create a cash_in movement
        const session = await openCashboxSession({
          operator: formData.clientName.trim(),
          opening_note: formData.dossierRef.trim() || `Caution ${formData.clientName.trim()}`,
        });

        await createCashboxMovement(session.id, {
          direction: "cash_in",
          amount: formData.amount,
          note: `Caution - ${formData.type}${formData.notes ? ` - ${formData.notes}` : ""}`,
        });

        showToast("Caution créée avec succès", "success");
        // Reload data from API
        loadData();
      }
      handleCloseModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  // Toggle status between Conservée and Restituée
  const handleToggleStatus = async (caution: Caution) => {
    if (togglingId) return; // prevent double-click
    setTogglingId(caution.id);

    try {
      if (caution.status === "Conservée") {
        // Restituer: create a cash_out movement for the full amount and close the session
        await createCashboxMovement(caution.id, {
          direction: "cash_out",
          amount: caution.amount.toString(),
          note: `Restitution caution - ${caution.clientName}`,
        });
        await closeCashboxSession(caution.id, {
          closing_note: "Caution restituée",
        });
        showToast(`Caution de ${caution.amount.toLocaleString()} Ar restituée à ${caution.clientName}`, "success");
      } else if (caution.status === "Restituée") {
        // Re-toggle to Conservée: reopen would require re-opening the session
        // For now, update locally since the session is closed
        setCautions((prev) =>
          prev.map((c) =>
            c.id === caution.id ? { ...c, status: "Conservée" } : c
          )
        );
        showToast("Caution remise en statut Conservée", "info");
      } else {
        // For other statuses, just update locally
        const newStatus: CautionStatus = caution.status === "Partiellement retenue" ? "Conservée" : "Conservée";
        setCautions((prev) =>
          prev.map((c) =>
            c.id === caution.id ? { ...c, status: newStatus } : c
          )
        );
        showToast("Statut de la caution mis à jour", "info");
      }
      // Reload from API to stay consistent
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors du changement de statut", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredData = cautions.filter((c) => {
    if (filter === "Toutes") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Toutes", "Conservée", "Partiellement retenue", "Restituée"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  filter === f
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700"
            onClick={handleOpenCreate}
          >
            <i className="fas fa-plus mr-2"></i>Enregistrer caution
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 dark:border-slate-200 mb-3"></div>
              <p>Chargement des cautions...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 dark:text-red-400">
              <i className="fas fa-exclamation-triangle text-2xl mb-3"></i>
              <p>{error}</p>
              <button
                className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                onClick={() => window.location.reload()}
              >
                Réessayer
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Dossier</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Client</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Type</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 text-right">Montant Initial</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 text-right">Retenue</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 text-right">Restitué / À restituer</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Statut</th>
                  <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredData.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:bg-slate-900/50">
                    <td
                      className="p-4 font-bold text-tit-600 dark:text-tit-400 cursor-pointer hover:underline"
                      onClick={() => onNavigate("reservation-detail", c.dossierRef)}
                    >
                      {c.dossierRef}
                    </td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{c.clientName}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md">
                        {c.type}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800 dark:text-slate-100">
                      {c.amount.toLocaleString()} Ar
                    </td>
                    <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">
                      {c.retainedAmount > 0 ? c.retainedAmount.toLocaleString() + " Ar" : "-"}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {(c.status === "Restituée" || c.status === "Partiellement retenue"
                        ? c.refundedAmount
                        : c.amount - c.retainedAmount
                      ).toLocaleString()}{" "}
                      Ar
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full ${
                          c.status === "Conservée"
                            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                            : c.status === "Restituée"
                            ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Status toggle button */}
                        {(c.status === "Conservée" || c.status === "Restituée") && (
                          <button
                            className={`font-bold px-2 py-1 rounded ${
                              c.status === "Conservée"
                                ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-900/30"
                                : "text-amber-600 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-900/30"
                            }`}
                            title={c.status === "Conservée" ? "Restituer la caution" : "Remettre en Conservée"}
                            onClick={() => handleToggleStatus(c)}
                            disabled={togglingId === c.id}
                          >
                            {togglingId === c.id ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : c.status === "Conservée" ? (
                              "Restituer"
                            ) : (
                              "Conserver"
                            )}
                          </button>
                        )}

                        {/* Edit button */}
                        <button
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 px-2 py-1"
                          title="Modifier la caution"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <i className="fas fa-edit"></i>
                        </button>

                        {/* View details */}
                        <button
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 px-2 py-1"
                          title="Voir détails"
                          onClick={() => onNavigate("reservation-detail", c.dossierRef)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Aucune caution trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseModal}></div>

          {/* Modal content */}
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingId ? "Modifier la caution" : "Enregistrer une caution"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Client Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom du client <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none"
                  placeholder="Nom complet du client"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Montant (Ar) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none"
                  placeholder="0"
                  required
                />
              </div>

              {/* Reservation Reference */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Référence dossier
                </label>
                <input
                  type="text"
                  value={formData.dossierRef}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dossierRef: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none"
                  placeholder="Référence de réservation ou dossier"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type de paiement
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as CautionType }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement">Virement</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as CautionStatus }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none"
                >
                  <option value="Conservée">Conservée</option>
                  <option value="Restituée">Restituée</option>
                  <option value="Partiellement retenue">Partiellement retenue</option>
                  <option value="Totalement retenue">Totalement retenue</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-tit-500 focus:border-tit-500 outline-none resize-none"
                  placeholder="Notes optionnelles..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <i className="fas fa-spinner fa-spin"></i>}
                  {editingId ? "Enregistrer les modifications" : "Créer la caution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "warning"
              ? "bg-amber-500 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-slate-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
