import React, { useEffect, useState } from "react";
import { AppScope } from "../App";
import { LoadingSpinner } from "../components";
import { getUsers, getApplicationRoles } from "../api";
import type { User, ApplicationRole } from "../types";

interface AdminPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function AdminPage({ onNavigate }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [toast, setToast] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Roles state
  const [roles, setRoles] = useState<ApplicationRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUsers() {
      try {
        setUsersLoading(true);
        setUsersError(null);
        const data = await getUsers(undefined, controller.signal);
        setUsers(data);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setUsersError(err.message || "Erreur lors du chargement des utilisateurs.");
        }
      } finally {
        setUsersLoading(false);
      }
    }

    async function loadRoles() {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const data = await getApplicationRoles(controller.signal);
        setRoles(data);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setRolesError(err.message || "Erreur lors du chargement des rôles.");
        }
      } finally {
        setRolesLoading(false);
      }
    }

    loadUsers();
    loadRoles();

    return () => controller.abort();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role_names.some((r) => r.toLowerCase().includes(q))
    );
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page active space-y-6 relative pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Administration & Paramètres</h2>
          <p className="text-sm text-slate-500">Gérez les utilisateurs, rôles, et préférences globales.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 px-6 pt-4 flex gap-6">
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users mr-2"></i>Utilisateurs
          </button>
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('roles')}
          >
            <i className="fas fa-shield-halved mr-2"></i>Rôles & Permissions
          </button>
          <button 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="fas fa-cog mr-2"></i>Paramètres globaux
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur..."
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <button 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
                  onClick={() => showToast("Fonctionnalité en cours de développement")}
                >
                  <i className="fas fa-plus mr-2"></i>Nouvel Utilisateur
                </button>
              </div>

              {usersLoading && (
                <LoadingSpinner message="Chargement des utilisateurs…" />
              )}

              {usersError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {usersError}
                </div>
              )}

              {!usersLoading && !usersError && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                      <th className="py-3 px-4">Nom</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Rôle</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                      <th className="py-3 px-4 text-right">Dernière connexion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          <i className="fas fa-users-slash text-2xl mb-2 block"></i>
                          Aucun utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {user.display_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{user.email}</td>
                          <td className="py-3 px-4">
                            {user.role_names.length > 0 ? (
                              user.role_names.map((role, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold mr-1"
                                >
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold">
                                Aucun rôle
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {user.is_active ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                Actif
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                Inactif
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 text-xs">
                            {user.last_login
                              ? new Date(user.last_login).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Jamais"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <button 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
                  onClick={() => showToast("Fonctionnalité en cours de développement")}
                >
                  <i className="fas fa-plus mr-2"></i>Nouveau Rôle
                </button>
              </div>

              {rolesLoading && (
                <LoadingSpinner message="Chargement des rôles…" />
              )}

              {rolesError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {rolesError}
                </div>
              )}

              {!rolesLoading && !rolesError && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.length === 0 ? (
                    <div className="col-span-2 p-8 text-center text-slate-400">
                      <i className="fas fa-shield-halved text-2xl mb-2 block"></i>
                      Aucun rôle configuré.
                    </div>
                  ) : (
                    roles.map((role) => (
                      <div key={role.id} className="p-4 border border-slate-200 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-800">{role.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            role.is_system_managed
                              ? "bg-slate-100 text-slate-600"
                              : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {role.is_system_managed ? "Système" : "Personnalisé"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                          {role.description || "Aucune description disponible."}
                        </p>
                        <button
                          className="text-indigo-600 text-sm font-bold hover:underline"
                          onClick={() => showToast("Configuration rôle (en cours de développement)")}
                        >
                          Gérer les permissions →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nom de l'organisation</label>
                  <input type="text" defaultValue="Hahitantsoa / Titan ERP" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Devise par défaut</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option>Ariary (Ar)</option>
                    <option>Euro (€)</option>
                    <option>USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Taux de TVA par défaut (%)</label>
                  <input type="number" defaultValue="20" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <button 
                  className="mt-4 px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                  onClick={() => showToast("Paramètres sauvegardés (en cours de développement)")}
                >
                  Sauvegarder les paramètres
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
