import React from "react";
import { AppScope } from "../App";
import { getClient, mockReservations } from "./mockData";

interface CustomerDetailPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
}

export default function CustomerDetailPage({ onNavigate, param }: CustomerDetailPageProps) {
  const clientId = param || "CUST-001";
  const client = getClient(clientId);
  const reservations = mockReservations.filter(r => r.clientId === client.id);

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => onNavigate("customers")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fiche Client</h2>
          <p className="text-sm text-slate-500">Détails, historique et documents liés</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 ${client.colorClass}`}>
            {client.initials}
          </div>
          <h3 className="text-xl font-bold text-slate-900">{client.name}</h3>
          <span className="px-2.5 py-0.5 mt-2 mb-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{client.type}</span>
          
          <button className="w-full px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 mb-2" onClick={() => onNavigate("reservation-new")}>
            <i className="fa-solid fa-plus mr-2"></i> Nouvelle réservation
          </button>
          <button className="w-full px-4 py-2 bg-slate-100 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-200" onClick={() => onNavigate("commercial-ops")}>
            <i className="fa-solid fa-file-invoice mr-2"></i> Nouveau devis
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Coordonnées</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                <div className="text-sm text-slate-800 font-medium">{client.email}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone</label>
                <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Historique des dossiers</h3>
            {reservations.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun dossier trouvé pour ce client.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                    <th className="text-left px-4 py-3 rounded-l-lg">ID</th>
                    <th className="text-left px-4 py-3">Titre</th>
                    <th className="text-left px-4 py-3">Module</th>
                    <th className="text-right px-4 py-3 rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{r.id}</td>
                      <td className="px-4 py-3 text-slate-600">{r.title}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">{r.type}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-indigo-600 font-medium hover:underline text-xs" onClick={() => onNavigate("reservation-detail", r.id)}>Ouvrir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
