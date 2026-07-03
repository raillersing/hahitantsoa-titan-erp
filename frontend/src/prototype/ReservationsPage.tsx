import React, { useMemo, useState } from "react";
import { AppScope } from "../App";
import { mockReservations, mockClients, getClient, formatMoney } from "./mockData";

interface ReservationsPageProps {
  onNavigate: (scope: AppScope, param?: string) => void;
}

type FilterKey = "all" | "hahitantsoa" | "titan" | "En cours" | "Proforma" | "Confirmée" | "En sortie" | "Terminée";

export default function ReservationsPage({ onNavigate }: ReservationsPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockReservations.filter(r => {
      const client = getClient(r.clientId);
      const matchesSearch = !q ||
        r.id.toLowerCase().includes(q) ||
        client.name.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ? true :
        filter === "hahitantsoa" ? r.type === "Hahitantsoa" :
        filter === "titan" ? r.type === "Titan" :
        r.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const totalReste = useMemo(() =>
    filtered.reduce((acc, r) => {
      const amount = typeof r.amount === "number" ? r.amount : 0;
      const paid = typeof r.paidAmount === "number" ? r.paidAmount : Math.round(amount / 2);
      return acc + Math.max(0, amount - paid);
    }, 0),
    [filtered]
  );

  return (
    <div className="page active space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Toutes les réservations</h1>
          <p className="text-sm text-slate-500 mt-1">Index consolidé Hahitantsoa + Titan</p>
        </div>
        <button
          onClick={() => onNavigate("reservation-new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>Nouvelle réservation
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Rechercher par ID, client, titre, statut..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "all", label: "Tous" },
              { key: "hahitantsoa", label: "Hahitantsoa" },
              { key: "titan", label: "Titan" },
              { key: "En cours", label: "En cours" },
              { key: "Proforma", label: "Proforma" },
              { key: "Confirmée", label: "Confirmée" },
              { key: "En sortie", label: "Sortie" },
              { key: "Terminée", label: "Terminée" }
            ] as { key: FilterKey; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.key
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span><strong>{filtered.length}</strong> dossier(s)</span>
          <span>•</span>
          <span>Reste à payer total : <strong className="text-rose-600">{formatMoney(totalReste)}</strong></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="px-4 py-3 text-left font-medium rounded-tl-lg">ID</th>
              <th className="px-4 py-3 text-left font-medium">Module</th>
              <th className="px-4 py-3 text-left font-medium">Client</th>
              <th className="px-4 py-3 text-left font-medium">Titre / Objet</th>
              <th className="px-4 py-3 text-left font-medium">Date / Période</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Reste</th>
              <th className="px-4 py-3 text-center font-medium rounded-tr-lg">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => {
              const client = getClient(r.clientId);
              const amount = typeof r.amount === "number" ? r.amount : 0;
              const paid = typeof r.paidAmount === "number" ? r.paidAmount : Math.round(amount / 2);
              const remaining = Math.max(0, amount - paid);
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onNavigate("reservation-detail", r.id)}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {r.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      r.type === "Hahitantsoa"
                        ? "bg-hah-100 text-hah-700 dark:bg-hah-900 dark:text-hah-100"
                        : "bg-tit-100 text-tit-700 dark:bg-tit-900 dark:text-tit-100"
                    }`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onNavigate("customer", client.id)}
                      className="text-left group"
                    >
                      <div className="font-medium text-slate-800 group-hover:text-indigo-600 group-hover:underline">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.email}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.title}</td>
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatMoney(amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-rose-600">{formatMoney(remaining)}</td>
                  <td className="px-4 py-3 text-center rounded-tr-lg">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucune réservation ne correspond à votre recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
