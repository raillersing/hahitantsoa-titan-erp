import React, { useState, useEffect, useMemo } from "react";
import { getCashboxSessions, getCashboxMovements, createCashboxMovement } from "../api";
import type { CashboxSession, CashboxMovement, CashboxMovementDirection } from "../types";
import { LoadingSpinner } from "../components";

interface CashboxPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

function formatAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value || "0");
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-MG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function directionLabel(direction: CashboxMovementDirection): string {
  return direction === "cash_in" ? "Entrée" : "Sortie";
}

export default function CashboxPage({ onNavigate }: CashboxPageProps) {
  const [sessions, setSessions] = useState<CashboxSession[]>([]);
  const [movements, setMovements] = useState<CashboxMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"Toutes" | "Entrées" | "Sorties">("Toutes");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [direction, setDirection] = useState<CashboxMovementDirection>("cash_in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch data on mount
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getCashboxSessions(undefined, controller.signal),
      getCashboxMovements(undefined, controller.signal),
    ])
      .then(([sessionsData, movementsData]) => {
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
        setMovements(Array.isArray(movementsData) ? movementsData : []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur lors du chargement des données caisse.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Find open session for creating movements
  const openSession = useMemo(
    () => sessions.find((s) => s.closed_at === null) ?? null,
    [sessions],
  );

  // Compute summary stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayMovements = movements.filter((m) => m.moved_at.startsWith(today));

    const entrees = todayMovements
      .filter((m) => m.direction === "cash_in")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const sorties = todayMovements
      .filter((m) => m.direction === "cash_out")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const solde = entrees - sorties;

    return { entrees, sorties, solde, totalMovements: movements.length };
  }, [movements]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    if (filter === "Toutes") return movements;
    if (filter === "Entrées") return movements.filter((m) => m.direction === "cash_in");
    return movements.filter((m) => m.direction === "cash_out");
  }, [movements, filter]);

  // Create new movement
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openSession || !amount) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createCashboxMovement(openSession.id, {
        direction,
        amount,
        note: note || undefined,
      });

      // Reload data
      const [sessionsData, movementsData] = await Promise.all([
        getCashboxSessions(),
        getCashboxMovements(),
      ]);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setMovements(Array.isArray(movementsData) ? movementsData : []);

      // Reset form
      setShowModal(false);
      setDirection("cash_in");
      setAmount("");
      setNote("");
      showToast(
        direction === "cash_in"
          ? `Entrée de ${Number(amount).toLocaleString()} Ar enregistrée.`
          : `Sortie de ${Number(amount).toLocaleString()} Ar enregistrée.`,
        "success",
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Chargement de la caisse…" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <i className="fas fa-exclamation-triangle text-3xl text-rose-400"></i>
        <p className="text-slate-600 font-medium">{error}</p>
        <button
          className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          onClick={() => window.location.reload()}
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Caisse</h2>
          <p className="text-sm text-slate-500">
            Gestion des encaissements et décaissements journaliers
          </p>
        </div>
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          onClick={() => {
            if (!openSession) {
              showToast("Aucune session de caisse ouverte. Ouvrez une session d'abord.", "error");
              return;
            }
            setShowModal(true);
          }}
        >
          <i className="fa-solid fa-plus mr-2"></i>Nouvelle opération
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-arrow-down"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Entrées du jour</p>
            <p className="text-2xl font-bold text-slate-800">
              {formatAmount(stats.entrees)} Ar
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-arrow-up"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Sorties du jour</p>
            <p className="text-2xl font-bold text-slate-800">
              {formatAmount(stats.sorties)} Ar
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Solde actuel</p>
            <p className="text-2xl font-bold text-slate-800">
              {formatAmount(stats.solde)} Ar
            </p>
          </div>
        </div>
      </div>

      {/* Movements section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Mouvements récents
            <span className="ml-2 text-slate-400 font-normal">
              ({filteredMovements.length} opération{filteredMovements.length !== 1 ? "s" : ""})
            </span>
          </h3>
          <div className="flex gap-2">
            {(["Toutes", "Entrées", "Sorties"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  filter === f
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <i className="fa-solid fa-inbox text-3xl mb-3"></i>
            <p className="text-sm font-medium">Aucun mouvement enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                  <th className="text-left px-4 py-3 rounded-l-lg">Date & Heure</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(movement.moved_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {movement.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          movement.direction === "cash_in"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {directionLabel(movement.direction)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        movement.direction === "cash_in"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {movement.direction === "cash_in" ? "+" : "−"}{" "}
                      {formatAmount(movement.amount)} Ar
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessions info */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Sessions de caisse
            <span className="ml-2 text-slate-400 font-normal">({sessions.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 rounded-xl border ${
                  session.closed_at
                    ? "border-slate-100 bg-slate-50"
                    : "border-emerald-100 bg-emerald-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {session.operator}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      session.closed_at
                        ? "bg-slate-200 text-slate-600"
                        : "bg-emerald-200 text-emerald-700"
                    }`}
                  >
                    {session.closed_at ? "Clôturée" : "Ouverte"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Ouvert {formatDateTime(session.opened_at)}
                  {session.closed_at && ` · Fermé ${formatDateTime(session.closed_at)}`}
                </p>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  Solde net : {formatAmount(session.net_amount)} MGA
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create movement modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Nouvelle opération</h3>
                <button
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Enregistrer une entrée ou une sortie de caisse
              </p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Direction toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Type d'opération
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      direction === "cash_in"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                    onClick={() => setDirection("cash_in")}
                  >
                    <i className="fa-solid fa-arrow-down mr-2"></i>Entrée
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      direction === "cash_out"
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                    onClick={() => setDirection("cash_out")}
                  >
                    <i className="fa-solid fa-arrow-up mr-2"></i>Sortie
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Montant (Ar)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Motif de l'opération (optionnel)"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {submitError && (
                <p className="text-sm text-rose-600 font-medium">{submitError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !amount}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors ${
                    direction === "cash_in"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? (
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fa-solid fa-check mr-2"></i>
                  )}
                  {direction === "cash_in" ? "Enregistrer l'entrée" : "Enregistrer la sortie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium z-50 animate-fade-in ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
