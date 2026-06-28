import React from "react";
import { AppScope } from "../App";

interface DashboardPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <div className="page active">
      <div className="template-extra-actions flex flex-wrap gap-2 mb-6">
        <button className="px-4 py-2 bg-hah-600 text-white rounded-lg text-sm font-medium hover:bg-hah-700 transition shadow-sm" onClick={() => onNavigate("reservation-new")}>
          <i className="fas fa-plus mr-2"></i>Nouvelle réservation
        </button>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition" onClick={() => onNavigate("planning")}>
          <i className="fas fa-calendar mr-2"></i>Ouvrir le planning
        </button>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition" onClick={() => onNavigate("reports")}>
          <i className="fas fa-chart-bar mr-2 text-blue-500"></i>Voir les rapports
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-hah-50 flex items-center justify-center text-hah-600">
              <i className="fas fa-building text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">24</p>
          <p className="text-sm text-slate-500">Événements Hahitantsoa ce mois</p>
          <button className="mt-3 text-xs text-hah-600 font-semibold hover:text-hah-700" onClick={() => onNavigate("hahitantsoa")}>Voir les réservations →</button>
        </div>
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-tit-50 flex items-center justify-center text-tit-600">
              <i className="fas fa-box text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">+8%</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">38</p>
          <p className="text-sm text-slate-500">Locations Titan ce mois</p>
          <button className="mt-3 text-xs text-tit-600 font-semibold hover:text-tit-700" onClick={() => onNavigate("titan")}>Voir les locations →</button>
        </div>
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <i className="fas fa-exclamation-triangle text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">3 urgents</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">7</p>
          <p className="text-sm text-slate-500">Retours à contrôler aujourd'hui</p>
        </div>
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <i className="fas fa-coins text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">J-10</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">4.2M Ar</p>
          <p className="text-sm text-slate-500">Reste à payer (échéances)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Activité des 7 derniers jours</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-hah-500"></span> Hahitantsoa</span>
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-tit-500"></span> Titan</span>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 55, 30, 65, 45, 80, 25].map((titH, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1 justify-end h-full">
                <div className="w-full bg-tit-500 rounded-t-lg opacity-80" style={{ height: `${titH}%` }}></div>
                <div className="w-full bg-hah-500 rounded-t-lg" style={{ height: `${100 - titH}%` }}></div>
                <p className="text-center text-xs text-slate-400 mt-2">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4">Alertes & Notifications</h3>
          <div className="space-y-3">
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition">
              <i className="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-red-800">Stock bas : Serviettes</p>
                <p className="text-xs text-red-600">Il reste 12 unités (seuil: 20)</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 transition" onClick={() => onNavigate("commercial-ops")}>
              <i className="fas fa-clock text-amber-500 mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-amber-800">Échéance J-10</p>
                <p className="text-xs text-amber-700">Mariage R. — Solde 850 000 Ar</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="font-bold text-slate-800 mb-4">Dossiers en cours</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left rounded-l-lg">Client</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Date événement</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">RAP</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>
                <td className="px-4 py-3 font-medium text-slate-800">Rakoto & famille</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-md bg-hah-100 text-hah-700 text-xs font-bold">HAH</span></td>
                <td className="px-4 py-3 text-slate-600">28 Juin 2026</td>
                <td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Confirmé</span></td>
                <td className="px-4 py-3 font-mono text-slate-600">1 200 000 Ar</td>
                <td className="px-4 py-3"><button className="text-hah-600 hover:text-hah-700 text-xs font-semibold">Voir dossier →</button></td>
              </tr>
              <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0143")}>
                <td className="px-4 py-3 font-medium text-slate-800">Société TechMada</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-md bg-tit-100 text-tit-700 text-xs font-bold">TIT</span></td>
                <td className="px-4 py-3 text-slate-600">25 Juin 2026</td>
                <td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Proforma</span></td>
                <td className="px-4 py-3 font-mono text-slate-600">450 000 Ar</td>
                <td className="px-4 py-3"><button className="text-tit-600 hover:text-tit-700 text-xs font-semibold">Voir dossier →</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
