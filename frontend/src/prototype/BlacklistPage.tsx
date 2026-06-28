import React, { useState } from 'react';
import { hahitantsoaBlockedIntervenants } from './mockData';

const BlacklistPage: React.FC = () => {
  const [intervenants, setIntervenants] = useState(hahitantsoaBlockedIntervenants);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', note: '', active: true });

  const handleEdit = (id: string) => {
    const int = intervenants.find(i => i.id === id);
    if (int) {
      setFormData({ name: int.name, note: int.note, active: int.active });
      setEditingId(id);
      setShowForm(true);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment désactiver ce blocage ?')) {
      setIntervenants(intervenants.map(i => i.id === id ? { ...i, active: false } : i));
    }
  };

  const handleSave = () => {
    if (editingId) {
      setIntervenants(intervenants.map(i => i.id === editingId ? { ...i, ...formData } : i));
    } else {
      const newId = `INT-${intervenants.length + 1}`;
      setIntervenants([...intervenants, { id: newId, ...formData }]);
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', note: '', active: true });
  };

  return (
    <div className="p-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Intervenants Non Autorisés</h1>
          <p className="text-sm text-slate-500">Gérez la liste noire des prestataires interdits dans les locaux Hahitantsoa.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setFormData({ name: '', note: '', active: true }); setShowForm(true); }}
          className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-rose-700 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Bloquer Intervenant
        </button>
      </div>

      {showForm && (
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Modifier Blocage' : 'Nouveau Blocage'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du prestataire / entreprise</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motif / Note interne</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 mt-2">
              <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
              <label htmlFor="active" className="text-sm font-medium text-slate-700">Blocage actif</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg text-sm font-medium" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700" onClick={handleSave}>Enregistrer</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-sm">
              <th className="p-4 font-semibold text-slate-700">Prestataire</th>
              <th className="p-4 font-semibold text-slate-700">Motif</th>
              <th className="p-4 font-semibold text-slate-700">Statut</th>
              <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {intervenants.map(i => (
              <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-4 font-bold text-slate-800">{i.name}</td>
                <td className="p-4 text-sm text-slate-600">{i.note || <span className="italic opacity-50">Aucun motif renseigné</span>}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${i.active ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i.active ? 'Bloqué' : 'Leveé'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 mr-1" onClick={() => handleEdit(i.id)}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="w-8 h-8 rounded-full hover:bg-emerald-100 text-emerald-600" onClick={() => handleDelete(i.id)}>
                    <i className="fa-solid fa-check"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BlacklistPage;
