import React, { useEffect, useRef, useState } from "react";
import { getReservationDrafts, getInventoryItems } from "../api";
import { clampQuantity } from "../utils";
import type { ReservationDraft, InventoryItem } from "../types";

type PrepItem = {
  articleId: string;
  name: string;
  qtyOrdered: number;
  qtyPrepared: number;
  available: number;
};

type Preparation = {
  id: string;
  dossierRef: string;
  clientName: string;
  dateSortie: string;
  status: "À préparer" | "Partiel" | "Prêt" | "Bloqué";
  items: PrepItem[];
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function draftToPreparation(draft: ReservationDraft, inventoryMap: Map<string, InventoryItem>): Preparation {
  const items: PrepItem[] = draft.lines.map((line) => {
    const invItem = inventoryMap.get(line.inventory_item_id);
    return {
      articleId: line.inventory_item_id,
      name: line.inventory_item_name || invItem?.name || line.inventory_item_id,
      qtyOrdered: line.quantity,
      qtyPrepared: 0,
      available: 0, // TODO: real availability when stock-availability API is ready
    };
  });

  // Determine status based on available vs ordered
  let status: Preparation["status"] = "À préparer";
  if (items.every((i) => i.available >= i.qtyOrdered)) {
    status = "Prêt";
  } else if (items.some((i) => i.available > 0 && i.available < i.qtyOrdered)) {
    status = "Partiel";
  }

  return {
    id: draft.id,
    dossierRef: draft.public_reference,
    clientName: draft.customer_display_name,
    dateSortie: formatDate(draft.start_at),
    status,
    items,
  };
}

export default function StockPreparationPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("À préparer");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [drafts, items] = await Promise.all([
          getReservationDrafts(undefined, signal),
          getInventoryItems(signal).catch(() => []),
        ]);

        const inventoryMap = new Map<string, InventoryItem>();
        items.forEach((item) => inventoryMap.set(item.id, item));

        // Only confirmed reservations are "to prepare"
        const confirmedDrafts = drafts.filter((d) => d.status === "confirmed");
        const mapped = confirmedDrafts.map((d) => draftToPreparation(d, inventoryMap));
        setPreparations(mapped);
      } catch (err: any) {
        if (signal.aborted) return;
        setError(err?.message || "Erreur lors du chargement des données.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    fetchData();
    return () => abortRef.current?.abort();
  }, []);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredData = preparations.filter((p) => {
    if (filter === "Tous") return true;
    return p.status === filter;
  });

  const filterCounts = {
    "Tous": preparations.length,
    "À préparer": preparations.filter((p) => p.status === "À préparer").length,
    "Partiel": preparations.filter((p) => p.status === "Partiel").length,
    "Prêt": preparations.filter((p) => p.status === "Prêt").length,
    "Bloqué": preparations.filter((p) => p.status === "Bloqué").length,
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-tit-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Chargement des préparations…</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
          <div className="flex flex-col items-center gap-4">
            <i className="fas fa-exclamation-triangle text-3xl text-red-500"></i>
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {(["Tous", "À préparer", "Partiel", "Prêt", "Bloqué"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  filter === f
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {f}
                {filterCounts[f] > 0 && (
                  <span className={`ml-1.5 text-xs ${filter === f ? "text-slate-300" : "text-slate-400"}`}>
                    {filterCounts[f]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredData.map((prep) => (
            <div key={prep.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span
                      className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer"
                      onClick={() => onNavigate("reservation-detail", prep.dossierRef)}
                    >
                      {prep.dossierRef}
                    </span>
                    <span className="text-slate-400 text-sm font-normal">•</span>
                    <span>{prep.clientName}</span>
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <i className="fas fa-calendar-alt mr-2"></i>Sortie prévue le {prep.dateSortie}
                  </p>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 text-sm font-bold rounded-full ${
                      prep.status === "Prêt"
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                        : prep.status === "Partiel"
                        ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                        : prep.status === "Bloqué"
                        ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                        : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {prep.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Article</th>
                      <th className="p-3 text-right">Commandé</th>
                      <th className="p-3 text-right">Dispo.</th>
                      <th className="p-3 text-center">Préparé</th>
                      <th className="p-3 text-right">Reste</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {prep.items.map((item) => (
                      <tr key={item.articleId} className="bg-white dark:bg-slate-800">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{item.qtyOrdered}</td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-bold ${
                              item.available >= item.qtyOrdered
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {item.available}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-blue-600 text-center">
                          <input
                            type="number"
                            className="w-20 text-center border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 shadow-sm font-bold focus:ring-tit-500 focus:border-tit-500 mx-auto"
                            defaultValue={item.qtyPrepared}
                            min={0}
                            max={Math.min(item.qtyOrdered, item.available)}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              e.target.value = clampQuantity(
                                val,
                                0,
                                Math.min(item.qtyOrdered, item.available),
                              ).toString();
                            }}
                          />
                        </td>
                        <td className="p-3 font-bold text-amber-600 dark:text-amber-400 text-right">
                          {item.qtyOrdered - item.qtyPrepared}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                              title="Préparer le max possible"
                              onClick={() =>
                                showToast(`Quantité max préparée pour ${item.name}`, "success")
                              }
                            >
                              Mettre au max
                            </button>
                            {item.available < item.qtyOrdered && (
                              <button
                                className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded hover:bg-red-100 dark:hover:bg-red-900/50"
                                title="Remplacer l'article"
                                onClick={() =>
                                  showToast(
                                    `Sélection d'un article de remplacement pour ${item.name}...`,
                                    "info",
                                  )
                                }
                              >
                                <i className="fas fa-exchange-alt"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  onClick={() =>
                    showToast(`Aperçu du bon de préparation pour ${prep.dossierRef}`, "info")
                  }
                >
                  <i className="fas fa-print mr-2"></i>Bon de préparation
                </button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
                  onClick={() =>
                    showToast(`${prep.dossierRef} marqué comme PRÊT !`, "success")
                  }
                >
                  <i className="fas fa-check mr-2"></i>Marquer comme Prêt
                </button>
              </div>
            </div>
          ))}

          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Aucun dossier à préparer dans cette vue.
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "warning"
              ? "bg-amber-500 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-slate-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
