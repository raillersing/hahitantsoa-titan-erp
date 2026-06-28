import React from "react";
import { AppScope } from "../App";

interface AuditPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function AuditPage({ onNavigate }: AuditPageProps) {
  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Journal d'Audit</h2>
        <p className="text-sm text-slate-500">Traçabilité complète des actions utilisateurs (Immutable)</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <input type="text" placeholder="Rechercher (ex: nom, action, IP)..." className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
          <select className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
            <option>Tous les modules</option>
            <option>Hahitantsoa</option>
            <option>Titan</option>
            <option>Commercial</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Horodatage</th>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Détails</th>
              <th className="text-right px-4 py-3 rounded-r-lg">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">2026-06-27 15:30:12</td>
              <td className="px-4 py-3 font-semibold text-slate-700">admin@titan.mg</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">CREATE_RESERVATION</span></td>
              <td className="px-4 py-3 text-slate-600">ID: RES-2026-0142 | Module: Hahitantsoa</td>
              <td className="px-4 py-3 text-right text-slate-400">192.168.1.42</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">2026-06-27 14:15:00</td>
              <td className="px-4 py-3 font-semibold text-slate-700">caisse@titan.mg</td>
              <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">REGISTER_PAYMENT</span></td>
              <td className="px-4 py-3 text-slate-600">ID: PAY-2026-088 | Montant: 1200000 Ar</td>
              <td className="px-4 py-3 text-right text-slate-400">192.168.1.105</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
