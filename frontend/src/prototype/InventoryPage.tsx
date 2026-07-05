import React, { useState } from "react";
import { mockInventory } from "./mockData";

export default function InventoryPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [viewMode, setViewMode] = useState<"grid-large" | "grid-medium" | "list" | "compact">("grid-large");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const catalogData = mockInventory.filter(item => item.type === "Location");
  const categories = ["Tous", ...Array.from(new Set(catalogData.map(item => item.category)))];

  const filteredData = catalogData.filter(item => {
    if (filter === "Tous") return true;
    return item.category === filter;
  });

  const selectedItems = catalogData.filter(i => selectedIds.includes(i.id));
  const estimatedTotal = selectedItems.reduce((acc, curr) => {
    const qty = selectedQuantities[curr.id] || 1;
    return acc + (curr.unitPrice * qty);
  }, 0);

  const toggleSelection = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (selectedIds.includes(item.id)) {
      setSelectedIds(selectedIds.filter(sel => sel !== item.id));
      const newQtys = { ...selectedQuantities };
      delete newQtys[item.id];
      setSelectedQuantities(newQtys);
    } else {
      if (item.availableStock <= 0) {
        showToast(`L'article "${item.name}" est en rupture de stock.`);
        return;
      }
      setSelectedIds([...selectedIds, item.id]);
      setSelectedQuantities({ ...selectedQuantities, [item.id]: 1 });
    }
  };

  const updateQuantity = (item: any, qty: number, e?: any) => {
    if (e) e.stopPropagation();
    if (qty <= 0) {
      toggleSelection(item, e);
      return;
    }
    if (qty > item.availableStock) {
      showToast(`Quantité max disponible pour "${item.name}" : ${item.availableStock}.`);
      setSelectedQuantities({ ...selectedQuantities, [item.id]: item.availableStock });
    } else {
      setSelectedQuantities({ ...selectedQuantities, [item.id]: qty });
    }
  };

  const removeFromSelection = (id: string) => {
    const newSel = selectedIds.filter(sel => sel !== id);
    setSelectedIds(newSel);
    const newQtys = { ...selectedQuantities };
    delete newQtys[id];
    setSelectedQuantities(newQtys);
    if (newSel.length === 0) {
      setIsPrepModalOpen(false);
    }
  };

  const handlePrepareTitan = () => {
    // Generate payload
    const payloadItems = selectedItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.unitPrice,
      quantity: selectedQuantities[item.id] || 1
    }));
    
    const paramStr = `catalog-prep|${JSON.stringify(payloadItems)}`;
    onNavigate("reservation-new", paramStr);
  };

  const handleSelectAll = () => {
    const validItems = filteredData.filter(i => i.availableStock > 0);
    const newIds = validItems.map(i => i.id);
    const newQtys = { ...selectedQuantities };
    validItems.forEach(i => {
      if (!newQtys[i.id]) newQtys[i.id] = 1;
    });
    setSelectedIds(Array.from(new Set([...selectedIds, ...newIds])));
    setSelectedQuantities(newQtys);
  };

  const handleDeselectAll = () => {
    const currentViewIds = filteredData.map(i => i.id);
    const newSelectedIds = selectedIds.filter(id => !currentViewIds.includes(id));
    setSelectedIds(newSelectedIds);
    const newQtys = { ...selectedQuantities };
    currentViewIds.forEach(id => delete newQtys[id]);
    setSelectedQuantities(newQtys);
  };

  const handleInvertSelection = () => {
    const validItems = filteredData.filter(i => i.availableStock > 0);
    const currentViewIds = filteredData.map(i => i.id);
    const currentViewSelected = selectedIds.filter(id => currentViewIds.includes(id));
    const toSelect = validItems.filter(i => !currentViewSelected.includes(i.id)).map(i => i.id);
    
    const newSelectedIds = selectedIds.filter(id => !currentViewIds.includes(id)).concat(toSelect);
    const newQtys = { ...selectedQuantities };
    currentViewSelected.forEach(id => delete newQtys[id]);
    toSelect.forEach(id => newQtys[id] = 1);
    
    setSelectedIds(newSelectedIds);
    setSelectedQuantities(newQtys);
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-rose-600 text-white px-4 py-3 rounded-lg shadow-lg font-medium flex items-center gap-2 animate-fade-in">
          <i className="fa-solid fa-circle-exclamation"></i>
          {toastMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Catalogue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Articles et matériels disponibles à la location</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSelectionMode ? (
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 border border-slate-200 dark:border-slate-700">
                <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all">Tout sélectionner</button>
                <button onClick={handleDeselectAll} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all">Désélectionner tout</button>
                <button onClick={handleInvertSelection} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all">Inverser</button>
              </div>
              <button onClick={() => setIsSelectionMode(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold transition-colors shadow-sm">
                <i className="fa-solid fa-times mr-2"></i>Terminer
              </button>
            </div>
          ) : (
            <button onClick={() => setIsSelectionMode(true)} className="px-4 py-2 bg-white hover:bg-tit-50 text-tit-600 border border-tit-200 rounded-lg text-sm font-bold transition-colors shadow-sm">
              <i className="fa-solid fa-check-double mr-2"></i>Sélection multiple
            </button>
          )}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode("grid-large")} className={`p-2 rounded ${viewMode === 'grid-large' ? 'bg-white shadow text-tit-600' : 'text-slate-500 hover:text-slate-700'}`} title="Grille large">
              <i className="fas fa-th-large"></i>
            </button>
            <button onClick={() => setViewMode("grid-medium")} className={`p-2 rounded ${viewMode === 'grid-medium' ? 'bg-white shadow text-tit-600' : 'text-slate-500 hover:text-slate-700'}`} title="Grille moyenne">
              <i className="fas fa-th"></i>
            </button>
            <button onClick={() => setViewMode("list")} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow text-tit-600' : 'text-slate-500 hover:text-slate-700'}`} title="Vue Liste">
              <i className="fas fa-list"></i>
            </button>
            <button onClick={() => setViewMode("compact")} className={`p-2 rounded ${viewMode === 'compact' ? 'bg-white shadow text-tit-600' : 'text-slate-500 hover:text-slate-700'}`} title="Vue Compacte">
              <i className="fas fa-align-justify"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pb-2 overflow-x-auto">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setFilter(cat)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${filter === cat ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {(viewMode === "grid-large" || viewMode === "grid-medium") && (
        <div className={`grid gap-6 ${viewMode === 'grid-large' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
          {filteredData.map(item => {
            const isSelected = selectedIds.includes(item.id);
            const qty = selectedQuantities[item.id] || 0;
            const isOutOfStock = item.availableStock <= 0;
            return (
              <div 
                key={item.id} 
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col relative ${isSelected ? 'border-tit-500 ring-2 ring-tit-200 bg-tit-50/10' : 'border-slate-200 dark:border-slate-700'} ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}
                onClick={(e) => {
                  if (isOutOfStock) return;
                  if (isSelectionMode) toggleSelection(item, e);
                  else onNavigate("inventory-item", item.id);
                }}
              >
                {!isSelected && !isSelectionMode && (
                  <button 
                    className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm bg-white text-slate-300 hover:text-tit-500 hover:bg-tit-50 ${isOutOfStock ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={(e) => toggleSelection(item, e)}
                    disabled={isOutOfStock}
                  >
                    <i className="fas fa-plus opacity-0 hover:opacity-100 group-hover:opacity-100"></i>
                  </button>
                )}

                <div className={`${viewMode === 'grid-large' ? 'aspect-square' : 'aspect-[4/3]'} bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden group`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <i className={`fas fa-image text-slate-300 dark:text-slate-700 ${viewMode === 'grid-large' ? 'text-4xl' : 'text-2xl'}`}></i>
                  )}
                  {item.status === "OK" && <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">DISPO</div>}
                  {item.status === "Bas" && <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">BAS</div>}
                  {item.status === "Rupture" && <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">RUPTURE</div>}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-tit-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      <i className="fas fa-check text-xs"></i>
                    </div>
                  )}
                </div>
                
                <div className={`p-3 flex flex-col flex-1 ${viewMode === 'grid-medium' ? 'text-sm' : ''} ${isSelected ? 'bg-tit-50/50' : ''}`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 uppercase">{item.category}</div>
                  <h3 className={`font-bold text-slate-800 dark:text-slate-100 leading-tight mb-2 line-clamp-2 ${viewMode === 'grid-large' ? 'text-base' : 'text-sm'}`}>{item.name}</h3>
                  
                  <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-end">
                    <div>
                      <div className="font-extrabold text-tit-600 dark:text-tit-400">{item.unitPrice.toLocaleString()} Ar</div>
                    </div>
                    <div className="text-right text-[10px]">
                      <div className="text-slate-500 dark:text-slate-400">Stock</div>
                      <div className="font-bold text-slate-700 dark:text-slate-300">{item.availableStock}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <div className="text-xs font-medium text-slate-500">Qté:</div>
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded hover:shadow-sm" onClick={(e) => updateQuantity(item, qty - 1, e)}><i className="fas fa-minus text-xs"></i></button>
                        <input type="number" min="1" max={item.availableStock} value={qty} onChange={(e) => updateQuantity(item, parseInt(e.target.value || '1'), e)} className="w-10 text-center bg-transparent text-sm font-bold border-none focus:ring-0 p-0" />
                        <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded hover:shadow-sm" onClick={(e) => updateQuantity(item, qty + 1, e)} disabled={qty >= item.availableStock}><i className="fas fa-plus text-xs"></i></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && (
        <div className="flex flex-col gap-4">
          {filteredData.map(item => {
            const isSelected = selectedIds.includes(item.id);
            const qty = selectedQuantities[item.id] || 0;
            const isOutOfStock = item.availableStock <= 0;

            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${isSelected ? 'border-tit-500 ring-2 ring-tit-200 bg-tit-50/20' : 'border-slate-200'} ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}
                onClick={(e) => {
                  if (isOutOfStock) return;
                  if (isSelectionMode) toggleSelection(item, e);
                  else onNavigate("inventory-item", item.id);
                }}
              >
                <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <i className="fas fa-image text-slate-300"></i>}
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-tit-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                      <i className="fas fa-check text-[10px]"></i>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{item.category}</div>
                  <h3 className="font-bold text-slate-800 text-lg truncate">{item.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                    <span>Stock: <strong>{item.availableStock}</strong></span>
                    {item.status === "OK" ? (
                      <span className="text-emerald-600 font-medium"><i className="fas fa-check-circle mr-1"></i>Disponible</span>
                    ) : item.status === "Bas" ? (
                      <span className="text-amber-600 font-medium"><i className="fas fa-exclamation-triangle mr-1"></i>Bas</span>
                    ) : (
                      <span className="text-red-600 font-medium"><i className="fas fa-times-circle mr-1"></i>Rupture</span>
                    )}
                  </div>
                </div>
                <div className="text-right px-4 hidden md:block">
                  <div className="text-xl font-extrabold text-tit-600">{item.unitPrice.toLocaleString()} Ar</div>
                </div>

                <div className="pl-4 border-l border-slate-100 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                  {isSelected ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded hover:shadow-sm" onClick={(e) => updateQuantity(item, qty - 1, e)}><i className="fas fa-minus text-xs"></i></button>
                        <input type="number" min="1" max={item.availableStock} value={qty} onChange={(e) => updateQuantity(item, parseInt(e.target.value || '1'), e)} className="w-12 text-center bg-transparent font-bold border-none focus:ring-0 p-0" />
                        <button className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded hover:shadow-sm" onClick={(e) => updateQuantity(item, qty + 1, e)} disabled={qty >= item.availableStock}><i className="fas fa-plus text-xs"></i></button>
                      </div>
                    </div>
                  ) : !isSelectionMode ? (
                    <button 
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${isOutOfStock ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-300 border-slate-300 hover:border-tit-500 hover:text-tit-500'}`}
                      onClick={(e) => toggleSelection(item, e)}
                      disabled={isOutOfStock}
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "compact" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <tbody className="divide-y divide-slate-100">
              {filteredData.map(item => {
                const isSelected = selectedIds.includes(item.id);
                const qty = selectedQuantities[item.id] || 0;
                const isOutOfStock = item.availableStock <= 0;

                return (
                  <tr key={item.id} className={`hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-tit-50/50' : ''} ${isOutOfStock ? 'opacity-75' : ''}`} onClick={(e) => {
                    if (isOutOfStock) return;
                    if (isSelectionMode) toggleSelection(item, e);
                    else onNavigate("inventory-item", item.id);
                  }}>
                    <td className="p-3 w-10 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" disabled={isOutOfStock} checked={isSelected} onChange={(e) => toggleSelection(item, e as any)} className="w-4 h-4 text-tit-600 rounded border-slate-300 focus:ring-tit-500" />
                    </td>
                    <td className="p-3 font-bold text-slate-800">{item.name}</td>
                    <td className="p-3 text-slate-500 text-sm">{item.category}</td>
                    <td className="p-3 font-medium text-tit-600 text-right">{item.unitPrice.toLocaleString()} Ar</td>
                    <td className="p-3 text-center">
                      <div className="text-xs text-slate-500">Stock: <strong className="text-slate-800">{item.availableStock}</strong></div>
                    </td>
                    <td className="p-3 w-32" onClick={e => e.stopPropagation()}>
                      {isSelected && (
                        <div className="flex items-center bg-white border border-slate-200 rounded p-0.5">
                          <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded" onClick={(e) => updateQuantity(item, qty - 1, e)}><i className="fas fa-minus text-[10px]"></i></button>
                          <input type="number" min="1" max={item.availableStock} value={qty} onChange={(e) => updateQuantity(item, parseInt(e.target.value || '1'), e)} className="w-8 text-center bg-transparent text-xs font-bold border-none focus:ring-0 p-0" />
                          <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded" onClick={(e) => updateQuantity(item, qty + 1, e)} disabled={qty >= item.availableStock}><i className="fas fa-plus text-[10px]"></i></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredData.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <i className="fas fa-search text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun article trouvé dans cette catégorie.</p>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4 z-40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-tit-100 text-tit-700 flex items-center justify-center font-bold text-lg">
              {selectedIds.length}
            </div>
            <div>
              <p className="font-bold text-slate-800">Sélection Titan</p>
              <p className="text-sm text-slate-500">{estimatedTotal.toLocaleString()} Ar estimé</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">
              Vider
            </button>
            <button onClick={() => setIsPrepModalOpen(true)} className="px-6 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700 shadow-md flex items-center gap-2">
              Préparer location Titan <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      )}

      {isPrepModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="prep-modal-title">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-tit-50 rounded-t-xl">
              <div>
                <h3 id="prep-modal-title" className="text-xl font-extrabold text-tit-900 flex items-center gap-2">
                  <i className="fas fa-clipboard-list text-tit-600"></i> Préparer location Titan
                </h3>
                <p className="text-sm text-tit-700 mt-1">L'assistant va reprendre ces articles pour configurer le dossier de location.</p>
              </div>
              <button onClick={() => setIsPrepModalOpen(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase">Article</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center w-32">Quantité</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Sous-total</th>
                    <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {selectedItems.map(item => {
                    const qty = selectedQuantities[item.id] || 1;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800 flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded overflow-hidden flex items-center justify-center shrink-0">
                             {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <i className="fas fa-image text-slate-300"></i>}
                          </div>
                          <span className="truncate max-w-[200px]">{item.name}</span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center bg-white border border-slate-200 rounded p-0.5">
                            <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded" onClick={(e) => updateQuantity(item, qty - 1, e)}><i className="fas fa-minus text-[10px]"></i></button>
                            <input type="number" min="1" max={item.availableStock} value={qty} onChange={(e) => updateQuantity(item, parseInt(e.target.value || '1'), e)} className="w-10 text-center bg-transparent text-xs font-bold border-none focus:ring-0 p-0" />
                            <button className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded" onClick={(e) => updateQuantity(item, qty + 1, e)} disabled={qty >= item.availableStock}><i className="fas fa-plus text-[10px]"></i></button>
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-600">{(item.unitPrice * qty).toLocaleString()} Ar</td>
                        <td className="p-3 text-center">
                          <button onClick={() => removeFromSelection(item.id)} className="text-red-400 hover:text-red-600 p-1" title="Retirer">
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex flex-col gap-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <span className="font-bold text-slate-600">Total estimé</span>
                <span className="text-2xl font-extrabold text-tit-600">{estimatedTotal.toLocaleString()} Ar</span>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100" onClick={() => setIsPrepModalOpen(false)}>Continuer sélection</button>
                <button type="button" className="px-6 py-2 bg-tit-600 text-white rounded-lg font-bold shadow hover:bg-tit-700 flex items-center gap-2" onClick={handlePrepareTitan}>
                  Créer dossier Titan brouillon <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
