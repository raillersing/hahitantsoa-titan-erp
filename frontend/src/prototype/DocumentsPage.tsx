import React, { useState, useEffect } from "react";
import { AppScope } from "../App";
import {
  mockDocumentTemplates,
  MockCommercialDocumentTemplate,
} from "./mockData";
import { DocumentPreview } from "./DocumentPreview";

const VARIABLE_DICTIONARY = [
  { key: 'client.name', label: 'Nom complet du client', desc: 'Nom complet du client' },
  { key: 'client.address', label: 'Adresse de facturation', desc: 'Adresse de facturation' },
  { key: 'dossier.ref', label: 'Numéro de dossier', desc: 'Référence unique du dossier' },
  { key: 'event.date', label: 'Date de l\'événement', desc: 'Date prévue de l\'événement' },
  { key: 'event.venue', label: 'Lieu', desc: 'Lieu de l\'événement' },
  { key: 'event.usage', label: 'Type d\'usage', desc: 'Type d\'événement' },
  { key: 'finance.totalAmount', label: 'Montant total', desc: 'Montant total TTC' },
  { key: 'finance.depositAmount', label: 'Acompte', desc: 'Acompte versé' },
  { key: 'finance.balanceAmount', label: 'Solde', desc: 'Reste à payer' },
  { key: 'finance.cautionAmount', label: 'Caution', desc: 'Dépôt de garantie' },
  { key: 'inventory.articles', label: 'Articles', desc: 'Liste des articles' },
  { key: 'inventory.packs', label: 'Packs', desc: 'Liste des packs' },
  { key: 'logistics.deliveryDate', label: 'Date de livraison', desc: 'Date de livraison' },
  { key: 'logistics.returnDate', label: 'Date de reprise', desc: 'Date de récupération' },
  { key: 'company.name', label: 'Nom société', desc: 'Nom de notre société' },
  { key: 'document.date', label: 'Date édition', desc: 'Date d\'édition' },
  { key: 'document.total', label: 'Montant total', desc: 'Montant total TTC' },
  { key: 'reservation.start_date', label: 'Date de début', desc: 'Date de début de location' }
];

const normalizeDocumentContent = (content: any) => {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'string') {
        const doubleParsed = JSON.parse(parsed);
        if (Array.isArray(doubleParsed)) return doubleParsed;
        return [{ id: "b1", type: "Paragraphe", text: doubleParsed || "" }];
      }
      if (Array.isArray(parsed)) return parsed;
      return [{ id: "b1", type: "Paragraphe", text: content }];
    } catch (e) {
      return [{ id: "b1", type: "Paragraphe", text: content }];
    }
  }
  return [];
};


interface DocumentsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const VOLETS = ["Hahitantsoa", "Titan", "Commun"];
const COMMERCIAL_TYPES = ["Avenant", "Bon de livraison", "Constat casse/perte", "Contrat", "Facture", "Proforma", "Bon de retour"];

export default function DocumentsPage({ onNavigate }: DocumentsPageProps) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState("templates");
  const [editorTab, setEditorTab] = useState("1. Informations générales");
  const [templates, setTemplates] = useState<MockCommercialDocumentTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [voletFilter, setVoletFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");

  const [currentDoc, setCurrentDoc] = useState<Partial<MockCommercialDocumentTemplate> | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("mock_templates");
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch (e) {
        setTemplates(mockDocumentTemplates);
      }
    } else {
      setTemplates(mockDocumentTemplates);
    }
    setIsLoaded(true);
  }, []);

  if (!isLoaded) return null;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const saveTemplates = (newTemplates: MockCommercialDocumentTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem("mock_templates", JSON.stringify(newTemplates));
  };

  const filteredTemplates = (templates || []).filter(t => {
    if (search && !t.name.toLowerCase().includes(search.trim().toLowerCase()) && !t.code.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (voletFilter !== "Tous" && t.volet !== voletFilter) return false;
    if (typeFilter !== "Tous" && t.type !== typeFilter) return false;
    return true;
  });

  const handleNew = () => {
    setCurrentDoc({
      id: "NEW-" + Date.now(),
      name: "",
      code: "",
      family: "Documents commerciaux",
      volet: "Commun",
      type: "Contrat",
      status: "Brouillon",
      version: 1
    });
    setBlocks([]);
    setEditorTab("1. Informations générales");
    setView('editor');
    setErrorMsg(null);
  };

  const handleEdit = (t: MockCommercialDocumentTemplate) => {
    setCurrentDoc({ ...t });
    setBlocks(normalizeDocumentContent(t.content));
    setEditorTab("1. Informations générales");
    setView('editor');
    setErrorMsg(null);
  };

  const handleDuplicate = (t: MockCommercialDocumentTemplate) => {
    setCurrentDoc({
      ...t,
      id: "NEW-" + Date.now(),
      name: t.name + " (Copie)",
      code: t.code + "-COPY",
      status: "Brouillon",
      version: 1
    });
    setBlocks(normalizeDocumentContent(t.content));
    setEditorTab("1. Informations générales");
    setView('editor');
    setErrorMsg(null);
    showToast("Modèle dupliqué avec succès.");
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      const docToDelete = templates.find(t => t.id === deleteConfirm) || currentDoc;
      if (docToDelete && docToDelete.status === 'Actif') {
        setErrorMsg("Un modèle actif ne peut pas être supprimé. Veuillez l'archiver d'abord.");
        setDeleteConfirm(null);
        return;
      }
      const newTemplates = templates.filter(t => t.id !== deleteConfirm);
      saveTemplates(newTemplates);
      setDeleteConfirm(null);
      setView('list');
      showToast("Modèle supprimé.");
    }
  };

  const handleSave = () => {
    if (!currentDoc) return;

    if (currentDoc.status === 'Actif') {
      const hasActive = (templates || []).some(t => t.code === currentDoc.code && t.status === 'Actif' && t.id !== currentDoc.id);
      if (hasActive) {
        setErrorMsg("Une version active existe déjà pour ce code.");
        return;
      }
    }

    const isDuplicateCode = (templates || []).some(t => t.code === currentDoc.code && t.id !== currentDoc.id);
    if (isDuplicateCode) {
      setErrorMsg("Ce code existe déjà pour un autre modèle.");
      return;
    }

    const newTemplates = [...(templates || [])];
    const existingIdx = newTemplates.findIndex(t => t.id === currentDoc.id);
    const finalDoc = {
      ...currentDoc,
      content: JSON.stringify(blocks),
      variables: currentDoc.variables || [],
      author: currentDoc.author || "Admin"
    } as MockCommercialDocumentTemplate;

    if (existingIdx >= 0) {
      newTemplates[existingIdx] = finalDoc;
    } else {
      newTemplates.push(finalDoc);
    }

    saveTemplates(newTemplates);
    setErrorMsg(null);
    showToast("Modèle enregistré avec succès.");
  };

  const insertVariable = (v: string) => {
    if (blocks.length > 0) {
      const newBlocks = [...blocks];
      newBlocks[0].text = (newBlocks[0].text || newBlocks[0].content || '') + `{{${v}}}`;
      newBlocks[0].content = newBlocks[0].text;
      setBlocks(newBlocks);
    } else {
      setBlocks([{ id: "b1", type: "Paragraphe", text: `{{${v}}}` }]);
    }
    setEditorTab('2. Contenu');
    showToast(`Variable ${v} insérée.`);
  };

  const currentTypes = COMMERCIAL_TYPES.filter(t => currentDoc?.volet === 'Titan' ? t !== 'Avenant' : true);

  return (
    <div className="page active space-y-6 relative pb-10">
      {view === 'list' && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Documents & Modèles</h2>
              <p className="text-sm text-slate-500">Gestion des modèles PDF, conditions générales et documents types.</p>
            </div>
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-colors"
                onClick={() => { handleNew(); setEditorTab('4. Importer'); }}
              >
                <i className="fas fa-file-import mr-2"></i>Importer
              </button>
              <button 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                onClick={handleNew}
              >
                <i className="fas fa-file-circle-plus mr-2"></i>Nouveau modèle
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap gap-4 items-center bg-slate-50">
              <div className="relative flex-1 min-w-[250px]">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type="search" 
                  placeholder="Rechercher par nom ou code..." 
                  className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
                {search && (
                  <button 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setSearch("")}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
              <select 
                className="py-2 pl-3 pr-8 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={voletFilter} 
                onChange={e => setVoletFilter(e.target.value)}
              >
                <option value="Tous">Tous les volets</option>
                {VOLETS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select 
                className="py-2 pl-3 pr-8 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={typeFilter} 
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="Tous">Tous les types</option>
                {COMMERCIAL_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-white">
                  <th className="py-3 px-6">Titre du document</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4 text-center">Dernière modif.</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm bg-white">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <i className="fas fa-folder-open text-4xl mb-4 text-slate-300 block"></i>
                      Aucun modèle ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 cursor-pointer group transition-colors" onClick={() => handleEdit(t)}>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{t.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <span className="font-mono text-slate-400">{t.code}</span>
                          <span>•</span>
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{t.volet}</span>
                          <span>•</span>
                          <span>{t.type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-slate-600 text-xs">
                        v{t.version || 1}.0
                      </td>
                      <td className="py-4 px-4 text-center text-slate-600 text-xs">
                        {new Date().toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          t.status === 'Actif' ? 'bg-emerald-100 text-emerald-700' :
                          t.status === 'Brouillon' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            className="w-8 h-8 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center" 
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }} 
                            title="Dupliquer le modèle"
                          >
                            <i className="fas fa-copy"></i>
                          </button>
                          <button 
                            className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (t.status === 'Actif') {
                                showToast("Archivage requis pour un modèle actif.");
                              } else {
                                setDeleteConfirm(t.id!); 
                              }
                            }} 
                            title={t.status === 'Actif' ? "Archivage requis" : "Supprimer"}
                          >
                            <i className={t.status === 'Actif' ? "fas fa-archive" : "fas fa-trash"}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'editor' && currentDoc && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center shadow-sm font-medium"
                onClick={() => setView('list')}
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Documents & Modèles
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-slate-800 leading-none">
                    {currentDoc.name || "Nouveau modèle"} {currentDoc.version ? `/ v${currentDoc.version}` : ''}
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                    currentDoc.status === 'Actif' ? 'bg-emerald-100 text-emerald-700' :
                    currentDoc.status === 'Brouillon' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {currentDoc.status}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    v{currentDoc.version || 1}.0
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="font-mono font-medium">{currentDoc.code || "CODE-MANQUANT"}</span>
                  <span>•</span>
                  <span>{currentDoc.volet}</span>
                  <span>•</span>
                  <span>{currentDoc.type}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentDoc.id && (
                <button 
                  className="px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => currentDoc.status === 'Actif' ? showToast("Désactivez le modèle pour pouvoir le supprimer.") : setDeleteConfirm(currentDoc.id!)}
                >
                  <i className={currentDoc.status === 'Actif' ? "fas fa-lock" : "fas fa-trash-alt"}></i>
                  {currentDoc.status === 'Actif' ? "Suppression verrouillée" : "Supprimer le modèle"}
                </button>
              )}
              <button 
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2"
                onClick={handleSave}
              >
                <i className="fas fa-save"></i>
                Enregistrer
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex overflow-x-auto hide-scrollbar gap-1" role="tablist">
            {['1. Informations générales', '2. Contenu', '3. Variables', '4. Importer', '5. Prévisualisation', '6. Versions'].map(tab => (
              <button 
                key={tab} 
                role="tab" 
                aria-selected={editorTab === tab} 
                onClick={() => setEditorTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                  editorTab === tab 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 min-h-[500px]">
            {errorMsg && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3">
                <i className="fas fa-exclamation-triangle"></i>
                <span className="font-medium text-sm">{errorMsg}</span>
              </div>
            )}

            {editorTab === '1. Informations générales' && (
              <div className="max-w-3xl space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nom du modèle</label>
                    <input 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      placeholder="Ex: Contrat de location Standard" 
                      value={currentDoc.name} 
                      onChange={e => setCurrentDoc({...currentDoc, name: e.target.value})} 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Code unique</label>
                    <input 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm uppercase"
                      placeholder="Ex: CONTRAT-STD" 
                      value={currentDoc.code} 
                      onChange={e => setCurrentDoc({...currentDoc, code: e.target.value.toUpperCase()})} 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Famille</label>
                    <select className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500" disabled>
                      <option>Documents commerciaux</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Volet métier</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={currentDoc.volet} 
                      onChange={e => setCurrentDoc({...currentDoc, volet: e.target.value as any})}
                    >
                      {VOLETS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Type de document</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={currentDoc.type} 
                      onChange={e => setCurrentDoc({...currentDoc, type: e.target.value as any})}
                    >
                      {currentTypes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-800 text-base mb-1">Statut du modèle</div>
                      <div className="text-sm text-slate-500">Activer ce modèle pour le rendre disponible lors de la génération de documents.</div>
                    </div>
                    <button 
                      role="switch" 
                      aria-checked={currentDoc.status === 'Actif'} 
                      onClick={() => setCurrentDoc({...currentDoc, status: currentDoc.status === 'Actif' ? 'Brouillon' : 'Actif'})}
                      className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${currentDoc.status === 'Actif' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform shadow-sm ${currentDoc.status === 'Actif' ? 'translate-x-6' : 'translate-x-0'}`}></span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {editorTab === '2. Contenu' && (
              <div className="grid grid-cols-12 gap-8 h-full min-h-[500px]">
                <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col h-full border-b lg:border-b-0 lg:border-r border-slate-100 pb-8 lg:pb-0 lg:pr-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Éditeur structuré</h3>
                    <div className="flex gap-2">
                      <button 
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        onClick={() => setBlocks([...blocks, {id: "b"+Date.now(), type: "Paragraphe", text: ""}])}
                      >
                        <i className="fas fa-align-left"></i> + Paragraphe
                      </button>
                      <button 
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        onClick={() => setBlocks([...blocks, {id: "b"+Date.now(), type: "Titre", text: ""}])}
                      >
                        <i className="fas fa-heading"></i> + Titre
                      </button>
                      <button 
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        onClick={() => setBlocks([...blocks, {id: "b"+Date.now(), type: "Tableau articles/packs"}])}
                      >
                        <i className="fas fa-table"></i> + Tableau
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    {blocks.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
                        <i className="fas fa-layer-group text-3xl mb-3 text-slate-300"></i>
                        <p className="text-sm font-medium">Aucun bloc dans ce document.</p>
                      </div>
                    ) : (
                      blocks.map((b, i) => (
                        <div key={b.id} className="group relative bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm flex items-start gap-3 hover:border-indigo-300 hover:shadow transition-all focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                          <div className="flex flex-col gap-1 p-2 bg-slate-50 rounded-lg shrink-0">
                            <button className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition-colors" title="Monter">
                              <i className="fas fa-arrow-up text-xs"></i>
                            </button>
                            <div className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest leading-none py-1">{b.type.substring(0,3)}</div>
                            <button className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition-colors" title="Descendre">
                              <i className="fas fa-arrow-down text-xs"></i>
                            </button>
                          </div>
                          {b.type === 'Tableau articles/packs' || b.type === 'Tableau' ? (
                            <div className="flex-1 py-3 text-sm text-slate-500 italic">Tableau généré automatiquement</div>
                          ) : (
                            <textarea 
                              className="flex-1 w-full min-h-[90px] py-3 pr-4 text-sm text-slate-800 bg-transparent outline-none resize-y"
                              placeholder={b.type === 'Titre' || b.type === 'title' ? "Titre de section..." : "Saisissez votre contenu ou insérez des variables..."} 
                              value={b.text || b.content || ''} 
                              onChange={e => {
                                const nb = [...blocks];
                                nb[i].text = e.target.value;
                                nb[i].content = e.target.value;
                                setBlocks(nb);
                              }} 
                            />
                          )}
                          <button 
                            className="absolute -right-2.5 -top-2.5 w-6 h-6 bg-white border border-slate-200 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm flex items-center justify-center"
                            onClick={() => setBlocks(blocks.filter((_, idx) => idx !== i))}
                            title="Supprimer ce bloc"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col h-full min-h-[400px]">
                   <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><i className="fas fa-file-pdf text-rose-500"></i>Aperçu rendu</h3>
                   <div className="flex-1 bg-slate-100 rounded-xl p-4 sm:p-6 lg:p-8 overflow-y-auto shadow-inner">
                      <div className="bg-white min-h-full rounded shadow-sm border border-slate-200 p-6 sm:p-8 text-sm text-slate-800 space-y-4">
                        {blocks.map(b => (
                          <div key={'preview-'+b.id}>
                            {b.type === 'Titre' || b.type === 'title' ? (
                              <h4 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-4">{b.text || b.content || 'Titre de section'}</h4>
                            ) : b.type === 'Tableau articles/packs' || b.type === 'Tableau' ? (
                              <table className="w-full border-collapse border border-slate-300 mb-6 text-xs">
                                <thead><tr className="bg-slate-100"><th className="border p-2 text-left">Désignation</th><th className="border p-2">Qté</th><th className="border p-2 text-right">Total</th></tr></thead>
                                <tbody><tr><td className="border p-2 text-slate-400 italic">Articles mock</td><td className="border p-2 text-center">-</td><td className="border p-2 text-right">-</td></tr></tbody>
                              </table>
                            ) : (
                              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{b.text || b.content || 'Paragraphe de contenu'}</p>
                            )}
                          </div>
                        ))}
                        {blocks.length === 0 && <div className="text-center text-slate-400 py-20 italic">Le rendu de votre document apparaîtra ici</div>}
                      </div>
                   </div>
                </div>
              </div>
            )}

            {editorTab === '3. Variables' && (
              <div className="max-w-3xl">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Dictionnaire de variables</h3>
                <p className="text-sm text-slate-500 mb-8">Ces variables seront remplacées dynamiquement par les données de la réservation lors de la génération du document.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {VARIABLE_DICTIONARY.map(v => (
                    <div key={v.key} className="flex flex-col justify-center p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded">{`{{${v.key}}}`}</code>
                        <button 
                          className="text-xs font-bold px-3 py-1.5 bg-slate-50 hover:bg-indigo-600 text-slate-600 hover:text-white rounded transition-colors flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => insertVariable(v.key)}
                          title="Insérer dans le contenu"
                        >
                          <i className="fas fa-paste"></i> Insérer
                        </button>
                      </div>
                      <span className="text-xs text-slate-500">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editorTab === '4. Importer' && (
              <div className="max-w-2xl mx-auto py-16 flex flex-col items-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-3xl mb-6 shadow-sm border border-indigo-100">
                  <i className="fas fa-file-pdf"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Importer un modèle PDF existant</h3>
                <p className="text-center text-slate-500 mb-10 max-w-md">L'importation analysera votre document et tentera d'en extraire le texte structurel pour pré-remplir l'éditeur.</p>
                
                <div className="w-full relative group">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf" />
                  <div className="w-full border-2 border-dashed border-indigo-200 group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-colors bg-slate-50 rounded-2xl p-12 flex flex-col items-center justify-center text-indigo-600 relative">
                    <i className="fas fa-cloud-upload-alt text-4xl mb-4 text-indigo-400 group-hover:scale-110 transition-transform duration-300"></i>
                    <span className="font-bold text-lg mb-1 text-slate-700 group-hover:text-indigo-700">Cliquez pour sélectionner un fichier PDF</span>
                    <span className="text-sm text-slate-500">Taille maximale : 5 Mo</span>
                  </div>
                </div>

                <div className="mt-8 flex gap-4 w-full">
                  <button 
                    className="flex-1 py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    onClick={() => setEditorTab('1. Informations générales')}
                  >
                    Ignorer cette étape
                  </button>
                  <button 
                    className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                    onClick={() => {
                      setCurrentDoc({...currentDoc, name: 'Modèle importé (MOCK)'});
                      setBlocks([{id: 'b1', type: 'Paragraphe', text: 'Le texte simulé extrait du PDF apparaîtra ici. Aucune vraie extraction n\'a été faite.'}]);
                      setEditorTab('2. Contenu');
                      showToast("MOCK : Simulation d'importation effectuée.");
                    }}
                  >
                    <i className="fas fa-magic"></i> Extraire le contenu
                  </button>
                </div>
              </div>
            )}

            {editorTab === '5. Prévisualisation' && (
              <div className="h-[700px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <DocumentPreview 
                  template={{...currentDoc, content: blocks} as any} 
                  blocks={blocks} 
                  isGuided={true} 
                  client={{
                    name: "Jean Dupont (MOCK)", 
                    address: "123 Rue de la République",
                    nif: "123456789", stat: "987654321", rcs: "RCS-123", repFirstName: "Jean", repRole: "Gérant"
                  }} 
                  date={new Date().toLocaleDateString('fr-FR')} 
                  refNumber="PRO-2026-0001" 
                  totalAmount={150000} 
                  paidAmount={50000} 
                  materials={[{id: "1", name: "Chaise Napoléon", quantity: 100}, {id: "2", name: "Table rectangulaire", quantity: 10}]} 
                  tDetails={{usageType: "Mariage", destinationName: "Domaine des Oliviers"}} 
                  hDetails={{eventType: "Mariage", guests: 200, rentalType: "Location nue"}} 
                />
              </div>
            )}

            {editorTab === '6. Versions' && (
              <div className="max-w-3xl">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Historique des versions</h3>
                    <p className="text-sm text-slate-500 mt-1">Consultez et restaurez les révisions précédentes.</p>
                  </div>
                  <button 
                    className="px-4 py-2.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-sm font-bold rounded-xl transition-all shadow-sm"
                    onClick={() => showToast("Nouvelle version mineure créée.")}
                  >
                    <i className="fas fa-code-branch mr-2"></i>Créer une révision
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-5 bg-emerald-50 border border-emerald-200 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                    <div className="mt-0.5">
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200">
                        <i className="fas fa-check"></i>
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="font-bold text-emerald-900 text-base">Version v{currentDoc.version || 1}.0 <span className="ml-3 text-[10px] uppercase font-bold tracking-wider bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded shadow-sm">Actuelle</span></div>
                        <div className="text-xs font-medium text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded">{new Date().toLocaleString('fr-FR')}</div>
                      </div>
                      <div className="text-sm text-emerald-700 mb-4 font-medium">Dernière modification par Admin. Structure composée de {blocks.length} blocs.</div>
                      <div className="flex gap-3">
                        <button className="px-3 py-1.5 text-xs font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg shadow-sm transition-colors flex items-center gap-1.5">
                          <i className="fas fa-download"></i> Exporter JSON
                        </button>
                      </div>
                    </div>
                  </div>

                  {currentDoc.version && currentDoc.version > 1 && (
                    <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl relative group">
                      <div className="mt-0.5">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                          <i className="fas fa-history"></i>
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="font-bold text-slate-700 text-base">Version v{(currentDoc.version || 2) - 1}.0</div>
                          <div className="text-xs text-slate-500">Il y a 3 jours</div>
                        </div>
                        <div className="text-sm text-slate-500 mb-4">Version précédente archivée automatiquement suite à une modification majeure.</div>
                        <div className="flex gap-3">
                          <button 
                            className="px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                            onClick={() => showToast("Version restaurée.")}
                          >
                            <i className="fas fa-undo"></i> Restaurer cette version
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-2xl mb-5 shadow-inner">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Supprimer définitivement ce modèle ?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Cette action est irréversible. Toutes les versions de ce modèle seront perdues. Les documents déjà générés ne seront pas affectés.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
              <button 
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors shadow-sm"
                onClick={() => setDeleteConfirm(null)}
              >
                Annuler
              </button>
              <button 
                className="px-5 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm flex items-center gap-2"
                onClick={confirmDelete}
              >
                <i className="fas fa-trash-alt"></i> Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl font-bold text-sm z-[100] flex items-center gap-3 animate-fade-in border border-slate-700">
          <i className="fas fa-check-circle text-emerald-400 text-lg"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
