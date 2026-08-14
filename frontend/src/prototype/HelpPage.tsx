import React, { useEffect, useState } from "react";
import type { AppScope } from "../App";
import { createBugReport, getBugReports, updateBugReportStatus } from "../api";
import type { BugReport } from "../types";

interface HelpPageProps {
  onNavigate: (scope: AppScope, param?: string) => void;
  canManageSupport?: boolean;
}

const statusLabels: Record<BugReport["status"], string> = {
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Résolu",
};

const severityLabels: Record<BugReport["severity"], string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
  critical: "Critique",
};

export default function HelpPage({ onNavigate, canManageSupport = false }: HelpPageProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<BugReport["severity"]>("medium");

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getBugReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les signalements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const report = await createBugReport({
        title: title.trim(),
        description: description.trim(),
        severity,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        correlation_id: crypto.randomUUID(),
      });
      setReports((current) => [report, ...current]);
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err instanceof Error ? err.message : "Le signalement n'a pas pu être enregistré.");
    }
  };

  const changeStatus = async (report: BugReport, nextStatus: BugReport["status"]) => {
    try {
      const updated = await updateBugReportStatus(report.id, nextStatus);
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le statut n'a pas pu être mis à jour.");
    }
  };

  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Aide & Support</h2>
        <p className="text-sm text-slate-500">Documentation et suivi des problèmes réellement enregistrés dans l&apos;ERP.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600">
            <i className="fa-solid fa-book" aria-hidden="true"></i>
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-800">Manuel utilisateur</h3>
          <p className="text-sm text-slate-500">Les parcours validés restent accessibles depuis les volets et leurs pages métier.</p>
          <button type="button" onClick={() => onNavigate("user-manual")} className="mt-4 font-medium text-indigo-600 hover:underline">Ouvrir le manuel →</button>
        </div>

        <form onSubmit={submitReport} className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-xl text-rose-600">
            <i className="fa-solid fa-bug" aria-hidden="true"></i>
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-800">Signaler un bug</h3>
          <p className="mb-4 text-sm text-slate-500">Le signalement sera enregistré avec la page et le navigateur utilisés.</p>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Titre
              <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Gravité
              <select value={severity} onChange={(event) => setSeverity(event.target.value as BugReport["severity"])} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Description
              <textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            {submitState === "success" && <p className="text-sm text-emerald-700" role="status">Signalement enregistré.</p>}
            {submitState === "error" && <p className="text-sm text-rose-700" role="alert">{submitError}</p>}
            <button disabled={submitState === "submitting"} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitState === "submitting" ? "Enregistrement…" : "Envoyer le signalement"}
            </button>
          </div>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div><h3 className="text-lg font-bold text-slate-800">Signalements enregistrés</h3><p className="text-sm text-slate-500">Données chargées depuis le backend.</p></div>
          <button type="button" onClick={() => void loadReports()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Actualiser</button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</div>}
        {loading ? <p className="text-sm text-slate-500">Chargement…</p> : reports.length === 0 ? <p className="text-sm text-slate-500">Aucun signalement.</p> : (
          <div className="space-y-3">
            {reports.map((report) => <article key={report.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-800">{report.title}</h4><span className="text-xs text-slate-500">{statusLabels[report.status]} · {severityLabels[report.severity]}</span></div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{report.description}</p>
              <p className="mt-2 text-xs text-slate-400">{new Date(report.created_at).toLocaleString("fr-FR")} · {report.reporter_username}</p>
              {canManageSupport && <label className="mt-3 block text-xs font-medium text-slate-600">Statut
                <select value={report.status} onChange={(event) => void changeStatus(report, event.target.value as BugReport["status"])} className="ml-2 rounded border border-slate-300 p-1.5 text-xs">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>}
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
