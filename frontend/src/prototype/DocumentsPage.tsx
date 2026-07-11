
import React, { useState, useEffect } from "react";
import { AppScope } from "../App";
import {
  mockDocumentTemplates,
  MockCommercialDocumentTemplate,
} from "./mockData";

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
  const [blocks, setBlocks] = useState<{id: string, type: string, content: string}[]>([]);
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

  const saveTemplates = (newTemplates: MockCommercialDocumentTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem("mock_templates", JSON.stringify(newTemplates));
  };

  const filteredTemplates = (templates || []).filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase())) return false;
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
    setBlocks([{ id: "b1", type: "paragraph", content: t.content || "" }]);
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
    setBlocks([{ id: "b1", type: "paragraph", content: t.content || "" }]);
    setEditorTab("1. Informations générales");
    setView('editor');
    setErrorMsg(null);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      const newTemplates = templates.filter(t => t.id !== deleteConfirm);
      saveTemplates(newTemplates);
      setDeleteConfirm(null);
      setView('list'); // Also go back to list if we delete from editor
    }
  };

  const handleSave = () => {
    if (!currentDoc) return;

if (currentDoc.status === 'Actif') {
      const hasActive = (templates || []).some(t => t.code === currentDoc.code && t.status === 'Actif' && t.id !== currentDoc.id);
      if (hasActive) {
        setErrorMsg("Une version active existe déjà.");
        return;
      }
    }

    const isDuplicateCode = (templates || []).some(t => t.code === currentDoc.code && t.id !== currentDoc.id);
    if (isDuplicateCode) {
      setErrorMsg("Ce code existe déjà pour un autre modèle.");
      return;
    }

    if (currentDoc.status === 'Actif') {
      const hasActive = (templates || []).some(t => t.code === currentDoc.code && t.status === 'Actif' && t.id !== currentDoc.id);
      if (hasActive) {
        setErrorMsg("Une version active existe déjà.");
        return;
      }
    }

    const newTemplates = [...(templates || [])];
    const existingIdx = newTemplates.findIndex(t => t.id === currentDoc.id);
    const finalDoc = {
      ...currentDoc,
      content: blocks.map(b => b.content).join("\n"),
      variables: currentDoc.variables || [],
      author: currentDoc.author || "Admin"
    } as MockCommercialDocumentTemplate;

    if (existingIdx >= 0) {
      newTemplates[existingIdx] = finalDoc;
    } else {
      newTemplates.push(finalDoc);
    }

    saveTemplates(newTemplates);

  };

  const insertVariable = (v: string) => {
    if (blocks.length > 0) {
      const newBlocks = [...blocks];
      newBlocks[0].content += `{{${v}}}`;
      setBlocks(newBlocks);
    } else {
      setBlocks([{ id: "b1", type: "paragraph", content: `{{${v}}}` }]);
    }
    setEditorTab('2. Contenu');
  };

  const currentTypes = COMMERCIAL_TYPES.filter(t => currentDoc?.volet === 'Titan' ? t !== 'Avenant' : true);

  return (
    <div className="page active space-y-6 relative pb-10">
      <h2 className="text-2xl font-bold">Documents & Modèles</h2>

      {view === 'list' && (
        <>
          <div className="flex gap-2">
            <button onClick={() => { handleNew(); setEditorTab('4. Importer'); }}>Importer</button>
            <button onClick={handleNew}>Nouveau modèle</button>
          </div>

          <div className="flex gap-4">
            <input type="search" placeholder="Rechercher par nom" value={search} onChange={e => setSearch(e.target.value.trim())} />
            <button aria-label="Effacer la recherche" onClick={() => setSearch("")}>X</button>
            <select aria-label="Filtrer par volet" value={voletFilter} onChange={e => setVoletFilter(e.target.value)}>
              <option value="Tous">Tous</option>
              {VOLETS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select aria-label="Filtrer par type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="Tous">Tous</option>
              {COMMERCIAL_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <table>
            <tbody>
              {filteredTemplates.map(t => (
                <tr key={t.id} onClick={() => handleEdit(t)}>
                  <td>
                    <span className="font-semibold text-gray-900">{t.name}</span>
                    <span className="text-xs text-gray-500">{t.code}</span>
                  </td>
                  <td><button onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }} title="Dupliquer le modèle">Dupliquer le modèle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {view === 'editor' && currentDoc && (
        <div>
          <button onClick={() => setView('list')}>Documents & Modèles</button>
          <span>{currentDoc.name} / v{currentDoc.version}</span>

          <div className="flex gap-4" role="tablist">
            {['1. Informations générales', '2. Contenu', '3. Variables', '4. Importer', '5. Versions'].map(tab => (
              <button key={tab} role="tab" aria-selected={editorTab === tab} onClick={() => setEditorTab(tab)}>{tab}</button>
            ))}
          </div>

          <div className="mt-4">
            {errorMsg && <div className="text-red-500">{errorMsg}</div>}

            {editorTab === '1. Informations générales' && (
              <div>
                <input placeholder="Ex: Contrat de location Standard" value={currentDoc.name} onChange={e => setCurrentDoc({...currentDoc, name: e.target.value})} />
                <input placeholder="Ex: CONTRAT-STD" value={currentDoc.code} onChange={e => setCurrentDoc({...currentDoc, code: e.target.value})} />
                <select role="combobox" disabled><option>Documents commerciaux</option></select>
                <select role="combobox" value={currentDoc.volet} onChange={e => setCurrentDoc({...currentDoc, volet: e.target.value as any})}>
                  {VOLETS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select role="combobox" value={currentDoc.type} onChange={e => setCurrentDoc({...currentDoc, type: e.target.value as any})}>
                  {currentTypes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <button role="switch" aria-checked={currentDoc.status === 'Actif'} onClick={() => setCurrentDoc({...currentDoc, status: currentDoc.status === 'Actif' ? 'Brouillon' : 'Actif'})}>Toggle</button>
              </div>
            )}

            {editorTab === '2. Contenu' && (
              <div>
                <h2>Éditeur de document</h2>
                <button onClick={() => setBlocks([...blocks, {id: "b"+Date.now(), type: "paragraph", content: ""}])}>+ Paragraphe</button>
                <button onClick={() => setBlocks([...blocks, {id: "b"+Date.now(), type: "title", content: ""}])}>+ Titre</button>
                {blocks.map((b, i) => (
                  <div key={b.id}>
                    <button><i className="fa-arrow-up"></i></button>
                    <textarea placeholder="Contenu..." value={b.content} onChange={e => {
                      const nb = [...blocks];
                      nb[i].content = e.target.value;
                      setBlocks(nb);
                    }} />
                  </div>
                ))}
              </div>
            )}

            {editorTab === '3. Variables' && (
              <div>
                <h2>Variables nécessaires à la génération</h2>
                <button onClick={() => insertVariable('client.name')}>Insérer dans l'éditeur</button>
              </div>
            )}

            {editorTab === '4. Importer' && (
              <div>
                <h2>Cliquez pour sélectionner un fichier PDF</h2>
                <input type="file" />
                <button onClick={() => setCurrentDoc({...currentDoc, name: 'Modèle basé sur un PDF importé'})}>Suivant</button>
                <button>Terminer</button>
              </div>
            )}

            {editorTab === '5. Versions' && (
              <div>
                <h2>Historique des versions</h2>
                <div>v1</div>
              </div>
            )}

            <button onClick={handleSave}>Enregistrer</button>
            {currentDoc.id && <button onClick={() => setDeleteConfirm(currentDoc.id!)}>Supprimer le modèle</button>}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal">
          <button onClick={confirmDelete}>Oui, supprimer</button>
        </div>
      )}
    </div>
  );
}
