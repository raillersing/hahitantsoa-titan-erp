import React from "react";
import { AppScope } from "../App";

interface CashboxPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function CashboxPage({ onNavigate }: CashboxPageProps) {
  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Caisse</h2>
          <p className="text-sm text-slate-500">Gestion des encaissements et décaissements journaliers</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>Nouvelle opération
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-arrow-down"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Entrées du jour</p>
            <p className="text-2xl font-bold text-slate-800">1 200 000 Ar</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-arrow-up"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Sorties du jour</p>
            <p className="text-2xl font-bold text-slate-800">150 000 Ar</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Solde actuel</p>
            <p className="text-2xl font-bold text-slate-800">4 500 000 Ar</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Mouvements récents</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Date & Heure</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">27 Juin 14:30</td>
              <td className="px-4 py-3 text-slate-700 font-medium hover:text-indigo-600 cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>Acompte Réservation RES-2026-0142</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">Entrée</span></td>
              <td className="px-4 py-3 text-right text-emerald-600 font-bold">+ 1 200 000 Ar</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">27 Juin 10:15</td>
              <td className="px-4 py-3 text-slate-700 font-medium">Achat fournitures de bureau</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-medium">Sortie</span></td>
              <td className="px-4 py-3 text-right text-rose-600 font-bold">- 150 000 Ar</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
