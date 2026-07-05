import React, { useState } from "react";
import { mockInventory, mockMovements } from "./mockData";

export default function InventoryItemPage({ onNavigate, param, onBack, returnContext }: { onNavigate: (scope: any, param?: string) => void, param?: string, onBack?: () => void, returnContext?: any }) {
  const [toast, setToast] = useState<string | null>(null);

  // Local state for the item to allow mock edits
  const initialItem = mockInventory.find(i => i.id === param) || mockInventory[0];
  const [item, setItem] = useState(initialItem);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(item);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [stockDelta, setStockDelta] = useState(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const itemMovements = mockMovements.filter(m => m.articleId === item.id);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (returnContext?.from === 'inventory') {
      onNavigate('inventory');
    } else {
      onNavigate('inventory-management');
    }
  };

  const backLabel = returnContext?.from === 'inventory' ? "Retour au catalogue" : "Retour à l'inventaire";

  const handleToggleStatus = () => {
    const newStatus = (item.status === "OK" ? "Rupture" : "OK") as "OK" | "Bas" | "Rupture";
    const newItem = { ...item, status: newStatus };
    setItem(newItem);
    
    // Also update mockInventory globally so it persists during session
    const idx = mockInventory.findIndex(i => i.id === item.id);
    if (idx !== -1) mockInventory[idx] = newItem;

    setToast(`L'article ${item.name} est maintenant en ${newStatus === "OK" ? "Disponibilité (OK)" : "Rupture/Inactif"}`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setItem(editForm);
    // Update mockInventory
    const idx = mockInventory.findIndex(i => i.id === item.id);
    if (idx !== -1) mockInventory[idx] = editForm;
    setIsEditing(false);
    setToast("Article modifié avec succès.");
  };

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    const newTotal = item.totalStock + stockDelta;
    const newAvailable = item.availableStock + stockDelta;
    const newItem = { ...item, totalStock: newTotal, availableStock: newAvailable };
    setItem(newItem);
    const idx = mockInventory.findIndex(i => i.id === item.id);
    if (idx !== -1) mockInventory[idx] = newItem;
    setIsAdjustingStock(false);
    setStockDelta(0);
    setToast(`Stock ajusté : ${stockDelta > 0 ? '+' : ''}${stockDelta}`);
  };

  const handleConfirmDelete = () => {
    const idx = mockInventory.findIndex(i => i.id === item.id);
    if (idx !== -1) mockInventory.splice(idx, 1);
    setToast(`L'article ${item.name} a été supprimé.`);
    setIsDeleteOpen(false);
    setTimeout(() => {
      handleBack();
    }, 1000); // Give time for toast to be seen
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={handleBack} className="text-slate-500 hover:text-slate-800 transition flex items-center gap-2 font-medium">
          <i className="fas fa-arrow-left"></i> {backLabel}
        </button>
        <div className="flex gap-2">
          <button className={`px-4 py-2 ${item.status === 'OK' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} font-bold rounded-lg`} onClick={handleToggleStatus}>
            {item.status === 'OK' ? 'Désactiver' : 'Réactiver'}
          </button>
          <button className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50" onClick={() => { setEditForm(item); setIsEditing(true); }}>
            Modifier
          </button>
          <button className="px-4 py-2 border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50" onClick={() => setIsDeleteOpen(true)}>
            Supprimer
          </button>
          <button className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700" onClick={() => setIsAdjustingStock(true)}>
            Ajuster stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
            <div className="w-48 h-48 bg-slate-100 rounded-xl mb-4 flex items-center justify-center text-slate-300 overflow-hidden">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-image text-5xl"></i>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-800 text-center">{item.name}</h2>
            <div className="mt-2 flex gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                item.type === "Location" ? "bg-indigo-100 text-indigo-700" :
                item.type === "Consommable" ? "bg-amber-100 text-amber-700" :
                "bg-emerald-100 text-emerald-700"
              }`}>
                {item.type}
              </span>
              <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-600">
                {item.category}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-2 font-mono">{item.id}</p>
            
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

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 id="modal-title" className="text-xl font-bold text-slate-800">Modifier l'article</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code / ID</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'article</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as "Location" | "Consommable" | "Uniforme"})}>
                    <option value="Location">Location</option>
                    <option value="Consommable">Consommable</option>
                    <option value="Uniforme">Uniforme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                  <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Photo de l'article (URL ou Fichier local)</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {editForm.imageUrl ? (
                        <img src={editForm.imageUrl} alt="Prévisualisation" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fas fa-image text-slate-300 text-3xl"></i>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <input type="text" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.imageUrl || ''} placeholder="https://... (URL externe)" onChange={e => setEditForm({...editForm, imageUrl: e.target.value})} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-bold uppercase">Ou local</span>
                        <div className="flex-1">
                          <input type="file" accept="image/*" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-tit-50 file:text-tit-700 hover:file:bg-tit-100 cursor-pointer" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              setEditForm({ ...editForm, imageUrl: url });
                            }
                          }} />
                        </div>
                        {editForm.imageUrl && (
                          <button type="button" onClick={() => setEditForm({ ...editForm, imageUrl: '' })} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1">Retirer</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix de location/vente (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.unitPrice} onChange={e => setEditForm({...editForm, unitPrice: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix en cas de casse (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.breakagePrice} onChange={e => setEditForm({...editForm, breakagePrice: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Total</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50" value={editForm.totalStock} readOnly title="Utiliser 'Ajuster stock' pour modifier" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Disponible</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm bg-slate-50" value={editForm.availableStock} readOnly title="Utiliser 'Ajuster stock' pour modifier" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium" onClick={() => setIsEditing(false)}>Annuler</button>
                <button type="submit" className="px-4 py-2 bg-tit-600 text-white rounded font-bold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdjustingStock && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col" role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 id="adjust-stock-title" className="text-xl font-bold text-slate-800">Ajuster le stock</h3>
              <button onClick={() => { setIsAdjustingStock(false); setStockDelta(0); }} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveStock} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Ajoutez ou retirez du stock total (et disponible) pour <strong>{item.name}</strong>.</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ajustement (ex: +5, -2)</label>
                <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={stockDelta} onChange={e => setStockDelta(parseInt(e.target.value || '0', 10))} />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium" onClick={() => { setIsAdjustingStock(false); setStockDelta(0); }}>Annuler</button>
                <button type="submit" className="px-4 py-2 bg-tit-600 text-white rounded font-bold">Appliquer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="p-6 border-b border-slate-200">
              <h3 id="delete-title" className="text-xl font-bold text-slate-800">Supprimer l'article ?</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">Cette action supprimera l'article <strong>{item.name}</strong> de l'inventaire mock.</p>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium focus:outline-none focus:ring-2 focus:ring-slate-400" onClick={() => setIsDeleteOpen(false)} autoFocus>Annuler</button>
              <button className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition-colors" onClick={handleConfirmDelete}>Supprimer l'article</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-3">
          <span>{toast}</span>
          <button className="text-slate-400 hover:text-white" onClick={() => setToast(null)}><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
}
