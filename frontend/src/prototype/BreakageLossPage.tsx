import React, { useState } from "react";
import { mockCassesPertes } from "./mockData";

export default function BreakageLossPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("À traiter");
  const [data, setData] = useState(mockCassesPertes);
  const [toast, setToast] = useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = data.filter(cp => {
    if (filter === "Tous") return true;
    return cp.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "À traiter", "Retenue validée", "Différence à facturer", "Clôturé"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700" onClick={() => showToast('Ouverture du formulaire de déclaration de casse...', 'info')}>
            <i className="fas fa-plus mr-2"></i>Nouveau Dossier
          </button>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredData.map(cp => (
            <div key={cp.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-3">
                    <span className="text-red-600">{cp.id}</span>
                    <span className="text-slate-400 text-sm font-normal">•</span>
                    <span className="text-tit-600 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", cp.dossierRef)}>{cp.dossierRef}</span>
                  </h3>
                </div>
                <div>
                  <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                    cp.status === "À traiter" ? "bg-red-100 text-red-700" :
                    cp.status === "Retenue validée" ? "bg-blue-100 text-blue-700" :
                    cp.status === "Différence à facturer" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {cp.status}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Article concerné</th>
                      <th className="p-3 text-right">Qté Cassée</th>
                      <th className="p-3 text-right">Qté Manquante</th>
                      <th className="p-3 text-right">Prix Casse unitaire</th>
                      <th className="p-3 text-right">Montant Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    <tr className="bg-white">
                      <td className="p-3 font-bold text-slate-800">{cp.articleName}</td>
                      <td className="p-3 font-bold text-red-600 text-right">{cp.qtyBroken}</td>
                      <td className="p-3 font-bold text-red-600 text-right">{cp.qtyLost}</td>
                      <td className="p-3 text-right">{cp.priceBreakage.toLocaleString()} Ar</td>
                      <td className="p-3 font-bold text-slate-800 text-right">{cp.totalAmount.toLocaleString()} Ar</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Caution Disponible</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">{cp.cautionAvailable.toLocaleString()} Ar</p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                  <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Montant Retenue</p>
                  <p className="text-xl font-extrabold text-red-700 mt-1">{cp.cautionRetained.toLocaleString()} Ar</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                  <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Différence à payer</p>
                  <p className="text-xl font-extrabold text-amber-700 mt-1">{cp.diffToPay.toLocaleString()} Ar</p>
                </div>
              </div>
              
              {cp.notes && (
                <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
                  <i className="fas fa-comment-alt mr-2 text-slate-400"></i><strong>Notes :</strong> {cp.notes}
                </div>
              )}
              
              <div className="mt-6 flex justify-between gap-3 items-center">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-slate-100 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-200" onClick={() => showToast('Ouverture de la modale photos de casse', 'info')}>
                    <i className="fas fa-camera mr-2"></i>Photos
                  </button>
                </div>
                <div className="flex gap-2">
                  {cp.status === "À traiter" && (
                    <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700" onClick={() => {
                      setData(data.map(d => d.id === cp.id ? {...d, status: "Retenue validée"} : d));
                      showToast('Montant imputé à la caution avec succès', 'success');
                    }}>
                      <i className="fas fa-cut mr-2"></i>Imputer à la caution
                    </button>
                  )}
                  {cp.diffToPay > 0 && cp.status !== "Clôturé" && (
                    <button className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700" onClick={() => showToast('Génération de la facture complémentaire...', 'info')}>
                      <i className="fas fa-file-invoice mr-2"></i>Créer facture de différence
                    </button>
                  )}
                  {cp.status !== "Clôturé" && (
                    <button className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900" onClick={() => {
                      setData(data.map(d => d.id === cp.id ? {...d, status: "Clôturé"} : d));
                      showToast('Dossier clôturé', 'success');
                    }}>
                      <i className="fas fa-check-circle mr-2"></i>Clôturer le dossier
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Aucun dossier de casse ou de perte.
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
