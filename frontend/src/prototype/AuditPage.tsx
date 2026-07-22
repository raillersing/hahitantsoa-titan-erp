import React, { useEffect, useState } from "react";
import { getAuditEvents } from "../api";
import type { AuditEvent } from "../types";
import { LoadingSpinner } from "../components";

interface AuditPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

type AuditState =
  | { status: "loading" }
  | { status: "loaded"; events: AuditEvent[] }
  | { status: "empty" }
  | { status: "error"; message: string };

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-MG", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getActionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("ajout")) return "bg-blue-100 text-blue-700";
  if (lower.includes("payment") || lower.includes("paiement")) return "bg-emerald-100 text-emerald-700";
  if (lower.includes("delete") || lower.includes("supprim")) return "bg-red-100 text-red-700";
  if (lower.includes("update") || lower.includes("modif")) return "bg-amber-100 text-amber-700";
  if (lower.includes("login") || lower.includes("connexion")) return "bg-purple-100 text-purple-700";
  if (lower.includes("export")) return "bg-cyan-100 text-cyan-700";
  return "bg-slate-100 text-slate-700";
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "document.instance_pdf_generated": "PDF généré",
    "identity.role_assigned": "Rôle attribué",
    "billing.invoice_settled": "Facture réglée",
  };
  return labels[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ");
}

function metadataValue(event: AuditEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = event.metadata?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return null;
}

function getOutcome(event: AuditEvent): string {
  return metadataValue(event, ["outcome", "result", "status"]) ?? "Traçabilité enregistrée";
}

function getSeverity(event: AuditEvent): { label: string; className: string } {
  const explicitSeverity = metadataValue(event, ["severity", "risk_level"]);
  const normalized = explicitSeverity?.toLowerCase();
  if (["critical", "critique", "high", "élevée", "elevee"].includes(normalized ?? "")) {
    return { label: "Élevée", className: "bg-red-100 text-red-700" };
  }
  if (["medium", "moyenne", "warning", "avertissement"].includes(normalized ?? "")) {
    return { label: "À surveiller", className: "bg-amber-100 text-amber-700" };
  }
  if (/(delete|supprim|revoke|annul)/i.test(event.action)) {
    return { label: "À surveiller", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Information", className: "bg-slate-100 text-slate-700" };
}

function extractIp(event: AuditEvent): string {
  const meta = event.metadata;
  if (meta && typeof meta === "object") {
    if (meta.ip_address) return String(meta.ip_address);
    if (meta.ip) return String(meta.ip);
    if (meta.remote_addr) return String(meta.remote_addr);
    if (meta.client_ip) return String(meta.client_ip);
  }
  return "—";
}

function extractDetails(event: AuditEvent): string {
  const meta = event.metadata;
  if (!meta || typeof meta !== "object") return "—";
  const entries = Object.entries(meta).filter(
    ([key]) => !["ip_address", "ip", "remote_addr", "client_ip"].includes(key),
  );
  if (entries.length === 0) return "—";
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${key}: —`;
      if (typeof value === "object") return `${key}: ${JSON.stringify(value)}`;
      return `${key}: ${value}`;
    })
    .join(" | ");
}

export default function AuditPage({ onNavigate }: AuditPageProps) {
  const [state, setState] = useState<AuditState>({ status: "loading" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    getAuditEvents({}, controller.signal)
      .then((events) => {
        setState(events.length === 0 ? { status: "empty" } : { status: "loaded", events });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Échec du chargement des événements d'audit.",
        });
      });
    return () => controller.abort();
  }, []);

  const filteredEvents =
    state.status === "loaded"
      ? state.events.filter((event) => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return (
            event.action.toLowerCase().includes(q) ||
            (event.actor_id ?? "").toLowerCase().includes(q) ||
            event.target_type.toLowerCase().includes(q) ||
            event.target_id.toLowerCase().includes(q) ||
            extractIp(event).toLowerCase().includes(q) ||
            extractDetails(event).toLowerCase().includes(q)
          );
        })
      : [];

  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Journal d'Audit</h2>
        <p className="text-sm text-slate-500">Consultez qui a fait quoi, quand, et le résultat enregistré par le système.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <label className="sr-only" htmlFor="audit-search">Rechercher dans le journal d'audit</label>
          <input
            id="audit-search"
            type="search"
            placeholder="Rechercher : utilisateur, action, cible, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-96"
          />
        </div>

        {state.status === "loading" && (
          <div className="py-12" aria-live="polite">
            <LoadingSpinner size="md" message="Chargement des événements d'audit..." />
          </div>
        )}

        {state.status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center" role="alert">
            <p className="text-sm font-medium text-red-800">Événements d'audit indisponibles</p>
            <p className="text-xs text-red-600 mt-1">{state.message}</p>
          </div>
        )}

        {state.status === "empty" && (
          <div className="py-12 text-center" role="status">
            <p className="text-sm text-slate-500">Aucun événement d'audit trouvé.</p>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center" role="status">
                <p className="text-sm text-slate-500">Aucun résultat ne correspond à votre recherche.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Événements du journal d'audit">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                    <th className="text-left px-4 py-3 rounded-l-lg">Date et heure</th>
                    <th className="text-left px-4 py-3">Auteur</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Entité</th>
                    <th className="text-left px-4 py-3">Résultat</th>
                    <th className="text-left px-4 py-3">Niveau</th>
                    <th className="text-left px-4 py-3">Détails</th>
                    <th className="text-right px-4 py-3 rounded-r-lg">Adresse IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(event.created_at)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{event.actor_id ?? "Système"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded ${getActionColor(event.action)}`} title={event.action}>
                          {actionLabel(event.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="font-semibold">{event.target_type}</span>
                        <span className="text-slate-400 ml-1">/ {event.target_id}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{getOutcome(event)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const severity = getSeverity(event);
                          return <span className={`px-2 py-0.5 rounded ${severity.className}`}>{severity.label}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={extractDetails(event)}>
                        {extractDetails(event)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{extractIp(event)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
