import { useMemo, useState } from "react";
import { TUTORIAL_CATALOG } from "./catalog";
import { useTutorial } from "./TutorialContext";
import type { TutorialDefinition } from "./types";

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function TutorialCenter() {
  const { startTutorial, getModuleProgress, resetAllProgress, canAccessTutorial, storageUnavailable } = useTutorial();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const filteredTutorials = useMemo(() => {
    const query = normalizeString(searchTerm.trim());
    return TUTORIAL_CATALOG.filter((t) => {
      if (!canAccessTutorial(t.id)) return false;
      // Category filter
      if (selectedCategory !== "all" && t.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (!query) return true;
      const titleMatch = normalizeString(t.title).includes(query);
      const descMatch = normalizeString(t.shortDescription).includes(query);
      const scopeMatch = normalizeString(t.scope).includes(query);
      return titleMatch || descMatch || scopeMatch;
    });
  }, [searchTerm, selectedCategory, canAccessTutorial]);

  const handleStart = (t: TutorialDefinition) => {
    const prog = getModuleProgress(t.id);
    startTutorial(t.id, prog?.contentVersion === t.version ? prog.stepIndex : 0);
  };

  const getStatusBadge = (t: TutorialDefinition) => {
    const prog = getModuleProgress(t.id);
    if (prog && prog.contentVersion !== t.version) {
      return <span>À revoir</span>;
    }
    if (!prog || prog.status === "not_started") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          <i className="fa-regular fa-circle text-[10px]" />
          À découvrir
        </span>
      );
    }
    if (prog.status === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <i className="fa-solid fa-spinner text-[10px]" />
          Étape {prog.stepIndex + 1}/{t.steps.length}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        <i className="fa-solid fa-check text-[10px]" />
        Consulté
      </span>
    );
  };

  return (
    <div
      className="erp-tutorial-center space-y-6"
      data-tutorial="help-tutorial-center"
      role="region"
      aria-label="Centre d'apprentissage interactif"
    >
      {storageUnavailable && <p role="status" className="rounded-lg border border-amber-300 p-3 text-sm">La progression ne peut pas être enregistrée sur cet appareil. Elle reste disponible pendant cette session.</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Apprendre à utiliser l’ERP
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choisissez une tâche ou un parcours guidé. Avancez à votre propre rythme.
            La progression est conservée sur cet appareil lorsque le stockage est disponible.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 underline font-medium"
          >
            Réinitialiser ma progression
          </button>
        </div>
      </div>

      {/* Confirmation modal for reset */}
      {showResetConfirm && (
        <div
          role="region"
          aria-labelledby="reset-progress-title"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-3"
        >
          <h4 id="reset-progress-title" className="font-bold text-sm">
            Réinitialiser votre historique de consultation ?
          </h4>
          <p className="text-xs">
            Cette action effacera uniquement la progression des tutoriels sur cet
            appareil. Aucune donnée commerciale ni réservation ne sera modifiée.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetAllProgress();
                setShowResetConfirm(false);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
            >
              Confirmer la réinitialisation
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Search & Categories */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i
            className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un module (ex: contrat, reprise, statut)..."
            aria-label="Rechercher un module de tutoriel"
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Tous" },
            { id: "discovery", label: "Découverte" },
            { id: "daily", label: "Mon quotidien" },
            { id: "advanced", label: "Aller plus loin" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tutorial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTutorials.map((t) => {
          const prog = getModuleProgress(t.id);
          const isViewed = prog?.status === "viewed";
          const isInProgress = prog?.status === "in_progress";

          return (
            <article
              key={t.id}
              className="flex flex-col justify-between p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      t.scope === "titan"
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : t.scope === "hahitantsoa"
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {t.scope === "titan"
                      ? "Titan Rental"
                      : t.scope === "hahitantsoa"
                      ? "Hahitantsoa"
                      : "Général ERP"}
                  </span>
                  {getStatusBadge(t)}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {t.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {t.shortDescription}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <i className="fa-regular fa-clock" />
                    ~{t.durationMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-list-check" />
                    {t.steps.length} étapes
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleStart(t)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition"
                >
                  <span>
                    {isViewed
                      ? "Revoir le module"
                      : isInProgress
                      ? `Reprendre (Étape ${(prog?.stepIndex || 0) + 1})`
                      : "Démarrer le guide"}
                  </span>
                  <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
