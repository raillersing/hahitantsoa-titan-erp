import React, { useState } from "react";
import { AppScope } from "../App";

interface AgendaVisitorsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function AgendaVisitorsPage({ onNavigate }: AgendaVisitorsPageProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page active space-y-6 relative pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Agenda Visiteurs</h2>
          <p className="text-sm text-slate-500">Registre des visites, réunions commerciales et prestataires.</p>
        </div>
        <button 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
          onClick={() => showToast("Enregistré localement — mock (Nouvelle Visite)")}
        >
          <i className="fas fa-calendar-plus mr-2"></i>Enregistrer une visite
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-6">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Rechercher un visiteur..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <th className="py-3 px-4">Heure</th>
              <th className="py-3 px-4">Visiteur</th>
              <th className="py-3 px-4">Motif</th>
              <th className="py-3 px-4 text-center">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            <tr className="hover:bg-slate-50">
              <td className="py-3 px-4 font-mono text-slate-600">09:00 - 10:00</td>
              <td className="py-3 px-4">
                <div className="font-bold text-slate-800">Société SMTP</div>
                <div className="text-xs text-slate-500">M. Dubois (Prestataire)</div>
              </td>
              <td className="py-3 px-4 text-slate-600">Maintenance climatisation</td>
              <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">Terminé</span></td>
              <td className="py-3 px-4 text-right">
                <button className="text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => showToast("Édition (mock)")}><i className="fas fa-eye"></i></button>
              </td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="py-3 px-4 font-mono text-slate-600">14:30 - 15:30</td>
              <td className="py-3 px-4">
                <div className="font-bold text-slate-800">Mme. Rajerison</div>
                <div className="text-xs text-slate-500">Client - Réservation Mariage</div>
              </td>
              <td className="py-3 px-4 text-slate-600">Visite salle Hahitantsoa</td>
              <td className="py-3 px-4 text-center"><span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">En cours</span></td>
              <td className="py-3 px-4 text-right">
                <button className="text-slate-400 hover:text-emerald-600 transition-colors mr-3" onClick={() => showToast("Visite terminée — mock")} title="Marquer terminé"><i className="fas fa-check"></i></button>
                <button className="text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => showToast("Édition (mock)")}><i className="fas fa-edit"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
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
