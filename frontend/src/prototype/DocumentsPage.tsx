import React, { useState } from "react";
import { AppScope } from "../App";

interface DocumentsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function DocumentsPage({ onNavigate }: DocumentsPageProps) {
  const [activeTab, setActiveTab] = useState("templates");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page active space-y-6 relative pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Documents & Modèles</h2>
          <p className="text-sm text-slate-500">Gestion des modèles PDF, conditions générales et documents types.</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
          onClick={() => showToast("Enregistré localement — mock (Ajout Modèle)")}
        >
          <i className="fas fa-file-circle-plus mr-2"></i>Nouveau modèle
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 px-6 pt-4 flex gap-6">
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'templates' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('templates')}
          >
            <i className="fas fa-file-contract mr-2"></i>Modèles de contrats
          </button>
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'cgu' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('cgu')}
          >
            <i className="fas fa-scale-balanced mr-2"></i>Conditions & CGU
          </button>
        </div>

        <div className="p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="py-3 px-4">Titre du document</th>
                <th className="py-3 px-4 text-center">Version</th>
                <th className="py-3 px-4 text-center">Dernière modif.</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {activeTab === 'templates' && (
                <>
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">Contrat Location Titan Standard</div>
                      <div className="text-xs text-slate-500">Utilisé pour les locations pures sans livraison.</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600 text-xs">v2.1</td>
                    <td className="py-3 px-4 text-center text-slate-600">12 Juin 2026</td>
                    <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Actif</span></td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors mr-3" onClick={() => showToast("Édition modèle (mock)")}><i className="fas fa-edit"></i></button>
                      <button className="text-slate-400 hover:text-rose-600 transition-colors" onClick={() => showToast("Action désactivée (mock)")}><i className="fas fa-trash"></i></button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">Contrat Hahitantsoa Full Service</div>
                      <div className="text-xs text-slate-500">Inclut traiteur, lieu et logistique complète.</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600 text-xs">v1.4</td>
                    <td className="py-3 px-4 text-center text-slate-600">05 Mai 2026</td>
                    <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Actif</span></td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors mr-3" onClick={() => showToast("Édition modèle (mock)")}><i className="fas fa-edit"></i></button>
                      <button className="text-slate-400 hover:text-rose-600 transition-colors" onClick={() => showToast("Action désactivée (mock)")}><i className="fas fa-trash"></i></button>
                    </td>
                  </tr>
                </>
              )}
              {activeTab === 'cgu' && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">Conditions Générales de Location Titan</div>
                    <div className="text-xs text-slate-500">Annexe obligatoire pour tous les devis Titan.</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-600 text-xs">v3.0</td>
                  <td className="py-3 px-4 text-center text-slate-600">01 Jan 2026</td>
                  <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Actif</span></td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-slate-400 hover:text-indigo-600 transition-colors mr-3" onClick={() => showToast("Édition CGU (mock)")}><i className="fas fa-edit"></i></button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
