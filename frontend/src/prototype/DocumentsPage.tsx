import React, { useEffect, useState } from "react";
import DocumentsHubPage from "./DocumentsHubPage";
import DocumentsTemplatesPage from "./DocumentsTemplatesPage";
import {
  HomeIcon,
  FileTextIcon,
  PlusCircleIcon,
  ConstructionIcon,
} from "../components/icons";

type DocumentsTab = "hub" | "templates" | "generate";

export default function DocumentsPage({ onNavigate, param }: { onNavigate: (scope: any, param?: string) => void; param?: string }) {
  const [activeTab, setActiveTab] = useState<DocumentsTab>(
    param === "templates" || param === "generate" ? param : "hub",
  );

  useEffect(() => {
    setActiveTab(param === "templates" || param === "generate" ? param : "hub");
  }, [param]);

  const tabs: { key: DocumentsTab; label: string; icon: React.ReactNode }[] = [
    { key: "hub", label: "Hub documentaire", icon: <HomeIcon size={18} /> },
    { key: "templates", label: "Modeles", icon: <FileTextIcon size={18} /> },
    { key: "generate", label: "Generer", icon: <PlusCircleIcon size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex items-center gap-1" role="tablist" aria-label="Espace Documents">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`documents-panel-${tab.key}`}
            onClick={() => {
              setActiveTab(tab.key);
              onNavigate("documents", tab.key === "hub" ? undefined : tab.key);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "hub" && (
          <div id="documents-panel-hub" role="tabpanel" aria-label="Hub documentaire">
            <DocumentsHubPage
              onNavigate={onNavigate}
              selectedDocumentId={param && param !== "templates" && param !== "generate" ? param : undefined}
            />
          </div>
        )}
        {activeTab === "templates" && <div id="documents-panel-templates" role="tabpanel" aria-label="Modèles de documents"><DocumentsTemplatesPage /></div>}
        {activeTab === "generate" && (
          <div id="documents-panel-generate" role="tabpanel" aria-label="Générer un document" className="bg-white rounded-xl border border-slate-200 p-8 max-w-2xl mx-auto text-center space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FileTextIcon size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Génération de documents officiels</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Dans l'ERP, les documents contractuels (devis proformas, contrats signés, avenants, fiches de passation, reçus de paiement et factures) sont générés avec intégrité et traçabilité directement au sein de chaque dossier.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate("reservation-new", "domain:Titan")}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-white text-left transition shadow-sm group"
              >
                <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Dossier Titan</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Créer un devis matériel pour générer proforma, contrat de location et avenants Titan.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("reservation-new", "domain:Hahitantsoa")}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-white text-left transition shadow-sm group"
              >
                <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Dossier Hahitantsoa</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Créer un devis événementiel pour générer contrat de salle, pack, services et passation.
                </p>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span>Vous souhaitez tester un rendu ?</span>
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className="font-bold text-indigo-600 hover:underline"
              >
                Prévisualiser les modèles officiels →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
