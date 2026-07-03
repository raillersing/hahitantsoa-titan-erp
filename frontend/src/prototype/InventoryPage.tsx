import React, { useState, useEffect } from "react";
import { mockInventory } from "./mockData";

export default function InventoryPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const kpis = {
    total: mockInventory.reduce((acc, curr) => acc + curr.totalStock, 0),
    dispo: mockInventory.reduce((acc, curr) => acc + curr.availableStock, 0),
    reserve: mockInventory.reduce((acc, curr) => acc + curr.reservedStock, 0),
    sorti: mockInventory.reduce((acc, curr) => acc + curr.outStock, 0),
    retour: mockInventory.reduce((acc, curr) => acc + curr.expectedReturnStock, 0),
    casse: mockInventory.reduce((acc, curr) => acc + curr.brokenLostStock, 0),
  };

  const filteredData = mockInventory.filter(item => {
    if (filter === "Tous") return true;
    if (filter === "Disponible") return item.availableStock > 0;
    if (filter === "Réservé") return item.reservedStock > 0;
    if (filter === "Sorti") return item.outStock > 0;
    if (filter === "En retour") return item.expectedReturnStock > 0;
    if (filter === "Alertes") return item.status === "Bas" || item.status === "Rupture";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-1">{kpis.total}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Dispo</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{kpis.dispo}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Réservé</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">{kpis.reserve}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100">
          <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">Sorti</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">{kpis.sorti}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-100">
          <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">En retour</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{kpis.retour}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
          <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Casse/Perte</p>
          <p className="text-2xl font-extrabold text-red-700 mt-1">{kpis.casse}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "Disponible", "Réservé", "Sorti", "En retour", "Alertes"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setToast("Ouverture du formulaire de création d'article...")} className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700">
            <i className="fas fa-plus mr-2"></i>Nouvel Article
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200">Article</th>
                <th className="p-4 font-bold border-b border-slate-200">Catégorie</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Total</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Dispo</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Réservé</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Sorti</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Retour</th>
                <th className="p-4 font-bold border-b border-slate-200 text-center">Statut</th>
                <th className="p-4 font-bold border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredData.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800 cursor-pointer" onClick={() => onNavigate("inventory-item", item.id)}>
                    {item.name}
                    <div className="text-xs text-slate-500 font-normal">{item.id}</div>
                  </td>
                  <td className="p-4 text-slate-600">{item.category}</td>
                  <td className="p-4 text-slate-800 font-medium text-right">{item.totalStock}</td>
                  <td className="p-4 text-emerald-600 font-bold text-right">{item.availableStock}</td>
                  <td className="p-4 text-blue-600 font-medium text-right">{item.reservedStock}</td>
                  <td className="p-4 text-purple-600 font-medium text-right">{item.outStock}</td>
                  <td className="p-4 text-amber-600 font-medium text-right">{item.expectedReturnStock}</td>
                  <td className="p-4 text-center">
                    {item.status === "OK" ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">OK</span>
                    ) : item.status === "Bas" ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Bas</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Rupture</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-slate-400 hover:text-tit-600 px-2" onClick={() => onNavigate("inventory-item", item.id)}>
                      <i className="fas fa-eye"></i>
                    </button>
                    <button className="text-slate-400 hover:text-tit-600 px-2" onClick={() => setToast(`Édition rapide de l'article : ${item.name}`)}>
                      <i className="fas fa-edit"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">Aucun article trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
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
