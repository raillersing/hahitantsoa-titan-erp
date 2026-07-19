import React, { useState, useEffect } from "react";
import { mockVenues } from "./mockData";
import { getHahitantsoaVenues, createHahitantsoaVenue, updateHahitantsoaVenue } from "../api";
import type { HahitantsoaVenue } from "../types";

export default function VenuesPage() {
  const [venues, setVenues] = useState<HahitantsoaVenue[]>(mockVenues);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentVenue, setCurrentVenue] = useState<any>({
    id: "", name: "", type: "location_event", capacity: "", active: true, note: "", price: 0
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    getHahitantsoaVenues(controller.signal)
      .then((apiVenues) => {
        if (isSubscribed && Array.isArray(apiVenues) && apiVenues.length > 0) {
          setVenues(apiVenues);
        }
      })
      .catch(() => {
        // Fallback to mockVenues
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const openModal = (mode: "add" | "edit", venue?: any) => {
    setModalMode(mode);
    if (venue) {
      setCurrentVenue({ ...venue });
    } else {
      setCurrentVenue({ id: `v_${Date.now()}`, name: "", type: "location_event", capacity: "", active: true, note: "", price: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === "add") {
      setVenues([...venues, currentVenue]);
      createHahitantsoaVenue(currentVenue).catch(() => {});
      showToast("Espace enregistré (Ajout)");
    } else {
      setVenues(venues.map(v => v.id === currentVenue.id ? currentVenue : v));
      updateHahitantsoaVenue(currentVenue.id, currentVenue).catch(() => {});
      showToast("Espace enregistré (Modification)");
    }
    setIsModalOpen(false);
  };

  const [deleteVenueId, setDeleteVenueId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setDeleteVenueId(id);
  };

  const confirmDelete = () => {
    if (deleteVenueId) {
      setVenues(venues.filter(v => v.id !== deleteVenueId));
      showToast("Enregistré localement — mock (Suppression)");
      setDeleteVenueId(null);
    }
  };

  const toggleActive = (id: string) => {
    setVenues(venues.map(v => v.id === id ? { ...v, active: !v.active } : v));
  };

  const setDefault = (id: string) => {
    setVenues(venues.map(v => {
      if (v.type === "location_event") {
        return { ...v, isDefault: v.id === id };
      }
      return v;
    }));
  };

  const locationVenues = venues.filter(v => v.type === "location_event");
  const depotVenues = venues.filter(v => v.type === "depot_stock");

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Locaux & Dépôts</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion des lieux de réception et des espaces de stockage.</p>
        </div>
        <button onClick={() => openModal("add")} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 shadow-sm transition-colors">
          <i className="fa-solid fa-plus mr-2"></i> Ajouter un lieu
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Locaux en location</h2>
            <p className="text-xs text-slate-500">Lieux événementiels proposés dans les réservations Hahitantsoa.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-semibold">Nom</th>
                <th className="p-4 font-semibold">Capacité</th>
                <th className="p-4 font-semibold">Usage</th>
                <th className="p-4 font-semibold text-center">Statut</th>
                <th className="p-4 font-semibold text-center">Par défaut</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {locationVenues.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{v.name}</td>
                  <td className="p-4 text-slate-600">{v.capacity || "-"}</td>
                  <td className="p-4 text-slate-600">Location événementielle</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {v.isDefault ? (
                      <span className="text-amber-500" title="Local par défaut"><i className="fa-solid fa-star"></i></span>
                    ) : (
                      <button onClick={() => setDefault(v.id)} className="text-slate-300 hover:text-amber-500 transition-colors" title="Définir par défaut">
                        <i className="fa-regular fa-star"></i>
                      </button>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal("edit", v)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded" title="Modifier"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => toggleActive(v.id)} className={`p-1.5 rounded ${v.active ? 'text-rose-400 hover:text-rose-600' : 'text-emerald-500 hover:text-emerald-700'}`} title={v.active ? 'Désactiver' : 'Activer'}>
                        <i className={`fa-solid ${v.active ? 'fa-power-off' : 'fa-play'}`}></i>
                      </button>
                      <button onClick={() => handleDeleteClick(v.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded" title="Supprimer"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Dépôts internes</h2>
              <p className="text-xs text-slate-500">Lieux de stockage du matériel et de la logistique.</p>
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
            <p className="font-medium">Les dépôts internes ne sont pas proposés à la location. Ils servent uniquement à la logistique et au stock.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-semibold">Nom</th>
                <th className="p-4 font-semibold">Usage</th>
                <th className="p-4 font-semibold">Famille / Note</th>
                <th className="p-4 font-semibold text-center">Statut</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {depotVenues.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{v.name}</td>
                  <td className="p-4 text-slate-600">Stock & Logistique</td>
                  <td className="p-4 text-slate-600">{v.note || "-"}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal("edit", v)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded" title="Modifier"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => toggleActive(v.id)} className={`p-1.5 rounded ${v.active ? 'text-rose-400 hover:text-rose-600' : 'text-emerald-500 hover:text-emerald-700'}`} title={v.active ? 'Désactiver' : 'Activer'}>
                        <i className={`fa-solid ${v.active ? 'fa-power-off' : 'fa-play'}`}></i>
                      </button>
                      <button onClick={() => handleDeleteClick(v.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded" title="Supprimer"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">{modalMode === "add" ? "Ajouter un lieu" : "Modifier le lieu"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du lieu</label>
                <input required type="text" value={currentVenue.name} onChange={e => setCurrentVenue({...currentVenue, name: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Ex: Salle B" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={currentVenue.type} onChange={e => setCurrentVenue({...currentVenue, type: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="location_event">Location événementielle</option>
                  <option value="depot_stock">Dépôt interne (Stock)</option>
                </select>
              </div>
              {currentVenue.type === "location_event" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacité</label>
                      <input type="text" value={currentVenue.capacity || ""} onChange={e => setCurrentVenue({...currentVenue, capacity: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 100 pax" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix de base (Ar)</label>
                      <input type="number" value={currentVenue.price || 0} onChange={e => setCurrentVenue({...currentVenue, price: parseInt(e.target.value || "0")})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Famille / Note</label>
                  <input type="text" value={currentVenue.note || ""} onChange={e => setCurrentVenue({...currentVenue, note: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Matériel de décoration" />
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="activeStatus" checked={currentVenue.active} onChange={e => setCurrentVenue({...currentVenue, active: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                <label htmlFor="activeStatus" className="text-sm font-medium text-slate-700">Lieu actif</label>
              </div>
              <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteVenueId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50">
              <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i> Supprimer
              </h3>
              <button onClick={() => setDeleteVenueId(null)} className="text-rose-400 hover:text-rose-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">Êtes-vous sûr de vouloir supprimer ce lieu ? Cette action est simulée mais définitive dans la session.</p>
              <div className="pt-4 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setDeleteVenueId(null)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 text-white font-medium text-sm hover:bg-rose-700 rounded-lg transition-colors shadow-sm">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
