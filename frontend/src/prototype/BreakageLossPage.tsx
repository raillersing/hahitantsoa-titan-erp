import React, { useState, useEffect } from "react";
import { getDamageLossSettlements, validateDamageLossSettlement } from "../api";
import type { InventoryDamageLossSettlement } from "../types";

type FilterStatus = "Tous" | "À traiter" | "Retenue validée" | "Clôturé";

function statusLabel(status: string): FilterStatus {
  if (status === "draft") return "À traiter";
  if (status === "validated") return "Retenue validée";
  return "Clôturé";
}

function statusBadgeClass(status: FilterStatus): string {
  if (status === "À traiter") return "bg-red-100 text-red-700";
  if (status === "Retenue validée") return "bg-blue-100 text-blue-700";
  if (status === "Clôturé") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function BreakageLossPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState<FilterStatus>("Tous");
  const [data, setData] = useState<InventoryDamageLossSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getDamageLossSettlements(controller.signal)
      .then((res) => {
        if (!cancelled) setData(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!cancelled) setError("Erreur lors du chargement des dossiers casse/perte.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const filteredData = data.filter((s) => {
    if (filter === "Tous") return true;
    return statusLabel(s.settlement_status) === filter;
  });

  const handleValidate = async (settlement: InventoryDamageLossSettlement) => {
    try {
      const updated = await validateDamageLossSettlement(settlement.id);
      setData(data.map((d) => (d.id === settlement.id ? updated : d)));
      showToast("Montant imputé à la caution avec succès", "success");
    } catch {
      showToast("Erreur lors de la validation", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-500">Chargement des dossiers…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {(["Tous", "À traiter", "Retenue validée", "Clôturé"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredData.map((s) => {
            const label = statusLabel(s.settlement_status);
            const firstLine = s.lines?.[0];
            return (
              <div key={s.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-3">
                      <span className="text-red-600">{String(s.id).slice(0, 8)}</span>
                      <span className="text-slate-400 text-sm font-normal">•</span>
                      <span
                        className="text-tit-600 hover:underline cursor-pointer"
                        onClick={() => onNavigate("reservation-detail", s.return_operation)}
                      >
                        {s.return_operation ? String(s.return_operation).slice(0, 8) : "—"}
                      </span>
                    </h3>
                  </div>
                  <div>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusBadgeClass(label)}`}>
                      {label}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="p-3">Article concerné</th>
                        <th className="p-3 text-right">Qté</th>
                        <th className="p-3 text-right">Prix unitaire</th>
                        <th className="p-3 text-right">Montant Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {s.lines.map((line) => (
                        <tr key={line.id} className="bg-white">
                          <td className="p-3 font-bold text-slate-800">{line.manual_label || "—"}</td>
                          <td className="p-3 font-bold text-red-600 text-right">{line.quantity}</td>
                          <td className="p-3 text-right">{line.unit_amount.toLocaleString()} Ar</td>
                          <td className="p-3 font-bold text-slate-800 text-right">{line.total_amount.toLocaleString()} Ar</td>
                        </tr>
                      ))}
                      {s.lines.length === 0 && (
                        <tr className="bg-white">
                          <td colSpan={4} className="p-3 text-center text-slate-400">Aucune ligne</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Caution Disponible</p>
                    <p className="text-xl font-extrabold text-slate-800 mt-1">{s.caution_available.toLocaleString()} Ar</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Montant Retenue</p>
                    <p className="text-xl font-extrabold text-red-700 mt-1">{s.caution_applied.toLocaleString()} Ar</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Différence à payer</p>
                    <p className="text-xl font-extrabold text-amber-700 mt-1">{s.excess_due.toLocaleString()} Ar</p>
                  </div>
                </div>

                {s.notes && (
                  <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
                    <i className="fas fa-comment-alt mr-2 text-slate-400" />
                    <strong>Notes :</strong> {s.notes}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3 items-center">
                  {s.settlement_status === "draft" && (
                    <button
                      className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
                      onClick={() => handleValidate(s)}
                    >
                      <i className="fas fa-cut mr-2" />
                      Imputer à la caution
                    </button>
                  )}
                  {s.excess_due > 0 && s.settlement_status !== "cancelled" && (
                    <button
                      className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700"
                      onClick={() => showToast("Génération de la facture complémentaire…", "info")}
                    >
                      <i className="fas fa-file-invoice mr-2" />
                      Créer facture de différence
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500">Aucun dossier de casse ou de perte.</div>
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
}
