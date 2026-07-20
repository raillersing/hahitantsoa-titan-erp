import React, { useRef, useState } from "react";
import { AppScope } from "../App";
import { uploadImportFile, getImportJobs, updateImportMapping, validateImport } from "../api";
import type { ImportJob } from "../types";

interface ImportExcelPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const STEPS = [
  { key: "upload", label: "Fichier", icon: "fa-file-arrow-up" },
  { key: "mapping", label: "Mapping", icon: "fa-code" },
  { key: "preview", label: "Prévis", icon: "fa-eye" },
  { key: "validate", label: "Validation", icon: "fa-shield-halved" },
  { key: "report", label: "Rapport", icon: "fa-file-lines" },
];

const MAPPING_FIELDS = [
  { value: "", label: "— Ignorer —" },
  { value: "name", label: "Désignation (name)" },
  { value: "code", label: "Code article (code)" },
  { value: "kind", label: "Type produit (kind)" },
  { value: "description", label: "Description" },
  { value: "quantity", label: "Stock disponible (quantity)" },
];

export default function ImportExcelPage({ onNavigate }: ImportExcelPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({});
  const [sheetName, setSheetName] = useState("Articles_2026");
  const [headerRow, setHeaderRow] = useState(1);
  const [duplicateMode, setDuplicateMode] = useState("Avertir");

  const currentStepKey = STEPS[step].key;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      const result = await uploadImportFile(file);
      setJob(result);
      setMappingEdits(result.column_mapping);
      setStep(1);
    } catch (err: any) {
      setError(err.message || "Erreur d'upload");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingConfirm = async () => {
    if (!job) return;
    try {
      setLoading(true);
      const result = await updateImportMapping(job.id, mappingEdits);
      setJob(result);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Erreur de mapping");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!job) return;
    try {
      setLoading(true);
      const result = await validateImport(job.id);
      setJob(result);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Erreur de validation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Import Excel / CSV</h1>
          <p className="text-sm text-slate-500 mt-1">Importation en masse d'articles ou clients</p>
        </div>
        <button
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
          Retour
        </button>
      </div>

      {/* Stepper — identique au prototype */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`step flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
              i < step ? "done bg-green-100 text-green-700" :
              i === step ? "active bg-indigo-100 text-indigo-700" :
              "bg-slate-100 text-slate-400"
            }`}>
              {i < step ? <i className="fas fa-check"></i> : <i className={`fas ${s.icon}`}></i>}
              <span>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200"></div>}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
        </div>
      )}

      {/* Step 1: Upload */}
      {currentStepKey === "upload" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-cloud-arrow-up text-indigo-500 text-3xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Sélectionner un fichier</h3>
          <p className="text-sm text-slate-500 mb-6">Formats acceptés : CSV (UTF-8)</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Chargement...</> : <><i className="fa-solid fa-file-import mr-2"></i>Choisir un fichier CSV</>}
          </button>
        </div>
      )}

      {/* Step 2-3: Mapping + Preview — layout grid span-8/span-4 identique au prototype */}
      {(currentStepKey === "mapping" || currentStepKey === "preview") && job && (
        <div className="grid grid-cols-12 gap-6">
          {/* Colonne gauche — span 8 */}
          <div className="col-span-8 bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Mapping colonnes</h3>
            <p className="text-xs text-slate-500 mb-4">Fichier : {job.filename} ({job.total_rows} lignes)</p>
            <table className="w-full text-sm mb-6">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Colonne CSV</th>
                  <th className="px-3 py-2.5 text-left font-medium">Mapping ERP</th>
                  <th className="px-3 py-2.5 text-left font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.keys(job.column_mapping).map((col) => {
                  const mapped = mappingEdits[col] && mappingEdits[col] !== "";
                  return (
                    <tr key={col} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{col}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={mappingEdits[col] || ""}
                          onChange={(e) => setMappingEdits(prev => ({ ...prev, [col]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {MAPPING_FIELDS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        {mapped ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            <i className="fas fa-check mr-1"></i>Mappé
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                            <i className="fas fa-triangle-exclamation mr-1"></i>Non reconnu
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Prévisualisation</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Colonne</th>
                  <th className="px-3 py-2.5 text-left font-medium">Valeur exemple</th>
                  <th className="px-3 py-2.5 text-left font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.keys(job.column_mapping).slice(0, 5).map((col) => (
                  <tr key={col} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{col}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">—</td>
                    <td className="px-3 py-2.5">
                      {mappingEdits[col] ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Valide</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">Non mappé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Colonne droite — sidebar paramètres — span 4 */}
          <div className="col-span-4 bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Paramètres import</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Feuille source</label>
                <select
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>Articles_2026</option>
                  <option>Stock_global</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ligne d'en-tête</label>
                <input
                  type="number"
                  value={headerRow}
                  onChange={(e) => setHeaderRow(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mode doublon</label>
                <select
                  value={duplicateMode}
                  onChange={(e) => setDuplicateMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>Avertir</option>
                  <option>Ignorer</option>
                  <option>Mettre à jour</option>
                </select>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Total lignes</span>
                <span className="font-semibold">{job.total_rows}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-emerald-600">Valides</span>
                <span className="font-semibold text-emerald-600">{job.valid_rows || job.total_rows}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-amber-600">Avertissements</span>
                <span className="font-semibold text-amber-600">{job.error_rows > 0 ? Math.min(job.error_rows, 2) : 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-rose-600">Erreurs bloquantes</span>
                <span className="font-semibold text-rose-600">{job.error_rows > 0 ? job.error_rows : 0}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={currentStepKey === "mapping" ? handleMappingConfirm : handleValidate}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
                {currentStepKey === "mapping" ? "Valider le mapping" : "Valider l'import"}
              </button>
              <button
                onClick={() => onNavigate("inventory")}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Validation */}
      {currentStepKey === "validate" && job && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Validation en cours...</h3>
          <div className="text-center py-8">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-500 mb-4"></i>
            <p className="text-sm text-slate-500">Vérification des {job.total_rows} lignes...</p>
          </div>
        </div>
      )}

      {/* Step 5: Rapport */}
      {currentStepKey === "report" && job && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Rapport d'import</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{job.total_rows}</p>
              <p className="text-xs text-slate-500">Total lignes</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{job.valid_rows}</p>
              <p className="text-xs text-slate-500">Importées</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{job.error_rows}</p>
              <p className="text-xs text-slate-500">Erreurs</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full mb-6">
            <i className="fas fa-check-circle"></i> Import terminé avec succès
          </div>
          <div className="flex gap-2">
            <button onClick={() => onNavigate("inventory")} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm">
              <i className="fa-solid fa-boxes-stacked mr-2"></i>Voir l'inventaire
            </button>
            <button onClick={() => { setJob(null); setStep(0); }} className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
              <i className="fa-solid fa-file-import mr-2"></i>Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
