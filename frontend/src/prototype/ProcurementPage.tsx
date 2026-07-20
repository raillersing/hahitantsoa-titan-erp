import React, { useCallback, useEffect, useState } from "react";
import type {
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  PurchaseOrderStatus,
  QuickExpense,
  QuickExpenseCreatePayload,
  QuickExpenseCategory,
} from "../types";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  deletePurchaseOrder,
  getExpenses,
  createExpense,
  deleteExpense,
} from "../api";

interface ProcurementPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: "En attente",
  received: "Reçu",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const CATEGORY_LABELS: Record<QuickExpenseCategory, string> = {
  office: "Bureau",
  transport: "Transport",
  catering: "Restauration",
  maintenance: "Maintenance",
  other: "Autre",
};

export default function ProcurementPage({ onNavigate }: ProcurementPageProps) {
  // ---- Purchase Orders ----
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState<PurchaseOrderCreatePayload>({
    supplier_name: "",
    subject: "",
    amount: "",
    notes: "",
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // ---- Quick Expenses ----
  const [expenses, setExpenses] = useState<QuickExpense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState<QuickExpenseCreatePayload>({
    amount: "",
    category: "other",
    description: "",
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await getPurchaseOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(data);
    } catch (err: any) {
      setOrdersError(err.message || "Erreur lors du chargement des bons de commande.");
    } finally {
      setOrdersLoading(false);
    }
  }, [statusFilter]);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    setExpensesError(null);
    try {
      const data = await getExpenses(expenseCategoryFilter ? { category: expenseCategoryFilter } : undefined);
      setExpenses(data);
    } catch (err: any) {
      setExpensesError(err.message || "Erreur lors du chargement des dépenses.");
    } finally {
      setExpensesLoading(false);
    }
  }, [expenseCategoryFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // ---- Purchase Order CRUD ----
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.supplier_name.trim() || !orderForm.amount) return;
    setOrderSubmitting(true);
    try {
      await createPurchaseOrder(orderForm);
      setOrderForm({ supplier_name: "", subject: "", amount: "", notes: "" });
      setShowOrderForm(false);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm("Supprimer ce bon de commande ?")) return;
    try {
      await deletePurchaseOrder(id);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    }
  };

  // ---- Quick Expense CRUD ----
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount) return;
    setExpenseSubmitting(true);
    try {
      await createExpense(expenseForm);
      setExpenseForm({ amount: "", category: "other", description: "" });
      setShowExpenseForm(false);
      await loadExpenses();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création.");
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    try {
      await deleteExpense(id);
      await loadExpenses();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString("fr-MG", { style: "currency", currency: "MGA", minimumFractionDigits: 0 });
  };

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Approvisionnement</h2>
          <p className="text-sm text-slate-500">Bons de commande fournisseurs et dépenses rapides</p>
        </div>
      </div>

      {/* Purchase Orders Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Bons de commande</h3>
          <div className="flex items-center gap-3">
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="received">Reçu</option>
              <option value="cancelled">Annulé</option>
            </select>
            <button
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              onClick={() => setShowOrderForm(!showOrderForm)}
            >
              <i className="fa-solid fa-plus mr-2"></i>Nouveau bon
            </button>
          </div>
        </div>

        {/* New Order Form */}
        {showOrderForm && (
          <form onSubmit={handleOrderSubmit} className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Fournisseur *</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={orderForm.supplier_name}
                  onChange={(e) => setOrderForm({ ...orderForm, supplier_name: e.target.value })}
                  placeholder="Nom du fournisseur"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Montant (Ar) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={orderForm.amount}
                  onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Objet</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={orderForm.subject}
                onChange={(e) => setOrderForm({ ...orderForm, subject: e.target.value })}
                placeholder="Objet du bon de commande"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                placeholder="Notes complémentaires"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                onClick={() => setShowOrderForm(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={orderSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {orderSubmitting ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {/* Orders Table */}
        {ordersLoading ? (
          <p className="text-sm text-slate-400 py-4">Chargement…</p>
        ) : ordersError ? (
          <p className="text-sm text-rose-500 py-4">{ordersError}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Aucun bon de commande trouvé.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="text-left px-4 py-3 rounded-l-lg">Référence</th>
                <th className="text-left px-4 py-3">Fournisseur</th>
                <th className="text-left px-4 py-3">Objet</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-center px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3 rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{order.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{order.supplier_name}</td>
                  <td className="px-4 py-3 text-slate-500">{order.subject || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(order.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                      onClick={() => handleDeleteOrder(order.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Expenses Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Dépenses rapides</h3>
          <div className="flex items-center gap-3">
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600"
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
            >
              <option value="">Toutes les catégories</option>
              <option value="office">Bureau</option>
              <option value="transport">Transport</option>
              <option value="catering">Restauration</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Autre</option>
            </select>
            <button
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              onClick={() => setShowExpenseForm(!showExpenseForm)}
            >
              <i className="fa-solid fa-plus mr-2"></i>Nouvelle dépense
            </button>
          </div>
        </div>

        {/* New Expense Form */}
        {showExpenseForm && (
          <form onSubmit={handleExpenseSubmit} className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Montant (Ar) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Catégorie</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as QuickExpenseCategory })}
                >
                  <option value="office">Bureau</option>
                  <option value="transport">Transport</option>
                  <option value="catering">Restauration</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Description de la dépense"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                onClick={() => setShowExpenseForm(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {expenseSubmitting ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {/* Expenses Table */}
        {expensesLoading ? (
          <p className="text-sm text-slate-400 py-4">Chargement…</p>
        ) : expensesError ? (
          <p className="text-sm text-rose-500 py-4">{expensesError}</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Aucune dépense rapide enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="text-left px-4 py-3 rounded-l-lg">Date</th>
                <th className="text-left px-4 py-3">Catégorie</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Enregistré par</th>
                <th className="text-right px-4 py-3 rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(expense.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                      {CATEGORY_LABELS[expense.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{expense.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatCurrency(expense.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{expense.recorded_by_display || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                      onClick={() => handleDeleteExpense(expense.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
