import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AdminDialog } from "./AdminDialog";
import { AppScope } from "../App";
import { LoadingSpinner } from "../components";
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  getApplicationRoles,
  createApplicationRole,
  getNumberingSequences,
  configureNumberingSequence,
  getIdentitySessions,
  revokeDeviceSession,
} from "../api";
import type {
  User,
  ApplicationRole,
  NumberingSequence,
  NumberingSequenceBrand,
  NumberingSequenceType,
  IdentitySessionsListResponse,
  UserDeviceSession,
} from "../types";
import { getRolePresentation, ROLE_PRESENTATION_CATALOG, type RolePresentationInfo } from "./rolePresentation";
import { getDeviceIcon, formatSessionDateTime } from "./SecuritySessionsModal";

const DEFAULT_SUFFIX_BY_TYPE: Record<NumberingSequenceType, string> = {
  proforma: "/{year}",
  invoice: "/{year}-FA",
  delivery_note: "/{year}-BL",
};

const SEQUENCE_TYPE_INFO: Record<NumberingSequenceType, {
  label: string;
  badge: string;
  previewName: string;
  description: string;
  exampleStart: string;
}> = {
  proforma: {
    label: "Devis / Proformas",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    previewName: "proforma",
    description: "Les nouvelles réservations et proformas recevront cette référence par défaut ou le numéro configuré s'incrémentera automatiquement en évitant les collisions.",
    exampleStart: "Ex: 100 pour démarrer à 100/{year}, ou 500 pour démarrer à 500/{year}.",
  },
  invoice: {
    label: "Factures Définitives",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    previewName: "facture",
    description: "Les factures définitives générées recevront cette référence par défaut ou le numéro configuré s'incrémentera automatiquement avec le suffixe -FA.",
    exampleStart: "Ex: 1 pour démarrer à 001/{year}-FA, ou 100 pour démarrer à 100/{year}-FA.",
  },
  delivery_note: {
    label: "Bons de Livraison (BL)",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    previewName: "bon de livraison",
    description: "Les bons de livraison et fiches de sortie recevront cette référence par défaut ou le numéro configuré s'incrémentera automatiquement avec le suffixe -BL.",
    exampleStart: "Ex: 1 pour démarrer à 001/{year}-BL, ou 50 pour démarrer à 050/{year}-BL.",
  },
};

interface AdminPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

function editableRoleSlugs(user: User, catalog: ApplicationRole[]): string[] {
  const assigned = user.assigned_role_slugs ?? user.role_slugs ?? catalog.filter(role => user.role_names.includes(role.name)).map(role => role.slug);
  return Array.from(new Set([...assigned, ...(user.group_role_slugs ?? [])]));
}

function AccessSummary({ slugs, catalog, base = {}, active = true }: { slugs: string[]; catalog: ApplicationRole[]; base?: Record<string, boolean>; active?: boolean }) {
  const granted = { ...base };
  for (const slug of slugs) {
    for (const [key, value] of Object.entries(catalog.find(role => role.slug === slug)?.capabilities ?? {})) {
      granted[key] = granted[key] || value;
    }
  }
  const known = slugs.every(slug => catalog.find(role => role.slug === slug)?.capabilities !== undefined);
  const actions = [
    ["canSensitiveWrite", "Confirmer les réservations et enregistrer les paiements"],
    ["canManageIdentity", "Gérer les collaborateurs et leurs rôles"],
    ["canOperateLogistics", "Préparer les locations et enregistrer sorties et retours"],
    ["canManageInventory", "Gérer les articles et ensembles de l’inventaire"],
    ["canOperateCashbox", "Utiliser une caisse"],
    ["canManageFinance", "Gérer les achats et les dépenses"],
    ["canViewPayroll", "Consulter les dossiers RH et la paie"],
    ["canEditPayroll", "Modifier les dossiers RH et préparer la paie"],
    ["canActivatePayroll", "Valider la paie et activer ses règles"],
    ["canSuperviseCashbox", "Superviser les caisses des collègues"],
    ["canOverrideLogistics", "Autoriser les dérogations logistiques"],
    ["canSuperAdminDelete", "Supprimer les données métier"],
  ];
  if (!active) return <section aria-label="Résumé des droits" className="rounded-xl border border-amber-200 p-4 text-xs">
    <h4 className="font-bold">Compte suspendu : aucun accès autorisé</h4>
    <p>Les profils affichés sont conservés. Réactivez le compte pour consulter ses droits effectifs et les modifier.</p>
  </section>;
  return <section aria-label="Résumé des droits" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs space-y-2">
    <h4 className="font-bold">Vérifiez les accès avant d’enregistrer</h4>
    <p>{active ? "Dossiers partagés de l’entreprise : ce compte peut consulter et reprendre les brouillons créés par ses collègues." : "Compte suspendu : aucune connexion autorisée. Les droits indiqués seront disponibles après réactivation."}</p>
    {!known && <p role="status">Le serveur ne fournit pas encore le détail de certains profils. Vérifiez leurs autorisations avant attribution.</p>}
    <ul className="space-y-1">{actions.map(([key, label]) => <li key={key}>{granted[key] ? "Autorisé" : known ? "Non autorisé" : "À vérifier"} : {label}.</li>)}</ul>
    {!slugs.length && <p className="font-semibold">Sans rôle, le compte conserve ces accès aux brouillons. Pour bloquer toute connexion, suspendez le compte.</p>}
    <p>Toute confirmation reste soumise au contrat signé, à l’acompte et à la disponibilité.</p>
  </section>;
}

export default function AdminPage({ onNavigate }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [toast, setToast] = useState<string | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // New User modal state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoleSlugs, setNewUserRoleSlugs] = useState<string[]>([]);
  const [newUserSubmitting, setNewUserSubmitting] = useState(false);
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserFirstName, setEditUserFirstName] = useState("");
  const [editUserLastName, setEditUserLastName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRoleSlugs, setEditUserRoleSlugs] = useState<string[]>([]);
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Reset password modal state
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

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
  const [roleSearch, setRoleSearch] = useState("");
  const [roleCategoryFilter, setRoleCategoryFilter] = useState<string>("all");

  // Numbering sequences state
  const [sequences, setSequences] = useState<NumberingSequence[]>([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [sequencesError, setSequencesError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedSequenceType, setSelectedSequenceType] = useState<NumberingSequenceType>("proforma");
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
        sequence_type: selectedSequenceType,
        year: selectedYear,
        next_number: editNextNumber,
        prefix: editPrefix,
        padding: editPadding,
        suffix_template: editSuffix,
      });
      setEditingBrand(null);
      showToast(`Séquence ${brand === "titan" ? "Titan" : "Hahitantsoa"} (${selectedSequenceType}) ${selectedYear} enregistrée.`);
      await loadSequences(selectedYear);
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de l'enregistrement de la séquence.");
    } finally {
      setSavingSequence(false);
    }
  };

  // Sessions & Devices state
  const [sessionsData, setSessionsData] = useState<IdentitySessionsListResponse | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionDeviceFilter, setSessionDeviceFilter] = useState<"all" | "desktop" | "mobile" | "tablet">("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [sessionConcurrentOnly, setSessionConcurrentOnly] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await getIdentitySessions();
      setSessionsData(data);
    } catch (err: any) {
      setSessionsError(err?.message || "Erreur lors du chargement des sessions d'appareils.");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (session: UserDeviceSession) => {
    const targetLabel = session.device_name || session.browser_name || "cet appareil";
    if (!window.confirm(`Déconnecter l'appareil "${targetLabel}" du compte @${session.username} ?`)) {
      return;
    }
    setRevokingSessionId(session.id);
    try {
      await revokeDeviceSession(session.id);
      showToast(`Session sur ${targetLabel} (@${session.username}) révoquée avec succès.`);
      setSessionsData((prev) => {
        if (!prev) return prev;
        const updatedResults = prev.results.map((s) =>
          s.id === session.id
            ? { ...s, is_active: false, is_online: false, revocation_reason: "admin_revocation", revoked_at: new Date().toISOString() }
            : s
        );
        const activeUsersCountMap = new Map<string, { user_id: string; username: string; display_name: string; devices: string[] }>();
        for (const s of updatedResults) {
          if (!s.is_active) continue;
          const existing = activeUsersCountMap.get(s.user_id) || {
            user_id: s.user_id,
            username: s.username,
            display_name: s.display_name,
            devices: [],
          };
          existing.devices.push(`${s.device_name} (${s.os_name})`);
          activeUsersCountMap.set(s.user_id, existing);
        }
        const updatedConcurrent: any[] = [];
        for (const [_, entry] of activeUsersCountMap.entries()) {
          if (entry.devices.length > 1) {
            updatedConcurrent.push({
              user_id: entry.user_id,
              username: entry.username,
              display_name: entry.display_name,
              active_devices_count: entry.devices.length,
              devices: entry.devices,
            });
          }
        }
        return {
          ...prev,
          total_active_sessions: updatedResults.filter((s) => s.is_active).length,
          users_with_concurrent_sessions: updatedConcurrent,
          results: updatedResults,
        };
      });
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de la révocation de la session.");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!sessionsData) return [];
    const q = sessionSearch.trim().toLowerCase();
    const concurrentUserIds = new Set((sessionsData.users_with_concurrent_sessions || []).map((u) => u.user_id));

    return (sessionsData.results || []).filter((s) => {
      const matchesSearch =
        !q ||
        s.username.toLowerCase().includes(q) ||
        s.display_name.toLowerCase().includes(q) ||
        s.device_name.toLowerCase().includes(q) ||
        s.os_name.toLowerCase().includes(q) ||
        s.browser_name.toLowerCase().includes(q) ||
        s.ip_address.toLowerCase().includes(q);

      const matchesDevice =
        sessionDeviceFilter === "all" ? true : s.device_type === sessionDeviceFilter;

      const matchesStatus =
        sessionStatusFilter === "all"
          ? true
          : sessionStatusFilter === "active"
            ? s.is_active
            : !s.is_active;

      const matchesConcurrent = sessionConcurrentOnly ? concurrentUserIds.has(s.user_id) : true;

      return matchesSearch && matchesDevice && matchesStatus && matchesConcurrent;
    });
  }, [sessionsData, sessionSearch, sessionDeviceFilter, sessionStatusFilter, sessionConcurrentOnly]);

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

  const fetchUsers = async (signal?: AbortSignal) => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await getUsers(undefined, signal);
      setUsers(data);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setUsersError(err.message || "Erreur lors du chargement des utilisateurs.");
      }
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    fetchRoles(controller.signal);
    return () => controller.abort();
  }, []);

  const generateSecurePassword = () => {
    if (!globalThis.crypto?.getRandomValues) return "";
    // ponytail: native cryptographic bytes; no dependency or insecure fallback.
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("") + "Aa1!";
  };

  const suggestUsername = (first: string, last: string) => {
    const cleanFirst = first.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const cleanLast = last.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (cleanFirst && cleanLast) return `${cleanFirst}.${cleanLast}`;
    if (cleanFirst) return cleanFirst;
    if (cleanLast) return cleanLast;
    return "";
  };

  const handleFirstNameChange = (val: string) => {
    setNewUserFirstName(val);
    if (!newUserUsername || newUserUsername === suggestUsername(newUserFirstName, newUserLastName)) {
      setNewUserUsername(suggestUsername(val, newUserLastName));
    }
  };

  const handleLastNameChange = (val: string) => {
    setNewUserLastName(val);
    if (!newUserUsername || newUserUsername === suggestUsername(newUserFirstName, newUserLastName)) {
      setNewUserUsername(suggestUsername(newUserFirstName, val));
    }
  };

  const resetNewUserForm = () => {
    setNewUserFirstName("");
    setNewUserLastName("");
    setNewUserUsername("");
    setNewUserEmail("");
    setNewUserPassword(generateSecurePassword());
    setNewUserRoleSlugs([]);
    setNewUserError(null);
    setShowNewUserPassword(false);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditUserFirstName(u.first_name || "");
    setEditUserLastName(u.last_name || "");
    setEditUserEmail(u.email || "");
    const initialSlugs = editableRoleSlugs(u, roles);
    setEditUserRoleSlugs(initialSlugs);
    setEditUserError(null);
  };

  const openResetPassword = (u: User) => {
    setResetPasswordUser(u);
    setResetNewPassword(generateSecurePassword());
    setResetPasswordError(null);
    setShowResetPassword(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserSubmitting || rolesLoading || rolesError) return;
    if (!newUserUsername.trim() || !newUserPassword.trim()) {
      setNewUserError("L'identifiant et le mot de passe sont obligatoires.");
      return;
    }
    setNewUserSubmitting(true);
    setNewUserError(null);
    try {
      const created = await createUser({
        username: newUserUsername.trim(),
        email: newUserEmail.trim(),
        first_name: newUserFirstName.trim(),
        last_name: newUserLastName.trim(),
        password: newUserPassword,
        role_slugs: newUserRoleSlugs,
      });
      setUsers(current => [created, ...current.filter(user => user.id !== created.id)]);
      setUserSearch("");
      setUserStatusFilter("all");
      setIsNewUserModalOpen(false);
      resetNewUserForm();
      showToast("Nouveau collaborateur créé avec succès !");
    } catch (err: any) {
      setNewUserError(err?.message || "Erreur lors de la création du collaborateur.");
    } finally {
      setNewUserSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUserSubmitting || rolesLoading || rolesError) return;
    if (!editingUser) return;
    setEditUserSubmitting(true);
    setEditUserError(null);
    try {
      await updateUser(editingUser.id, {
        first_name: editUserFirstName.trim(),
        last_name: editUserLastName.trim(),
        email: editUserEmail.trim(),
        ...(JSON.stringify([...editUserRoleSlugs].sort()) !== JSON.stringify(editableRoleSlugs(editingUser, roles).sort()) ? { role_slugs: editUserRoleSlugs } : {}),
      });
      showToast("Profil collaborateur mis à jour avec succès.");
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setEditUserError(err?.message || "Erreur lors de la modification du collaborateur.");
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !resetNewPassword.trim()) {
      setResetPasswordError("Le nouveau mot de passe est obligatoire.");
      return;
    }
    setResetPasswordSubmitting(true);
    setResetPasswordError(null);
    try {
      await resetUserPassword(resetPasswordUser.id, resetNewPassword);
      showToast(`Mot de passe réinitialisé pour ${resetPasswordUser.display_name}.`);
      setResetPasswordUser(null);
      setResetNewPassword("");
    } catch (err: any) {
      setResetPasswordError(err?.message || "Erreur lors de la réinitialisation du mot de passe.");
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      showToast(
        u.is_active
          ? `Compte de ${u.display_name} suspendu.`
          : `Compte de ${u.display_name} réactivé.`
      );
      await fetchUsers();
    } catch (err: any) {
      showToast(err?.message || "Impossible de modifier le statut de ce compte.");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userStatusFilter === "active" && !u.is_active) return false;
    if (userStatusFilter === "inactive" && u.is_active) return false;
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
          <button
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sessions' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('sessions')}
          >
            <i className="fa-solid fa-laptop-code"></i>
            <span>Connexions & Appareils</span>
            {(sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                {sessionsData?.users_with_concurrent_sessions.length}
              </span>
            )}
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Bannière explicative et bouton d'action */}
              <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fas fa-users-gear"></i>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Gestion des Collaborateurs & Accès Équipe
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed pl-10">
                    Créez de nouveaux comptes, attribuez des habilitations métiers et pilotez les accès de vos équipes en toute autonomie directement depuis cette interface.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetNewUserForm();
                    setIsNewUserModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-center"
                >
                  <i className="fas fa-user-plus"></i>
                  <span>Nouveau Collaborateur</span>
                </button>
              </div>

              {/* Barre de recherche et filtres de statut */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Rechercher par nom, identifiant, email ou rôle..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Statut :</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${userStatusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      onClick={() => setUserStatusFilter('all')}
                    >
                      Tous ({users.length})
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${userStatusFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      onClick={() => setUserStatusFilter('active')}
                    >
                      Actifs ({users.filter(u => u.is_active).length})
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${userStatusFilter === 'inactive' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      onClick={() => setUserStatusFilter('inactive')}
                    >
                      Suspendus ({users.filter(u => !u.is_active).length})
                    </button>
                  </div>
                </div>
              </div>

              {usersLoading && (
                <LoadingSpinner message="Chargement des collaborateurs…" />
              )}

              {usersError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>{usersError}</span>
                </div>
              )}

              {!usersLoading && !usersError && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl" data-tutorial="admin-users-table">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Collaborateur</th>
                        <th className="py-3 px-4">Identifiant & Contact</th>
                        <th className="py-3 px-4">Habilitations & Rôles</th>
                        <th className="py-3 px-4 text-center">Statut</th>
                        <th className="py-3 px-4 text-right">Dernière connexion</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <i className="fas fa-users-slash text-3xl mb-2 block text-slate-300"></i>
                            Aucun collaborateur trouvé pour cette recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const initials =
                            ((user.first_name?.[0] || "") + (user.last_name?.[0] || "")).toUpperCase() ||
                            user.username.slice(0, 2).toUpperCase();
                          const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

                          return (
                            <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 leading-snug">
                                      {user.display_name}
                                    </div>
                                    {fullName && fullName !== user.display_name && (
                                      <div className="text-[11px] text-slate-400">
                                        {fullName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-xs font-mono font-medium text-slate-700">
                                  @{user.username}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {user.email || <span className="text-slate-400 italic">Pas d'email</span>}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {user.role_names.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-xs">
                                    {user.role_names.map((roleName, idx) => {
                                      const matchedRole = roles.find((r) => r.name === roleName || r.slug === roleName);
                                      const roleObj: ApplicationRole = matchedRole || {
                                        id: "",
                                        name: roleName,
                                        slug: user.role_slugs?.[idx] || roleName,
                                        description: "",
                                        is_system_managed: true,
                                        is_active: true,
                                        created_at: "",
                                        updated_at: "",
                                      };
                                      const info = getRolePresentation(roleObj, users);
                                      return (
                                        <span
                                          key={idx}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${info.badgeClass}`}
                                          title={info.summary}
                                        >
                                          <i className={`fas ${info.iconClass} text-[10px]`}></i>
                                          <span>{info.title}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-xs font-medium">
                                    Aucun rôle
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {user.is_active ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Actif
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Suspendu
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
                                  : <span className="text-slate-400 italic">Jamais</span>}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditUser(user)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-1 border border-slate-200 hover:border-indigo-200"
                                    title="Modifier le profil et les rôles"
                                  >
                                    <i className="fas fa-user-pen text-[11px]"></i>
                                    <span>Profil & droits</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openResetPassword(user)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 border border-slate-200 hover:border-amber-200"
                                    title="Définir un nouveau mot de passe"
                                  >
                                    <i className="fas fa-key text-[11px]"></i>
                                    <span>Mot de passe</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(user)}
                                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 border ${
                                      user.is_active
                                        ? 'text-slate-500 hover:text-red-700 hover:bg-red-50 border-slate-200 hover:border-red-200'
                                        : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                    title={user.is_active ? "Suspendre ce compte" : "Réactiver ce compte"}
                                  >
                                    <i className={`fas ${user.is_active ? 'fa-user-slash' : 'fa-user-check'} text-[11px]`}></i>
                                    <span>{user.is_active ? "Suspendre" : "Activer"}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              {/* Bannière explicative et bouton d'action */}
              <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fas fa-shield-halved"></i>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Habilitations & Rôles Applicatifs de l'Agence
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed pl-10">
                    Les rôles déterminent avec précision ce que chaque collaborateur peut consulter ou valider (réservations, signature de contrat, caisse, logistique, exports). Les actions sensibles sont vérifiées par le serveur et auditées.
                  </p>
                </div>
                <button 
                  type="button"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-center"
                  onClick={() => {
                    setRoleError(null);
                    setNewRoleName("");
                    setNewRoleSlug("");
                    setNewRoleDescription("");
                    setIsRoleModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus"></i>
                  <span>Nouveau Rôle</span>
                </button>
              </div>

              {/* Filtres et recherche de rôles */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div className="relative w-full sm:w-72">
                  <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Filtrer un rôle par nom, métier..."
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                  />
                  {roleSearch && (
                    <button aria-label="Fermer"
                      type="button"
                      onClick={() => setRoleSearch("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: "all", label: "Tous les rôles" },
                    { id: "direction", label: "Direction & Sécurité" },
                    { id: "commercial", label: "Commerce" },
                    { id: "caisse", label: "Caisse & Finance" },
                    { id: "logistique", label: "Logistique" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRoleCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition ${
                        roleCategoryFilter === cat.id
                          ? "bg-slate-900 text-white dark:bg-indigo-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {rolesLoading && (
                <LoadingSpinner message="Chargement des rôles…" />
              )}

              {rolesError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-3">
                  <i className="fas fa-exclamation-circle text-base text-red-600"></i>
                  <span>{rolesError}</span>
                </div>
              )}

              {!rolesLoading && !rolesError && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tutorial="admin-roles-matrix">
                  {roles.length === 0 ? (
                    <div className="col-span-2 p-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <i className="fas fa-shield-halved text-3xl mb-3 block text-slate-300"></i>
                      <p className="font-medium text-slate-600 dark:text-slate-300">Aucun rôle configuré pour le moment.</p>
                      <p className="text-xs text-slate-400 mt-1">Cliquez sur « Nouveau Rôle » pour définir un profil métier.</p>
                    </div>
                  ) : (
                    roles
                      .filter((role) => {
                        const pres = getRolePresentation(role, users);
                        const matchCat =
                          roleCategoryFilter === "all" ||
                          pres.category === roleCategoryFilter ||
                          (roleCategoryFilter === "caisse" && (pres.category === "caisse" || pres.category === "comptabilite"));
                        const query = roleSearch.toLowerCase().trim();
                        const matchSearch =
                          !query ||
                          role.name.toLowerCase().includes(query) ||
                          role.slug.toLowerCase().includes(query) ||
                          pres.title.toLowerCase().includes(query) ||
                          pres.summary.toLowerCase().includes(query);
                        return matchCat && matchSearch;
                      })
                      .map((role) => {
                        const pres = getRolePresentation(role, users);
                        return (
                          <div
                            key={role.id}
                            className="p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-2xl hover:shadow-md transition-all flex flex-col justify-between group"
                          >
                            <div className="space-y-3">
                              {/* En-tête de la carte */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${pres.iconBgClass}`}>
                                    <i className={`fas ${pres.iconClass}`}></i>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                      {pres.title}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                      {pres.subtitle}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pres.badgeClass}`}>
                                    {pres.categoryLabel}
                                  </span>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    role.is_system_managed
                                      ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                      : "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                                  }`}>
                                    {role.is_system_managed ? "Système" : "Personnalisé"}
                                  </span>
                                </div>
                              </div>

                              {/* Descriptif métier */}
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                                {pres.summary}
                              </p>

                              {/* Habilitations clés résumées */}
                              <div className="space-y-1 pt-1">
                                {pres.keyRights.slice(0, 2).map((right, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                                    <i className="fas fa-check text-emerald-500 text-[10px] shrink-0"></i>
                                    <span className="truncate">{right}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Pied de carte avec effectif et bouton de consultation */}
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                <i className="fas fa-users text-slate-400"></i>
                                {pres.memberCount === 0 ? (
                                  "Aucun collaborateur"
                                ) : (
                                  <span>
                                    <strong>{pres.memberCount}</strong> collaborateur{pres.memberCount > 1 ? "s" : ""}
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs font-bold transition flex items-center gap-1"
                                onClick={() => setSelectedRoleDetail(role)}
                              >
                                <span>Détails & Permissions</span>
                                <i className="fas fa-arrow-right text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })
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
                    Définissez les numéros de départ (ex: 100, 500) et formats de référence pour les proformas, factures et bons de livraison par marque et année.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200" role="group" aria-label="Type de séquence">
                    <button
                      type="button"
                      onClick={() => { setSelectedSequenceType("proforma"); setEditingBrand(null); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${selectedSequenceType === "proforma" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      Proformas & Devis
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedSequenceType("invoice"); setEditingBrand(null); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${selectedSequenceType === "invoice" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      Factures Définitives
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedSequenceType("delivery_note"); setEditingBrand(null); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${selectedSequenceType === "delivery_note" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      Bons de Livraison
                    </button>
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
                    const seq = sequences.find(
                      (s) => s.brand === brand && (s.sequence_type ?? "proforma") === selectedSequenceType
                    );
                    const isEditing = editingBrand === brand;
                    const brandLabel = brand === "titan" ? "Titan (Location de Matériel)" : "Hahitantsoa (Événementiel)";
                    const currentNextNumber = seq ? seq.next_number : 1;
                    const currentPrefix = seq ? seq.prefix : "";
                    const currentPadding = seq ? seq.padding : 3;
                    const currentSuffix = seq?.suffix_template || DEFAULT_SUFFIX_BY_TYPE[selectedSequenceType];
                    const currentPreview = seq?.preview_next || `${currentPrefix}${String(currentNextNumber).padStart(currentPadding, "0")}${currentSuffix.replace("{year}", String(selectedYear))}`;
                    const typeInfo = SEQUENCE_TYPE_INFO[selectedSequenceType];

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
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                                {typeInfo.label}
                              </span>
                              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                                Année {selectedYear}
                              </span>
                            </div>
                          </div>

                          {!isEditing ? (
                            <div className="space-y-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider mb-1">
                                  Prochaine référence automatique ({typeInfo.label})
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
                                {typeInfo.description}
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
                                  {typeInfo.exampleStart.replace("{year}", String(selectedYear))}
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
                                  placeholder={DEFAULT_SUFFIX_BY_TYPE[selectedSequenceType]}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>

                              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <span className="text-xs text-indigo-600 font-bold block mb-1">
                                  Aperçu du prochain {typeInfo.previewName} :
                                </span>
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

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-base">
                      <i className="fa-solid fa-network-wired"></i>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Traçabilité des Connexions & Audit Multi-Appareils
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pl-11">
                    Supervisez en temps réel les terminaux connectés à l'ERP (MacBook, PC Windows, iPhone, Android, Linux), auditez l'historique complet et révoquez les sessions suspectes à distance.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-11 md:pl-0">
                  <button
                    type="button"
                    disabled={sessionsLoading}
                    onClick={() => void loadSessions()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <i className={`fa-solid fa-arrows-rotate ${sessionsLoading ? "fa-spin" : ""}`}></i>
                    <span>Actualiser</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Sessions Actives
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      En direct
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    {sessionsData?.total_active_sessions ?? 0}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Terminaux actuellement en ligne ou récents
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border shadow-2xs ${
                  (sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0
                    ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Comptes Multi-Appareils
                    </span>
                    {(sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                        ⚠️ Alerte active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Normal
                      </span>
                    )}
                  </div>
                  <div className={`text-2xl font-black mt-2 ${
                    (sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0
                      ? "text-amber-900 dark:text-amber-200"
                      : "text-slate-900 dark:text-slate-100"
                  }`}>
                    {sessionsData?.users_with_concurrent_sessions?.length ?? 0}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {(sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0
                      ? "Comptes connectés sur plusieurs terminaux simultanément"
                      : "Aucun compte partagé sur plusieurs terminaux"}
                  </p>
                </div>

                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Historique Sessions
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Total
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    {sessionsData?.results?.length ?? 0}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enregistrements de session conservés
                  </p>
                </div>
              </div>

              {/* Alert Banner for concurrent sessions */}
              {(sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0 && (
                <div data-testid="concurrent-sessions-alert-banner" className="p-5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 text-base shadow-xs">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                        Attention : Utilisation simultanée d'un même compte détectée
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                        Les utilisateurs suivants sont actuellement connectés ou actifs depuis plusieurs appareils différents en même temps :
                      </p>
                    </div>
                  </div>
                  <div className="pl-12 flex flex-wrap items-center gap-2">
                    {sessionsData?.users_with_concurrent_sessions.map((u) => (
                      <div
                        key={u.user_id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 shadow-2xs text-xs"
                      >
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {u.display_name} (@{u.username})
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-extrabold text-[10px]">
                          {u.active_devices_count} appareils
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          [{u.devices.join(", ")}]
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionSearch(u.username);
                            setSessionConcurrentOnly(true);
                          }}
                          className="ml-1 text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                        >
                          Filtrer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Filters */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Rechercher par nom, identifiant, appareil, IP, OS..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-slate-100"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                  />
                  {sessionSearch && (
                    <button
                      type="button"
                      onClick={() => setSessionSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Appareil :</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                    {[
                      { key: "all", label: "Tous" },
                      { key: "desktop", label: "Ordinateurs" },
                      { key: "mobile", label: "Mobiles" },
                      { key: "tablet", label: "Tablettes" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          sessionDeviceFilter === tab.key
                            ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                        onClick={() => setSessionDeviceFilter(tab.key as any)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">État :</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                    {[
                      { key: "all", label: "Tous" },
                      { key: "active", label: "Actifs" },
                      { key: "revoked", label: "Révoqués" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          sessionStatusFilter === tab.key
                            ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                        onClick={() => setSessionStatusFilter(tab.key as any)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {(sessionsData?.users_with_concurrent_sessions?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setSessionConcurrentOnly(!sessionConcurrentOnly)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        sessionConcurrentOnly
                          ? "bg-amber-500 border-amber-600 text-white shadow-xs"
                          : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                      Multi-appareils uniquement
                    </button>
                  )}
                </div>
              </div>

              {sessionsLoading && <LoadingSpinner message="Chargement des sessions d'appareils…" />}

              {sessionsError && (
                <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                  <span>{sessionsError}</span>
                </div>
              )}

              {/* Sessions Table */}
              {!sessionsLoading && !sessionsError && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Collaborateur</th>
                        <th className="py-3 px-4">Appareil & Système</th>
                        <th className="py-3 px-4">Navigateur & IP</th>
                        <th className="py-3 px-4">Statut & Simultanéité</th>
                        <th className="py-3 px-4">Horodatage</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSessions.map((session) => {
                        const dev = getDeviceIcon(session.device_type, session.os_name, session.device_name);
                        const isConcurrent = (sessionsData?.users_with_concurrent_sessions || []).some(
                          (u) => u.user_id === session.user_id
                        );
                        const initials = (session.display_name || session.username || "U")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <tr
                            key={session.id}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                              isConcurrent && session.is_active ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                            }`}
                          >
                            {/* Collaborateur */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {session.display_name || session.username}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    @{session.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Appareil & Système */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${dev.color}`}>
                                  <i className={dev.icon}></i>
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    {session.device_name || "Appareil inconnu"}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {session.os_name || "Système inconnu"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Navigateur & IP */}
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {session.browser_name || "Inconnu"}
                              </div>
                              <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                                {session.ip_address}
                              </div>
                            </td>

                            {/* Statut & Simultanéité */}
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {session.is_current ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    Cette session
                                  </span>
                                ) : null}

                                {session.is_active ? (
                                  session.is_online ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      En ligne
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                      Actif
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Déconnecté
                                  </span>
                                )}

                                {isConcurrent && session.is_active ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300">
                                    <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                    Multi-appareils
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Horodatage */}
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="text-slate-400 text-[10px]">Connexion :</span>{" "}
                                {formatSessionDateTime(session.logged_in_at)}
                              </div>
                              {session.last_seen_at && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  <span>Activité :</span> {formatSessionDateTime(session.last_seen_at)}
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              {session.is_active ? (
                                <button
                                  type="button"
                                  disabled={revokingSessionId === session.id}
                                  onClick={() => handleRevokeSession(session)}
                                  className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 hover:text-rose-700 transition disabled:opacity-50 cursor-pointer"
                                >
                                  {revokingSessionId === session.id ? "Déconnexion..." : "Déconnecter"}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  {session.revocation_reason === "admin_revocation" ? "Révoquée par admin" : "Session terminée"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredSessions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <i className="fa-solid fa-desktop text-2xl mb-2 block opacity-40"></i>
                            Aucune session ne correspond à vos critères de recherche.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isRoleModalOpen && (
        <AdminDialog className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" titleId="modal-role-title" onClose={() => setIsRoleModalOpen(false)} busy={roleSubmitting}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-role-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Nouveau rôle applicatif
              </h3>
              <button aria-label="Fermer"
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

            <form onSubmit={handleCreateRole} className="space-y-4"><fieldset disabled={roleSubmitting} className="space-y-4 min-w-0">
              <div>
                <label htmlFor="admin-role-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom du profil
                </label>
                <input
                  type="text"
                  id="admin-role-name"
                  value={newRoleName}
                  onChange={(e) => {
                    setNewRoleName(e.target.value);
                    setNewRoleSlug(e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }}
                  placeholder="Ex: Responsable Planning"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <details><summary className="text-xs cursor-pointer">Réglages avancés du profil</summary>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newRoleSlug">
                  Identifiant technique (slug)
                </label>
                <input id="admin-newRoleSlug"
                  type="text"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  placeholder="Ex: responsable-planning"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  required
                />
              </div>              </details>
              <p className="text-xs text-slate-600">Créer un nom de profil ne lui accorde aucune autorisation supplémentaire. Les droits disponibles restent ceux définis par le serveur.</p>


              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newRoleDescription">
                  Description
                </label>
                <textarea id="admin-newRoleDescription"
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
            </fieldset></form>
          </div>
        </AdminDialog>
      )}

      {selectedRoleDetail && (() => {
        const info = getRolePresentation(selectedRoleDetail, users);
        return (
          <AdminDialog className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" titleId="modal-role-detail-title" onClose={() => setSelectedRoleDetail(null)} busy={false}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Entête du modal */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${info.iconBgClass}`}>
                    <i className={`fas ${info.iconClass} text-lg`}></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="modal-role-detail-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {selectedRoleDetail.name}
                      </h3>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${info.badgeClass}`}>
                        {info.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {info.subtitle}
                    </p>
                  </div>
                </div>
                <button aria-label="Fermer"
                  type="button"
                  onClick={() => setSelectedRoleDetail(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Contenu défilant */}
              <div className="p-6 overflow-y-auto space-y-5 text-sm">
                {/* Métadonnées techniques et type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Identifiant technique</span>
                    <code className="text-xs font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 inline-block mt-0.5">
                      {selectedRoleDetail.slug}
                    </code>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Type de rôle</span>
                    <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded ${
                      selectedRoleDetail.is_system_managed
                        ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    }`}>
                      {selectedRoleDetail.is_system_managed ? "Rôle système managé" : "Rôle personnalisé"}
                    </span>
                  </div>
                </div>

                {/* Description métier */}
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Description & Mission
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {selectedRoleDetail.description || info.summary || "Aucune description renseignée."}
                  </p>
                </div>

                {/* Public cible */}
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Profil type / Public cible
                  </span>
                  <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-3 rounded-lg">
                    <i className="fas fa-id-badge text-amber-600 dark:text-amber-400 mt-0.5"></i>
                    <span>{info.targetAudience}</span>
                  </div>
                </div>

                {/* Matrice des permissions par domaine */}
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                    Matrice d'habilitation par domaine métier
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {info.matrix.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                          item.allowed
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <i className={`fas ${item.icon} text-slate-500`}></i>
                            {item.domain}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              item.allowed
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {item.allowed === null ? "À vérifier" : item.allowed ? "Autorisé" : "Restreint"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {item.actionText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Droits clés et garde-fous */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                      Droits clés accordés
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {info.keyRights.map((kr, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <i className="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                          <span>{kr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {info.restrictions && info.restrictions.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        Contraintes & Garde-fous
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {info.restrictions.map((res, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <i className="fas fa-shield-halved text-amber-500 mt-0.5"></i>
                            <span>{res}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Collaborateurs assignés */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Collaborateurs assignés ({info.memberCount})
                    </span>
                  </div>
                  {info.memberCount > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {info.memberNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                        >
                          <i className="fas fa-user text-slate-400 text-[10px]"></i>
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Aucun collaborateur n'a encore ce rôle assigné dans l'organisation.
                    </p>
                  )}
                </div>

                {/* Explication système */}
                <div className="p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedRoleDetail.is_system_managed
                    ? "Les habilitations de ce rôle système sont définies directement par la politique RBAC du serveur d'application."
                    : "Rôle personnalisé administrable. Ses attributions sont gérées au niveau des profils utilisateurs."}
                </div>
              </div>

              {/* Pied de modal */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={() => setSelectedRoleDetail(null)}
                  className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </AdminDialog>
        );
      })()}

      {/* MODAL 1: Nouveau Collaborateur */}
      {isNewUserModalOpen && (
        <AdminDialog className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" titleId="new-user-title" onClose={() => setIsNewUserModalOpen(false)} busy={newUserSubmitting}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
                  <i className="fas fa-user-plus"></i>
                </div>
                <div>
                  <h3 id="new-user-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Nouveau Collaborateur
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Créez un compte d'accès et attribuez-lui ses habilitations de travail.
                  </p>
                </div>
              </div>
              <button aria-label="Fermer"
                type="button"
                onClick={() => {
                  setIsNewUserModalOpen(false);
                  resetNewUserForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Fermer"
              >
                <i className="fas fa-times text-base"></i>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto"><fieldset disabled={newUserSubmitting} className="space-y-4 min-w-0">
              {newUserError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                  <i className="fas fa-triangle-exclamation mt-0.5 shrink-0"></i>
                  <span>{newUserError}</span>
                </div>
              )}

              {/* Identité */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-id-card text-indigo-500"></i>
                  Identité du collaborateur
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newUserFirstName">
                      Prénom
                    </label>
                    <input id="admin-newUserFirstName"
                      type="text"
                      placeholder="Ex: Jean"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                      value={newUserFirstName}
                      onChange={(e) => handleFirstNameChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newUserLastName">
                      Nom
                    </label>
                    <input id="admin-newUserLastName"
                      type="text"
                      placeholder="Ex: Dupont"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                      value={newUserLastName}
                      onChange={(e) => handleLastNameChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Accès de connexion */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-lock text-indigo-500"></i>
                  Identifiant & Mot de passe
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newUserUsername">
                      Identifiant de connexion <span className="text-red-500">*</span>
                    </label>
                    <input id="admin-newUserUsername"
                      type="text"
                      required
                      placeholder="ex: jean.dupont"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Sert d'identifiant unique pour ouvrir sa session ERP.
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-newUserEmail">
                      Adresse email
                    </label>
                    <input id="admin-newUserEmail"
                      type="email"
                      placeholder="jean.dupont@entreprise.com"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Optionnel mais recommandé pour les communications.
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="admin-newUserPassword">
                      Mot de passe initial <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewUserPassword(generateSecurePassword())}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <i className="fas fa-dice"></i>
                      Régénérer un mot de passe robuste
                    </button>
                  </div>
                  <div className="relative">
                    <input id="admin-newUserPassword"
                      type={showNewUserPassword ? "text" : "password"}
                      required
                      minLength={8}
                      className="w-full pl-3 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={showNewUserPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
                      title={showNewUserPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      <i className={`fas ${showNewUserPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                  <div className="mt-1.5 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <i className="fas fa-info-circle shrink-0"></i>
                    <span>Notez ce mot de passe ou communiquez-le au collaborateur à la création de son compte.</span>
                  </div>
                </div>
              </div>

              {/* Habilitations et rôles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fas fa-shield-halved text-indigo-500"></i>
                    Attribution des rôles ({newUserRoleSlugs.length} sélectionné{newUserRoleSlugs.length > 1 ? "s" : ""})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Choisissez les profils et vérifiez les droits ci-dessous
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {rolesLoading && <p role="status">Chargement des profils…</p>}
                  {rolesError && <div role="alert"><p>Impossible de charger les profils. Votre saisie est conservée.</p><button type="button" className="underline min-h-11" onClick={() => fetchRoles()}>Réessayer le chargement des profils</button></div>}
                  {roles.map((r) => {
                    const info = getRolePresentation(r, users);
                    const isSelected = newUserRoleSlugs.includes(r.slug);
                    return (
                      <label
                        key={r.slug}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-700/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={r.assignable === false}
                          checked={isSelected}
                          onChange={() => setNewUserRoleSlugs(prev => prev.includes(r.slug) ? prev.filter(slug => slug !== r.slug) : [...prev, r.slug])}
                          className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${info.iconBgClass} border`}>
                              <i className={`fas ${info.iconClass}`}></i>
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {info.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {info.summary}
                          </p>
                          {r.assignable === false && <p className="text-xs text-amber-800">Attribution réservée à la direction ou à l’administrateur de plateforme.</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <AccessSummary slugs={newUserRoleSlugs} catalog={roles} />

              {/* Boutons d'action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUserModalOpen(false);
                    resetNewUserForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={newUserSubmitting || rolesLoading || !!rolesError}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {newUserSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Création en cours…</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      <span>Créer le collaborateur</span>
                    </>
                  )}
                </button>
              </div>
            </fieldset></form>
          </div>
        </AdminDialog>
      )}

      {/* MODAL 2: Modifier le Collaborateur */}
      {editingUser && (
        <AdminDialog className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" titleId="edit-user-title" onClose={() => setEditingUser(null)} busy={editUserSubmitting}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
                  <i className="fas fa-user-pen"></i>
                </div>
                <div>
                  <h3 id="edit-user-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Modifier le profil et les droits
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingUser.display_name} — <span className="font-mono">@{editingUser.username}</span>
                  </p>
                </div>
              </div>
              <button aria-label="Fermer"
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Fermer"
              >
                <i className="fas fa-times text-base"></i>
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto"><fieldset disabled={editUserSubmitting} className="space-y-4 min-w-0">
              {editUserError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                  <i className="fas fa-triangle-exclamation mt-0.5 shrink-0"></i>
                  <span>{editUserError}</span>
                </div>
              )}

              {/* Nom & Prénom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-editUserFirstName">
                    Prénom
                  </label>
                  <input id="admin-editUserFirstName"
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                    value={editUserFirstName}
                    onChange={(e) => setEditUserFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-editUserLastName">
                    Nom
                  </label>
                  <input id="admin-editUserLastName"
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                    value={editUserLastName}
                    onChange={(e) => setEditUserLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1" htmlFor="admin-editUserEmail">
                  Adresse email
                </label>
                <input id="admin-editUserEmail"
                  type="email"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                />
              </div>

              {/* Habilitations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fas fa-shield-halved text-indigo-500"></i>
                    Habilitations & Rôles ({editUserRoleSlugs.length} sélectionné{editUserRoleSlugs.length > 1 ? "s" : ""})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Modifiez les rôles accordés
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {rolesLoading && <p role="status">Chargement des profils…</p>}
                  {rolesError && <div role="alert"><p>Impossible de charger les profils. Votre saisie est conservée.</p><button type="button" className="underline min-h-11" onClick={() => fetchRoles()}>Réessayer le chargement des profils</button></div>}
                  {roles.map((r) => {
                    const info = getRolePresentation(r, users);
                    const isSelected = editUserRoleSlugs.includes(r.slug);
                    return (
                      <label
                        key={r.slug}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-700/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={r.assignable === false || !editingUser.is_active}
                          checked={isSelected}
                          onChange={() => setEditUserRoleSlugs(prev => prev.includes(r.slug) ? prev.filter(slug => slug !== r.slug) : [...prev, r.slug])}
                          className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${info.iconBgClass} border`}>
                              <i className={`fas ${info.iconClass}`}></i>
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {info.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {info.summary}
                          </p>
                          {r.assignable === false && <p className="text-xs text-amber-800">Attribution réservée à la direction ou à l’administrateur de plateforme.</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {(editingUser.group_role_slugs ?? []).some(slug => !roles.some(role => role.slug === slug)) && <fieldset className="space-y-2 text-xs">
                <legend className="font-semibold">Autorisations héritées à vérifier</legend>
                <p>Ces accès existants restent actifs même si leur profil manque au catalogue. Décochez-les pour les retirer ; le serveur vérifie votre autorisation.</p>
                {(editingUser.group_role_slugs ?? []).filter(slug => !roles.some(role => role.slug === slug)).map(slug => <label key={slug} className="flex items-center gap-2">
                  <input type="checkbox" checked={editUserRoleSlugs.includes(slug)} disabled={!editingUser.is_active} onChange={() => setEditUserRoleSlugs(previous => previous.includes(slug) ? previous.filter(value => value !== slug) : [...previous, slug])} />
                  {ROLE_PRESENTATION_CATALOG[slug]?.title ?? "Autorisation héritée"}
                </label>)}
              </fieldset>}
              <p className="text-xs text-slate-600">
                Profils ajoutés : {editUserRoleSlugs.filter(slug => !editableRoleSlugs(editingUser, roles).includes(slug)).map(slug => roles.find(role => role.slug === slug)?.name ?? slug).join(", ") || "aucun"}.
                {" "}Profils retirés : {editableRoleSlugs(editingUser, roles).filter(slug => !editUserRoleSlugs.includes(slug)).map(slug => roles.find(role => role.slug === slug)?.name ?? slug).join(", ") || "aucun"}.
              </p>
              {!editingUser.is_active && <p className="text-xs text-amber-800">Réactivez ce compte pour modifier ses profils. Ses attributions sont conservées pendant la suspension.</p>}
              <AccessSummary slugs={editUserRoleSlugs} catalog={roles} base={editingUser.base_capabilities} active={editingUser.is_active} />

              {/* Boutons d'action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editUserSubmitting || rolesLoading || !!rolesError}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {editUserSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Enregistrement…</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </fieldset></form>
          </div>
        </AdminDialog>
      )}

      {/* MODAL 3: Réinitialiser le Mot de Passe */}
      {resetPasswordUser && (
        <AdminDialog className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" titleId="reset-password-title" onClose={() => setResetPasswordUser(null)} busy={resetPasswordSubmitting}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-amber-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-sm">
                  <i className="fas fa-key"></i>
                </div>
                <div>
                  <h3 id="reset-password-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Réinitialiser le mot de passe
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pour {resetPasswordUser.display_name} (@{resetPasswordUser.username})
                  </p>
                </div>
              </div>
              <button aria-label="Fermer"
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Fermer"
              >
                <i className="fas fa-times text-base"></i>
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4"><fieldset disabled={resetPasswordSubmitting} className="space-y-4 min-w-0">
              {resetPasswordError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                  <i className="fas fa-triangle-exclamation mt-0.5 shrink-0"></i>
                  <span>{resetPasswordError}</span>
                </div>
              )}

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <p className="font-semibold mb-1">
                  <i className="fas fa-shield-halved mr-1.5"></i>
                  Action administrative tracée
                </p>
                Définissez un nouveau mot de passe pour ce collaborateur. Cette réinitialisation sera consignée dans l'audit système.
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="admin-resetNewPassword">
                    Nouveau mot de passe <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetNewPassword(generateSecurePassword())}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <i className="fas fa-dice"></i>
                    Générer un mot de passe
                  </button>
                </div>
                <div className="relative">
                  <input id="admin-resetNewPassword"
                    type={showResetPassword ? "text" : "password"}
                    required
                    minLength={8}
                    className="w-full pl-3 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-white font-mono"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showResetPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
                    title={showResetPassword ? "Masquer" : "Afficher"}
                  >
                    <i className={`fas ${showResetPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {resetPasswordSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Mise à jour…</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      <span>Mettre à jour le mot de passe</span>
                    </>
                  )}
                </button>
              </div>
            </fieldset></form>
          </div>
        </AdminDialog>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
