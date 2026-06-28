import React, { useState } from 'react';
import { hahitantsoaMockServices } from './mockData';

const ServicesPage: React.FC = () => {
  const [services, setServices] = useState(hahitantsoaMockServices.map(s => ({...s, active: true})));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', desc: '', price: 0, active: true });

  const handleEdit = (id: string) => {
    const srv = services.find(s => s.id === id);
    if (srv) {
      setFormData({ name: srv.name, desc: srv.desc, price: srv.price, active: srv.active });
      setEditingId(id);
      setShowForm(true);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment désactiver ce service ?')) {
      setServices(services.map(s => s.id === id ? { ...s, active: false } : s));
    }
  };

  const handleSave = () => {
    if (editingId) {
      setServices(services.map(s => s.id === editingId ? { ...s, ...formData } : s));
    } else {
      const newId = `SRV-H${services.length + 1}`;
      setServices([...services, { id: newId, ...formData }]);
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', desc: '', price: 0, active: true });
  };

  return (
    <div className="p-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Services Hahitantsoa</h1>
          <p className="text-sm text-slate-500">Gérez le catalogue des services optionnels pour les événements.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setFormData({ name: '', desc: '', price: 0, active: true }); setShowForm(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Nouveau Service
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Modifier Service' : 'Nouveau Service'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du service</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prix par défaut (Ar)</label>
              <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value || '0', 10)})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 mt-2">
              <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} />
              <label htmlFor="active" className="text-sm font-medium text-slate-700">Service actif</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700" onClick={handleSave}>Enregistrer</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-sm">
              <th className="p-4 font-semibold text-slate-700">Nom</th>
              <th className="p-4 font-semibold text-slate-700">Description</th>
              <th className="p-4 font-semibold text-slate-700">Prix par défaut</th>
              <th className="p-4 font-semibold text-slate-700">Statut</th>
              <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.id} • Exclusif Hahitantsoa</div>
                </td>
                <td className="p-4 text-sm text-slate-600">{s.desc}</td>
                <td className="p-4 font-bold text-indigo-600">{s.price.toLocaleString('fr-FR')} Ar</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {s.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 mr-1" onClick={() => handleEdit(s.id)}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="w-8 h-8 rounded-full hover:bg-rose-100 text-rose-500" onClick={() => handleDelete(s.id)}>
                    <i className="fa-solid fa-ban"></i>
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

export default ServicesPage;
