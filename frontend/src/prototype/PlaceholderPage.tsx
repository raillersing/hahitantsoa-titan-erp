import React from "react";
import { AppScope } from "../App";

interface PlaceholderPageProps {
  title: string;
  scope: AppScope;
  onNavigate: (scope: any, param?: string) => void;
}

export default function PlaceholderPage({ title, scope, onNavigate }: PlaceholderPageProps) {
  if (scope === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 w-full max-w-md shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-cube text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Hahitantsoa / Titan ERP</h1>
            <p className="text-sm text-slate-500 mt-1">Connexion à votre espace</p>
          </div>
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onNavigate("dashboard"); }}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse email</label>
              <div className="relative">
                <i className="fa-regular fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input type="email" placeholder="utilisateur@hahitantsoa.mg" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input type="password" placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
              <i className="fa-solid fa-right-to-bracket mr-2"></i>Se connecter
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-6">Version prototype — données de démonstration</p>
        </div>
      </div>
    );
  }

  // Configuration métier pour les pages "À venir"
  const upcomingContent: Record<string, { desc: string, icon: string }> = {
    "hr-payroll": { desc: "Gestion des ressources humaines, pointages et fiches de paie.", icon: "fa-users-cog" },
    "purchasing": { desc: "Gestion des achats, fournisseurs et commandes d'approvisionnement.", icon: "fa-cart-shopping" },
    "notifications": { desc: "Centre de notifications et alertes système.", icon: "fa-bell" },
    "mobile-tablet": { desc: "Interface dédiée pour les opérateurs sur le terrain.", icon: "fa-mobile-screen" },
    "import-excel": { desc: "Outil d'importation en masse depuis Excel/CSV.", icon: "fa-file-import" },
  };

  const content = upcomingContent[scope] || { desc: "Interface en cours de développement.", icon: "fa-tools" };

  return (
    <div className="page active">
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-10 shadow-sm">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
          <i className={`fas ${content.icon} text-3xl`}></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full mb-6">
          <i className="fas fa-person-digging"></i> À venir — nécessite raccordement API
        </div>
        <p className="text-slate-600 mb-8 text-base">
          {content.desc}
        </p>
        <button className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors shadow-sm" onClick={() => onNavigate("dashboard")}>
          <i className="fas fa-arrow-left mr-2"></i>Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}
