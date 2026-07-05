import React, { useState } from "react";
import { hahitantsoaMockPackages, mockCatalog } from "./mockData";

export default function PackageBuilderPage() {
  const [packages, setPackages] = useState(hahitantsoaMockPackages);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "details">("details");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };
  
  const selectedPkg = packages.find(p => p.id === selectedPkgId);

  const handleAddPackage = () => {
    const newPkg = {
      id: `PACK-NEW-${Date.now()}`,
      name: "Nouveau Package",
      price: 0,
      desc: "Description du package",
      imageUrl: "",
      active: true,
      articles: []
    };
    setPackages([...packages, newPkg]);
    setSelectedPkgId(newPkg.id);
    setViewMode("details");
    showToast('Nouveau pack créé', 'success');
  };

  const handleUpdatePackage = (updatedPkg: any) => {
    setPackages(packages.map(p => p.id === updatedPkg.id ? updatedPkg : p));
  };

  const handleDisablePackage = (id: string) => {
    showToast("Pack désactivé", "warning");
    setPackages(packages.map(p => p.id === id ? { ...p, active: false } : p));
  };

  const handleDeletePackage = (id: string) => {
    showToast("Pack supprimé définitivement", "error");
    setPackages(packages.filter(p => p.id !== id));
    setSelectedPkgId(null);
  };

  const toggleArticle = (pkg: any, articleId: string) => {
    const exists = pkg.articles.find((a: any) => a.id === articleId);
    let newArticles;
    if (exists) {
      newArticles = pkg.articles.filter((a: any) => a.id !== articleId);
    } else {
      newArticles = [...pkg.articles, { id: articleId, qty: 1 }];
    }
    handleUpdatePackage({ ...pkg, articles: newArticles });
  };

  const [quantityFeedback, setQuantityFeedback] = useState<string | null>(null);

  const updateArticleQty = (pkg: any, articleId: string, rawQty: number) => {
    let qty = rawQty;
    if (Number.isNaN(qty)) qty = 0;
    
    const catItem = mockCatalog.find(c => c.id === articleId);
    const maxQty = catItem ? catItem.available : 999;
    
    if (qty > maxQty) {
      qty = maxQty;
      setQuantityFeedback(`Attention: Stock mocké disponible est de ${maxQty}.`);
      setTimeout(() => setQuantityFeedback(null), 3000);
    } else if (qty < 0) {
      qty = 0;
    }

    if (qty <= 0) {
      toggleArticle(pkg, articleId);
    } else {
      handleUpdatePackage({
        ...pkg,
        articles: pkg.articles.map((a: any) => a.id === articleId ? { ...a, qty } : a)
      });
    }
  };

  const getEstimatedTotal = (pkg: any) => {
    return pkg.articles.reduce((acc: number, art: any) => {
      const catItem = mockCatalog.find(c => c.id === art.id);
      return acc + (catItem ? catItem.price * art.qty : 0);
    }, 0);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${toast.type === 'error' ? 'bg-rose-600' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-600'}`}>
          {toast.message}
        </div>
      )}
      <div className="flex justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestion des Packs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Offres commerciales composées (Matériel & Services)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fas fa-th-large"></i> Grille
            </button>
            <button onClick={() => setViewMode("details")} className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 ${viewMode === 'details' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fas fa-list"></i> Détails
            </button>
          </div>
          <button onClick={handleAddPackage} className="px-4 py-2 bg-tit-600 hover:bg-tit-700 text-white rounded-lg text-sm font-bold transition-colors shadow whitespace-nowrap">
            <i className="fa-solid fa-plus mr-2"></i>Nouveau Pack
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {packages.map(p => (
            <div key={p.id} onClick={() => { setSelectedPkgId(p.id); setViewMode("details"); }} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all flex flex-col cursor-pointer group hover:ring-2 hover:ring-indigo-500" aria-label={`Ouvrir le détail du Pack ${p.name}`} role="button">
              <div className="h-48 bg-slate-100 dark:bg-slate-900 relative">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="fa-solid fa-box text-slate-300 text-5xl"></i>
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1">
                  {p.active === false ? (
                    <span className="bg-slate-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase">Inactif</span>
                  ) : (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase">Actif</span>
                  )}
                </div>
                <div className="absolute top-3 left-3">
                  <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">Offre / Matériel & Services</span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">{p.name}</h3>
                <div className="text-xl font-extrabold text-hah-600 mb-3">{p.price.toLocaleString('fr-FR')} Ar</div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1 line-clamp-2">{p.desc}</p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    <i className="fa-solid fa-layer-group mr-1.5"></i>
                    {p.articles?.length || 0} article(s)
                  </span>
                </div>
              </div>
            </div>
          ))}
          {packages.length === 0 && (
            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <i className="fa-solid fa-boxes-stacked text-4xl mb-4 text-slate-300"></i>
              <p>Aucun pack disponible</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Liste des packs</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {packages.map(p => (
              <div 
                key={p.id} 
                className={`p-4 cursor-pointer transition-colors flex gap-4 items-center ${selectedPkgId === p.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 dark:bg-slate-900/50 border-l-4 border-transparent'} ${p.active === false ? 'opacity-50' : ''}`}
                onClick={() => setSelectedPkgId(p.id)}
              >
                <div className="w-32 h-32 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <i className="fa-solid fa-box text-slate-400 text-4xl"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 whitespace-normal break-words">{p.name}</h3>
                      <div className="flex flex-shrink-0 gap-1 mt-0.5">
                        {p.active === false ? (
                          <span className="status-badge status-inactive">Inactif</span>
                        ) : (
                          <span className="status-badge status-active">Actif</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{p.desc}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-hah-600">{p.price.toLocaleString('fr-FR')} Ar</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">Offre</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic text-sm">Aucun pack disponible</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedPkg ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative">
              <div className="absolute top-6 right-6 flex gap-2">
                <button 
                  className="primary-btn"
                  onClick={() => showToast('Sauvegarde des modifications du pack en cours...', 'info')}
                >
                  <i className="fas fa-save mr-2"></i>Enregistrer
                </button>
              </div>
              <div className="mb-6">
                <p className="eyebrow">Offre Commerciale</p>
                <h2 className="font-bold text-xl text-slate-800 dark:text-slate-100 mt-1">Édition : {selectedPkg.name}</h2>
                <div className="flex gap-2 mt-3">
                  {selectedPkg.active !== false ? (
                    <span className="status-badge status-active">Actif</span>
                  ) : (
                    <span className="status-badge status-inactive">Inactif</span>
                  )}
                  <span className="status-badge status-warning">Matériel & Services</span>
                </div>
              </div>
              
              <div className="mb-6 flex flex-col md:flex-row items-start gap-6">
                <div className="w-48 h-48 bg-slate-100 rounded-xl border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden relative group">
                  {selectedPkg.imageUrl ? (
                    <img src={selectedPkg.imageUrl} alt={selectedPkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <i className="fa-solid fa-image text-slate-300 text-4xl"></i>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom du pack</label>
                  <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm" value={selectedPkg.name} onChange={e => handleUpdatePackage({...selectedPkg, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prix forfaitaire (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm" value={selectedPkg.price} onChange={e => handleUpdatePackage({...selectedPkg, price: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Photo du pack (URL ou Fichier local)</label>
                  <div className="flex flex-col gap-3">
                    <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm" value={selectedPkg.imageUrl || ''} placeholder="https://... (URL externe)" onChange={e => handleUpdatePackage({...selectedPkg, imageUrl: e.target.value})} />
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-bold uppercase">Ou local</span>
                      <div className="flex-1">
                        <input type="file" accept="image/*" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            handleUpdatePackage({ ...selectedPkg, imageUrl: url });
                          }
                        }} />
                      </div>
                      {selectedPkg.imageUrl && (
                        <button type="button" onClick={() => handleUpdatePackage({ ...selectedPkg, imageUrl: '' })} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1">Retirer</button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description courte</label>
                  <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm" value={selectedPkg.desc} onChange={e => handleUpdatePackage({...selectedPkg, desc: e.target.value})} />
                </div>
                  <div className="md:col-span-2 flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                      <input type="checkbox" id="active" checked={selectedPkg.active !== false} onChange={e => handleUpdatePackage({...selectedPkg, active: e.target.checked})} />
                      <label htmlFor="active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Pack actif</label>
                    </div>
                    <div className="flex items-center gap-4">
                      <button className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:text-amber-400" onClick={() => handleDisablePackage(selectedPkg.id)}>
                        Désactiver
                      </button>
                      <button className="text-sm font-medium text-rose-600 hover:text-rose-700" onClick={() => handleDeletePackage(selectedPkg.id)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                {quantityFeedback && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    {quantityFeedback}
                  </div>
                )}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Composition du pack</h3>
                  <div className="flex gap-4 items-center">
                    <button onClick={() => setIsAddMaterialOpen(true)} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold text-sm rounded-lg transition-colors">
                      <i className="fas fa-plus mr-2"></i>Ajouter du matériel
                    </button>
                    <div className="flex flex-col text-sm font-medium text-slate-600 dark:text-slate-400 items-end hidden sm:flex">
                      <div>Total estimé : <span className="font-bold text-slate-900 dark:text-white">{getEstimatedTotal(selectedPkg).toLocaleString('fr-FR')} Ar</span></div>
                      {getEstimatedTotal(selectedPkg) > selectedPkg.price && selectedPkg.price > 0 && (
                        <div className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                          Économie client : <span className="font-bold">{(getEstimatedTotal(selectedPkg) - selectedPkg.price).toLocaleString('fr-FR')} Ar</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                  {selectedPkg.articles.length === 0 && (
                    <div className="p-8 text-center text-slate-500 italic text-sm border-2 border-dashed border-slate-200 rounded-xl">
                      Ce pack ne contient aucun article. <br/><br/>
                      <button onClick={() => setIsAddMaterialOpen(true)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-sm rounded-lg transition-colors">
                        <i className="fas fa-plus mr-2"></i>Ajouter du matériel
                      </button>
                    </div>
                  )}
                  {selectedPkg.articles.map((art: any) => {
                    const item = mockCatalog.find(c => c.id === art.id);
                    if (!item) return null;
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg transition-colors border-indigo-300 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-3 flex-1">
                          <button onClick={() => toggleArticle(selectedPkg, item.id)} className="text-rose-400 hover:text-rose-600 p-1" title="Retirer l'article">
                            <i className="fas fa-trash"></i>
                          </button>
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <i className="fas fa-image text-slate-300 dark:text-slate-600 text-sm"></i>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-800 dark:text-slate-100">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.price.toLocaleString('fr-FR')} Ar / u</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right min-w-[80px]">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Sous-total</div>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{(item.price * (art.qty || 0)).toLocaleString('fr-FR')} Ar</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Qté:</label>
                            <input 
                              type="number" 
                              min="0"
                              className="w-16 border border-slate-300 dark:border-slate-600 rounded p-1 text-sm text-center font-medium"
                              value={art.qty || ''}
                              onChange={e => updateArticleQty(selectedPkg, item.id, parseInt(e.target.value || '0', 10))}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
              <i className="fa-solid fa-boxes-stacked text-4xl mb-4 text-slate-300 dark:text-slate-600"></i>
              <p>Sélectionnez un pack dans la liste pour le modifier</p>
            </div>
          )}
          </div>
        </div>
      )}

      {isAddMaterialOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Ajouter du matériel au pack</h3>
              <button onClick={() => setIsAddMaterialOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <input 
                type="text" 
                placeholder="Rechercher par nom ou code..." 
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
              />
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid gap-3">
              {mockCatalog
                .filter(c => c.name.toLowerCase().includes(materialSearch.toLowerCase()) || c.id.toLowerCase().includes(materialSearch.toLowerCase()))
                .map(item => {
                  const isAlreadyInPack = selectedPkg?.articles.some((a: any) => a.id === item.id);
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-3 border rounded-lg ${isAlreadyInPack ? 'bg-slate-50 opacity-50' : 'hover:border-indigo-300 cursor-pointer'}`} onClick={() => {
                      if (!isAlreadyInPack && selectedPkg) {
                        toggleArticle(selectedPkg, item.id);
                      }
                    }}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <i className="fas fa-image text-slate-400"></i>}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.id} • {item.price.toLocaleString('fr-FR')} Ar / u</div>
                        </div>
                      </div>
                      <div>
                        {isAlreadyInPack ? (
                          <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded">Déjà ajouté</span>
                        ) : (
                          <button className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-bold text-xs">Ajouter</button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
