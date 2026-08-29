import React, { useState, useEffect } from "react";
import {
  createDamageLossSettlement,
  createDamageLossSettlementExecution,
  executeDamageLossSettlementExecution,
  generateExcessReceivableInvoice,
  getDamageLossSettlementExecutions,
  getDamageLossSettlements,
  getInventoryItems,
  getReturnOperations,
  validateDamageLossSettlement,
} from "../api";
import type {
  InventoryDamageLossSettlement,
  InventoryDamageLossSettlementCreatePayload,
  InventoryDamageLossSettlementExecution,
  InventoryItem,
  InventoryReturnOperation,
} from "../types";

type FilterStatus = "Tous" | "À traiter" | "Retenue validée" | "Clôturé";

function statusLabel(status: string): FilterStatus {
  if (status === "draft") return "À traiter";
  if (status === "validated") return "Retenue validée";
  return "Clôturé";
}

function statusBadgeClass(status: FilterStatus): string {
  if (status === "À traiter") return "bg-red-100 text-red-700";
  if (status === "Retenue validée") return "bg-blue-100 text-blue-700";
  if (status === "Clôturé") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function BreakageLossPage({ onNavigate, param }: { onNavigate: (scope: any, param?: string) => void; param?: string }) {
  const [filter, setFilter] = useState<FilterStatus>("Tous");
  const [data, setData] = useState<InventoryDamageLossSettlement[]>([]);
  const [executions, setExecutions] = useState<InventoryDamageLossSettlementExecution[]>([]);
  const [returnOperations, setReturnOperations] = useState<InventoryReturnOperation[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [creatingReturnId, setCreatingReturnId] = useState<string | null>(null);
  const [unitAmounts, setUnitAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [busySettlementId, setBusySettlementId] = useState<string | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      getDamageLossSettlements(controller.signal),
      getDamageLossSettlementExecutions(undefined, controller.signal),
      getReturnOperations(controller.signal),
      getInventoryItems(controller.signal),
    ])
      .then(([settlements, settlementExecutions, operations, items]) => {
        if (!cancelled) {
          setData(Array.isArray(settlements) ? settlements : []);
          setExecutions(Array.isArray(settlementExecutions) ? settlementExecutions : []);
          setReturnOperations(Array.isArray(operations) ? operations : []);
          setInventoryItems(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Erreur lors du chargement des dossiers casse/perte.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const scopedReturnIds = new Set(returnOperations
    .filter((operation) => !param || (param.startsWith("titan:")
      ? operation.reservation_draft === param.slice("titan:".length)
      : param.startsWith("hahitantsoa:")
        ? operation.hahitantsoa_event_draft === param.slice("hahitantsoa:".length)
        : true))
    .map((operation) => operation.id));

  const filteredData = data.filter((s) => {
    if (param && !scopedReturnIds.has(s.return_operation)) return false;
    if (filter === "Tous") return true;
    return statusLabel(s.settlement_status) === filter;
  });

  const pendingReturns = returnOperations.filter(
    (operation) =>
      (!param || scopedReturnIds.has(operation.id)) &&
      operation.status === "validated" &&
      !data.some((settlement) => settlement.return_operation === operation.id) &&
      operation.lines.some((line) => line.damaged_quantity > 0 || line.missing_quantity > 0),
  );

  const itemName = (itemId: string) => inventoryItems.find((item) => item.id === itemId)?.name ?? itemId.slice(0, 8);

  const handleCreateSettlement = async (operation: InventoryReturnOperation) => {
    if (creatingReturnId === operation.id) return;
    const affectedLines = operation.lines.flatMap((line) => {
      const amount = unitAmounts[line.id]?.trim() ?? "";
      const proposals: InventoryDamageLossSettlementCreatePayload["lines"] = [];
      if (line.damaged_quantity > 0) {
        proposals.push({
          return_operation_line: line.id,
          manual_label: itemName(line.inventory_item),
          settlement_line_kind: "damage",
          quantity: line.damaged_quantity,
          unit_amount: amount,
          amount_source: "manual",
          notes: line.notes,
        });
      }
      if (line.missing_quantity > 0) {
        proposals.push({
          return_operation_line: line.id,
          manual_label: itemName(line.inventory_item),
          settlement_line_kind: "loss",
          quantity: line.missing_quantity,
          unit_amount: amount,
          amount_source: "manual",
          notes: line.notes,
        });
      }
      return proposals;
    });
    if (affectedLines.length === 0 || affectedLines.some((line) => !line.unit_amount || Number(line.unit_amount) <= 0)) {
      showToast("Saisissez un montant unitaire positif pour chaque article concerné.", "error");
      return;
    }

    setCreatingReturnId(operation.id);
    try {
      const created = await createDamageLossSettlement({
        return_operation: operation.id,
        document_instance: null,
        notes: "Déclaration créée depuis le retour contrôlé.",
        lines: affectedLines,
      });
      setData((current) => [created, ...current]);
      setUnitAmounts((current) => {
        const next = { ...current };
        operation.lines.forEach((line) => delete next[line.id]);
        return next;
      });
      showToast("Dossier casse/perte créé. Vous pouvez maintenant le valider.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Impossible de créer le règlement casse/perte.", "error");
    } finally {
      setCreatingReturnId(null);
    }
  };

  const handleValidate = async (settlement: InventoryDamageLossSettlement) => {
    if (settlement.settlement_status !== "draft" || busySettlementId) return;
    setBusySettlementId(settlement.id);
    try {
      const updated = await validateDamageLossSettlement(settlement.id);
      const createdExecution = await createDamageLossSettlementExecution(updated.id);
      const executed = await executeDamageLossSettlementExecution(createdExecution.id);
      setData((current) => current.map((d) => (d.id === settlement.id ? updated : d)));
      setExecutions((current) => [...current.filter((item) => item.settlement !== executed.settlement), executed]);
      showToast("Règlement validé et imputation de la caution enregistrée.", "success");
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de l'exécution du règlement casse/perte.", "error");
    } finally {
      setBusySettlementId(null);
    }
  };

  const handleGenerateInvoice = async (execution: InventoryDamageLossSettlementExecution) => {
    const receivable = execution.excess_receivable;
    if (!receivable || receivable.status !== "pending_invoice" || busyInvoiceId) return;
    setBusyInvoiceId(execution.id);
    try {
      await generateExcessReceivableInvoice(receivable.id);
      setExecutions((current) => current.map((item) => item.id === execution.id
        ? { ...item, excess_receivable: { ...receivable, status: "invoiced" } }
        : item));
      showToast("Facture de différence générée et enregistrée.", "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible de générer la facture de différence.", "error");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-500">Chargement des dossiers…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {(["Tous", "À traiter", "Retenue validée", "Clôturé"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                  filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate("documents", "templates")}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg flex items-center gap-2 transition"
            title="Consulter les modèles Détails de casse Hahitantsoa et Titan"
          >
            <i className="fas fa-file-invoice text-red-600" />
            <span>Modèles Détails de casse</span>
          </button>
        </div>

        {pendingReturns.length > 0 && (
          <section className="m-6 p-5 rounded-xl border border-amber-200 bg-amber-50" aria-labelledby="pending-damage-loss-title">
            <h2 id="pending-damage-loss-title" className="font-extrabold text-amber-900">Retours à régulariser</h2>
            <p className="mt-1 text-sm text-amber-800">Saisissez la valeur de remplacement ou de réparation avant de créer le dossier financier.</p>
            <div className="mt-4 space-y-4">
              {pendingReturns.map((operation) => {
                const affectedLines = operation.lines.filter((line) => line.damaged_quantity > 0 || line.missing_quantity > 0);
                return (
                  <div key={operation.id} className="p-4 bg-white rounded-lg border border-amber-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>Retour {operation.id.slice(0, 8)}</strong>
                      <span className="text-sm text-slate-500">Retour validé, règlement absent</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {affectedLines.map((line) => (
                        <label key={line.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                          <span>
                            <strong>{itemName(line.inventory_item)}</strong>{" "}
                            — {line.damaged_quantity > 0 ? `${line.damaged_quantity} endommagé(s)` : ""}
                            {line.damaged_quantity > 0 && line.missing_quantity > 0 ? ", " : ""}
                            {line.missing_quantity > 0 ? `${line.missing_quantity} manquant(s)` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <input
                              className="w-36 px-3 py-2 border border-slate-300 rounded-lg"
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Montant unitaire"
                              value={unitAmounts[line.id] ?? ""}
                              onChange={(event) => setUnitAmounts((current) => ({ ...current, [line.id]: event.target.value }))}
                              aria-label={`Montant unitaire ${itemName(line.inventory_item)}`}
                            />
                            <span>Ar</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        disabled={creatingReturnId === operation.id}
                        onClick={() => void handleCreateSettlement(operation)}
                      >
                        {creatingReturnId === operation.id ? "Création…" : "Créer le règlement"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="divide-y divide-slate-100">
          {filteredData.map((s) => {
            const label = statusLabel(s.settlement_status);
            const execution = executions.find((item) => item.settlement === s.id);
            return (
              <div key={s.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-3">
                      <span className="text-red-600">{String(s.id).slice(0, 8)}</span>
                      <span className="text-slate-400 text-sm font-normal">•</span>
                      <span
                        className="text-tit-600 hover:underline cursor-pointer"
                        onClick={() => {
                          const source = returnOperations.find((operation) => operation.id === s.return_operation);
                          onNavigate(
                            "reservation-detail",
                            source?.reservation_draft
                              ? `titan:${source.reservation_draft}`
                              : source?.hahitantsoa_event_draft
                                ? `hahitantsoa:${source.hahitantsoa_event_draft}`
                                : undefined,
                          );
                        }}
                      >
                        {s.return_operation ? String(s.return_operation).slice(0, 8) : "—"}
                      </span>
                    </h3>
                  </div>
                  <div>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusBadgeClass(label)}`}>
                      {label}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="p-3">Article concerné</th>
                        <th className="p-3 text-right">Qté</th>
                        <th className="p-3 text-right">Prix unitaire</th>
                        <th className="p-3 text-right">Montant Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {(s.lines ?? []).map((line) => (
                        <tr key={line.id} className="bg-white">
                          <td className="p-3 font-bold text-slate-800">{line.manual_label || "—"}</td>
                          <td className="p-3 font-bold text-red-600 text-right">{line.quantity}</td>
                          <td className="p-3 text-right">{line.unit_amount.toLocaleString()} Ar</td>
                          <td className="p-3 font-bold text-slate-800 text-right">{line.total_amount.toLocaleString()} Ar</td>
                        </tr>
                      ))}
                      {(s.lines ?? []).length === 0 && (
                        <tr className="bg-white">
                          <td colSpan={4} className="p-3 text-center text-slate-400">Aucune ligne</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Caution Disponible</p>
                    <p className="text-xl font-extrabold text-slate-800 mt-1">{Number(s.caution_available ?? 0).toLocaleString()} Ar</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Montant Retenue</p>
                    <p className="text-xl font-extrabold text-red-700 mt-1">{Number(s.caution_applied ?? 0).toLocaleString()} Ar</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Différence à payer</p>
                    <p className="text-xl font-extrabold text-amber-700 mt-1">{Number(s.excess_due ?? 0).toLocaleString()} Ar</p>
                  </div>
                </div>

                {s.notes && (
                  <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
                    <i className="fas fa-comment-alt mr-2 text-slate-400" />
                    <strong>Notes :</strong> {s.notes}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3 items-center">
                  <button
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1.5 transition"
                    onClick={() => onNavigate("documents", "templates")}
                    title="Consulter les modèles Détails de casse"
                  >
                    <i className="fas fa-eye text-slate-500" />
                    <span>Modèle Détails de casse</span>
                  </button>
                  {s.settlement_status === "draft" && (
                    <button
                      className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
                      disabled={busySettlementId === s.id}
                      onClick={() => handleValidate(s)}
                    >
                      <i className={`fas ${busySettlementId === s.id ? "fa-spinner fa-spin" : "fa-cut"} mr-2`} />
                      {busySettlementId === s.id ? "Traitement…" : "Valider le règlement"}
                    </button>
                  )}
                  {execution?.excess_receivable?.status === "pending_invoice" && (
                    <button
                      className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700"
                      disabled={busyInvoiceId === execution.id}
                      onClick={() => void handleGenerateInvoice(execution)}
                    >
                      <i className={`fas ${busyInvoiceId === execution.id ? "fa-spinner fa-spin" : "fa-file-invoice"} mr-2`} />
                      {busyInvoiceId === execution.id ? "Génération…" : "Créer facture de différence"}
                    </button>
                  )}
                  {execution?.excess_receivable?.status === "invoiced" && (
                    <span className="px-4 py-2 text-sm font-semibold text-emerald-700">Facture de différence enregistrée</span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500">Aucun dossier de casse ou de perte.</div>
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
