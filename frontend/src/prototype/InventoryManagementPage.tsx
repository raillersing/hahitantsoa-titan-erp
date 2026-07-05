import React, { useState, useEffect } from "react";
import { mockInventory } from "./mockData";

export default function InventoryManagementPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = useState<string | null>(null);

  // Local state for the inventory to allow mock modifications
  const [inventory, setInventory] = useState(mockInventory);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editForm, setEditForm] = useState<any>({});
  
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [stockDelta, setStockDelta] = useState(0);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const kpis = {
    total: inventory.reduce((acc, curr) => acc + curr.totalStock, 0),
    dispo: inventory.reduce((acc, curr) => acc + curr.availableStock, 0),
    reserve: inventory.reduce((acc, curr) => acc + curr.reservedStock, 0),
    sorti: inventory.reduce((acc, curr) => acc + curr.outStock, 0),
    retour: inventory.reduce((acc, curr) => acc + curr.expectedReturnStock, 0),
    casse: inventory.reduce((acc, curr) => acc + curr.brokenLostStock, 0),
  };

  const filteredData = inventory.filter(item => {
    if (filter === "Tous") return true;
    if (filter === "Disponible") return item.availableStock > 0;
    if (filter === "Réservé") return item.reservedStock > 0;
    if (filter === "Sorti") return item.outStock > 0;
    if (filter === "En retour") return item.expectedReturnStock > 0;
    if (filter === "Alertes") return item.status === "Bas" || item.status === "Rupture";
    return true;
  });

  const handleOpenCreate = () => {
    setFormMode("create");
    setEditForm({
      id: `NEW-${Math.floor(Math.random() * 10000)}`,
      name: "",
      type: "Location",
      category: "",
      imageUrl: "",
      unitPrice: 0,
      breakagePrice: 0,
      totalStock: 0,
      availableStock: 0,
      reservedStock: 0,
      outStock: 0,
      expectedReturnStock: 0,
      brokenLostStock: 0,
      status: "OK"
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setFormMode("edit");
    setEditForm({ ...item });
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "create") {
      const newInv = [editForm, ...inventory];
      setInventory(newInv);
      mockInventory.unshift(editForm); // sync global
      setToast("Article créé avec succès.");
    } else {
      const newInv = inventory.map(i => i.id === editForm.id ? editForm : i);
      setInventory(newInv);
      const idx = mockInventory.findIndex(i => i.id === editForm.id);
      if (idx !== -1) mockInventory[idx] = editForm;
      setToast("Article modifié avec succès.");
    }
    setIsFormOpen(false);
  };

  const handleToggleStatus = (item: any) => {
    const newStatus = (item.status === "OK" ? "Rupture" : "OK") as "OK" | "Bas" | "Rupture";
    const newItem = { ...item, status: newStatus };
    const newInv = inventory.map(i => i.id === item.id ? newItem : i);
    setInventory(newInv);
    const idx = mockInventory.findIndex(i => i.id === item.id);
    if (idx !== -1) mockInventory[idx] = newItem;
    setToast(`L'article ${item.name} est maintenant en ${newStatus === "OK" ? "Disponibilité" : "Rupture"}`);
  };

  const handleOpenAdjustStock = (item: any) => {
    setAdjustItem(item);
    setStockDelta(0);
    setIsAdjustingStock(true);
  };

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const newTotal = adjustItem.totalStock + stockDelta;
    const newAvailable = adjustItem.availableStock + stockDelta;
    const newItem = { ...adjustItem, totalStock: newTotal, availableStock: newAvailable };
    const newInv = inventory.map(i => i.id === adjustItem.id ? newItem : i);
    setInventory(newInv);
    const idx = mockInventory.findIndex(i => i.id === adjustItem.id);
    if (idx !== -1) mockInventory[idx] = newItem;
    setToast(`Stock ajusté : ${stockDelta > 0 ? '+' : ''}${stockDelta}`);
    setIsAdjustingStock(false);
    setStockDelta(0);
  };

  const handleOpenDelete = (item: any) => {
    setDeleteItem(item);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    const newInv = inventory.filter(i => i.id !== deleteItem.id);
    setInventory(newInv);
    const idx = mockInventory.findIndex(i => i.id === deleteItem.id);
    if (idx !== -1) mockInventory.splice(idx, 1);
    setToast(`L'article ${deleteItem.name} a été supprimé.`);
    setIsDeleteOpen(false);
  };

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
          <div className="flex gap-2 flex-wrap">
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
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-tit-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-tit-700 whitespace-nowrap">
            <i className="fas fa-plus mr-2"></i>Nouvel Article
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-200">Photo</th>
                <th className="p-4 font-bold border-b border-slate-200">Article</th>
                <th className="p-4 font-bold border-b border-slate-200">Type</th>
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
                  <td className="p-4">
                    <div className="w-10 h-10 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <i className="fas fa-image text-slate-400"></i>}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-800 cursor-pointer" onClick={() => onNavigate("inventory-item", item.id)}>
                    {item.name}
                    <div className="text-xs text-slate-500 font-normal">{item.id}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                      item.type === "Location" ? "bg-indigo-100 text-indigo-700" :
                      item.type === "Consommable" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {item.type}
                    </span>
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
                  <td className="p-4 text-right whitespace-nowrap">
                    <button className="text-slate-400 hover:text-tit-600 px-1.5" onClick={() => onNavigate("inventory-item", item.id)} title="Détail">
                      <i className="fas fa-eye"></i>
                    </button>
                    <button className="text-slate-400 hover:text-tit-600 px-1.5" onClick={() => handleOpenEdit(item)} title="Modifier">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="text-slate-400 hover:text-tit-600 px-1.5" onClick={() => handleOpenAdjustStock(item)} title="Ajuster stock">
                      <i className="fas fa-boxes"></i>
                    </button>
                    <button className="text-slate-400 hover:text-tit-600 px-1.5" onClick={() => handleToggleStatus(item)} title={item.status === 'OK' ? "Désactiver" : "Réactiver"}>
                      <i className={`fas ${item.status === 'OK' ? 'fa-ban' : 'fa-check'}`}></i>
                    </button>
                    <button className="text-slate-400 hover:text-rose-600 px-1.5" onClick={() => handleOpenDelete(item)} title="Supprimer">
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">Aucun article trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 id="modal-title" className="text-xl font-bold text-slate-800">
                {formMode === "create" ? "Nouvel Article" : "Modifier l'article"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-4">
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
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.totalStock} onChange={e => setEditForm({...editForm, totalStock: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Disponible</label>
                  <input type="number" className="w-full border border-slate-300 rounded p-2 text-sm" value={editForm.availableStock} onChange={e => setEditForm({...editForm, availableStock: parseInt(e.target.value || '0', 10)})} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded font-medium" onClick={() => setIsFormOpen(false)}>Annuler</button>
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
              <p className="text-sm text-slate-600">Ajoutez ou retirez du stock total (et disponible) pour <strong>{adjustItem?.name}</strong>.</p>
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
              <p className="text-sm text-slate-600">Cette action supprimera l'article <strong>{deleteItem?.name}</strong> de l'inventaire mock.</p>
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
