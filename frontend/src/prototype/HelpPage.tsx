import React from "react";
import { AppScope } from "../App";

interface HelpPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function HelpPage({ onNavigate }: HelpPageProps) {
  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Aide & Support</h2>
          <p className="text-sm text-slate-500">Documentation, manuels utilisateurs et support technique</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl mb-4">
            <i className="fa-solid fa-book"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Manuel utilisateur</h3>
          <p className="text-sm text-slate-500 mb-4">Consultez notre documentation complète pour apprendre à utiliser l'ERP de manière optimale.</p>
          <button className="text-indigo-600 font-medium text-sm hover:underline">Lire le manuel →</button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl mb-4">
            <i className="fa-solid fa-headset"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Support Technique</h3>
          <p className="text-sm text-slate-500 mb-4">Vous rencontrez un problème ? Notre équipe technique est disponible pour vous assister.</p>
          <button className="text-indigo-600 font-medium text-sm hover:underline">Contacter le support →</button>
        </div>
      </div>
    </div>
  );
}
