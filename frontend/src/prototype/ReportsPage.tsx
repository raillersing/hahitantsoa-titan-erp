import React, { useState } from "react";
import { AppScope } from "../App";

interface ReportsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function ReportsPage({ onNavigate }: ReportsPageProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Rapports & BI</h2>
        <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Chiffre d'affaires mensuel</h3>
          <div className="h-48 flex items-end justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="w-1/6 bg-indigo-100 rounded-t-lg h-1/2 relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100">Jan</span></div>
            <div className="w-1/6 bg-indigo-200 rounded-t-lg h-3/4 relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100">Fév</span></div>
            <div className="w-1/6 bg-indigo-300 rounded-t-lg h-2/3 relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100">Mar</span></div>
            <div className="w-1/6 bg-indigo-400 rounded-t-lg h-4/5 relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100">Avr</span></div>
            <div className="w-1/6 bg-indigo-500 rounded-t-lg h-full relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100">Mai</span></div>
            <div className="w-1/6 bg-indigo-600 rounded-t-lg h-3/5 relative group"><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-600 opacity-100">Juin</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Rapports disponibles</h3>
          <ul className="space-y-3">
            <li 
              className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
              onClick={() => showToast("Export PDF simulé (mock)")}
            >
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-file-pdf text-rose-500"></i>
                <span className="text-sm font-medium text-slate-700">Bilan financier Q2</span>
              </div>
              <i className="fa-solid fa-download text-slate-400"></i>
            </li>
            <li 
              className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
              onClick={() => showToast("Export Excel simulé (mock)")}
            >
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-file-excel text-emerald-500"></i>
                <span className="text-sm font-medium text-slate-700">Export Clients Actifs</span>
              </div>
              <i className="fa-solid fa-download text-slate-400"></i>
            </li>
          </ul>
        </div>
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
