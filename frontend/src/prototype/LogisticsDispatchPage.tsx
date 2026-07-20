import React, { useState, useEffect } from "react";
import { getLogisticsEvents } from "../api";
import type { LogisticsEvent } from "../types";

const eventTypeLabels: Record<string, string> = {
  delivery: "Livraison Titan",
  pickup: "Prélèvement",
  preparation: "Préparation",
  handover: "Remise",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  planned: {
    label: "Planifié",
    className: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400",
  },
  dispatched: {
    label: "En cours",
    className: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400",
  },
  completed: {
    label: "Terminé",
    className: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400",
  },
};

export default function LogisticsDispatchPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getLogisticsEvents(controller.signal)
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement des événements logistiques.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = events.filter(e => {
    if (filter === "Tous") return true;
    if (filter === "Livraison") return e.event_type === "delivery";
    if (filter === "Prélèvement") return e.event_type === "pickup";
    return true;
  });

  const formatDate = (isoDate: string | null): string => {
    if (!isoDate) return "—";
    try {
      return new Date(isoDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <i className="fas fa-spinner fa-spin text-xl"></i>
          <span className="font-medium">Chargement des événements logistiques…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">
            Erreur de chargement
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700"
            onClick={() => {
              setLoading(true);
              setError(null);
              getLogisticsEvents()
                .then((data) => {
                  setEvents(data);
                  setLoading(false);
                })
                .catch((err) => {
                  setError(err.message || "Erreur lors du chargement.");
                  setLoading(false);
                });
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
            {["Tous", "Livraison", "Prélèvement"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredData.map(evt => {
            const statusInfo = statusConfig[evt.status] || { label: evt.status, className: "" };
            return (
              <div key={evt.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-3">
                      <span className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", evt.reservation_draft)}>
                        {evt.reservation_draft}
                      </span>
                    </h3>
                    <div className="flex gap-4 mt-2">
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <i className="fas fa-truck mr-2 text-slate-400"></i>
                        {eventTypeLabels[evt.event_type] || evt.event_type}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <i className="fas fa-user mr-2 text-slate-400"></i>
                        Contact : {evt.contact_name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <i className="fas fa-clock mr-2 text-slate-400"></i>
                        Prévu le : {formatDate(evt.scheduled_at)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
                
                {evt.item_lines && evt.item_lines.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="p-3">Article remis</th>
                          <th className="p-3 text-right">Quantité</th>
                          <th className="p-3">État initial constaté</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {evt.item_lines.map(item => (
                          <tr key={item.id} className="bg-white dark:bg-slate-800">
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.inventory_item_name}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{item.quantity}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{item.notes || item.inventory_item_kind}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-2">
                    <button 
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium rounded-lg text-sm hover:bg-slate-200 dark:bg-slate-700"
                      onClick={() => showToast('Ouverture modale pour ajouter des photos de l\'état', 'info')}
                    >
                      <i className="fas fa-camera mr-2"></i>Ajouter photos état
                    </button>
                    <button 
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium rounded-lg text-sm hover:bg-slate-200 dark:bg-slate-700"
                      onClick={(e) => {
                        showToast('Capture signature client...', 'info');
                        e.currentTarget.innerHTML = '<i class="fas fa-check-circle mr-2 text-emerald-500"></i>Signé !';
                        e.currentTarget.classList.add('text-emerald-700 dark:text-emerald-400', 'bg-emerald-50 dark:bg-emerald-900/30');
                      }}
                    >
                      <i className="fas fa-signature mr-2"></i>Signature client
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-700"
                      onClick={() => showToast('Génération PDF du Bon de Livraison...', 'info')}
                    >
                      <i className="fas fa-file-pdf mr-2"></i>Générer Bon de Livraison
                    </button>
                    <button 
                      className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
                      onClick={() => showToast('Sortie validée avec succès !', 'success')}
                    >
                      <i className="fas fa-check mr-2"></i>Valider la sortie
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Aucun événement logistique dans cette vue.
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
