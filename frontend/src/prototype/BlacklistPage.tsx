import React, { useState, useEffect } from "react";
import {
  getBlacklistedIntervenants,
  createBlacklistedIntervenant,
  updateBlacklistedIntervenant,
} from "../api";
import type { BlacklistedIntervenant } from "../api";

const BlacklistPage: React.FC = () => {
  const [intervenants, setIntervenants] = useState<BlacklistedIntervenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", note: "", active: true });
  const [toast, setToast] = React.useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getBlacklistedIntervenants(controller.signal)
      .then((data) => {
        if (!cancelled) setIntervenants(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError("Erreur lors du chargement de la liste noire.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleEdit = (id: string) => {
    const int = intervenants.find((i) => i.id === id);
    if (int) {
      showToast(`Édition de l'intervenant ${int.name}`, "info");
      setFormData({ name: int.name, note: int.note, active: int.is_active });
      setEditingId(id);
      setShowForm(true);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const updated = await updateBlacklistedIntervenant(id, { is_active: !currentActive });
      setIntervenants(intervenants.map((i) => (i.id === id ? updated : i)));
      showToast(currentActive ? "Blocage levé" : "Intervenant bloqué", "success");
    } catch {
      showToast("Erreur lors de la mise à jour", "error");
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        const updated = await updateBlacklistedIntervenant(editingId, {
          name: formData.name,
          note: formData.note,
        });
        setIntervenants(intervenants.map((i) => (i.id === editingId ? updated : i)));
        showToast("Intervenant mis à jour", "success");
      } else {
        const created = await createBlacklistedIntervenant({
          name: formData.name,
          note: formData.note,
        });
        setIntervenants([...intervenants, created]);
        showToast("Intervenant ajouté à la liste noire", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", note: "", active: true });
    } catch {
      showToast("Erreur lors de l'enregistrement", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-500">Chargement de la liste noire…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
    );
  }

  return (
    <div className="p-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            Liste Noire Intervenants
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gérez les intervenants bloqués pour les événements
          </p>
        </div>
        <button
          className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
          onClick={() => {
            setEditingId(null);
            setFormData({ name: "", note: "", active: true });
            setShowForm(true);
          }}
        >
          + Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h3 className="font-bold text-lg mb-4">
            {editingId ? "Modifier l'intervenant" : "Ajouter un intervenant"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nom
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="Nom de l'intervenant"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Note
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                rows={3}
                placeholder="Raison du blocage…"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
                onClick={handleSave}
                disabled={!formData.name.trim()}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {intervenants.map((int) => (
            <div key={int.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">{int.name}</p>
                {int.note && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{int.note}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 text-xs font-bold rounded-full ${
                    int.is_active
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {int.is_active ? "Bloqué" : "Levé"}
                </span>
                <button
                  className="text-sm text-tit-600 hover:underline"
                  onClick={() => handleEdit(int.id)}
                >
                  Éditer
                </button>
                <button
                  className="text-sm text-slate-500 hover:text-red-600"
                  onClick={() => handleToggleActive(int.id, int.is_active)}
                >
                  {int.is_active ? "Débloquer" : "Rebloquer"}
                </button>
              </div>
            </div>
          ))}
          {intervenants.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Aucun intervenant dans la liste noire.
            </div>
          )}
        </div>
      </div>

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
};

export default BlacklistPage;
