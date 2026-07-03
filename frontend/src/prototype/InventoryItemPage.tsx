import React from "react";
import { mockInventory, mockMovements } from "./mockData";

export default function InventoryItemPage({ onNavigate, param }: { onNavigate: (scope: any, param?: string) => void, param?: string }) {
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const item = mockInventory.find(i => i.id === param) || mockInventory[0];
  const itemMovements = mockMovements.filter(m => m.articleId === item.id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => onNavigate("inventory")} className="text-slate-500 hover:text-slate-800 transition flex items-center gap-2 font-medium">
          <i className="fas fa-arrow-left"></i> Retour à l'inventaire
        </button>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200" onClick={() => setToast(`Désactivation de l'article ${item.name}`)}>
            Désactiver
          </button>
          <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700" onClick={() => setToast(`Ajustement du stock pour ${item.name}`)}>
            Ajuster stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
            <div className="w-48 h-48 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-300">
              <i className="fas fa-image text-5xl"></i>
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 text-center">{item.name}</h2>
            <p className="text-slate-500 text-sm mt-1">{item.id} • {item.category}</p>
            
            <div className="mt-6 w-full space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">Prix unitaire</span>
                <span className="font-bold text-slate-800">{item.unitPrice.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">Prix casse</span>
                <span className="font-bold text-slate-800">{item.breakagePrice.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 text-sm">Statut</span>
                {item.status === "OK" ? (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">OK</span>
                ) : item.status === "Bas" ? (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Bas</span>
                ) : (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Rupture</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stock Total</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{item.totalStock}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Disponible</p>
              <p className="text-3xl font-extrabold text-emerald-700 mt-1">{item.availableStock}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Réservé</p>
              <p className="text-3xl font-extrabold text-blue-700 mt-1">{item.reservedStock}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100">
              <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">Sorti</p>
              <p className="text-3xl font-extrabold text-purple-700 mt-1">{item.outStock}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Historique des mouvements</h3>
            </div>
            <div className="p-0">
              {itemMovements.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b border-slate-200">Date</th>
                      <th className="p-4 font-bold border-b border-slate-200">Type</th>
                      <th className="p-4 font-bold border-b border-slate-200 text-right">Qté</th>
                      <th className="p-4 font-bold border-b border-slate-200">Motif</th>
                      <th className="p-4 font-bold border-b border-slate-200">Dossier</th>
                      <th className="p-4 font-bold border-b border-slate-200">Opérateur</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {itemMovements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-600">{m.date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                            m.type === "Entrée" ? "bg-emerald-100 text-emerald-700" :
                            m.type === "Sortie" ? "bg-purple-100 text-purple-700" :
                            m.type === "Retour" ? "bg-amber-100 text-amber-700" :
                            m.type === "Réservation" ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>{m.type}</span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 text-right">{m.quantity}</td>
                        <td className="p-4 text-slate-600">{m.reason}</td>
                        <td className="p-4 text-tit-600 hover:underline cursor-pointer font-medium">{m.dossierRef}</td>
                        <td className="p-4 text-slate-500">{m.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">Aucun mouvement pour cet article.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-3">
          <span>{toast}</span>
          <button className="text-slate-400 hover:text-white" onClick={() => setToast(null)}><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
}
