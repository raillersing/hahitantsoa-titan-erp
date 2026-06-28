import React from "react";

export default function PlanningPage() {
  return (
    <div className="page active space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planning hebdomadaire</h2>
          <p className="text-sm text-slate-500">Semaine du 23 au 29 juin 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-slate-700 shadow-sm">Semaine</button>
            <button className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700">Mois</button>
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            <i className="fa-solid fa-plus mr-2"></i>Nouveau RDV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Filtrer :</span>
        <button className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold hover:bg-indigo-200 transition-colors">
          <i className="fa-solid fa-building mr-1"></i>Hahitantsoa
        </button>
        <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
          <i className="fa-solid fa-truck mr-1"></i>Titan
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Jour</th>
              <th className="text-left px-4 py-3">Événement</th>
              <th className="text-left px-4 py-3">Ressources</th>
              <th className="text-left px-4 py-3 rounded-r-lg">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-900">Lundi 23 juin</div>
                <div className="text-xs text-slate-500">09:00 — 11:00</div>
              </td>
              <td className="px-4 py-4">
                <div className="font-medium text-slate-900">Visite Domaine Ambohimanga</div>
                <div className="text-xs text-slate-500">Mariage — 120 invités</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-user text-slate-400"></i>
                  <span className="text-slate-600">Ando R. + 2 accompagnants</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Confirmé</span>
              </td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-900">Mardi 24 juin</div>
                <div className="text-xs text-slate-500">14:00 — 16:00</div>
              </td>
              <td className="px-4 py-4">
                <div className="font-medium text-slate-900">Installation mobilier Titan</div>
                <div className="text-xs text-slate-500">Entreprise — 50 chaises, 10 tables</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-truck text-slate-400"></i>
                  <span className="text-slate-600">Camion + 2 installateurs</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">À préparer</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
