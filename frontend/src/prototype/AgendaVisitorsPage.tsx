import React, { useEffect, useState } from "react";
import { getCustomers } from "../api";
import type { Customer } from "../types";
import { LoadingSpinner, EmptyState } from "../components";

interface AgendaVisitorsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const FILTERS = ["Tous", "Clients", "Prospects", "Prestataires", "Aujourd'hui"];

export default function AgendaVisitorsPage({ onNavigate }: AgendaVisitorsPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("Tous");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  // New visitor form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newMotif, setNewMotif] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newHeure, setNewHeure] = useState("09:00");
  const [newStatut, setNewStatut] = useState<"En attente" | "Confirmé">("En attente");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const loadCustomers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch {
      setLoadError("Impossible de charger les visiteurs. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetch = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getCustomers(undefined, controller.signal);
        if (!cancelled) setCustomers(data);
      } catch {
        if (!cancelled) setLoadError("Impossible de charger les visiteurs. Réessayez.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const mapToVisitor = (c: Customer) => ({
    id: c.id,
    name: c.display_name || "Visiteur",
    email: c.email,
    phone: c.phone,
    type: c.party_type === "company" ? "Entreprise" : "Particulier",
    status: c.lifecycle_status === "prospect" ? "Prospect" : "Client",
    motif: c.notes || "—",
    lastVisit: c.last_activity_at
      ? new Date(c.last_activity_at).toLocaleDateString("fr-FR")
      : "—",
    reservationCount: c.reservation_count ?? 0,
    eventCount: c.event_count ?? 0,
  });

  const filtered = customers
    .filter((c) => c.is_active && !c.is_deleted)
    .map(mapToVisitor)
    .filter((v) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterType === "Clients" && v.status !== "Client") return false;
      if (filterType === "Prospects" && v.status !== "Prospect") return false;
      if (filterType === "Prestataires" && v.type !== "Entreprise") return false;
      return true;
    });

  const handleCreateVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    showToast(`Visiteur « ${newName} » enregistré — ${newDate} à ${newHeure}`);
    setShowForm(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewMotif("");
    setNewStatut("En attente");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmé":
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Confirmé</span>;
      case "En attente":
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">En attente</span>;
      case "Terminé":
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">Terminé</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="page active space-y-6 relative pb-10">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Agenda Visiteurs</h2>
          <p className="text-sm text-slate-500">Registre des visites, réunions commerciales et prestataires.</p>
        </div>
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
          onClick={() => setShowForm(true)}
        >
          <i className="fas fa-plus mr-2"></i>Nouveau visiteur
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <LoadingSpinner size="md" message="Chargement des visiteurs…" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <i className="fas fa-exclamation-triangle text-3xl text-red-400 mb-3"></i>
          <p className="text-red-600 font-medium mb-4">{loadError}</p>
          <button
            onClick={loadCustomers}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Content (visible when not loading) */}
      {!isLoading && !loadError && (
        <>
          {/* Filters + search */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    filterType === f
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setFilterType(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Rechercher un visiteur…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <EmptyState
                title="Aucun visiteur"
                message="Aucun visiteur ne correspond à votre recherche ou filtre."
                icon="fa-calendar-times"
              />
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Visiteur</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4">Dernière activité</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{v.name}</div>
                        <div className="text-xs text-slate-500">
                          {v.status === "Client" ? "Client" : "Prospect"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">{v.email || "—"}</div>
                        <div className="text-xs text-slate-500">{v.phone || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600">{v.type}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge("En attente")}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{v.lastVisit}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Voir"
                          onClick={() => onNavigate("customer", v.id)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{filtered.length}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">Visiteurs affichés</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {filtered.filter((v) => v.status === "Client").length}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">Clients</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {filtered.filter((v) => v.status === "Prospect").length}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">Prospects</div>
            </div>
          </div>
        </>
      )}

      {/* Nouveau visiteur modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative animate-fade-in">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <i className="fas fa-times text-lg"></i>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-1">Nouveau visiteur</h3>
            <p className="text-sm text-slate-500 mb-6">Enregistrer une nouvelle visite ou rendez-vous.</p>

            <form onSubmit={handleCreateVisitor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Rakoto Jean"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="email@exemple.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="034 00 000 00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motif de la visite</label>
                <input
                  type="text"
                  value={newMotif}
                  onChange={(e) => setNewMotif(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Visite salle, maintenance…"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Heure</label>
                  <select
                    value={newHeure}
                    onChange={(e) => setNewHeure(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(
                      (h) => (
                        <option key={h} value={h}>{h}</option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
                  <select
                    value={newStatut}
                    onChange={(e) => setNewStatut(e.target.value as "En attente" | "Confirmé")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="En attente">En attente</option>
                    <option value="Confirmé">Confirmé</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  <i className="fas fa-calendar-plus mr-2"></i>Enregistrer la visite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
