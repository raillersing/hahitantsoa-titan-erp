import React, { useState, useEffect } from "react";
import { getCashboxSessions, getCashboxMovements } from "../api";
import type { CashboxSession, CashboxMovement } from "../types";

type Caution = {
  id: string;
  dossierRef: string;
  clientName: string;
  type: "Chèque" | "Espèces" | "Virement";
  amount: number;
  status: "Conservée" | "Restituée" | "Partiellement retenue" | "Totalement retenue";
  retainedAmount: number;
  refundedAmount: number;
  notes?: string;
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
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
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
  }, []);

  const handleRestituer = (id: string, amount: number, clientName: string) => {
    setCautions(cautions.map(c => c.id === id ? { ...c, status: "Restituée" } : c));
    showToast(`Caution de ${amount.toLocaleString()} Ar restituée à ${clientName}`, 'success');
  };

  const filteredData = cautions.filter(c => {
    if (filter === "Toutes") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Toutes", "Conservée", "Partiellement retenue", "Restituée"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700" onClick={() => showToast('Ouverture du formulaire d\'enregistrement de caution', 'info')}>
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
                {filteredData.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:bg-slate-900/50">
                    <td className="p-4 font-bold text-tit-600 dark:text-tit-400 cursor-pointer hover:underline" onClick={() => onNavigate("reservation-detail", c.dossierRef)}>
                      {c.dossierRef}
                    </td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{c.clientName}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md">{c.type}</span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-800 dark:text-slate-100">{c.amount.toLocaleString()} Ar</td>
                    <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">{c.retainedAmount > 0 ? c.retainedAmount.toLocaleString() + " Ar" : "-"}</td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{(c.status === "Restituée" || c.status === "Partiellement retenue" ? c.refundedAmount : c.amount - c.retainedAmount).toLocaleString()} Ar</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        c.status === "Conservée" ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400" :
                        c.status === "Restituée" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" :
                        "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {c.status === "Conservée" && (
                          <button 
                            className="text-tit-600 dark:text-tit-400 hover:text-tit-800 dark:text-tit-200 font-bold px-2 py-1 bg-tit-50 dark:bg-tit-900/30 rounded" 
                            title="Restituer"
                            onClick={() => handleRestituer(c.id, c.amount, c.clientName)}
                          >
                            Restituer
                          </button>
                        )}
                        <button className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 px-2 py-1" title="Voir détails" onClick={() => showToast(`Aperçu détaillé de la caution pour ${c.clientName}`, 'info')}>
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">Aucune caution trouvée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
