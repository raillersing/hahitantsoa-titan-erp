import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  getCashboxSessions,
  getCashboxMovements,
  openCashboxSession,
  createCashboxMovement,
  submitCashboxCount,
  validateCashboxCount,
  reopenCashboxSession,
  getUsers,
  getReservationDrafts,
  getHahitantsoaEventDrafts,
  getPayments,
  recordConfirmedDeposit,
} from "../api";
import type {
  CashboxSession,
  CashboxMovement,
  CashboxMovementDirection,
  User,
  ReservationDraft,
  HahitantsoaEventDraft,
  Payment,
} from "../types";
import { LoadingSpinner } from "../components";
import { useAuth } from "../AuthContext";

interface CashboxPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

// ----------------------------------------------------------------------
// Types & Categories
// ----------------------------------------------------------------------

export interface CashboxCategory {
  id: string;
  direction: CashboxMovementDirection;
  label: string;
  prefix: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const CASH_IN_CATEGORIES: CashboxCategory[] = [
  {
    id: "encaissement_reservation",
    direction: "cash_in",
    label: "Acompte / Règlement Réservation",
    prefix: "[ENCAISSEMENT_RESERVATION]",
    icon: "fa-receipt",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Acompte (50%) ou règlement de solde sur un dossier de réservation ou événement",
  },
  {
    id: "apport",
    direction: "cash_in",
    label: "Apport / Réapprovisionnement",
    prefix: "[APPORT_CAISSE]",
    icon: "fa-vault",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    description: "Injection de liquidités pour le fond de roulement de caisse",
  },
  {
    id: "encaissement_direct",
    direction: "cash_in",
    label: "Encaissement client direct",
    prefix: "[ENCAISSEMENT_DIRECT]",
    icon: "fa-money-bill-wave",
    color: "text-indigo-700 dark:text-indigo-300",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    description: "Paiement comptant / Vente directe sans dossier préalable",
  },
  {
    id: "caution_recue",
    direction: "cash_in",
    label: "Caution reçue en espèces",
    prefix: "[CAUTION_RECUE]",
    icon: "fa-shield-halved",
    color: "text-indigo-700 dark:text-indigo-300",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    description: "Dépôt de garantie en liquide pour matériel ou salle",
  },
  {
    id: "retour_avance",
    direction: "cash_in",
    label: "Rendu de monnaie / Retour d'avance",
    prefix: "[RETOUR_AVANCE]",
    icon: "fa-rotate-left",
    color: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-50 dark:bg-teal-950/40",
    borderColor: "border-teal-200 dark:border-teal-800",
    description: "Restitution de monnaie ou reliquat d'avance par un collaborateur",
  },
  {
    id: "autre_in",
    direction: "cash_in",
    label: "Autre entrée (Motif personnalisé)",
    prefix: "[AUTRE_ENTREE]",
    icon: "fa-circle-plus",
    color: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-50 dark:bg-slate-800",
    borderColor: "border-slate-200 dark:border-slate-700",
    description: "Autre rentrée de fonds exceptionnelle",
  },
];

export const CASH_OUT_CATEGORIES: CashboxCategory[] = [
  {
    id: "menue_depense",
    direction: "cash_out",
    label: "Menues dépenses & Achats urgents",
    prefix: "[MENUE_DEPENSE]",
    icon: "fa-cart-shopping",
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    borderColor: "border-rose-200 dark:border-rose-800",
    description: "Fournitures de bureau, quincaillerie, produits d'entretien",
  },
  {
    id: "transport_carburant",
    direction: "cash_out",
    label: "Transport & Carburant",
    prefix: "[TRANSPORT_CARBURANT]",
    icon: "fa-gas-pump",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800",
    description: "Frais de déplacement, taxi, carburant livraison ou logistique",
  },
  {
    id: "reception_restauration",
    direction: "cash_out",
    label: "Réception & Restauration",
    prefix: "[RECEPTION_RESTAURATION]",
    icon: "fa-mug-hot",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
    borderColor: "border-orange-200 dark:border-orange-800",
    description: "Pause-café, eau minérale, repas équipe événementielle",
  },
  {
    id: "restitution_caution",
    direction: "cash_out",
    label: "Restitution de caution en espèces",
    prefix: "[RESTITUTION_CAUTION]",
    icon: "fa-hand-holding-dollar",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    borderColor: "border-purple-200 dark:border-purple-800",
    description: "Remboursement de dépôt de garantie au client en espèces",
  },
  {
    id: "versement_banque",
    direction: "cash_out",
    label: "Versement bancaire / Dépôt coffre",
    prefix: "[VERSEMENT_BANQUE]",
    icon: "fa-building-columns",
    color: "text-cyan-700 dark:text-cyan-300",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    description: "Évacuation du surplus d'espèces vers la banque ou coffre sécurisé",
  },
  {
    id: "avance_personnel",
    direction: "cash_out",
    label: "Avance sur salaire / frais personnel",
    prefix: "[AVANCE_PERSONNEL]",
    icon: "fa-user-tag",
    color: "text-pink-700 dark:text-pink-300",
    bgColor: "bg-pink-50 dark:bg-pink-950/40",
    borderColor: "border-pink-200 dark:border-pink-800",
    description: "Avance ponctuelle accordée à un collaborateur avec reçu signé",
  },
  {
    id: "autre_out",
    direction: "cash_out",
    label: "Autre sortie (Motif personnalisé)",
    prefix: "[AUTRE_SORTIE]",
    icon: "fa-circle-minus",
    color: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-50 dark:bg-slate-800",
    borderColor: "border-slate-200 dark:border-slate-700",
    description: "Autre décaissement exceptionnel",
  },
];

const ALL_CATEGORIES = [...CASH_IN_CATEGORIES, ...CASH_OUT_CATEGORIES];

export interface UnifiedDossier {
  id: string;
  domain: "titan" | "hahitantsoa";
  reference: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  eventDateLabel?: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  requiredDepositAmount: number;
  cautionAmount: number;
  remainingBalance: number;
  isDepositMet: boolean;
}


export const DENOMINATIONS = [
  { value: 20000, label: "20 000 Ar" },
  { value: 10000, label: "10 000 Ar" },
  { value: 5000, label: "5 000 Ar" },
  { value: 2000, label: "2 000 Ar" },
  { value: 1000, label: "1 000 Ar" },
  { value: 500, label: "500 Ar" },
  { value: 200, label: "200 Ar" },
  { value: 100, label: "100 Ar" },
  { value: 50, label: "50 Ar" },
];

export function getCategoryFromNote(
  note: string | undefined | null,
  direction: CashboxMovementDirection,
): CashboxCategory {
  if (!note) {
    return direction === "cash_in"
      ? CASH_IN_CATEGORIES[CASH_IN_CATEGORIES.length - 1]
      : CASH_OUT_CATEGORIES[CASH_OUT_CATEGORIES.length - 1];
  }
  const match = ALL_CATEGORIES.find((cat) => note.includes(cat.prefix));
  if (match) return match;
  return direction === "cash_in"
    ? CASH_IN_CATEGORIES[CASH_IN_CATEGORIES.length - 1]
    : CASH_OUT_CATEGORIES[CASH_OUT_CATEGORIES.length - 1];
}

export function cleanNoteDescription(note: string | undefined | null): string {
  if (!note) return "—";
  let cleaned = note;
  for (const cat of ALL_CATEGORIES) {
    cleaned = cleaned.replace(cat.prefix, "");
  }
  return cleaned.trim() || "—";
}

export function formatAmount(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value || "0"));
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-MG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-MG", {
    dateStyle: "long",
  }).format(new Date(value));
}

// ----------------------------------------------------------------------
// Main CashboxPage Component
// ----------------------------------------------------------------------

export default function CashboxPage({ onNavigate }: CashboxPageProps) {
  // Authentication context
  let authUser: any = null;
  try {
    const auth = useAuth();
    authUser = auth.state.status === "authenticated" ? auth.state.user : null;
  } catch {
    authUser = null;
  }

  const [sessions, setSessions] = useState<CashboxSession[]>([]);
  const [movements, setMovements] = useState<CashboxMovement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected session (defaults to current open session or most recent)
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"operations" | "sessions">("operations");
  const [filterDirection, setFilterDirection] = useState<"all" | "cash_in" | "cash_out">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementModalDirection, setMovementModalDirection] = useState<CashboxMovementDirection>("cash_in");
  const [showCloseCountModal, setShowCloseCountModal] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<"ticket_z" | "operation_receipt">("ticket_z");
  const [printSelectedMovement, setPrintSelectedMovement] = useState<CashboxMovement | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch initial data
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, movementsData, usersData] = await Promise.all([
        getCashboxSessions(undefined, signal),
        getCashboxMovements(undefined, signal),
        getUsers(undefined, signal).catch(() => []),
      ]);
      const sessionList = Array.isArray(sessionsData) ? sessionsData : [];
      setSessions(sessionList);
      setMovements(Array.isArray(movementsData) ? movementsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);

      if (sessionList.length > 0) {
        // Prefer currently open session, or keep current selection, or fallback to first
        const openSes = sessionList.find((s) => !s.closed_at && s.status === "open");
        setSelectedSessionId((prev) => {
          if (prev && sessionList.some((s) => s.id === prev)) return prev;
          return openSes ? openSes.id : sessionList[0].id;
        });
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Erreur lors du chargement de la caisse.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Selected session object
  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  // Active open session for currently logged-in operator or overall
  const activeOpenSession = useMemo(() => {
    return sessions.find((s) => s.status === "open" && !s.closed_at) || null;
  }, [sessions]);

  // Movements of the selected session
  const sessionMovements = useMemo(() => {
    if (!selectedSession) return [];
    return movements.filter((m) => m.session === selectedSession.id);
  }, [movements, selectedSession]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    let result = sessionMovements;

    if (filterDirection !== "all") {
      result = result.filter((m) => m.direction === filterDirection);
    }

    if (categoryFilter !== "all") {
      result = result.filter((m) => {
        const cat = getCategoryFromNote(m.note, m.direction);
        return cat.id === categoryFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => {
        const desc = (m.note || "").toLowerCase();
        const amt = String(m.amount);
        return desc.includes(q) || amt.includes(q);
      });
    }

    return result;
  }, [sessionMovements, filterDirection, categoryFilter, searchQuery]);

  // Statistics for selected session
  const sessionStats = useMemo(() => {
    if (!selectedSession) {
      return {
        openingAmount: 0,
        totalIn: 0,
        totalOut: 0,
        netMovements: 0,
        theoreticalBalance: 0,
        totalOperations: 0,
        inBreakdown: {} as Record<string, number>,
        outBreakdown: {} as Record<string, number>,
      };
    }

    const openingAmount = Number(selectedSession.opening_amount || 0);
    let totalIn = 0;
    let totalOut = 0;
    const inBreakdown: Record<string, number> = {};
    const outBreakdown: Record<string, number> = {};

    for (const m of sessionMovements) {
      const amt = Number(m.amount || 0);
      const cat = getCategoryFromNote(m.note, m.direction);
      if (m.direction === "cash_in") {
        totalIn += amt;
        inBreakdown[cat.label] = (inBreakdown[cat.label] || 0) + amt;
      } else {
        totalOut += amt;
        outBreakdown[cat.label] = (outBreakdown[cat.label] || 0) + amt;
      }
    }

    const netMovements = totalIn - totalOut;
    const theoreticalBalance = openingAmount + netMovements;

    return {
      openingAmount,
      totalIn,
      totalOut,
      netMovements,
      theoreticalBalance,
      totalOperations: sessionMovements.length,
      inBreakdown,
      outBreakdown,
    };
  }, [selectedSession, sessionMovements]);

  // Check supervisor rights
  const isSupervisor = useMemo(() => {
    if (!authUser) return true; // default lenient in prototype
    return Boolean(
      authUser.is_staff ||
      authUser.is_superuser ||
      authUser.roles?.some((r: string) => ["superadmin", "supervisor", "gerant", "admin"].includes(r.toLowerCase())),
    );
  }, [authUser]);

  // Operator display helper
  const getOperatorName = (operatorId: string | number | undefined | null) => {
    if (!operatorId) return "Opérateur";
    const foundUser = users.find((u) => String(u.id) === String(operatorId));
    if (foundUser) return foundUser.display_name || foundUser.username;
    return `Opérateur #${operatorId}`;
  };

  // Handlers for quick actions
  const handleOpenNewMovement = (dir: CashboxMovementDirection) => {
    if (!activeOpenSession) {
      showToast("Veuillez d'abord ouvrir une session de caisse.", "error");
      setShowOpenModal(true);
      return;
    }
    setMovementModalDirection(dir);
    setShowMovementModal(true);
  };

  const handlePrintReceipt = (m: CashboxMovement) => {
    setPrintSelectedMovement(m);
    setPrintType("operation_receipt");
    setShowPrintModal(true);
  };

  const handlePrintJournalZ = () => {
    setPrintType("ticket_z");
    setShowPrintModal(true);
  };

  if (loading && sessions.length === 0) {
    return <LoadingSpinner message="Chargement du journal de caisse…" />;
  }

  if (error && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <p className="text-slate-700 dark:text-slate-300 font-semibold">{error}</p>
        <button
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          onClick={() => loadData()}
        >
          <i className="fa-solid fa-rotate-right mr-2"></i>Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto pb-16">
      {/* ========================================================================= */}
      {/* HEADER & TOP BAR */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-cash-register text-indigo-600 dark:text-indigo-400"></i>
              Gestion de Caisse
            </h1>

            {/* Session Status Pill */}
            {selectedSession && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  selectedSession.status === "open"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : selectedSession.status === "count_submitted"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedSession.status === "open"
                      ? "bg-emerald-500 animate-pulse"
                      : selectedSession.status === "count_submitted"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />
                {selectedSession.status === "open"
                  ? "Session Ouverte (En cours)"
                  : selectedSession.status === "count_submitted"
                  ? "Comptage Soumis (En attente visa)"
                  : "Session Clôturée & Validée"}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <span>
              <i className="fa-solid fa-user-circle mr-1"></i>
              Caissier : <strong>{selectedSession ? getOperatorName(selectedSession.operator) : "Aucun"}</strong>
            </span>
            <span>•</span>
            <span>
              <i className="fa-regular fa-clock mr-1"></i>
              Ouvert le : {selectedSession ? formatDateTime(selectedSession.opened_at) : "—"}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {/* If no open session, show Open button */}
          {!activeOpenSession && (
            <button
              type="button"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              onClick={() => setShowOpenModal(true)}
            >
              <i className="fa-solid fa-play"></i>
              Ouvrir ma caisse
            </button>
          )}

          {/* Quick Add In / Out */}
          {activeOpenSession && (
            <>
              <button
                type="button"
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                onClick={() => handleOpenNewMovement("cash_in")}
              >
                <i className="fa-solid fa-circle-plus text-emerald-600"></i>
                Ajouter (Entrée)
              </button>

              <button
                type="button"
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                onClick={() => handleOpenNewMovement("cash_out")}
              >
                <i className="fa-solid fa-circle-minus text-rose-600"></i>
                Retirer (Sortie)
              </button>

              <button
                type="button"
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                onClick={() => setShowCloseCountModal(true)}
              >
                <i className="fa-solid fa-calculator text-amber-400"></i>
                Billetage & Clôture
              </button>
            </>
          )}

          {/* Supervisor validation button if count submitted */}
          {selectedSession?.status === "count_submitted" && isSupervisor && (
            <button
              type="button"
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              onClick={() => setShowSupervisorModal(true)}
            >
              <i className="fa-solid fa-signature"></i>
              Valider la clôture
            </button>
          )}

          {/* Print Journal Z */}
          {selectedSession && (
            <button
              type="button"
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              onClick={handlePrintJournalZ}
            >
              <i className="fa-solid fa-print"></i>
              Journal Z (80mm / A4)
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KPI DASHBOARD CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Solde Théorique en Caisse */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Solde Physique Théorique
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatAmount(sessionStats.theoreticalBalance)} <span className="text-sm font-semibold text-slate-400">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Fond ({formatAmount(sessionStats.openingAmount)}) + Net ({formatAmount(sessionStats.netMovements)})
            </p>
          </div>
        </div>

        {/* 2. Total Entrées */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Total Entrées (Cash In)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{formatAmount(sessionStats.totalIn)} <span className="text-sm font-semibold">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {sessionMovements.filter((m) => m.direction === "cash_in").length} encaissement(s)
            </p>
          </div>
        </div>

        {/* 3. Total Sorties */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Total Sorties (Cash Out)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-arrow-trend-down"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              −{formatAmount(sessionStats.totalOut)} <span className="text-sm font-semibold">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {sessionMovements.filter((m) => m.direction === "cash_out").length} décaissement(s)
            </p>
          </div>
        </div>

        {/* 4. Fond de Caisse Initial */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Fond Initial de Caisse
            </span>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-lg">
              <i className="fa-solid fa-coins"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
              {formatAmount(sessionStats.openingAmount)} <span className="text-sm font-semibold text-slate-400">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {selectedSession?.opening_note || "Sans note d'ouverture"}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SESSION SELECTOR / SUPERVISOR DRAWER */}
      {/* ========================================================================= */}
      {sessions.length > 1 && (
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
            <span>Session affichée :</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
            >
              {sessions.map((ses) => (
                <option key={ses.id} value={ses.id}>
                  {ses.status === "open" ? "🟢 [OUVERTE]" : "🔒 [CLÔTURÉE]"} — {getOperatorName(ses.operator)} (du {formatDateTime(ses.opened_at)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "operations" ? "sessions" : "operations")}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-list-check"></i>
              {activeTab === "operations" ? "Voir l'historique complet des sessions" : "Retour aux mouvements"}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OPERATIONS & MOVEMENTS TABLE */}
      {/* ========================================================================= */}
      {activeTab === "operations" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
          {/* Controls Bar: Filters, Search, Category Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            {/* Direction Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setFilterDirection("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterDirection === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Toutes ({sessionMovements.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection("cash_in")}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterDirection === "cash_in"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                }`}
              >
                <i className="fa-solid fa-arrow-down mr-1"></i>
                Entrées ({sessionMovements.filter((m) => m.direction === "cash_in").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection("cash_out")}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filterDirection === "cash_out"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                }`}
              >
                <i className="fa-solid fa-arrow-up mr-1"></i>
                Sorties ({sessionMovements.filter((m) => m.direction === "cash_out").length})
              </button>
            </div>

            {/* Category Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="all">Toutes les catégories de motif</option>
                <optgroup label="Entrées (Cash In)">
                  {CASH_IN_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Sorties (Cash Out)">
                  {CASH_OUT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>

              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Rechercher un motif..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none w-48"
                />
              </div>
            </div>
          </div>

          {/* Movements Table */}
          {filteredMovements.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-3xl mx-auto mb-3">
                <i className="fa-solid fa-inbox"></i>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Aucun mouvement pour cette sélection
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Utilisez les boutons d'action en haut pour enregistrer une entrée ou une sortie.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Motif & Catégorie</th>
                    <th className="py-3 px-4">Description / Tiers</th>
                    <th className="py-3 px-4">Auteur</th>
                    <th className="py-3 px-4 text-right">Montant</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filteredMovements.map((m) => {
                    const cat = getCategoryFromNote(m.note, m.direction);
                    const desc = cleanNoteDescription(m.note);
                    const isCashIn = m.direction === "cash_in";

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatDateTime(m.moved_at)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${cat.bgColor} ${cat.color} ${cat.borderColor}`}
                          >
                            <i className={`fa-solid ${cat.icon}`}></i>
                            {cat.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {desc}
                          </span>
                          {m.payment && (
                            <span className="ml-1 text-[10px] text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                              Paiement #{m.payment.id.slice(0, 6)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {getOperatorName(m.moved_by)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-black text-sm whitespace-nowrap ${
                            isCashIn
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isCashIn ? "+" : "−"} {formatAmount(m.amount)}{" "}
                          <span className="text-xs font-normal">Ar</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(m)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                            title="Imprimer le reçu de caisse"
                          >
                            <i className="fa-solid fa-receipt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORICAL SESSIONS LIST */}
      {/* ========================================================================= */}
      {activeTab === "sessions" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Historique de toutes les sessions de caisse ({sessions.length})
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab("operations")}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Revenir à la session active
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((s) => {
              const isOpen = s.status === "open" && !s.closed_at;
              const isSubmitted = s.status === "count_submitted";
              const isSelected = s.id === selectedSessionId;

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    setActiveTab("operations");
                  }}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm"
                      : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm ${
                          isOpen
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : isSubmitted
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <i className="fa-solid fa-cash-register"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          {getOperatorName(s.operator)}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          ID: #{s.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        isOpen
                          ? "bg-emerald-100 text-emerald-800"
                          : isSubmitted
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isOpen
                        ? "En cours"
                        : isSubmitted
                        ? "Comptage soumis"
                        : "Clôturée"}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="flex justify-between">
                      <span>Ouverture :</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatDateTime(s.opened_at)}
                      </strong>
                    </p>
                    {s.closed_at && (
                      <p className="flex justify-between">
                        <span>Clôture :</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {formatDateTime(s.closed_at)}
                        </strong>
                      </p>
                    )}
                    <p className="flex justify-between">
                      <span>Fond initial :</span>
                      <span>{formatAmount(s.opening_amount)} Ar</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Solde Net :</span>
                      <strong className="text-slate-900 dark:text-white">
                        {formatAmount(s.net_amount)} Ar
                      </strong>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: OPEN CASHBOX SESSION */}
      {/* ========================================================================= */}
      {showOpenModal && (
        <OpenSessionModal
          isOpen={showOpenModal}
          onClose={() => setShowOpenModal(false)}
          users={users}
          currentUserId={authUser?.id}
          onSuccess={(ses) => {
            setShowOpenModal(false);
            showToast("Session de caisse ouverte avec succès.", "success");
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: NEW CASHBOX MOVEMENT (IN / OUT WITH CATEGORIES) */}
      {/* ========================================================================= */}
      {showMovementModal && activeOpenSession && (
        <MovementModal
          isOpen={showMovementModal}
          onClose={() => setShowMovementModal(false)}
          sessionId={activeOpenSession.id}
          initialDirection={movementModalDirection}
          onSuccess={(dir, amount) => {
            setShowMovementModal(false);
            showToast(
              dir === "cash_in"
                ? `Entrée de ${formatAmount(amount)} Ar enregistrée.`
                : `Sortie de ${formatAmount(amount)} Ar enregistrée.`,
              "success",
            );
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BILLETAGE & CLOSE SESSION */}
      {/* ========================================================================= */}
      {showCloseCountModal && activeOpenSession && (
        <CloseCountModal
          isOpen={showCloseCountModal}
          onClose={() => setShowCloseCountModal(false)}
          session={activeOpenSession}
          theoreticalAmount={sessionStats.theoreticalBalance}
          onSuccess={() => {
            setShowCloseCountModal(false);
            showToast("Comptage de caisse soumis pour validation.", "info");
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SUPERVISOR VALIDATION & REOPEN */}
      {/* ========================================================================= */}
      {showSupervisorModal && selectedSession && (
        <SupervisorValidationModal
          isOpen={showSupervisorModal}
          onClose={() => setShowSupervisorModal(false)}
          session={selectedSession}
          onSuccess={() => {
            setShowSupervisorModal(false);
            showToast("Session de caisse validée et clôturée définitivement.", "success");
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PRINT TICKET Z & RECEIPT */}
      {/* ========================================================================= */}
      {showPrintModal && selectedSession && (
        <CashboxPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          session={selectedSession}
          movements={sessionMovements}
          stats={sessionStats}
          operatorName={getOperatorName(selectedSession.operator)}
          printType={printType}
          singleMovement={printSelectedMovement}
        />
      )}

      {/* ========================================================================= */}
      {/* TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl shadow-xl font-bold z-50 animate-fade-in flex items-center gap-2 text-xs ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-amber-600 text-white"
          }`}
        >
          <i
            className={`fa-solid ${
              toast.type === "success"
                ? "fa-check-circle"
                : toast.type === "error"
                ? "fa-triangle-exclamation"
                : "fa-circle-info"
            }`}
          ></i>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL 1: Open Cashbox Session
// ----------------------------------------------------------------------

function OpenSessionModal({
  isOpen,
  onClose,
  users,
  currentUserId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUserId?: string;
  onSuccess: (session: CashboxSession) => void;
}) {
  const [operatorId, setOperatorId] = useState<string>(
    currentUserId ? String(currentUserId) : users[0]?.id ? String(users[0].id) : "",
  );
  const [openingAmount, setOpeningAmount] = useState<string>("0");
  const [openingNote, setOpeningNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ses = await openCashboxSession({
        operator: operatorId || currentUserId || "1",
        opening_amount: Number(openingAmount) || 0,
        opening_note: openingNote.trim(),
      });
      onSuccess(ses);
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de l'ouverture de la session.");
    } finally {
      setSubmitting(false);
    }
  };

  const setPreset = (amt: number) => {
    setOpeningAmount(String(amt));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-door-open text-emerald-600"></i>
              Ouverture de Caisse
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Initialisez votre journée et renseignez votre fond de caisse.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleOpen} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-semibold">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              {error}
            </div>
          )}

          {/* Operator */}
          {users.length > 0 && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Caissier / Opérateur responsable :
              </label>
              <select
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.username} ({u.email || "Utilisateur"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Opening Float Amount */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Fond de caisse initial (en Ariary) :
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="100"
                required
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full p-3 pl-4 pr-12 text-sm font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                Ar
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Raccourcis :</span>
              {[0, 50000, 100000, 200000, 500000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setPreset(amt)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {formatAmount(amt)} Ar
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Note d'ouverture (optionnelle) :
            </label>
            <textarea
              rows={2}
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
              placeholder="Ex: Fond de caisse compté par Jean..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              Confirmer l'ouverture
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL 2: New Movement (Cash In / Out with Categorized Motifs & Dossier POS)
// ----------------------------------------------------------------------

function MovementModal({
  isOpen,
  onClose,
  sessionId,
  initialDirection,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  initialDirection: CashboxMovementDirection;
  onSuccess: (dir: CashboxMovementDirection, amount: number, createdMovement?: CashboxMovement) => void;
}) {
  const [direction, setDirection] = useState<CashboxMovementDirection>(initialDirection);
  const [selectedCatId, setSelectedCatId] = useState<string>(
    initialDirection === "cash_in" ? CASH_IN_CATEGORIES[0].id : CASH_OUT_CATEGORIES[0].id,
  );
  const [amount, setAmount] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [userNote, setUserNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dossier POS state
  const [dossiers, setDossiers] = useState<UnifiedDossier[]>([]);
  const [loadingDossiers, setLoadingDossiers] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<UnifiedDossier | null>(null);
  const [dossierSearch, setDossierSearch] = useState("");
  const [dossierScopeFilter, setDossierScopeFilter] = useState<"all" | "titan" | "hahitantsoa" | "with_balance">("all");

  // Load dossiers and payments when modal is open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingDossiers(true);

    const pReservations =
      typeof getReservationDrafts === "function"
        ? getReservationDrafts().catch(() => [] as ReservationDraft[])
        : Promise.resolve([] as ReservationDraft[]);

    const pHahitantsoa =
      typeof getHahitantsoaEventDrafts === "function"
        ? getHahitantsoaEventDrafts().catch(() => [] as HahitantsoaEventDraft[])
        : Promise.resolve([] as HahitantsoaEventDraft[]);

    const pPayments =
      typeof getPayments === "function"
        ? getPayments().catch(() => [] as Payment[])
        : Promise.resolve([] as Payment[]);

    Promise.all([pReservations, pHahitantsoa, pPayments])
      .then(([titanDrafts, hahitantsoaDrafts, allPayments]) => {
        if (!isMounted) return;

        // Index payments by draft ID
        const paymentsByTitan = new Map<string, number>();
        const paymentsByHahitantsoa = new Map<string, number>();

        allPayments.forEach((p) => {
          if (p.payment_status === "confirmed" || p.payment_status === "reconciled") {
            const amt = Number(p.amount) || 0;
            if (p.reservation_draft) {
              const prev = paymentsByTitan.get(p.reservation_draft) || 0;
              paymentsByTitan.set(p.reservation_draft, prev + amt);
            }
            if (p.hahitantsoa_event_draft) {
              const prev = paymentsByHahitantsoa.get(p.hahitantsoa_event_draft) || 0;
              paymentsByHahitantsoa.set(p.hahitantsoa_event_draft, prev + amt);
            }
          }
        });

        const unified: UnifiedDossier[] = [];

        // Add Titan reservations
        titanDrafts.forEach((r) => {
          const total = Number(r.total_amount || 0);
          const paid = paymentsByTitan.get(r.id) || 0;
          const reqDeposit = Number(r.required_deposit_amount || Math.round(total * 0.5));
          const remaining = Math.max(0, total - paid);
          unified.push({
            id: r.id,
            domain: "titan",
            reference: r.public_reference,
            customerName: r.customer_display_name || "Client Titan",
            eventDateLabel: r.start_at ? `${formatDateOnly(r.start_at)} → ${formatDateOnly(r.end_at)}` : undefined,
            status: r.status,
            totalAmount: total,
            paidAmount: paid,
            requiredDepositAmount: reqDeposit,
            cautionAmount: Math.round(total * 0.2), // Standard 20% caution estimate
            remainingBalance: remaining,
            isDepositMet: paid >= reqDeposit && reqDeposit > 0,
          });
        });

        // Add Hahitantsoa events
        hahitantsoaDrafts.forEach((ev) => {
          const total = Number(ev.space_rental_amount || 0);
          const paid = paymentsByHahitantsoa.get(ev.id) || 0;
          const reqDeposit = Number(ev.required_deposit_amount || Math.round(total * 0.5));
          const remaining = Math.max(0, total - paid);
          unified.push({
            id: ev.id,
            domain: "hahitantsoa",
            reference: ev.public_reference,
            customerName: ev.customer_display_name || ev.event_name || "Client Hahitantsoa",
            eventDateLabel: ev.start_at ? `${formatDateOnly(ev.start_at)} → ${formatDateOnly(ev.end_at)}` : undefined,
            status: ev.status,
            totalAmount: total,
            paidAmount: paid,
            requiredDepositAmount: reqDeposit,
            cautionAmount: 500000,
            remainingBalance: remaining,
            isDepositMet: paid >= reqDeposit && reqDeposit > 0,
          });
        });

        setDossiers(unified);
      })
      .finally(() => {
        if (isMounted) setLoadingDossiers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCategories = direction === "cash_in" ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;
  const activeCategory = currentCategories.find((c) => c.id === selectedCatId) || currentCategories[0];

  const isDossierLinkedCategory =
    selectedCatId === "encaissement_reservation" ||
    selectedCatId === "caution_recue" ||
    selectedCatId === "restitution_caution";

  const handleDirectionSwitch = (dir: CashboxMovementDirection) => {
    setDirection(dir);
    setSelectedCatId(dir === "cash_in" ? CASH_IN_CATEGORIES[0].id : CASH_OUT_CATEGORIES[0].id);
    setSelectedDossier(null);
  };

  const handleSelectDossier = (d: UnifiedDossier) => {
    setSelectedDossier(d);
    setBeneficiary(d.customerName);
    setReference(d.reference);

    // Default amount suggestion: remaining deposit shortfall or remaining balance
    if (selectedCatId === "encaissement_reservation") {
      if (!d.isDepositMet) {
        const depositShortfall = Math.max(0, d.requiredDepositAmount - d.paidAmount);
        setAmount(depositShortfall > 0 ? String(depositShortfall) : String(d.remainingBalance));
      } else {
        setAmount(String(d.remainingBalance));
      }
    } else if (selectedCatId === "caution_recue" || selectedCatId === "restitution_caution") {
      setAmount(String(d.cautionAmount));
    }
  };

  // Filter dossiers
  const filteredDossiers = dossiers.filter((d) => {
    if (dossierScopeFilter === "titan" && d.domain !== "titan") return false;
    if (dossierScopeFilter === "hahitantsoa" && d.domain !== "hahitantsoa") return false;
    if (dossierScopeFilter === "with_balance" && d.remainingBalance <= 0) return false;

    if (dossierSearch.trim()) {
      const q = dossierSearch.toLowerCase();
      const matchRef = d.reference.toLowerCase().includes(q);
      const matchName = d.customerName.toLowerCase().includes(q);
      const matchPhone = d.customerPhone?.toLowerCase().includes(q);
      const matchDate = d.eventDateLabel?.toLowerCase().includes(q);
      if (!matchRef && !matchName && !matchPhone && !matchDate) return false;
    }

    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!amount || numAmt <= 0) {
      setError("Veuillez saisir un montant positif valide.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // Build structured note
    let constructedNote = `${activeCategory.prefix}`;
    if (beneficiary.trim()) {
      constructedNote += ` [Tiers: ${beneficiary.trim()}]`;
    }
    if (reference.trim()) {
      constructedNote += ` [Réf: ${reference.trim()}]`;
    }
    if (userNote.trim()) {
      constructedNote += ` ${userNote.trim()}`;
    }

    try {
      let createdMovement: CashboxMovement | undefined = undefined;

      if (selectedDossier && selectedCatId === "encaissement_reservation") {
        // 1. Atomically record confirmed deposit on the reservation/event draft
        const depositResult = await recordConfirmedDeposit({
          reservation_draft: selectedDossier.domain === "titan" ? selectedDossier.id : null,
          hahitantsoa_event_draft: selectedDossier.domain === "hahitantsoa" ? selectedDossier.id : null,
          payment_method: "cash",
          amount: numAmt.toFixed(2),
          notes: constructedNote.trim(),
          idempotency_key: crypto.randomUUID(),
        });

        // 2. Create linked cashbox movement with payment FK
        createdMovement = await createCashboxMovement(sessionId, {
          direction: "cash_in",
          amount: numAmt,
          payment: depositResult.payment.id,
          note: constructedNote.trim(),
        });
      } else {
        // Standard unlinked or custom movement
        createdMovement = await createCashboxMovement(sessionId, {
          direction,
          amount: numAmt,
          note: constructedNote.trim(),
        });
      }

      onSuccess(direction, numAmt, createdMovement);
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de l'enregistrement du mouvement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i
                className={`fa-solid ${
                  direction === "cash_in" ? "fa-circle-plus text-emerald-600" : "fa-circle-minus text-rose-600"
                }`}
              ></i>
              {direction === "cash_in" ? "Nouvelle Entrée de Caisse" : "Nouvelle Sortie de Caisse"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez la catégorie, le dossier commercial le cas échéant, et renseignez les détails de l'opération.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-semibold flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Direction Switch Tabs */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Type de flux :
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDirectionSwitch("cash_in")}
                className={`p-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  direction === "cash_in"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                }`}
              >
                <i className="fa-solid fa-arrow-down text-emerald-600"></i>
                Entrée (Ajout / Encaissement)
              </button>
              <button
                type="button"
                onClick={() => handleDirectionSwitch("cash_out")}
                className={`p-3 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  direction === "cash_out"
                    ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                }`}
              >
                <i className="fa-solid fa-arrow-up text-rose-600"></i>
                Sortie (Décaissement / Restitution)
              </button>
            </div>
          </div>

          {/* Category Selector Cards */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Motif / Catégorie d'opération :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {currentCategories.map((cat) => {
                const isSelected = cat.id === activeCategory.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`p-2.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? `${cat.borderColor} ${cat.bgColor} ring-2 ring-indigo-500/20`
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                        isSelected ? cat.bgColor : "bg-slate-100 dark:bg-slate-700"
                      }`}
                    >
                      <i className={`fa-solid ${cat.icon} ${cat.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {cat.label}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POS Dossier Selector Section (if applicable) */}
          {isDossierLinkedCategory && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-folder-open text-blue-600"></i>
                  Liaison Dossier Commercial (Réservation / Événement) :
                </label>
                {selectedDossier && (
                  <button
                    type="button"
                    onClick={() => setSelectedDossier(null)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                    Changer de dossier
                  </button>
                )}
              </div>

              {!selectedDossier ? (
                /* Dossier Search & Pick List */
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={dossierSearch}
                      onChange={(e) => setDossierSearch(e.target.value)}
                      placeholder="Rechercher par N° dossier (RES-..., EVT-...), client ou téléphone..."
                      className="w-full p-2.5 pl-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    {dossierSearch && (
                      <button
                        type="button"
                        onClick={() => setDossierSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>

                  {/* Scope filter tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: "all", label: `Tous (${dossiers.length})` },
                      {
                        id: "titan",
                        label: `Titan Location (${dossiers.filter((d) => d.domain === "titan").length})`,
                      },
                      {
                        id: "hahitantsoa",
                        label: `Hahitantsoa (${dossiers.filter((d) => d.domain === "hahitantsoa").length})`,
                      },
                      {
                        id: "with_balance",
                        label: `Avec Solde Dû (${dossiers.filter((d) => d.remainingBalance > 0).length})`,
                      },
                    ].map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setDossierScopeFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          dossierScopeFilter === f.id
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* List of Dossiers */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {loadingDossiers ? (
                      <div className="p-4 text-center text-slate-400">
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        Chargement des dossiers commerciaux...
                      </div>
                    ) : filteredDossiers.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        Aucun dossier trouvé correspondant à votre recherche.
                      </div>
                    ) : (
                      filteredDossiers.slice(0, 15).map((d) => (
                        <div
                          key={d.id}
                          onClick={() => handleSelectDossier(d)}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-black uppercase ${
                                d.domain === "titan"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {d.domain === "titan" ? "Titan" : "Hahitantsoa"}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                <span>{d.reference}</span>
                                <span className="text-slate-400 font-normal">·</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{d.customerName}</span>
                              </p>
                              {d.eventDateLabel && (
                                <p className="text-[10px] text-slate-400">{d.eventDateLabel}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-black text-slate-900 dark:text-white text-[11px]">
                              {formatAmount(d.totalAmount)} Ar
                            </p>
                            <p
                              className={`text-[10px] font-bold ${
                                d.remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"
                              }`}
                            >
                              {d.remainingBalance > 0
                                ? `Reste : ${formatAmount(d.remainingBalance)} Ar`
                                : "Intégralement réglé"}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Selected Dossier Summary Card */
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase ${
                          selectedDossier.domain === "titan"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {selectedDossier.domain === "titan" ? "Titan Location" : "Domaine Hahitantsoa"}
                      </span>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm">
                        {selectedDossier.reference}
                      </h4>
                      <span className="text-slate-400 font-normal">·</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {selectedDossier.customerName}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedDossier.status === "confirmed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {selectedDossier.status === "confirmed" ? "Confirmé" : "Brouillon Devis"}
                    </span>
                  </div>

                  {/* Financial KPI Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-center">
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Devis Total TTC</p>
                      <p className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                        {formatAmount(selectedDossier.totalAmount)} Ar
                      </p>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Déjà Réglé</p>
                      <p className="font-black text-emerald-600 text-xs mt-0.5">
                        {formatAmount(selectedDossier.paidAmount)} Ar
                      </p>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Acompte 50%</p>
                      <p className="font-black text-blue-600 text-xs mt-0.5">
                        {formatAmount(selectedDossier.requiredDepositAmount)} Ar
                      </p>
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Solde Restant</p>
                      <p className="font-black text-rose-600 text-xs mt-0.5">
                        {formatAmount(selectedDossier.remainingBalance)} Ar
                      </p>
                    </div>
                  </div>

                  {/* Quick Fill Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Remplissage rapide :</span>
                    {!selectedDossier.isDepositMet && selectedDossier.requiredDepositAmount > selectedDossier.paidAmount && (
                      <button
                        type="button"
                        onClick={() =>
                          setAmount(
                            String(Math.max(0, selectedDossier.requiredDepositAmount - selectedDossier.paidAmount)),
                          )
                        }
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                      >
                        Acompte 50% (
                        {formatAmount(
                          Math.max(0, selectedDossier.requiredDepositAmount - selectedDossier.paidAmount),
                        )}{" "}
                        Ar)
                      </button>
                    )}

                    {selectedDossier.remainingBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(selectedDossier.remainingBalance))}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                      >
                        Tout Solder ({formatAmount(selectedDossier.remainingBalance)} Ar)
                      </button>
                    )}

                    {selectedDossier.cautionAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(selectedDossier.cautionAmount))}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold rounded-lg border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                      >
                        Caution ({formatAmount(selectedDossier.cautionAmount)} Ar)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Montant à encaisser / décaisser (en Ariary MGA) :
            </label>
            <div className="relative">
              <input
                type="number"
                min="100"
                step="100"
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3.5 pl-4 pr-12 text-base font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                Ar
              </span>
            </div>
          </div>

          {/* Beneficiary & Reference (Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Bénéficiaire / Client / Tiers :
              </label>
              <input
                type="text"
                placeholder="Ex: Jean Dupont, Station Total..."
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Réf. Dossier / Pièce / Facturette :
              </label>
              <input
                type="text"
                placeholder="Ex: RES-2026-001, Facture #1245..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description / Justification détaillée :
            </label>
            <textarea
              rows={2}
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Ex: Versement acompte 50% de réservation..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl font-bold text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                direction === "cash_in"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              Enregistrer l'opération
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL 3: Billetage & Close Count Submission
// ----------------------------------------------------------------------

function CloseCountModal({
  isOpen,
  onClose,
  session,
  theoreticalAmount,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: CashboxSession;
  theoreticalAmount: number;
  onSuccess: () => void;
}) {
  // Counts of each denomination
  const [counts, setCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
  });

  const [directAmount, setDirectAmount] = useState<string>("");
  const [useDirectInput, setUseDirectInput] = useState(false);
  const [varianceJustification, setVarianceJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute calculated cash from denominations
  const totalCountedFromBilletage = Object.entries(counts).reduce(
    (sum, [val, count]) => sum + Number(val) * Number(count || 0),
    0,
  );

  const actualAmount = useDirectInput ? Number(directAmount || 0) : totalCountedFromBilletage;
  const variance = actualAmount - theoreticalAmount;
  const hasVariance = variance !== 0;

  const handleCountChange = (val: number, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [val]: Math.max(0, (prev[val] || 0) + delta),
    }));
  };

  const handleDirectCountSet = (val: number, countStr: string) => {
    const num = Math.max(0, parseInt(countStr, 10) || 0);
    setCounts((prev) => ({
      ...prev,
      [val]: num,
    }));
  };

  const handleSubmitCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasVariance && !varianceJustification.trim()) {
      setError("Une justification détaillée est obligatoire lorsqu'un écart de caisse est constaté.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const idempotencyKey = `cashbox-count-${session.id}-${Date.now()}`;

    try {
      await submitCashboxCount(session.id, {
        actual_amount: actualAmount,
        variance_justification: varianceJustification.trim(),
        idempotency_key: idempotencyKey,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de la soumission du comptage.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-calculator text-amber-500"></i>
              Billetage & Clôture de Caisse
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comptez vos espèces physiques et contrôlez les éventuels écarts avant clôture.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmitCount} className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-semibold">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              {error}
            </div>
          )}

          {/* Theoretical Summary Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                Solde Théorique attendu
              </p>
              <p className="text-xl font-black text-indigo-950 dark:text-indigo-100 mt-0.5">
                {formatAmount(theoreticalAmount)} Ar
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUseDirectInput(!useDirectInput)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {useDirectInput ? "Passer en mode Billetage détaillé" : "Saisie directe rapide"}
            </button>
          </div>

          {/* Billetage Table / Grid */}
          {!useDirectInput ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Comptage par coupure (Ariary MGA) :
                </span>
                <span className="text-[11px] text-slate-400">
                  Total compté : <strong>{formatAmount(totalCountedFromBilletage)} Ar</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {DENOMINATIONS.map((d) => {
                  const count = counts[d.value] || 0;
                  const subtotal = d.value * count;

                  return (
                    <div
                      key={d.value}
                      className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-800 dark:text-slate-200">
                          {d.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {formatAmount(subtotal)} Ar
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleCountChange(d.value, -1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={count}
                          onChange={(e) => handleDirectCountSet(d.value, e.target.value)}
                          className="flex-1 text-center font-bold p-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleCountChange(d.value, 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Montant total physique compté (en Ariary) :
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={directAmount}
                onChange={(e) => setDirectAmount(e.target.value)}
                placeholder="0"
                className="w-full p-3 text-base font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Variance (Écart) Result Box */}
          <div
            className={`p-4 rounded-2xl border ${
              !hasVariance
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : variance > 0
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i
                  className={`fa-solid ${
                    !hasVariance
                      ? "fa-check-circle text-emerald-600 text-lg"
                      : "fa-triangle-exclamation text-lg"
                  }`}
                ></i>
                <div>
                  <p className="font-black text-sm">
                    {!hasVariance
                      ? "Comptage Parfait — Aucun Écart de Caisse"
                      : variance > 0
                      ? `Excédent de Caisse (+${formatAmount(variance)} Ar)`
                      : `Manquant de Caisse (${formatAmount(variance)} Ar)`}
                  </p>
                  <p className="text-[11px] opacity-80">
                    Total Réel : {formatAmount(actualAmount)} Ar vs Attendu : {formatAmount(theoreticalAmount)} Ar
                  </p>
                </div>
              </div>
            </div>

            {hasVariance && (
              <div className="mt-3 pt-3 border-t border-current/20">
                <label className="block font-bold mb-1">
                  Justification obligatoire de l'écart :
                </label>
                <textarea
                  rows={2}
                  required
                  value={varianceJustification}
                  onChange={(e) => setVarianceJustification(e.target.value)}
                  placeholder="Expliquez la cause de l'écart constaté (ex: erreur de rendu de monnaie, oubli de saisie...)"
                  className="w-full p-2.5 rounded-xl border border-current/30 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              Soumettre le comptage du soir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL 4: Supervisor Validation & Reopen
// ----------------------------------------------------------------------

function SupervisorValidationModal({
  isOpen,
  onClose,
  session,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: CashboxSession;
  onSuccess: () => void;
}) {
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const latestClosure = session.closure_attempts?.[0];

  const handleValidate = async () => {
    setSubmitting(true);
    setError(null);
    const idempotencyKey = `cashbox-val-${session.id}-${Date.now()}`;
    try {
      await validateCashboxCount(session.id, {
        idempotency_key: idempotencyKey,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de la validation de clôture.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setError("Un motif précis est obligatoire pour rouvrir une caisse clôturée.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const idempotencyKey = `cashbox-reopen-${session.id}-${Date.now()}`;
    try {
      await reopenCashboxSession(session.id, {
        reason: reopenReason.trim(),
        idempotency_key: idempotencyKey,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || "Échec de la réouverture de la caisse.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-user-shield text-amber-500"></i>
              Validation Superviseur de Caisse
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Vérifiez le comptage soumis et apposez votre visa officiel.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-semibold">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              {error}
            </div>
          )}

          {latestClosure ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Solde théorique :</span>
                <strong>{formatAmount(latestClosure.theoretical_amount)} Ar</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant réel compté :</span>
                <strong className="text-slate-900 dark:text-white font-black">
                  {formatAmount(latestClosure.actual_amount)} Ar
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Écart constaté :</span>
                <strong
                  className={
                    Number(latestClosure.variance_amount) === 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }
                >
                  {formatAmount(latestClosure.variance_amount)} Ar
                </strong>
              </div>
              {latestClosure.variance_justification && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Justification du caissier :
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestClosure.variance_justification}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 italic">Aucun comptage soumis en attente.</p>
          )}

          {isReopening ? (
            <form onSubmit={handleReopen} className="space-y-3 pt-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Motif obligatoire de réouverture :
              </label>
              <textarea
                rows={2}
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Ex: Oubli d'enregistrement d'un encaissement..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReopening(false)}
                  className="px-3 py-2 rounded-xl text-slate-500 font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  Confirmer la réouverture
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReopening(true)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Rouvrir la caisse avec motif
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-signature"></i>
                )}
                Apposer le Visa & Clôturer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL 5: CashboxPrintModal (Ticket Z & Operation Receipt)
// ----------------------------------------------------------------------

function CashboxPrintModal({
  isOpen,
  onClose,
  session,
  movements,
  stats,
  operatorName,
  printType,
  singleMovement,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: CashboxSession;
  movements: CashboxMovement[];
  stats: any;
  operatorName: string;
  printType: "ticket_z" | "operation_receipt";
  singleMovement: CashboxMovement | null;
}) {
  const [paperFormat, setPaperFormat] = useState<"80mm" | "A4">("80mm");

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-print text-indigo-600"></i>
              {printType === "ticket_z" ? "Journal Z de Caisse (Clôture)" : "Reçu d'Opération de Caisse"}
            </h3>

            {/* Format toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setPaperFormat("80mm")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  paperFormat === "80mm"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500"
                }`}
              >
                Ticket 80 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat("A4")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  paperFormat === "A4"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500"
                }`}
              >
                Format A4
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-print"></i>
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950 flex justify-center max-h-[75vh] overflow-y-auto">
          {paperFormat === "80mm" ? (
            /* ================= TICKET THERMIQUE 80MM ================= */
            <div className="bg-white text-slate-900 p-6 rounded-xl shadow-md w-80 font-mono text-[11px] leading-tight space-y-3 border border-slate-200">
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <p className="font-black text-sm tracking-wider uppercase">
                  HAHITANTSOA / TITAN ERP
                </p>
                <p className="text-[10px] text-slate-500">Antananarivo · Madagascar</p>
                <p className="font-bold mt-1 text-xs uppercase">
                  {printType === "ticket_z" ? "JOURNAL Z DE CAISSE" : "REÇU D'OPÉRATION"}
                </p>
              </div>

              <div className="space-y-1 text-[10px]">
                <p className="flex justify-between">
                  <span>Session N° :</span>
                  <strong>#{session.id.slice(0, 8)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Caissier :</span>
                  <strong>{operatorName}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Date :</span>
                  <span>{formatDateOnly(session.opened_at)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Période :</span>
                  <span>
                    {formatDateTime(session.opened_at).slice(-5)} →{" "}
                    {session.closed_at ? formatDateTime(session.closed_at).slice(-5) : "En cours"}
                  </span>
                </p>
              </div>

              {printType === "ticket_z" ? (
                <>
                  <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                    <p className="flex justify-between font-bold">
                      <span>Fond de caisse initial :</span>
                      <span>{formatAmount(stats.openingAmount)} Ar</span>
                    </p>
                    <p className="flex justify-between text-emerald-700">
                      <span>Total Encaissements (+) :</span>
                      <span>+{formatAmount(stats.totalIn)} Ar</span>
                    </p>
                    <p className="flex justify-between text-rose-700">
                      <span>Total Décaissements (−) :</span>
                      <span>−{formatAmount(stats.totalOut)} Ar</span>
                    </p>
                    <p className="flex justify-between font-black text-xs pt-1 border-t border-slate-900">
                      <span>SOLDE THÉORIQUE :</span>
                      <span>{formatAmount(stats.theoreticalBalance)} Ar</span>
                    </p>
                  </div>

                  {/* Movements summary list */}
                  <div className="pt-2 border-t border-dashed border-slate-300">
                    <p className="font-bold text-[10px] uppercase mb-1">
                      Mouvements ({movements.length}) :
                    </p>
                    <div className="space-y-1 text-[9px]">
                      {movements.map((m) => (
                        <div key={m.id} className="flex justify-between">
                          <span className="truncate max-w-[170px]">
                            {m.direction === "cash_in" ? "+" : "−"}{" "}
                            {cleanNoteDescription(m.note)}
                          </span>
                          <span className="font-bold">
                            {formatAmount(m.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : singleMovement ? (
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-2">
                  <p className="font-bold text-center text-xs">
                    {singleMovement.direction === "cash_in"
                      ? "ENCAISSEMENT D'ESPÈCES"
                      : "DÉCAISSEMENT D'ESPÈCES"}
                  </p>
                  <p className="flex justify-between">
                    <span>Montant :</span>
                    <strong className="text-sm">
                      {formatAmount(singleMovement.amount)} Ar
                    </strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Motif :</span>
                    <span>{cleanNoteDescription(singleMovement.note)}</span>
                  </p>
                </div>
              ) : null}

              {/* Signatures */}
              <div className="pt-4 border-t border-dashed border-slate-400 grid grid-cols-2 gap-2 text-[9px] text-center">
                <div>
                  <p className="font-bold">Visa Caissier</p>
                  <div className="h-10 mt-1 border border-slate-200 rounded"></div>
                </div>
                <div>
                  <p className="font-bold">Visa Superviseur</p>
                  <div className="h-10 mt-1 border border-slate-200 rounded"></div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= FORMAT A4 ================= */
            <div className="bg-white text-slate-900 p-8 rounded-xl shadow-md w-full max-w-xl font-sans text-xs space-y-6 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    HAHITANTSOA & TITAN ERP
                  </h1>
                  <p className="text-xs text-slate-500">
                    Système de Gestion Commerciale, Événements & Location
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-white font-bold rounded-lg text-xs uppercase">
                    {printType === "ticket_z" ? "Journal Z de Caisse" : "Reçu de Caisse"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Session #{session.id.slice(0, 8)}
                  </p>
                </div>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                <div>
                  <p className="text-slate-500">Caissier responsable :</p>
                  <p className="font-bold text-slate-900">{operatorName}</p>
                  <p className="text-slate-500 mt-2">Date d'ouverture :</p>
                  <p className="font-semibold">{formatDateTime(session.opened_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Statut de clôture :</p>
                  <p className="font-bold text-slate-900 uppercase">
                    {session.status === "open" ? "Ouverte" : "Clôturée"}
                  </p>
                  <p className="text-slate-500 mt-2">Date de fermeture :</p>
                  <p className="font-semibold">{formatDateTime(session.closed_at)}</p>
                </div>
              </div>

              {/* Financial Recap */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Fond Initial</p>
                  <p className="text-base font-black text-slate-900">
                    {formatAmount(stats.openingAmount)} Ar
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
                  <p className="text-[10px] font-bold uppercase">Total Entrées</p>
                  <p className="text-base font-black">
                    +{formatAmount(stats.totalIn)} Ar
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
                  <p className="text-[10px] font-bold uppercase">Total Sorties</p>
                  <p className="text-base font-black">
                    −{formatAmount(stats.totalOut)} Ar
                  </p>
                </div>
              </div>

              {/* Movements Table */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase text-xs mb-2">
                  Détail chronologique des opérations
                </h4>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="p-2 border border-slate-200">Heure</th>
                      <th className="p-2 border border-slate-200">Type / Motif</th>
                      <th className="p-2 border border-slate-200">Description</th>
                      <th className="p-2 border border-slate-200 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="p-2 border border-slate-200">
                          {formatDateTime(m.moved_at).slice(-5)}
                        </td>
                        <td className="p-2 border border-slate-200 font-semibold">
                          {getCategoryFromNote(m.note, m.direction).label}
                        </td>
                        <td className="p-2 border border-slate-200">
                          {cleanNoteDescription(m.note)}
                        </td>
                        <td
                          className={`p-2 border border-slate-200 text-right font-bold ${
                            m.direction === "cash_in" ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {m.direction === "cash_in" ? "+" : "−"} {formatAmount(m.amount)} Ar
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t">
                <div className="border border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                  <span className="font-bold text-slate-500 text-[10px]">Visa & Signature du Caissier</span>
                </div>
                <div className="border border-slate-300 rounded-xl p-3 h-24 flex flex-col justify-between">
                  <span className="font-bold text-slate-500 text-[10px]">Visa & Signature du Responsable</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
