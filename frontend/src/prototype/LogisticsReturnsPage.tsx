import React, { useState, useEffect, useRef } from "react";
import { getReturnOperations, validateReturnOperation } from "../api";
import type { InventoryReturnOperation, InventoryReturnOperationLine } from "../types";
import { titanLateReturnPenaltyRate } from "../utils";

type FilterCategory = "Tous" | "En retard" | "Aujourd'hui" | "À venir";

const CONDITION_LABELS: Record<InventoryReturnOperationLine["condition_status"], string> = {
  intact: "Bon état",
  damaged: "Cassé",
  missing: "Manquant",
  mixed: "Sale / non lavé",
};

function categorizeByDate(createdAt: string): FilterCategory {
  const date = new Date(createdAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) return "En retard";
  if (date >= today && date < tomorrow) return "Aujourd'hui";
  return "À venir";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LogisticsReturnsPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState<FilterCategory>("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);
  const [operations, setOperations] = useState<InventoryReturnOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyReturnId, setBusyReturnId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    getReturnOperations(abortRef.current.signal)
      .then((data) => {
        setOperations(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement des retours");
          setLoading(false);
        }
      });

    return () => abortRef.current?.abort();
  }, []);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const handleValidateReturn = async (returnOperation: InventoryReturnOperation) => {
    if (returnOperation.status === "validated") return;
    setBusyReturnId(returnOperation.id);
    try {
      const validated = await validateReturnOperation(returnOperation.id);
      setOperations((current) => current.map((item) => item.id === validated.id ? validated : item));
      showToast("Retour validé et mouvements de stock enregistrés.", "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible de valider le retour.", "error");
    } finally {
      setBusyReturnId(null);
    }
  };

  const filteredData = filter === "Tous"
    ? operations
    : operations.filter(r => categorizeByDate(r.created_at) === filter);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-tit-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Chargement des retours...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <button
            className="mt-4 px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
            onClick={() => {
              setLoading(true);
              setError(null);
              abortRef.current = new AbortController();
              getReturnOperations(abortRef.current.signal)
                .then((data) => { setOperations(data); setLoading(false); })
                .catch((err) => { if (err.name !== "AbortError") { setError(err.message); setLoading(false); } });
            }}
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {(["Tous", "En retard", "Aujourd'hui", "À venir"] as FilterCategory[]).map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  filter === f 
                    ? (f === "En retard" ? "bg-red-600 text-white" : "bg-slate-800 text-white") 
                    : (f === "En retard" ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/50" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700")
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredData.map(retour => (
            <div key={retour.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", retour.reservation_draft ?? undefined)}>
                      {retour.reservation_draft || retour.id}
                    </span>
                  </h3>
                  <div className="flex gap-4 mt-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <i className="fas fa-clock mr-2 text-slate-400"></i>
                      Retour attendu le : <span className="font-bold">{formatDate(retour.created_at)}</span>
                    </p>
                    {retour.status && (
                      <p className={`text-sm font-bold px-2 rounded ${
                        retour.status === "draft" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                        "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {retour.status === "draft" ? "Brouillon" : "Validé"}
                      </p>
                    )}
                    {categorizeByDate(retour.created_at) === "En retard" && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/30 px-2 rounded">
                        <i className="fas fa-exclamation-triangle mr-2"></i>
                        Pénalité retard applicable : {titanLateReturnPenaltyRate * 100}% / jour
                      </p>
                    )}
                  </div>
                </div>
                <div>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${retour.status === "validated" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"}`}>
                    {retour.status === "validated" ? "Retour validé" : "En attente de retour"}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Article</th>
                      <th className="p-3 text-right">Attendu</th>
                      <th className="p-3 text-right">Retourné</th>
                      <th className="p-3">État au retour</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {retour.lines.map(line => (
                      <tr key={line.id} className={`bg-white dark:bg-slate-800 ${line.condition_status === "mixed" ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                          {line.inventory_item}
                          {line.condition_status === "mixed" && (
                            <span className="ml-2 text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Nettoyage à planifier
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{line.expected_quantity}</td>
                        <td className="p-3 text-center">
                          <input 
                            type="number" 
                            className="w-20 text-center border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 shadow-sm font-bold focus:ring-tit-500 focus:border-tit-500 mx-auto" 
                            value={line.returned_quantity}
                            min={0}
                            readOnly
                            disabled
                          />
                        </td>
                        <td className="p-3">
                          <select className={`border border-slate-300 dark:border-slate-600 rounded px-2 py-1 font-medium w-full ${
                            line.condition_status === "intact" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" : 
                            line.condition_status === "damaged" ? "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30" : 
                            line.condition_status === "missing" ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" : 
                            "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30"
                          }`} value={line.condition_status} disabled>
                            <option value="intact" className="text-slate-800 dark:text-slate-100">Bon état</option>
                            <option value="damaged" className="text-slate-800 dark:text-slate-100">Cassé</option>
                            <option value="missing" className="text-slate-800 dark:text-slate-100">Manquant</option>
                            <option value="mixed" className="text-slate-800 dark:text-slate-100">Sale / non lavé</option>
                          </select>
                        </td>
                        <td className="p-3">
                           {(line.condition_status === "damaged" || line.condition_status === "missing") && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400" title="La déclaration se fait depuis le bouton Casse/Perte du dossier.">
                              <i className="fas fa-exclamation-circle mr-1"></i>À déclarer
                            </span>
                           )}
                           {line.condition_status === "mixed" && (
                            <span className="text-xs font-medium text-purple-600 dark:text-purple-400" title="La création de tâches de nettoyage n'est pas encore raccordée au backend.">
                              <i className="fas fa-broom mr-1"></i>Nettoyage à planifier
                            </span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {retour.notes && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 rounded-lg text-sm text-amber-800">
                  <i className="fas fa-info-circle mr-2"></i><strong>Note de retour :</strong> {retour.notes}
                </div>
              )}
              
              <div className="mt-4 flex justify-end gap-3 items-center">
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-700" onClick={() => onNavigate("breakage-loss")}>
                    <i className="fas fa-exclamation-triangle mr-2"></i>Déclarer Casse/Perte
                  </button>
                  <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700 disabled:opacity-50" disabled={busyReturnId === retour.id || retour.status === "validated"} onClick={() => void handleValidateReturn(retour)}>
                    <i className={`fas ${busyReturnId === retour.id ? "fa-spinner fa-spin" : "fa-check"} mr-2`}></i>{retour.status === "validated" ? "Retour validé" : "Valider le retour"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Aucun retour prévu.
            </div>
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
