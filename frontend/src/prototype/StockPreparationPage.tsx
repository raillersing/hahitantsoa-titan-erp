import React, { useEffect, useRef, useState } from "react";
import {
  addLogisticsEventItemLine,
  createLogisticsEvent,
  getInventoryItems,
  getLogisticsEvents,
  getReservationDrafts,
  transitionLogisticsEvent,
} from "../api";
import { clampQuantity } from "../utils";
import type { InventoryItem, LogisticsEvent, ReservationDraft } from "../types";

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
  preparationEvent: LogisticsEvent | null;
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

function draftToPreparation(
  draft: ReservationDraft,
  inventoryMap: Map<string, InventoryItem>,
  preparationEvent: LogisticsEvent | null,
): Preparation {
  const items: PrepItem[] = draft.lines.map((line) => {
    const invItem = inventoryMap.get(line.inventory_item_id);
    const eventLine = preparationEvent?.item_lines.find((item) => item.inventory_item === line.inventory_item_id);
    return {
      articleId: line.inventory_item_id,
      name: line.inventory_item_name || invItem?.name || line.inventory_item_id,
      qtyOrdered: line.quantity,
      qtyPrepared: Math.min(eventLine?.quantity ?? 0, line.quantity),
      available: invItem?.stock_summary?.available_stock ?? 0,
    };
  });

  let status: Preparation["status"] = "À préparer";
  if (preparationEvent?.status === "completed") {
    status = "Prêt";
  } else if (items.some((i) => i.available < i.qtyOrdered)) {
    status = "Bloqué";
  } else if (items.some((i) => i.available > 0 && i.available < i.qtyOrdered)) {
    status = "Partiel";
  } else if (items.some((i) => i.qtyPrepared > 0)) {
    status = "Partiel";
  }

  return {
    id: draft.id,
    dossierRef: draft.public_reference,
    clientName: draft.customer_display_name,
    dateSortie: formatDate(draft.start_at),
    status,
    items,
    preparationEvent,
  };
}

export default function StockPreparationPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPreparationId, setBusyPreparationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [drafts, items, logisticsEvents] = await Promise.all([
          getReservationDrafts(undefined, signal),
          getInventoryItems(signal).catch(() => []),
          getLogisticsEvents(signal),
        ]);

        const inventoryMap = new Map<string, InventoryItem>();
        items.forEach((item) => inventoryMap.set(item.id, item));

        // Only confirmed reservations are "to prepare"
        const confirmedDrafts = drafts.filter((d) => d.status === "confirmed");
        const preparationEvents = new Map(
          logisticsEvents
            .filter((event) => event.event_type === "preparation" && event.reservation_draft)
            .map((event) => [event.reservation_draft!, event]),
        );
        const mapped = confirmedDrafts.map((d) => draftToPreparation(d, inventoryMap, preparationEvents.get(d.id) ?? null));
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

  const updatePreparedQuantity = (preparationId: string, articleId: string, value: number) => {
    setPreparations((current) => current.map((preparation) => {
      if (preparation.id !== preparationId || preparation.preparationEvent?.status === "completed") return preparation;
      const items = preparation.items.map((item) => item.articleId === articleId
        ? { ...item, qtyPrepared: clampQuantity(value, 0, Math.min(item.qtyOrdered, item.available)) }
        : item);
      const status: Preparation["status"] = items.some((item) => item.available < item.qtyOrdered)
        ? "Bloqué"
        : items.some((item) => item.qtyPrepared > 0)
          ? "Partiel"
          : "À préparer";
      return { ...preparation, items, status };
    }));
  };

  const markPreparationReady = async (preparation: Preparation) => {
    if (preparation.preparationEvent?.status === "completed") return;
    if (preparation.items.some((item) => item.available < item.qtyOrdered)) {
      showToast("La préparation est bloquée : le stock disponible est insuffisant.", "error");
      return;
    }
    if (preparation.items.some((item) => item.qtyPrepared < item.qtyOrdered)) {
      showToast("Préparez la quantité commandée de chaque article avant de marquer le dossier prêt.", "warning");
      return;
    }

    setBusyPreparationId(preparation.id);
    try {
      let event = preparation.preparationEvent;
      if (!event) {
        event = await createLogisticsEvent({
          reservation_draft: preparation.id,
          event_type: "preparation",
          operation: "outbound",
        });
      }
      for (const item of preparation.items) {
        await addLogisticsEventItemLine(event.id, {
          inventory_item_id: item.articleId,
          quantity: item.qtyPrepared,
          notes: "Quantité préparée depuis le volet Préparation stock.",
        });
      }
      if (event.status === "planned") {
        event = await transitionLogisticsEvent(event.id, {
          new_status: "dispatched",
          notes: "Préparation stock commencée.",
        });
      }
      if (event.status === "dispatched") {
        event = await transitionLogisticsEvent(event.id, {
          new_status: "completed",
          notes: "Préparation stock terminée.",
        });
      }
      setPreparations((current) => current.map((item) => item.id === preparation.id
        ? {
            ...item,
            preparationEvent: event,
            status: "Prêt",
            items: item.items.map((line) => ({ ...line, qtyPrepared: line.qtyOrdered })),
          }
        : item));
      showToast(`${preparation.dossierRef} est maintenant prêt.`, "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible d’enregistrer la préparation.", "error");
    } finally {
      setBusyPreparationId(null);
    }
  };

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
                            value={item.qtyPrepared}
                            min={0}
                            max={Math.min(item.qtyOrdered, item.available)}
                            disabled={prep.preparationEvent?.status === "completed"}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              updatePreparedQuantity(prep.id, item.articleId, val);
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
                              disabled={prep.preparationEvent?.status === "completed"}
                              onClick={() => updatePreparedQuantity(prep.id, item.articleId, Math.min(item.qtyOrdered, item.available))}
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
                  type="button"
                  disabled
                  title="La génération du bon de préparation sera disponible après raccordement du document opérationnel."
                >
                  <i className="fas fa-print mr-2"></i>Bon de préparation indisponible
                </button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700"
                  disabled={busyPreparationId === prep.id || prep.preparationEvent?.status === "completed"}
                  onClick={() => void markPreparationReady(prep)}
                >
                  <i className={`fas ${busyPreparationId === prep.id ? "fa-spinner fa-spin" : "fa-check"} mr-2`}></i>{prep.preparationEvent?.status === "completed" ? "Préparation enregistrée" : "Marquer comme Prêt"}
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
