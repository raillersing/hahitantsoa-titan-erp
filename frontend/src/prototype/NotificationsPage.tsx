import React, { useEffect, useState } from "react";
import { AppScope } from "../App";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../api";
import type { SystemNotification } from "../types";

interface NotificationsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const severityConfig: Record<string, { bg: string; border: string; iconBg: string; icon: string; iconColor: string }> = {
  success: { bg: "bg-green-50", border: "border-green-100", iconBg: "bg-green-100", icon: "fa-check", iconColor: "text-green-600" },
  warning: { bg: "bg-amber-50", border: "border-amber-100", iconBg: "bg-amber-100", icon: "fa-box-open", iconColor: "text-amber-600" },
  info: { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-100", icon: "fa-file-import", iconColor: "text-blue-600" },
  error: { bg: "bg-red-50", border: "border-red-100", iconBg: "bg-red-100", icon: "fa-circle-exclamation", iconColor: "text-red-600" },
};

const typeIcons: Record<string, string> = {
  payment: "fa-check",
  stock: "fa-box-open",
  import: "fa-file-import",
  reservation: "fa-calendar-check",
  system: "fa-user-plus",
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD} j`;
}

export default function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    email_payment: true,
    stock_alert: true,
    import_anomaly: true,
    expense_notif: false,
  });

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id, true);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="page active space-y-6">
      {/* Header — identique au prototype */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Centre de notifications et alertes système</p>
        </div>
        <button
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
          Retour
        </button>
      </div>

      {unreadCount > 0 && (
        <button
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full hover:bg-indigo-200 transition-colors"
        >
          <i className="fas fa-check-double"></i> Tout marquer lu ({unreadCount})
        </button>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">
          <i className="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
          <p className="text-sm">Chargement des notifications...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
        </div>
      )}

      {/* Section "Alertes récentes" — identique au prototype */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <i className="fa-solid fa-bell text-blue-600"></i>
            <h2 className="text-lg font-semibold text-slate-800">Alertes récentes</h2>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <i className="fa-solid fa-bell-slash text-3xl mb-3 text-slate-300"></i>
              <p>Aucune notification</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const config = severityConfig[notif.severity] || severityConfig.info;
                const icon = typeIcons[notif.notification_type] || config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-opacity ${
                      notif.is_read ? "bg-slate-50 border-slate-200 opacity-60" : `${config.bg} ${config.border}`
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${config.iconBg} flex items-center justify-center`}>
                      <i className={`fa-solid ${icon} ${config.iconColor} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${notif.is_read ? "text-slate-500" : "text-slate-800"}`}>
                          {notif.title}
                        </p>
                        <span className="text-xs text-slate-500">{formatRelativeTime(notif.created_at)}</span>
                      </div>
                      {notif.message && (
                        <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                      )}
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="flex-shrink-0 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Marquer comme lu"
                      >
                        <i className="fa-solid fa-check"></i>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section "Préférences" — identique au prototype */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <i className="fa-solid fa-sliders text-slate-500"></i>
            <h2 className="text-lg font-semibold text-slate-800">Préférences</h2>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-envelope text-slate-400"></i>
                <span className="text-sm text-slate-700">Email des confirmations de paiement</span>
              </div>
              <input
                type="checkbox"
                checked={prefs.email_payment}
                onChange={(e) => setPrefs(p => ({ ...p, email_payment: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-box-open text-slate-400"></i>
                <span className="text-sm text-slate-700">Alertes stock bas</span>
              </div>
              <input
                type="checkbox"
                checked={prefs.stock_alert}
                onChange={(e) => setPrefs(p => ({ ...p, stock_alert: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-triangle-exclamation text-slate-400"></i>
                <span className="text-sm text-slate-700">Alertes anomalies import</span>
              </div>
              <input
                type="checkbox"
                checked={prefs.import_anomaly}
                onChange={(e) => setPrefs(p => ({ ...p, import_anomaly: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-hand-holding-dollar text-slate-400"></i>
                <span className="text-sm text-slate-700">Notifications notes de frais</span>
              </div>
              <input
                type="checkbox"
                checked={prefs.expense_notif}
                onChange={(e) => setPrefs(p => ({ ...p, expense_notif: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
