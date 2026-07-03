import React, { useState } from "react";
import { mockSorties } from "./mockData";

export default function LogisticsDispatchPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = mockSorties.filter(s => {
    if (filter === "Tous") return true;
    return s.mode.includes(filter);
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "Titan", "Prélèvement"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"}`}
              >
                {f === "Titan" ? "Livraison Titan" : f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredData.map(sortie => (
            <div key={sortie.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", sortie.dossierRef)}>{sortie.dossierRef}</span>
                  </h3>
                  <div className="flex gap-4 mt-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <i className="fas fa-truck mr-2 text-slate-400"></i>
                      {sortie.mode} ({sortie.vehicule})
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <i className="fas fa-user mr-2 text-slate-400"></i>
                      Responsable : {sortie.responsable}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <i className="fas fa-clock mr-2 text-slate-400"></i>
                      Prévu le : {sortie.datePrevue}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="px-3 py-1 text-sm font-bold rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">
                    Prêt à sortir
                  </span>
                </div>
              </div>
              
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
                    {sortie.items.map(item => (
                      <tr key={item.articleId} className="bg-white dark:bg-slate-800">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{item.qty}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{item.etatInitial}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
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
          ))}
          
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Aucune sortie à traiter dans cette vue.
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
