import React, { useCallback, useEffect, useState } from "react";
import { getEmployees, createEmployee, deleteEmployee } from "../api";
import type { Employee, EmployeeCreatePayload } from "../types";

interface HRPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  on_leave: "En congé",
  inactive: "Inactif",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  on_leave: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
};

export default function HRPage({ onNavigate }: HRPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeCreatePayload>({
    first_name: "",
    last_name: "",
    role: "",
    assignment: "",
    salary: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmployees();
      setEmployees(data);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role.trim()) return;
    try {
      setSubmitting(true);
      await createEmployee(form);
      setShowForm(false);
      setForm({ first_name: "", last_name: "", role: "", assignment: "", salary: 0 });
      await load();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cet employé ?")) return;
    try {
      await deleteEmployee(id);
      await load();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression.");
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("fr-MG", { style: "decimal" }).format(v) + " Ar";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employés</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestion des ressources humaines
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("hr-payroll")}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <i className="fas fa-money-bill-wave mr-2"></i>Paie & Congés
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-sm"
          >
            <i className="fas fa-plus mr-2"></i>Nouvel employé
          </button>
        </div>
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

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <h3 className="font-bold text-slate-800 mb-4">
            <i className="fas fa-user-plus mr-2 text-slate-400"></i>
            Ajouter un employé
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Fonction *
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Affectation
              </label>
              <input
                type="text"
                value={form.assignment}
                onChange={(e) =>
                  setForm({ ...form, assignment: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Salaire (Ar)
              </label>
              <input
                type="number"
                value={form.salary}
                onChange={(e) =>
                  setForm({ ...form, salary: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                min="0"
                step="1000"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
            >
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">
            <i className="fas fa-users mr-2 text-slate-400"></i>
            Liste des employés ({employees.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-spinner fa-spin mr-2"></i>Chargement…
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fas fa-user-slash text-3xl mb-3 block"></i>
            Aucun employé enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Nom
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Fonction
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Statut
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Affectation
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Salaire
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {emp.full_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status]}`}
                      >
                        {STATUS_LABELS[emp.status] || emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {emp.assignment || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">
                      {formatCurrency(emp.salary)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
