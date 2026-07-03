import React, { useState } from "react";
import { mockMovements, mockInventory } from "./mockData";

export default function StockMovementsPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filterType, setFilterType] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = mockMovements.filter(m => {
    if (filterType !== "Tous" && m.type !== filterType) return false;
    return true;
  });

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
          <button className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700" onClick={() => showToast('Ouverture création de mouvement', 'info')}>
            <i className="fas fa-plus mr-2"></i>Nouveau Mouvement
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Date</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Type</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Article</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 text-right">Quantité</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Motif</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Dossier</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Opérateur</th>
                <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredData.map(m => {
                const article = mockInventory.find(a => a.id === m.articleId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50 dark:bg-slate-900/50">
                    <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{m.date}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                        m.type === "Entrée" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" :
                        m.type === "Sortie" ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400" :
                        m.type === "Retour" ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400" :
                        m.type === "Réservation" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>{m.type}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-tit-600 dark:text-tit-400" onClick={() => onNavigate("inventory-item", m.articleId)}>
                      {article ? article.name : m.articleId}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100 text-right">{m.quantity}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{m.reason}</td>
                    <td className="p-4 text-tit-600 dark:text-tit-400 hover:underline cursor-pointer font-medium">{m.dossierRef || "-"}</td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">{m.operator}</td>
                    <td className="p-4">
                      <button 
                        className="text-slate-400 hover:text-red-600 dark:text-red-400 px-2" 
                        title="Annuler ce mouvement"
                        onClick={() => showToast('Annulation du mouvement ' + m.id, 'info')}
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
