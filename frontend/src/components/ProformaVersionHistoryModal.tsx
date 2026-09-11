import React from "react";
import type { ProformaHistorySummary, ProformaVersionItem } from "../proformaVersionHistory";

export interface ProformaVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ProformaHistorySummary;
  onPreviewVersion: (version: ProformaVersionItem) => void;
  onCreateNewRevision?: () => Promise<void> | void;
  isCreatingRevision?: boolean;
  isConfirmed: boolean;
  domain?: "titan" | "hahitantsoa";
}

function formatDateFr(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr || "—";
  }
}

export const ProformaVersionHistoryModal: React.FC<ProformaVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  summary,
  onPreviewVersion,
  onCreateNewRevision,
  isCreatingRevision = false,
  isConfirmed,
}) => {
  if (!isOpen) return null;

  // Display versions newest first for easy consultation
  const displayVersions = [...summary.versions].reverse();
  const nextVersionNumber = summary.versions.length + 1;

  const renderStatusBadge = (version: ProformaVersionItem) => {
    switch (version.statusCode) {
      case "official_contract":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <i className="fa-solid fa-circle-check text-emerald-600"></i>
            {version.statusLabel}
          </span>
        );
      case "official_amendment":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <i className="fa-solid fa-file-contract text-indigo-600"></i>
            {version.statusLabel}
          </span>
        );
      case "pending_amendment":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <i className="fa-solid fa-hourglass-half text-amber-600"></i>
            {version.statusLabel}
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <i className="fa-solid fa-box-archive text-slate-400"></i>
            {version.statusLabel}
          </span>
        );
      case "voided":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <i className="fa-solid fa-ban text-rose-600"></i>
            Annulé
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
            <i className="fa-solid fa-file-pen text-amber-500"></i>
            {version.statusLabel}
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proforma-history-title"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h3 id="proforma-history-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Historique des versions du Proforma
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                  {summary.reference}
                </span>
                <span className="text-xs text-slate-500">
                  • {summary.totalVersionsCount} version{summary.totalVersionsCount > 1 ? "s" : ""}
                </span>
                {summary.currentOfficialVersion && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    • <i className="fa-solid fa-circle-check text-[11px]"></i>
                    Active : {summary.currentOfficialVersion.versionLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Fermer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Informational context banner */}
        <div className="px-6 py-3 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-blue-600 dark:text-blue-400 text-sm mt-0.5"></i>
          <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            {isConfirmed ? (
              <>
                <strong>Réservation confirmée :</strong> Le numéro de proforma{" "}
                <span className="font-mono font-bold">{summary.reference}</span> reste fixe. Toute révision
                émise après confirmation reste un brouillon de travail jusqu’à son officialisation définitive par un{" "}
                <strong>avenant</strong> au contrat.
              </>
            ) : (
              <>
                <strong>Phase préliminaire :</strong> Le numéro de proforma{" "}
                <span className="font-mono font-bold">{summary.reference}</span> est partagé par toutes les
                versions de devis. La dernière version sera officialisée lors de la signature du contrat et du
                règlement de l'acompte.
              </>
            )}
          </p>
        </div>

        {/* Body content / Versions table */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {displayVersions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <i className="fa-solid fa-file-invoice text-3xl text-slate-300 mb-2"></i>
              <p className="text-sm">Aucun proforma n'a encore été généré pour ce dossier.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/70 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Émission</th>
                    <th className="py-3 px-4">Statut légal & commercial</th>
                    <th className="py-3 px-4">Notes / Contexte</th>
                    <th className="py-3 px-4 text-right">Aperçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {displayVersions.map((version) => (
                    <tr
                      key={version.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        version.isOfficial
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 font-medium"
                          : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                              version.isOfficial
                                ? "bg-emerald-600 text-white shadow-xs"
                                : version.statusCode === "pending_amendment"
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {version.versionLabel}
                          </span>
                          {version.isOfficial && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              (Officielle)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {formatDateFr(version.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(version)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {version.notes || "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onPreviewVersion(version)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                          title={`Voir l'aperçu officiel de la version ${version.versionLabel}`}
                        >
                          <i className="fa-solid fa-eye text-indigo-600"></i>
                          Aperçu {version.versionLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div>
            {onCreateNewRevision && (
              <button
                type="button"
                onClick={() => void onCreateNewRevision()}
                disabled={isCreatingRevision}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                title="Générer une nouvelle révision du proforma sous le même numéro"
              >
                {isCreatingRevision ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Génération de la révision...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    Nouvelle révision (v{nextVersionNumber})
                  </>
                )}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProformaVersionHistoryModal;
