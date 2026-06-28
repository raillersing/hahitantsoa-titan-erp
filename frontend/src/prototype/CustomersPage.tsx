import React from "react";
import { AppScope } from "../App";

interface CustomersPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function CustomersPage({ onNavigate }: CustomersPageProps) {
  return (
    <div className="page active space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients</h2>
          <p className="text-sm text-slate-500">142 clients enregistrés</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Rechercher un client..." className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            <i className="fa-solid fa-plus mr-2"></i>Nouveau client
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Client</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Dernier dossier</th>
              <th className="text-left px-4 py-3">Documents</th>
              <th className="text-right px-4 py-3 rounded-r-lg">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">AR</div>
                  <div>
                    <div className="font-medium text-slate-900">Ando Rakoto</div>
                    <div className="text-xs text-slate-500">ando.rakoto@email.mg</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">Particulier</span>
              </td>
              <td className="px-4 py-4">
                <div className="text-slate-700 font-medium">RES-2026-0142</div>
                <div className="text-xs text-slate-500">Mariage Domaine Ambohimanga</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">Contrat OK</span>
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">Acompte OK</span>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Voir fiche</button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-xs">RN</div>
                  <div>
                    <div className="font-medium text-slate-900">Rasoa Nomena</div>
                    <div className="text-xs text-slate-500">rasoa.nomena@entreprise.mg</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Entreprise</span>
              </td>
              <td className="px-4 py-4">
                <div className="text-slate-700 font-medium">RES-2026-0138</div>
                <div className="text-xs text-slate-500">Séminaire Corporate</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Proforma</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">Attente contrat</span>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Voir fiche</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
