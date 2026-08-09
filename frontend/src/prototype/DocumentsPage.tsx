import React, { useState } from "react";
import DocumentsHubPage from "./DocumentsHubPage";
import DocumentsTemplatesPage from "./DocumentsTemplatesPage";
import {
  HomeIcon,
  FileTextIcon,
  PlusCircleIcon,
  ConstructionIcon,
} from "../components/icons";

type DocumentsTab = "hub" | "templates" | "generate";

export default function DocumentsPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [activeTab, setActiveTab] = useState<DocumentsTab>("hub");

  const tabs: { key: DocumentsTab; label: string; icon: React.ReactNode }[] = [
    { key: "hub", label: "Hub documentaire", icon: <HomeIcon size={18} /> },
    { key: "templates", label: "Modeles", icon: <FileTextIcon size={18} /> },
    { key: "generate", label: "Generer", icon: <PlusCircleIcon size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
        {activeTab === "hub" && <DocumentsHubPage onNavigate={onNavigate} />}
        {activeTab === "templates" && <DocumentsTemplatesPage />}
        {activeTab === "generate" && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ConstructionIcon size={28} />
            </div>
            <h3 className="font-semibold text-slate-900">Generateur de documents</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Le generateur pas a pas est en cours de developpement. Utilisez le Hub pour consulter les documents existants ou les modeles pour les previsualiser.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
