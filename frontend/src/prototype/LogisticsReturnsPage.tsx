import React, { useState } from "react";
import { mockRetours, titanLateReturnPenaltyRate, clampQuantity } from "./mockData";

export default function LogisticsReturnsPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = filter === "Tous" ? mockRetours : mockRetours.filter(r => r.status === filter);
  const [cleaningTasks, setCleaningTasks] = useState<Record<string, boolean>>({});

  const handleCleaningTask = (itemId: string, itemName: string) => {
    setCleaningTasks({ ...cleaningTasks, [itemId]: true });
    showToast('Tâche de nettoyage assignée pour ' + itemName, 'info');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "En retard", "Aujourd'hui", "À venir"].map(f => (
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
                    <span className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", retour.dossierRef)}>{retour.dossierRef}</span>
                  </h3>
                  <div className="flex gap-4 mt-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      <i className="fas fa-clock mr-2 text-slate-400"></i>
                      Retour attendu le : <span className="font-bold">{retour.datePrevue}</span>
                    </p>
                    {retour.status && (
                      <p className={`text-sm font-bold px-2 rounded ${
                        retour.status === "En retard" ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                        retour.status === "Aujourd'hui" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {retour.status}
                      </p>
                    )}
                    {retour.status === "En retard" && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/30 px-2 rounded">
                        <i className="fas fa-exclamation-triangle mr-2"></i>
                        Pénalité retard applicable : {titanLateReturnPenaltyRate * 100}% / jour
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="px-3 py-1 text-sm font-bold rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                    En attente de retour
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
                    {retour.items.map(item => (
                      <tr key={item.articleId} className={`bg-white dark:bg-slate-800 ${cleaningTasks[item.articleId] ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                          {item.name}
                          {cleaningTasks[item.articleId] && (
                            <span className="ml-2 text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Nettoyage en cours
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{item.qtyExpected}</td>
                        <td className="p-3 text-center">
                          <input 
                            type="number" 
                            className="w-20 text-center border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 shadow-sm font-bold focus:ring-tit-500 focus:border-tit-500 mx-auto" 
                            defaultValue={item.qtyReturned} 
                            min={0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              e.target.value = clampQuantity(val, 0, 9999).toString();
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <select className={`border border-slate-300 dark:border-slate-600 rounded px-2 py-1 font-medium w-full ${
                            cleaningTasks[item.articleId] ? "text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50" :
                            item.etat === "Bon état" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" : 
                            item.etat === "Cassé" ? "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30" : 
                            item.etat === "Manquant" ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" : 
                            "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30"
                          }`} defaultValue={item.etat}>
                            <option value="Bon état" className="text-slate-800 dark:text-slate-100">Bon état</option>
                            <option value="Cassé" className="text-slate-800 dark:text-slate-100">Cassé</option>
                            <option value="Manquant" className="text-slate-800 dark:text-slate-100">Manquant</option>
                            <option value="Sale / non lavé" className="text-slate-800 dark:text-slate-100">Sale / non lavé</option>
                          </select>
                        </td>
                        <td className="p-3">
                           {(item.etat === "Cassé" || item.etat === "Manquant") && (
                            <button className="text-slate-400 hover:text-red-600 dark:text-red-400 px-2" title="Signaler dans Casse & Perte" onClick={() => showToast('Article signalé en Casse/Perte', 'warning')}>
                              <i className="fas fa-exclamation-circle"></i>
                            </button>
                           )}
                           {item.etat === "Sale / non lavé" && !cleaningTasks[item.articleId] && (
                            <button 
                              className="text-slate-400 hover:text-purple-600 dark:text-purple-400 px-2" 
                              title="Créer une tâche de nettoyage"
                              onClick={() => handleCleaningTask(item.articleId, item.name)}
                            >
                              <i className="fas fa-broom text-purple-500"></i>
                            </button>
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
              
              <div className="mt-4 flex justify-between gap-3 items-center">
                <button className="text-slate-500 dark:text-slate-400 hover:text-tit-600 dark:text-tit-400 text-sm font-medium" onClick={() => showToast('Ouverture de l\'interface d\'ajout de photos...', 'info')}>
                  <i className="fas fa-camera mr-2"></i>Ajouter photos du retour
                </button>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-700" onClick={() => onNavigate("breakage-loss")}>
                    <i className="fas fa-exclamation-triangle mr-2"></i>Déclarer Casse/Perte
                  </button>
                  <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700" onClick={() => showToast('Retour validé et stock mis à jour', 'success')}>
                    <i className="fas fa-check mr-2"></i>Valider le retour
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
