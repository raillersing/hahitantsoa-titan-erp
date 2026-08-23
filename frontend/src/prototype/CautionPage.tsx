import React, { useCallback, useEffect, useState } from "react";
import { getDamageLossSettlements } from "../api";
import type { InventoryDamageLossSettlement } from "../types";

type CautionFilter = "Toutes" | "À traiter" | "Restitution due" | "Clôturées";

function amount(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function filterLabel(settlement: InventoryDamageLossSettlement): Exclude<CautionFilter, "Toutes"> {
  if (settlement.settlement_status === "draft") return "À traiter";
  if (amount(settlement.refund_due) > 0) return "Restitution due";
  return "Clôturées";
}

function formatMoney(value: number | string): string {
  return `${amount(value).toLocaleString("fr-FR")} Ar`;
}

export default function CautionPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [filter, setFilter] = useState<CautionFilter>("Toutes");
  const [settlements, setSettlements] = useState<InventoryDamageLossSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDamageLossSettlements(signal);
      setSettlements(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err?.message || "Impossible de charger les cautions.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const visibleSettlements = settlements.filter((settlement) =>
    filter === "Toutes" || filterLabel(settlement) === filter,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Source réelle des cautions.</strong> Les montants ci-dessous proviennent des règlements casse/perte validés par le backend. La page ne crée plus de fausses sessions de caisse pour simuler une caution.
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les cautions">
            {(["Toutes", "À traiter", "Restitution due", "Clôturées"] as CautionFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === value ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {value}
              </button>
            ))}
          </div>
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => void load()}>
            <i className="fas fa-rotate mr-2" />Actualiser
          </button>
        </div>

        {loading && <div className="p-12 text-center text-slate-500">Chargement des cautions…</div>}
        {error && !loading && <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {!loading && !error && visibleSettlements.length === 0 && <div className="p-12 text-center text-slate-500">Aucun règlement de caution trouvé.</div>}

        {!loading && !error && visibleSettlements.length > 0 && (
          <div className="divide-y divide-slate-100">
            {visibleSettlements.map((settlement) => {
              const status = filterLabel(settlement);
              return (
                <article key={settlement.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-slate-800">Dossier retour {settlement.return_operation}</h2>
                      <p className="mt-1 text-sm text-slate-500">Règlement {settlement.settlement_status === "draft" ? "à traiter" : "enregistré"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${status === "À traiter" ? "bg-amber-100 text-amber-700" : status === "Restitution due" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{status}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Caution disponible</p><p className="mt-1 text-lg font-bold text-slate-800">{formatMoney(settlement.caution_available)}</p></div>
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4"><p className="text-xs font-bold uppercase text-red-600">Retenue</p><p className="mt-1 text-lg font-bold text-red-700">{formatMoney(settlement.caution_applied)}</p></div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold uppercase text-blue-600">À restituer</p><p className="mt-1 text-lg font-bold text-blue-700">{formatMoney(settlement.refund_due)}</p></div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-600">Différence client</p><p className="mt-1 text-lg font-bold text-amber-700">{formatMoney(settlement.excess_due)}</p></div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button type="button" className="rounded-lg bg-tit-600 px-4 py-2 text-sm font-bold text-white hover:bg-tit-700" onClick={() => onNavigate("breakage-loss")}>
                      <i className="fas fa-arrow-up-right-from-square mr-2" />Ouvrir le règlement casse/perte
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
