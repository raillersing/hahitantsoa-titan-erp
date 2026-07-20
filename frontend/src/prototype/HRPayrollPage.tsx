import React, { useCallback, useEffect, useState } from "react";
import {
  getEmployees,
  getPaySlips,
  getAdvanceRequests,
  getLeaveRequests,
} from "../api";
import type {
  Employee,
  PaySlip,
  AdvanceRequest,
  LeaveRequest,
} from "../types";

interface HRPayrollPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const PAYSLIP_STATUS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validé",
  paid: "Payé",
};

const ADVANCE_STATUS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Rejetée",
};

const LEAVE_STATUS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Rejetée",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  validated: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  paid: "bg-green-100 text-green-800",
  rejected: "bg-red-50 text-red-700",
};

export default function HRPayrollPage({ onNavigate }: HRPayrollPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<PaySlip[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"payslips" | "advances" | "leaves">(
    "payslips"
  );

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [empData, psData, advData, leaveData] = await Promise.all([
        getEmployees(),
        getPaySlips(),
        getAdvanceRequests(),
        getLeaveRequests(),
      ]);
      setEmployees(empData);
      setPayslips(psData);
      setAdvances(advData);
      setLeaves(leaveData);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("fr-MG", { style: "decimal" }).format(v) + " Ar";

  const totalGross = payslips.reduce((s, p) => s + p.gross_salary, 0);
  const totalDeductions = payslips.reduce((s, p) => s + p.deductions, 0);
  const totalNet = payslips.reduce((s, p) => s + p.net_salary, 0);
  const pendingAdvances = advances.filter((a) => a.status === "pending");
  const pendingLeaves = leaves.filter((l) => l.status === "pending");

  const tabs = [
    { key: "payslips" as const, label: "Bulletins de paie", icon: "fa-file-invoice-dollar", count: payslips.length },
    { key: "advances" as const, label: "Avances", icon: "fa-hand-holding-usd", count: advances.length },
    { key: "leaves" as const, label: "Congés", icon: "fa-umbrella-beach", count: leaves.length },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paie & Congés</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tableau de bord de la paie et des demandes
          </p>
        </div>
        <button
          onClick={() => onNavigate("hr")}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
        >
          <i className="fas fa-users mr-2"></i>Retour aux employés
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-600 hover:text-red-800 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <i className="fas fa-file-invoice-dollar text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {payslips.length} bulletins
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {formatCurrency(totalNet)}
          </p>
          <p className="text-sm text-slate-500 mt-1">Net total payé</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <i className="fas fa-hand-holding-usd text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              {pendingAdvances.length} en attente
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {advances.length}
          </p>
          <p className="text-sm text-slate-500 mt-1">Demandes d'avance</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <i className="fas fa-umbrella-beach text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
              {pendingLeaves.length} en attente
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{leaves.length}</p>
          <p className="text-sm text-slate-500 mt-1">Demandes de congé</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <i className="fas fa-users text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {employees.filter((e) => e.status === "active").length} actifs
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {employees.length}
          </p>
          <p className="text-sm text-slate-500 mt-1">Employés totaux</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className={`fas ${tab.icon} mr-2`}></i>
            {tab.label}
            <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-spinner fa-spin mr-2"></i>Chargement…
          </div>
        ) : (
          <>
            {activeTab === "payslips" && (
              <>
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">
                    <i className="fas fa-file-invoice-dollar mr-2 text-blue-500"></i>
                    Bulletins de paie ({payslips.length})
                  </h3>
                </div>
                {payslips.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <i className="fas fa-file-alt text-3xl mb-3 block"></i>
                    Aucun bulletin de paie enregistré.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Employé</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Période</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600">Brut</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600">Retenues</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600">Net</th>
                          <th className="text-center px-4 py-3 font-semibold text-slate-600">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map((ps) => (
                          <tr key={ps.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3 font-medium text-slate-800">{ps.employee_name}</td>
                            <td className="px-4 py-3 text-slate-600">{ps.period}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(ps.gross_salary)}</td>
                            <td className="px-4 py-3 text-right text-red-600">−{formatCurrency(ps.deductions)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(ps.net_salary)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ps.status]}`}>
                                {PAYSLIP_STATUS[ps.status] || ps.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === "advances" && (
              <>
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">
                    <i className="fas fa-hand-holding-usd mr-2 text-amber-500"></i>
                    Demandes d'avance ({advances.length})
                  </h3>
                </div>
                {advances.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <i className="fas fa-inbox text-3xl mb-3 block"></i>
                    Aucune demande d'avance.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Employé</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600">Montant</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Motif</th>
                          <th className="text-center px-4 py-3 font-semibold text-slate-600">Statut</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {advances.map((adv) => (
                          <tr key={adv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3 font-medium text-slate-800">{adv.employee_name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(adv.amount)}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{adv.reason || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[adv.status]}`}>
                                {ADVANCE_STATUS[adv.status] || adv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {new Date(adv.created_at).toLocaleDateString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === "leaves" && (
              <>
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">
                    <i className="fas fa-umbrella-beach mr-2 text-green-500"></i>
                    Demandes de congé ({leaves.length})
                  </h3>
                </div>
                {leaves.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <i className="fas fa-calendar-times text-3xl mb-3 block"></i>
                    Aucune demande de congé.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Employé</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Du</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Au</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Motif</th>
                          <th className="text-center px-4 py-3 font-semibold text-slate-600">Statut</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600">Demandé le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaves.map((lv) => (
                          <tr key={lv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3 font-medium text-slate-800">{lv.employee_name}</td>
                            <td className="px-4 py-3 text-slate-600">{lv.start_date}</td>
                            <td className="px-4 py-3 text-slate-600">{lv.end_date}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{lv.reason || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[lv.status]}`}>
                                {LEAVE_STATUS[lv.status] || lv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {new Date(lv.created_at).toLocaleDateString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
