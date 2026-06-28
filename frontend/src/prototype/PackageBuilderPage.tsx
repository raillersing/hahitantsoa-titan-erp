import React, { useState } from "react";
import { hahitantsoaMockPackages, mockCatalog } from "./mockData";

export default function PackageBuilderPage() {
  const [packages, setPackages] = useState(hahitantsoaMockPackages);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  
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
  };

  const handleUpdatePackage = (updatedPkg: any) => {
    setPackages(packages.map(p => p.id === updatedPkg.id ? updatedPkg : p));
  };

  const handleDeletePackage = (id: string) => {
    if (confirm("Voulez-vous vraiment désactiver ce package ?")) {
      setPackages(packages.map(p => p.id === id ? { ...p, active: false } : p));
    }
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

  const updateArticleQty = (pkg: any, articleId: string, qty: number) => {
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Packages</h1>
          <p className="text-sm text-slate-500">Créez et modifiez les packages pour Hahitantsoa</p>
        </div>
        <button onClick={handleAddPackage} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm">
          <i className="fa-solid fa-plus mr-2"></i>Nouveau Package
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700">Liste des packages</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {packages.map(p => (
              <div 
                key={p.id} 
                className={`p-4 cursor-pointer transition-colors flex gap-4 items-center ${selectedPkgId === p.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 border-l-4 border-transparent'} ${p.active === false ? 'opacity-50' : ''}`}
                onClick={() => setSelectedPkgId(p.id)}
              >
                <div className="w-16 h-16 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <i className="fa-solid fa-box text-slate-400 text-xl"></i>}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    {p.active === false && <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Inactif</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">{p.desc}</p>
                  <div className="mt-1 text-sm font-semibold text-indigo-600">{p.price.toLocaleString('fr-FR')} Ar</div>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic text-sm">Aucun package disponible</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedPkg ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="font-bold text-xl text-slate-800 mb-6">Édition : {selectedPkg.name}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom du package</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={selectedPkg.name} onChange={e => handleUpdatePackage({...selectedPkg, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix forfaitaire (Ar)</label>
                  <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={selectedPkg.price} onChange={e => handleUpdatePackage({...selectedPkg, price: parseInt(e.target.value || '0', 10)})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL de l'image (optionnel)</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={selectedPkg.imageUrl || ''} placeholder="/brand/packages/example.jpg" onChange={e => handleUpdatePackage({...selectedPkg, imageUrl: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description courte</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={selectedPkg.desc} onChange={e => handleUpdatePackage({...selectedPkg, desc: e.target.value})} />
                </div>
                <div className="md:col-span-2 flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="active" checked={selectedPkg.active !== false} onChange={e => handleUpdatePackage({...selectedPkg, active: e.target.checked})} />
                    <label htmlFor="active" className="text-sm font-medium text-slate-700">Package actif</label>
                  </div>
                  <button className="text-sm font-medium text-rose-600 hover:text-rose-700" onClick={() => handleDeletePackage(selectedPkg.id)}>
                    Désactiver / Supprimer
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700">Composition du package</h3>
                  <div className="text-sm font-medium text-slate-600">
                    Total articles estimé : <span className="font-bold text-slate-900">{getEstimatedTotal(selectedPkg).toLocaleString('fr-FR')} Ar</span>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                  {mockCatalog.map(item => {
                    const art = selectedPkg.articles.find((a: any) => a.id === item.id);
                    const isSelected = !!art;
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isSelected ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-white opacity-60'}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded" checked={isSelected} onChange={() => toggleArticle(selectedPkg, item.id)} />
                          <div>
                            <div className="font-medium text-sm text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.price.toLocaleString('fr-FR')} Ar / u</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-500">Qté:</label>
                            <input 
                              type="number" 
                              min="0"
                              className="w-16 border border-slate-300 rounded p-1 text-sm text-center"
                              value={art.qty || ''}
                              onChange={e => updateArticleQty(selectedPkg, item.id, parseInt(e.target.value || '0', 10))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center justify-center h-full text-slate-400">
              <i className="fa-solid fa-box-open text-4xl mb-4 text-slate-300"></i>
              <p>Sélectionnez un package dans la liste pour le modifier</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
