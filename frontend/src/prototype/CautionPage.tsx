import React from "react";
import { AppScope } from "../App";

interface CautionPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function CautionPage({ onNavigate }: CautionPageProps) {
  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Caution</h2>
          <p className="text-sm text-slate-500">Suivi des cautions (chèques, espèces)</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>Enregistrer caution
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Cautions conservées</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Dossier</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3 rounded-r-lg">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-700 hover:text-indigo-600 cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>LOC-2026-0089</td>
              <td className="px-4 py-3 text-slate-600">Ando R.</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">Chèque</span></td>
              <td className="px-4 py-3 text-right font-medium">500 000 Ar</td>
              <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Conservée</span></td>
              <td className="px-4 py-3 text-right">
                <button className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Restituer</button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-700 hover:text-indigo-600 cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>LOC-2026-0087</td>
              <td className="px-4 py-3 text-slate-600">Traiteur Royal</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">Espèces</span></td>
              <td className="px-4 py-3 text-right font-medium">200 000 Ar</td>
              <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Conservée</span></td>
              <td className="px-4 py-3 text-right">
                <button className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Restituer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
