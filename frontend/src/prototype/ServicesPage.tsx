import React, { useState, useEffect, useMemo } from 'react';
import { ApiError, getHahitantsoaServices, createHahitantsoaService, updateHahitantsoaService } from '../api';
import type { HahitantsoaService, HahitantsoaServiceCategory, HahitantsoaServicePricingType } from '../types';

const CATEGORIES: Array<{ key: HahitantsoaServiceCategory | 'all'; label: string; icon: string }> = [
  { key: 'all', label: 'Toutes les offres', icon: 'fa-layer-group' },
  { key: 'drapery', label: 'Draperie & Voilage', icon: 'fa-ribbon' },
  { key: 'starry_sky', label: 'Ciels Étoilés', icon: 'fa-star' },
  { key: 'scenography', label: 'Piste LED & Scéno', icon: 'fa-gem' },
  { key: 'special_effects', label: 'Effets Spéciaux', icon: 'fa-wand-magic-sparkles' },
  { key: 'technical_facility', label: 'Prestations Techniques', icon: 'fa-wrench' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  drapery: { bg: 'bg-rose-50 text-rose-700', text: 'text-rose-700', border: 'border-rose-200' },
  starry_sky: { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200' },
  scenography: { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', border: 'border-purple-200' },
  special_effects: { bg: 'bg-cyan-50 text-cyan-700', text: 'text-cyan-700', border: 'border-cyan-200' },
  technical_facility: { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', border: 'border-slate-200' },
  other: { bg: 'bg-gray-100 text-gray-700', text: 'text-gray-700', border: 'border-gray-200' },
};

const CATEGORY_BANNERS: Record<string, string> = {
  drapery: 'from-rose-500/20 via-pink-400/10 to-amber-200/20',
  starry_sky: 'from-amber-500/20 via-yellow-400/10 to-slate-900/40',
  scenography: 'from-indigo-600/25 via-purple-500/20 to-blue-400/20',
  special_effects: 'from-cyan-500/20 via-sky-400/15 to-indigo-900/30',
  technical_facility: 'from-slate-700/20 via-zinc-500/15 to-slate-200/20',
  other: 'from-slate-500/10 to-slate-200/20',
};

const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<HahitantsoaService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<HahitantsoaServiceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const initialForm = {
    name: '',
    category: 'drapery' as HahitantsoaServiceCategory,
    pricing_type: 'flat_fee' as HahitantsoaServicePricingType,
    price: 0,
    unit_label: '',
    desc: '',
    image_url: '',
    features_raw: '',
    is_external_fee: false,
    active: true,
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    getHahitantsoaServices(controller.signal)
      .then((apiServices) => {
        if (isSubscribed && Array.isArray(apiServices)) {
          setServices(apiServices);
        }
      })
      .catch(() => {
        if (isSubscribed) setServices([]);
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, []);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (service: HahitantsoaService) => {
    setFormData({
      name: service.name,
      category: service.category || 'other',
      pricing_type: service.pricing_type || 'flat_fee',
      price: Number(service.price) || 0,
      unit_label: service.unit_label || '',
      desc: service.desc || '',
      image_url: service.image_url || '',
      features_raw: Array.isArray(service.features) ? service.features.join(', ') : '',
      is_external_fee: !!service.is_external_fee,
      active: service.active !== false,
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  const handleToggleActive = async (service: HahitantsoaService) => {
    try {
      const nextActive = !service.active;
      const saved = await updateHahitantsoaService(service.id, { active: nextActive });
      setServices((current) => current.map((s) => (s.id === service.id ? saved : s)));
      showToast(nextActive ? 'Prestation activée.' : 'Prestation désactivée.', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "L'action a échoué.", 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('Le nom de la prestation est requis.', 'warning');
      return;
    }

    const features = formData.features_raw
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      pricing_type: formData.pricing_type,
      price: Number(formData.price) || 0,
      unit_label: formData.unit_label.trim(),
      desc: formData.desc.trim(),
      image_url: formData.image_url.trim(),
      features,
      is_external_fee: formData.is_external_fee,
      active: formData.active,
    };

    try {
      if (editingId) {
        const saved = await updateHahitantsoaService(editingId, payload);
        setServices((current) => current.map((s) => (s.id === editingId ? saved : s)));
        showToast('Prestation modifiée avec succès.', 'success');
      } else {
        const saved = await createHahitantsoaService(payload);
        setServices((current) => [...current, saved]);
        showToast('Nouvelle prestation créée.', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'La sauvegarde a échoué.', 'error');
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [services, selectedCategory, searchQuery]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: services.length };
    for (const s of services) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [services]);

  const formatPriceDisplay = (service: HahitantsoaService) => {
    const p = Number(service.price || 0).toLocaleString('fr-FR');
    if (service.pricing_type === 'on_quote') return 'Sur devis';
    if (service.pricing_type === 'per_line') return `${p} Ar / ligne`;
    if (service.pricing_type === 'per_unit') return `${p} Ar / ${service.unit_label || 'unité'}`;
    return `${p} Ar`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Navigation Hub Hahitantsoa */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        <a
          href="#services"
          className="border-b-2 border-indigo-600 px-4 py-3 text-sm font-bold text-indigo-600 flex items-center gap-2"
        >
          <i className="fas fa-magic"></i>
          <span>Catalogue Visuel des Prestations & Scénographies</span>
        </a>
        <a
          href="#hahitantsoa-settings"
          className="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2"
        >
          <i className="fas fa-sliders"></i>
          <span>Tarifs & Règles de Base Hahitantsoa</span>
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-hah-700">Domaine Hahitantsoa • Offres 2026</p>
          <h1 className="text-2xl font-black text-slate-900">Catalogue des Prestations & Scénographies</h1>
          <p className="text-sm text-slate-500">
            Draperie, ciels étoilés, piste LED, effets spéciaux et prestations techniques illustrées avec photos et tarification.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(initialForm);
            setShowForm(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 self-start md:self-auto"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Nouvelle Prestation</span>
        </button>
      </div>

      {/* Categories Tabs */}
      <div className="flex flex-wrap gap-2 pt-2 border-b border-slate-100 pb-3">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          const count = countByCategory[cat.key] || 0;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <i className={`fa-solid ${cat.icon}`}></i>
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & View Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <i className="fa-solid fa-search absolute left-3.5 top-3 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder="Rechercher une prestation, un effet, un voilage..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 mr-2">{filteredServices.length} prestation(s)</span>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-grip mr-1.5"></i>Galerie
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-list mr-1.5"></i>Tableau
            </button>
          </div>
        </div>
      </div>

      {/* Modal / Form */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Modifier la prestation scénographique' : 'Ajouter une prestation au catalogue'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom de la prestation *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Voilage cascade, Flocon centré classique, Piste lumineuse LED"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as HahitantsoaServiceCategory })}
                >
                  <option value="drapery">🎀 Draperie & Voilage</option>
                  <option value="starry_sky">✨ Ciel Étoilé</option>
                  <option value="scenography">🪩 Piste LED & Scénographie</option>
                  <option value="special_effects">🎆 Effets Spéciaux</option>
                  <option value="technical_facility">🛠️ Prestations Techniques</option>
                  <option value="other">🏷️ Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Facturation</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white"
                  value={formData.pricing_type}
                  onChange={(e) => setFormData({ ...formData, pricing_type: e.target.value as HahitantsoaServicePricingType })}
                >
                  <option value="flat_fee">Forfait fixe (événement)</option>
                  <option value="per_line">À la ligne (ex: Guinguette)</option>
                  <option value="per_unit">À l'unité (ex: Voile d'ombrage)</option>
                  <option value="on_quote">Sur devis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prix par défaut (Ariary)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value || '0', 10) })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Libellé d'unité (optionnel)</label>
                <input
                  type="text"
                  placeholder="ex: ligne, unité, pièce"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  value={formData.unit_label}
                  onChange={(e) => setFormData({ ...formData, unit_label: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">URL de la photo ou aperçu visuel</label>
                <input
                  type="text"
                  placeholder="https://... ou /brand/services/voilage.jpg"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
                {formData.image_url && (
                  <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden w-full h-32 bg-slate-100 relative">
                    <img
                      src={formData.image_url}
                      alt="Prévisualisation"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description commerciale</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  placeholder="Atmosphère, rendu esthétique, détails de pose..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Caractéristiques & Options clés (séparées par des virgules)
                </label>
                <input
                  type="text"
                  placeholder="ex: Disponible en blanc, Blanc chaud / blanc froid, 30 kVA"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  value={formData.features_raw}
                  onChange={(e) => setFormData({ ...formData, features_raw: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="external_fee"
                  checked={formData.is_external_fee}
                  onChange={(e) => setFormData({ ...formData, is_external_fee: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="external_fee" className="text-xs font-semibold text-slate-700">
                  Droit régie / prestataire externe
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="service_active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="service_active" className="text-xs font-semibold text-slate-700">
                  Prestation active au catalogue
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                onClick={handleSave}
              >
                Enregistrer la prestation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-medium">Chargement du catalogue des offres...</div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <i className="fa-solid fa-folder-open text-4xl text-slate-300 mb-3"></i>
          <h3 className="text-base font-bold text-slate-800">Aucune prestation trouvée</h3>
          <p className="text-xs text-slate-500 mt-1">Modifiez vos critères de recherche ou ajoutez une nouvelle prestation.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GALLERY VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const catColor = CATEGORY_COLORS[service.category] || CATEGORY_COLORS.other;
            const bannerGradient = CATEGORY_BANNERS[service.category] || CATEGORY_BANNERS.other;

            return (
              <div
                key={service.id}
                className={`bg-white rounded-2xl border ${
                  service.active ? 'border-slate-200' : 'border-slate-200 opacity-60'
                } shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group`}
              >
                {/* Visual Image / Banner */}
                <div className={`h-44 w-full relative bg-gradient-to-br ${bannerGradient} flex items-center justify-center overflow-hidden`}>
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-white/70 backdrop-blur-xs flex items-center justify-center mx-auto mb-2 text-indigo-600 shadow-xs">
                        <i className={`fa-solid ${
                          service.category === 'drapery' ? 'fa-ribbon' :
                          service.category === 'starry_sky' ? 'fa-star' :
                          service.category === 'scenography' ? 'fa-gem' :
                          service.category === 'special_effects' ? 'fa-wand-magic-sparkles' :
                          'fa-wrench'
                        } text-xl`}></i>
                      </div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 bg-white/80 px-2 py-0.5 rounded-full">
                        {service.category_display || service.category}
                      </span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-xs ${catColor.bg}`}>
                      {service.category_display || service.category}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {service.is_external_fee && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        Externe
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                      service.active ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {service.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {service.desc || 'Prestation officielle Hahitantsoa 2026.'}
                    </p>

                    {/* Features Tags */}
                    {Array.isArray(service.features) && service.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {service.features.map((f, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Price & Actions */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tarif officiel</span>
                      <span className="text-base font-black text-indigo-600">
                        {formatPriceDisplay(service)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Modifier la prestation"
                        onClick={() => handleEdit(service)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors text-xs"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        title={service.active ? 'Désactiver' : 'Activer'}
                        onClick={() => handleToggleActive(service)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-xs ${
                          service.active ? 'bg-slate-100 hover:bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        <i className={`fa-solid ${service.active ? 'fa-ban' : 'fa-check'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Prestation</th>
                <th className="p-4">Catégorie</th>
                <th className="p-4">Tarif Officiel</th>
                <th className="p-4">Caractéristiques</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1 max-w-sm">{s.desc}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      CATEGORY_COLORS[s.category]?.bg || CATEGORY_COLORS.other.bg
                    }`}>
                      {s.category_display || s.category}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-indigo-600">
                    {formatPriceDisplay(s)}
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    {Array.isArray(s.features) ? s.features.join(' • ') : '—'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {s.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        className="w-7 h-7 rounded hover:bg-slate-200 text-slate-600 text-xs flex items-center justify-center"
                        onClick={() => handleEdit(s)}
                        title="Modifier"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        className={`w-7 h-7 rounded text-xs flex items-center justify-center ${
                          s.active ? 'hover:bg-rose-100 text-rose-500' : 'hover:bg-emerald-100 text-emerald-600'
                        }`}
                        onClick={() => handleToggleActive(s)}
                        title={s.active ? 'Désactiver' : 'Activer'}
                      >
                        <i className={`fa-solid ${s.active ? 'fa-ban' : 'fa-check'}`}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-white'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
