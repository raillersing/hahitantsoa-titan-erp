import React, { useState } from "react";
import { AppScope } from "../App";

interface AdminPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function AdminPage({ onNavigate }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page active space-y-6 relative pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Administration & Paramètres</h2>
          <p className="text-sm text-slate-500">Gérez les utilisateurs, rôles, et préférences globales.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 px-6 pt-4 flex gap-6">
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users mr-2"></i>Utilisateurs
          </button>
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('roles')}
          >
            <i className="fas fa-shield-halved mr-2"></i>Rôles & Permissions
          </button>
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="fas fa-cog mr-2"></i>Paramètres globaux
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <input type="text" placeholder="Rechercher un utilisateur..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
                  onClick={() => showToast("Enregistré localement — mock (Ajout Utilisateur)")}
                >
                  <i className="fas fa-plus mr-2"></i>Nouvel Utilisateur
                </button>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Nom</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">Jean Rakoto</td>
                    <td className="py-3 px-4 text-slate-600">j.rakoto@hahitantsoa.mg</td>
                    <td className="py-3 px-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">Administrateur</span></td>
                    <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Actif</span></td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => showToast("Édition utilisateur (mock)")}><i className="fas fa-edit"></i></button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">Marie Rasoa</td>
                    <td className="py-3 px-4 text-slate-600">m.rasoa@titan.mg</td>
                    <td className="py-3 px-4"><span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">Opérateur Logistique</span></td>
                    <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Actif</span></td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => showToast("Édition utilisateur (mock)")}><i className="fas fa-edit"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
                  onClick={() => showToast("Enregistré localement — mock (Ajout Rôle)")}
                >
                  <i className="fas fa-plus mr-2"></i>Nouveau Rôle
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800">Administrateur</h4>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Système</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">Accès total à tous les modules Hahitantsoa et Titan.</p>
                  <button className="text-indigo-600 text-sm font-bold hover:underline" onClick={() => showToast("Configuration rôle (mock)")}>Gérer les permissions →</button>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800">Opérateur Logistique</h4>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Personnalisé</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">Accès limité à l'inventaire et aux sorties/retours matériels Titan.</p>
                  <button className="text-indigo-600 text-sm font-bold hover:underline" onClick={() => showToast("Configuration rôle (mock)")}>Gérer les permissions →</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
                <div className="text-sm text-amber-800">
                  <strong>Mode Mock activé</strong><br/>
                  Ces paramètres sont sauvegardés uniquement dans le localStorage. Ils nécessiteront un raccordement à l'API système.
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nom de l'organisation</label>
                  <input type="text" defaultValue="Hahitantsoa / Titan ERP" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Devise par défaut</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option>Ariary (Ar)</option>
                    <option>Euro (€)</option>
                    <option>USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Taux de TVA par défaut (%)</label>
                  <input type="number" defaultValue="20" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <button 
                  className="mt-4 px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                  onClick={() => showToast("Enregistré localement — mock")}
                >
                  Sauvegarder les paramètres
                </button>
              </div>
            </div>
          )}
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
