import React from "react";
import { AppScope } from "../App";

interface HahitantsoaPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function HahitantsoaPage({ onNavigate }: HahitantsoaPageProps) {
  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            <i className="fa-solid fa-calendar-check text-indigo-600 mr-2"></i>Réservations Hahitantsoa
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestion des réservations événementielles avec suivi de workflow</p>
        </div>
        <button onClick={() => onNavigate("reservation-new", "hahitantsoa")} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>Nouvelle réservation
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Filtres :</span>
          <button className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">Toutes</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">Proforma</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">Contrat signé</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">Acompte reçu</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">Confirmées</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">En cours</button>
          <button className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">Retournées</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Liste des réservations</h2>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Rechercher..." className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-filter"></i></button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="px-4 py-3 text-left font-medium rounded-tl-lg">N°</th>
              <th className="px-4 py-3 text-left font-medium">Client</th>
              <th className="px-4 py-3 text-left font-medium">Événement</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Workflow</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-center font-medium rounded-tr-lg">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <button onClick={() => onNavigate("reservation-detail", "RES-2026-0142")} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">RES-2026-0142</button>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onNavigate("customer", "CUST-001")} className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">AR</div>
                  <span className="text-slate-700 group-hover:text-indigo-600 group-hover:underline">Ando R.</span>
                </button>
              </td>
              <td className="px-4 py-3 text-slate-600">Mariage traditionnel</td>
              <td className="px-4 py-3 text-slate-600">15 Juin 2026</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Proforma"></div>
                  <div className="w-4 h-0.5 bg-emerald-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Contrat"></div>
                  <div className="w-4 h-0.5 bg-emerald-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Acompte"></div>
                  <div className="w-4 h-0.5 bg-emerald-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Confirmé"></div>
                  <div className="w-4 h-0.5 bg-slate-200"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Sortie"></div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-700">2 400 000 Ar</td>
              <td className="px-4 py-3 text-center rounded-tr-lg">
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Confirmée</span>
              </td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <button onClick={() => onNavigate("reservation-detail", "RES-2026-0141")} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">RES-2026-0141</button>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onNavigate("customer", "CUST-002")} className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">RF</div>
                  <span className="text-slate-700 group-hover:text-indigo-600 group-hover:underline">Rakoto F.</span>
                </button>
              </td>
              <td className="px-4 py-3 text-slate-600">Anniversaire 50 ans</td>
              <td className="px-4 py-3 text-slate-600">22 Juin 2026</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Proforma"></div>
                  <div className="w-4 h-0.5 bg-emerald-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Contrat"></div>
                  <div className="w-4 h-0.5 bg-slate-200"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Acompte"></div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-700">1 850 000 Ar</td>
              <td className="px-4 py-3 text-center rounded-tr-lg">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Contrat signé</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
