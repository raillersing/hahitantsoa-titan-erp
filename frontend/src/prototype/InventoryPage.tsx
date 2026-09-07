import React, { useState, useEffect } from "react";
import { EmptyState, LoadingSpinner } from "../components";
import { getInventoryItems } from "../api";
import type { InventoryItem, InventoryItemKind } from "../types";

interface InventoryPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
}

const KIND_LABELS: Record<InventoryItemKind, string> = {
  material: "Matériel",
  article: "Article",
  material_pack: "Pack Matériel",
};

const KIND_ICONS: Record<InventoryItemKind, string> = {
  material: "fa-box",
  article: "fa-cube",
  material_pack: "fa-layer-group",
};

function getItemMetrics(item: InventoryItem) {
  const stock = item.stock_summary;
  const reportedStock = stock?.reported_inventory_quantity ?? item.reported_inventory_quantity ?? 0;
  const totalStock = stock?.current_stock ?? reportedStock;
  const brokenLost = stock?.damaged_lost_stock ?? item.reported_damaged_quantity ?? 0;
  const available = stock?.available_stock ?? Math.max(totalStock - brokenLost, 0);
  const rentalPrice = Number(item.rental_price ?? 0);
  const breakagePrice = Number(item.breakage_price ?? 0);
  const isOutOfStock = item.is_active === false || available <= 0;
  const isLowStock = !isOutOfStock && available <= 5;
  return { available, totalStock, rentalPrice, breakagePrice, isOutOfStock, isLowStock };
}

export default function InventoryPage({ onNavigate, canSensitiveWrite = false }: InventoryPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("Tous");
  const [viewMode, setViewMode] = useState<"grid-large" | "grid-medium" | "list" | "compact">("grid-large");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getInventoryItems(controller.signal)
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement du catalogue.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const kindCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});

  const kinds = ["Tous", ...Array.from(new Set(items.map((i) => i.kind)))];

  const filteredData = items.filter((item) => {
    if (filter === "Tous") return true;
    return item.kind === filter;
  });

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Catalogue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Articles et matériels disponibles à la location</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setViewMode("grid-large")} className={`p-2 rounded ${viewMode === 'grid-large' ? 'bg-white dark:bg-slate-700 shadow text-tit-600 dark:text-tit-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} title="Grille large">
              <i className="fas fa-th-large"></i>
            </button>
            <button onClick={() => setViewMode("grid-medium")} className={`p-2 rounded ${viewMode === 'grid-medium' ? 'bg-white dark:bg-slate-700 shadow text-tit-600 dark:text-tit-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} title="Grille moyenne">
              <i className="fas fa-th"></i>
            </button>
            <button onClick={() => setViewMode("list")} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-tit-600 dark:text-tit-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} title="Vue Liste">
              <i className="fas fa-list"></i>
            </button>
            <button onClick={() => setViewMode("compact")} className={`p-2 rounded ${viewMode === 'compact' ? 'bg-white dark:bg-slate-700 shadow text-tit-600 dark:text-tit-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} title="Vue Compacte">
              <i className="fas fa-align-justify"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips by kind */}
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {kinds.map((kind) => {
          const count = kind === "Tous" ? items.length : (kindCounts[kind] || 0);
          const label = kind === "Tous" ? "Tous" : KIND_LABELS[kind as InventoryItemKind] || kind;
          return (
            <button
              key={kind}
              onClick={() => setFilter(kind)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                filter === kind
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
              }`}
            >
              <span>{label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                filter === kind
                  ? "bg-slate-700 text-slate-200 dark:bg-slate-300 dark:text-slate-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <LoadingSpinner size="lg" message="Chargement du catalogue…" />
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-700 p-12 text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              getInventoryItems()
                .then((data) => { setItems(data); setLoading(false); })
                .catch((err) => { setError(err.message); setLoading(false); });
            }}
            className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold transition-colors"
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredData.length === 0 && (
        <EmptyState
          message="Aucun article trouvé dans cette catégorie."
          icon="fa-search"
        />
      )}

      {/* Grid views */}
      {!loading && !error && (viewMode === "grid-large" || viewMode === "grid-medium") && (
        <div className={`grid gap-6 ${viewMode === 'grid-large' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'}`}>
          {filteredData.map((item) => {
            const metrics = getItemMetrics(item);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col"
                onClick={() => onNavigate("inventory-item", item.id)}
              >
                <div className={`${viewMode === 'grid-large' ? 'aspect-square' : 'aspect-[4/3]'} bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative`}>
                  <i className={`fas ${KIND_ICONS[item.kind]} text-slate-300 dark:text-slate-700 ${viewMode === 'grid-large' ? 'text-4xl' : 'text-2xl'}`}></i>
                  <div className="absolute top-2 right-2">
                    {metrics.isOutOfStock ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300 text-[10px] font-bold rounded-full shadow-xs">
                        Rupture
                      </span>
                    ) : metrics.isLowStock ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300 text-[10px] font-bold rounded-full shadow-xs">
                        Faible ({metrics.available})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300 text-[10px] font-bold rounded-full shadow-xs">
                        Dispo: {metrics.available}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`p-3 flex flex-col flex-1 ${viewMode === 'grid-medium' ? 'text-sm' : ''}`}>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 uppercase font-medium">
                    {KIND_LABELS[item.kind] || item.kind}
                  </div>
                  <h3 className={`font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1 line-clamp-2 ${viewMode === 'grid-large' ? 'text-base' : 'text-sm'}`}>
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{item.description}</p>
                  )}
                  <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">
                        {metrics.rentalPrice > 0 ? `${metrics.rentalPrice.toLocaleString()} Ar` : "—"}
                      </span>
                      {metrics.rentalPrice > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500"> / jour</span>}
                    </div>
                    {metrics.breakagePrice > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500" title={`Prix de casse: ${metrics.breakagePrice.toLocaleString()} Ar`}>
                        Casse: {metrics.breakagePrice.toLocaleString()} Ar
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!loading && !error && viewMode === "list" && (
        <div className="flex flex-col gap-4">
          {filteredData.map((item) => {
            const metrics = getItemMetrics(item);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => onNavigate("inventory-item", item.id)}
              >
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                  <i className={`fas ${KIND_ICONS[item.kind]} text-slate-300 dark:text-slate-700 text-xl`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {KIND_LABELS[item.kind] || item.kind}
                    </span>
                    {metrics.isOutOfStock ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[10px] font-bold rounded-full">
                        Rupture
                      </span>
                    ) : metrics.isLowStock ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold rounded-full">
                        Stock faible ({metrics.available} dispo)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                        {metrics.available} disponible{metrics.available > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {metrics.rentalPrice > 0 ? `${metrics.rentalPrice.toLocaleString()} Ar` : "—"}
                  </div>
                  {metrics.breakagePrice > 0 && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Casse: {metrics.breakagePrice.toLocaleString()} Ar
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compact / table view */}
      {!loading && !error && viewMode === "compact" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Nom</th>
                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Disponibilité</th>
                <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Prix location</th>
                <th className="p-3 text-xs font-bold text-slate-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredData.map((item) => {
                const metrics = getItemMetrics(item);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => onNavigate("inventory-item", item.id)}
                  >
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.name}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 text-sm">
                      {KIND_LABELS[item.kind] || item.kind}
                    </td>
                    <td className="p-3 text-center">
                      {metrics.isOutOfStock ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-xs font-bold rounded-full">
                          0
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold rounded-full">
                          {metrics.available}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800 dark:text-slate-100 text-sm">
                      {metrics.rentalPrice > 0 ? `${metrics.rentalPrice.toLocaleString()} Ar` : "—"}
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 text-sm max-w-xs truncate">
                      {item.description || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
