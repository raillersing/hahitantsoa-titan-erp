import React, { useEffect, useState, useCallback } from "react";
import { getMyDeviceSessions, revokeDeviceSession, revokeAllOtherDeviceSessions } from "../api";
import type { UserDeviceSession, UserPersonalSessionsResponse } from "../types";
import { LoadingSpinner } from "../components";

interface SecuritySessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function getDeviceIcon(deviceType: string, osName: string, deviceName: string) {
  const os = (osName || "").toLowerCase();
  const name = (deviceName || "").toLowerCase();
  const type = (deviceType || "").toLowerCase();

  if (os.includes("ios") || name.includes("iphone")) {
    return { icon: "fa-solid fa-mobile-screen", color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60" };
  }
  if (name.includes("ipad")) {
    return { icon: "fa-solid fa-tablet-screen-button", color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60" };
  }
  if (os.includes("mac") || name.includes("macbook") || name.includes("imac")) {
    return { icon: "fa-brands fa-apple", color: "text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800" };
  }
  if (os.includes("windows") || name.includes("pc")) {
    return { icon: "fa-brands fa-windows", color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60" };
  }
  if (os.includes("android")) {
    return { icon: type === "tablet" ? "fa-solid fa-tablet-screen-button" : "fa-solid fa-mobile-screen", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60" };
  }
  if (os.includes("linux")) {
    return { icon: "fa-brands fa-linux", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60" };
  }
  if (type === "mobile") {
    return { icon: "fa-solid fa-mobile-screen", color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" };
  }
  if (type === "tablet") {
    return { icon: "fa-solid fa-tablet-screen-button", color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" };
  }
  return { icon: "fa-solid fa-laptop", color: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800" };
}

export function formatSessionDateTime(isoString: string | undefined | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

export default function SecuritySessionsModal({ isOpen, onClose }: SecuritySessionsModalProps) {
  const [data, setData] = useState<UserPersonalSessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyDeviceSessions();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger vos appareils connectés.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadSessions();
    }
  }, [isOpen, loadSessions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleRevokeSingle = async (session: UserDeviceSession) => {
    if (session.is_current) {
      if (!window.confirm("Déconnecter la session actuelle ? Vous serez redirigé vers la page de connexion.")) {
        return;
      }
    } else {
      if (!window.confirm(`Déconnecter cet appareil (${session.device_name || session.browser_name}) ?`)) {
        return;
      }
    }

    setRevokingId(session.id);
    setActionNotice(null);
    try {
      await revokeDeviceSession(session.id);
      setData((prev) => {
        if (!prev) return prev;
        const remaining = prev.sessions.filter((s) => s.id !== session.id);
        return {
          ...prev,
          active_sessions_count: remaining.filter((s) => s.is_active).length,
          has_concurrent_sessions: remaining.filter((s) => s.is_active).length > 1,
          sessions: remaining,
        };
      });
      setActionNotice(`L'appareil "${session.device_name || session.browser_name}" a été déconnecté avec succès.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la déconnexion de l'appareil.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir déconnecter tous vos autres appareils connectés ? Seule cette session restera active.")) {
      return;
    }
    setRevokingOthers(true);
    setActionNotice(null);
    try {
      const result = await revokeAllOtherDeviceSessions();
      setData((prev) => {
        if (!prev) return prev;
        const currentOnly = prev.sessions.filter((s) => s.is_current);
        return {
          ...prev,
          active_sessions_count: 1,
          has_concurrent_sessions: false,
          sessions: currentOnly,
        };
      });
      setActionNotice(`${result.revoked_count || "Tous les autres"} appareil(s) déconnecté(s) avec succès.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la déconnexion des autres appareils.");
    } finally {
      setRevokingOthers(false);
    }
  };

  if (!isOpen) return null;

  const otherSessionsCount = (data?.sessions || []).filter((s) => s.is_active && !s.is_current).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-sessions-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h2 id="security-sessions-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Sécurité & Appareils Connectés
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gérez vos sessions actives et contrôlez les accès à votre compte.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {actionNotice && (
            <div role="status" className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-emerald-600"></i>
              <span>{actionNotice}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Concurrent sessions warning */}
          {data?.has_concurrent_sessions && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 text-sm">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-900 dark:text-amber-100">
                    Compte connecté sur plusieurs appareils en même temps
                  </h3>
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5">
                    Votre compte est actuellement actif sur {data.active_sessions_count} appareils. Si vous ne reconnaissez pas un appareil, déconnectez-le immédiatement.
                  </p>
                </div>
              </div>
              {otherSessionsCount > 0 && (
                <button
                  type="button"
                  disabled={revokingOthers}
                  onClick={handleRevokeOthers}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {revokingOthers ? "Déconnexion..." : "Déconnecter les autres"}
                </button>
              )}
            </div>
          )}

          {loading && <LoadingSpinner message="Chargement des sessions actives…" />}

          {!loading && data && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Appareils actifs ({data.sessions.filter((s) => s.is_active).length})</span>
                {otherSessionsCount > 0 && (
                  <button
                    type="button"
                    disabled={revokingOthers}
                    onClick={handleRevokeOthers}
                    className="text-rose-600 hover:text-rose-700 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {revokingOthers ? "Déconnexion en cours…" : "Déconnecter tous les autres appareils"}
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {data.sessions.map((session) => {
                  const dev = getDeviceIcon(session.device_type, session.os_name, session.device_name);
                  return (
                    <div
                      key={session.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${dev.color}`}>
                          <i className={dev.icon}></i>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {session.device_name || "Appareil"}
                            </span>
                            {session.is_current ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Cet appareil
                              </span>
                            ) : null}
                            {session.is_online ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                En ligne
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {session.browser_name || "Navigateur"} · {session.os_name || "Système"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>
                              <i className="fa-solid fa-network-wired mr-1 text-[10px]"></i>
                              {session.ip_address}
                            </span>
                            <span>•</span>
                            <span>
                              Connecté le {formatSessionDateTime(session.logged_in_at)}
                            </span>
                            {session.last_seen_at && (
                              <>
                                <span>•</span>
                                <span>Dernière activité {formatSessionDateTime(session.last_seen_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center sm:self-center">
                        {!session.is_current && session.is_active && (
                          <button
                            type="button"
                            disabled={revokingId === session.id}
                            onClick={() => handleRevokeSingle(session)}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 hover:text-rose-700 transition disabled:opacity-50 cursor-pointer"
                          >
                            {revokingId === session.id ? "Déconnexion..." : "Déconnecter"}
                          </button>
                        )}
                        {session.is_current && (
                          <span className="text-xs text-slate-400 font-medium italic">
                            Session actuelle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {data.sessions.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Aucune session active enregistrée.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
