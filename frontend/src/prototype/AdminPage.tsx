import React, { useEffect, useState } from "react";
import { AppScope } from "../App";
import { LoadingSpinner } from "../components";
import {
  getUsers,
  getApplicationRoles,
  createApplicationRole,
  getNumberingSequences,
  configureNumberingSequence,
} from "../api";
import type { User, ApplicationRole, NumberingSequence, NumberingSequenceBrand } from "../types";

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
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<ApplicationRole | null>(null);

  // Numbering sequences state
  const [sequences, setSequences] = useState<NumberingSequence[]>([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [sequencesError, setSequencesError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editingBrand, setEditingBrand] = useState<NumberingSequenceBrand | null>(null);
  const [editNextNumber, setEditNextNumber] = useState<number>(1);
  const [editPrefix, setEditPrefix] = useState<string>("");
  const [editPadding, setEditPadding] = useState<number>(3);
  const [editSuffix, setEditSuffix] = useState<string>("/{year}");
  const [savingSequence, setSavingSequence] = useState<boolean>(false);

  const loadSequences = async (year: number) => {
    try {
      setSequencesLoading(true);
      setSequencesError(null);
      const data = await getNumberingSequences(undefined, year);
      setSequences(data);
    } catch (err: any) {
      setSequencesError(err?.message || "Erreur lors du chargement des séquences.");
    } finally {
      setSequencesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "numbering") {
      loadSequences(selectedYear);
    }
  }, [activeTab, selectedYear]);

  const handleSaveSequence = async (brand: NumberingSequenceBrand) => {
    try {
      setSavingSequence(true);
      await configureNumberingSequence({
        brand,
        year: selectedYear,
        next_number: editNextNumber,
        prefix: editPrefix,
        padding: editPadding,
        suffix_template: editSuffix,
      });
      setEditingBrand(null);
      showToast(`Séquence ${brand === "titan" ? "Titan" : "Hahitantsoa"} ${selectedYear} enregistrée.`);
      await loadSequences(selectedYear);
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de l'enregistrement de la séquence.");
    } finally {
      setSavingSequence(false);
    }
  };

  const fetchRoles = async (signal?: AbortSignal) => {
    try {
      setRolesLoading(true);
      setRolesError(null);
      const data = await getApplicationRoles(signal);
      setRoles(data);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setRolesError(err.message || "Erreur lors du chargement des rôles.");
      }
    } finally {
      setRolesLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setRoleError("Le nom du rôle est obligatoire.");
      return;
    }
    const computedSlug =
      newRoleSlug.trim() ||
      newRoleName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setRoleSubmitting(true);
    setRoleError(null);
    try {
      await createApplicationRole({
        name: newRoleName.trim(),
        slug: computedSlug,
        description: newRoleDescription.trim(),
      });
      showToast("Nouveau rôle créé avec succès.");
      setIsRoleModalOpen(false);
      setNewRoleName("");
      setNewRoleSlug("");
      setNewRoleDescription("");
      await fetchRoles();
    } catch (err: any) {
      setRoleError(err?.message || "Erreur lors de la création du rôle.");
    } finally {
      setRoleSubmitting(false);
    }
  };

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

    loadUsers();
    fetchRoles(controller.signal);

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
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'numbering' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('numbering')}
          >
            <i className="fas fa-list-ol mr-2"></i>Numérotation & Séquences
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
                <a
                  href="/admin/auth/user/add/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors inline-flex items-center"
                  title="Ajouter un utilisateur via l'administration Django"
                >
                  <i className="fas fa-plus mr-2"></i>Nouvel Utilisateur (Admin Django)
                </a>
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
                  onClick={() => {
                    setRoleError(null);
                    setNewRoleName("");
                    setNewRoleSlug("");
                    setNewRoleDescription("");
                    setIsRoleModalOpen(true);
                  }}
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
                          type="button"
                          className="text-indigo-600 text-sm font-bold hover:underline"
                          onClick={() => setSelectedRoleDetail(role)}
                        >
                          Détails & Permissions →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'numbering' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Configuration des Séquences Annuelles</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Définissez les numéros de départ (ex: 100, 500) et formats de référence pour les proformas et dossiers par marque et année.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Année :</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const yr = parseInt(e.target.value, 10);
                      setSelectedYear(yr);
                      setEditingBrand(null);
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[selectedYear - 1, selectedYear, selectedYear + 1, selectedYear + 2].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {sequencesLoading && <LoadingSpinner message="Chargement des séquences de numérotation…" />}

              {sequencesError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  {sequencesError}
                </div>
              )}

              {!sequencesLoading && !sequencesError && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(["titan", "hahitantsoa"] as NumberingSequenceBrand[]).map((brand) => {
                    const seq = sequences.find((s) => s.brand === brand);
                    const isEditing = editingBrand === brand;
                    const brandLabel = brand === "titan" ? "Titan (Location de Matériel)" : "Hahitantsoa (Événementiel)";
                    const currentNextNumber = seq ? seq.next_number : 1;
                    const currentPrefix = seq ? seq.prefix : "";
                    const currentPadding = seq ? seq.padding : 3;
                    const currentSuffix = seq ? seq.suffix_template : "/{year}";
                    const currentPreview = seq?.preview_next || `${currentPrefix}${String(currentNextNumber).padStart(currentPadding, "0")}/${selectedYear}`;

                    // preview for edit mode
                    const editComputedPreview = `${editPrefix}${String(editNextNumber).padStart(editPadding, "0")}${editSuffix.replace("{year}", String(selectedYear))}`;

                    return (
                      <div key={brand} className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${brand === "titan" ? "bg-emerald-500" : "bg-indigo-500"}`}></span>
                              <h4 className="font-bold text-slate-800 text-base">{brandLabel}</h4>
                            </div>
                            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                              Année {selectedYear}
                            </span>
                          </div>

                          {!isEditing ? (
                            <div className="space-y-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider mb-1">
                                  Prochaine référence automatique
                                </span>
                                <span className="text-xl font-mono font-bold text-slate-900 tracking-tight">
                                  {currentPreview}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Prochain numéro :</span>
                                  <span className="font-mono font-bold text-slate-800 text-sm">{currentNextNumber}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Format / Préfixe :</span>
                                  <span className="font-mono font-bold text-slate-800 text-sm">
                                    {currentPrefix ? `"${currentPrefix}"` : "(aucun)"} ({currentPadding} chiffres)
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-500 leading-relaxed">
                                Les nouvelles réservations et proformas recevront cette référence par défaut ou le numéro configuré s'incrémentera automatiquement en évitant les collisions.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 border-t border-slate-100 pt-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Prochain numéro de séquence (départ / incrément) :
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editNextNumber}
                                  onChange={(e) => setEditNextNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                  Ex: 100 pour démarrer à 100/{selectedYear}, ou 500 pour démarrer à 500/{selectedYear}.
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Préfixe (optionnel) :
                                  </label>
                                  <input
                                    type="text"
                                    value={editPrefix}
                                    onChange={(e) => setEditPrefix(e.target.value)}
                                    placeholder="Ex: PRO-"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Nombre de chiffres :
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="8"
                                    value={editPadding}
                                    onChange={(e) => setEditPadding(Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 3)))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Modèle de suffixe :
                                </label>
                                <input
                                  type="text"
                                  value={editSuffix}
                                  onChange={(e) => setEditSuffix(e.target.value)}
                                  placeholder="/{year}"
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>

                              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <span className="text-xs text-indigo-600 font-bold block mb-1">Aperçu du prochain proforma :</span>
                                <span className="font-mono font-bold text-indigo-900 text-sm">
                                  {editComputedPreview}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBrand(brand);
                                setEditNextNumber(currentNextNumber);
                                setEditPrefix(currentPrefix);
                                setEditPadding(currentPadding);
                                setEditSuffix(currentSuffix);
                              }}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                            >
                              <i className="fas fa-sliders mr-1"></i> Configurer la séquence
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={savingSequence}
                                onClick={() => setEditingBrand(null)}
                                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                disabled={savingSequence}
                                onClick={() => handleSaveSequence(brand)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5"
                              >
                                {savingSequence ? (
                                  <>
                                    <i className="fas fa-spinner fa-spin mr-1"></i> Enregistrement…
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-check mr-1"></i> Enregistrer
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="space-y-4">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Nom de l'organisation
                    </label>
                    <div className="text-base font-bold text-slate-800">
                      Hahitantsoa / Titan ERP
                    </div>
                    <span className="text-xs text-slate-400">
                      Structure d'exploitation opérationnelle unifiée.
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Devise légale de référence
                    </label>
                    <div className="text-base font-bold text-slate-800">
                      Ariary (Ar / MGA)
                    </div>
                    <span className="text-xs text-slate-400">
                      Monnaie légale unique pour devis, facturation et encaissements à Madagascar.
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Taux de TVA normal applicable
                    </label>
                    <div className="text-base font-bold text-slate-800">
                      20 %
                    </div>
                    <span className="text-xs text-slate-400">
                      Taux légal de la TVA conformément au Code Général des Impôts malgache.
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                  <i className="fas fa-circle-info text-blue-600 mt-0.5"></i>
                  <div className="text-xs text-blue-900 leading-relaxed">
                    <strong>Paramètres d'exploitation verrouillés</strong> : Ces constantes légales et financières sont appliquées à l'ensemble des devis, factures et écritures de caisse du système.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-role-title">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-role-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Nouveau rôle applicatif
              </h3>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {roleError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                <i className="fas fa-exclamation-circle mr-1.5"></i>
                {roleError}
              </div>
            )}

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom du rôle
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => {
                    setNewRoleName(e.target.value);
                    if (!newRoleSlug) {
                      setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }
                  }}
                  placeholder="Ex: Responsable Planning"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Identifiant technique (slug)
                </label>
                <input
                  type="text"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  placeholder="Ex: responsable-planning"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Rôle et responsabilités métier..."
                  rows={3}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  disabled={roleSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {roleSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Création…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i> Créer le rôle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRoleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-role-detail-title">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-role-detail-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {selectedRoleDetail.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRoleDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">Identifiant technique</span>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                  {selectedRoleDetail.slug}
                </code>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">Type de rôle</span>
                <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded ${
                  selectedRoleDetail.is_system_managed
                    ? "bg-slate-100 text-slate-700"
                    : "bg-indigo-50 text-indigo-700"
                }`}>
                  {selectedRoleDetail.is_system_managed ? "Rôle système managé" : "Rôle personnalisé"}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">Description</span>
                <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                  {selectedRoleDetail.description || "Aucune description renseignée."}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedRoleDetail.is_system_managed
                  ? "Les habilitations de ce rôle système sont définies directement par la politique RBAC du serveur d'application."
                  : "Rôle personnalisé administrable. Ses attributions sont gérées au niveau des profils utilisateurs."}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedRoleDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
