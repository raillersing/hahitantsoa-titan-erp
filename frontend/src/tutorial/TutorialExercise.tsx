import React, { useState } from "react";
import type { TutorialExerciseData } from "./types";

interface TutorialExerciseProps {
  data: TutorialExerciseData;
  onSuccess: () => void;
}

export function TutorialExercise({ data, onSuccess }: TutorialExerciseProps) {
  // State for multiple-choice
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // State for sequence-order
  const [sequenceIds, setSequenceIds] = useState<string[]>(() =>
    data.kind === "sequence-order"
      ? // Start with a non-trivial order (or reversed if already matching)
        [...data.choices.map((c) => c.id)].reverse()
      : [],
  );
  const [sequenceSubmitted, setSequenceSubmitted] = useState(false);

  const isMultipleChoice = data.kind === "multiple-choice";

  const handleSelectChoice = (choiceId: string, isCorrect: boolean) => {
    setSelectedChoiceId(choiceId);
    if (isCorrect) {
      onSuccess();
    }
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sequenceIds.length) return;

    const next = [...sequenceIds];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setSequenceIds(next);
    setSequenceSubmitted(false);
  };

  const handleVerifySequence = () => {
    setSequenceSubmitted(true);
    const expected = data.correctSequenceIds || data.choices.map((c) => c.id);
    const isMatch = sequenceIds.every((id, idx) => id === expected[idx]);
    if (isMatch) {
      onSuccess();
    }
  };

  return (
    <div className="erp-tutorial-exercise space-y-3" role="region" aria-label="Exercice pédagogique">
      <div className="erp-tutorial-exercise-banner rounded-lg">
        <i className="fa-solid fa-graduation-cap" aria-hidden="true" />
        <span>Exercice — aucune donnée enregistrée dans vos dossiers</span>
      </div>

      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
        {data.question}
      </p>

      {isMultipleChoice ? (
        <div className="space-y-2" role="radiogroup" aria-label={data.question}>
          {data.choices.map((choice) => {
            const isSelected = selectedChoiceId === choice.id;
            let choiceClass = "erp-tutorial-exercise-choice";
            if (isSelected) {
              choiceClass += choice.isCorrect
                ? " erp-tutorial-exercise-choice--correct"
                : " erp-tutorial-exercise-choice--incorrect";
            }

            return (
              <div key={choice.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={choiceClass}
                  onClick={() => handleSelectChoice(choice.id, choice.isCorrect)}
                >
                  <span className="font-medium text-xs mt-0.5">
                    {isSelected ? (
                      choice.isCorrect ? (
                        <i className="fa-solid fa-circle-check text-emerald-600" />
                      ) : (
                        <i className="fa-solid fa-circle-xmark text-rose-600" />
                      )
                    ) : (
                      <i className="fa-regular fa-circle text-slate-400" />
                    )}
                  </span>
                  <span>{choice.label}</span>
                </button>
                {isSelected && (
                  <p
                    className={`text-xs px-2 py-1 rounded ${
                      choice.isCorrect
                        ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                    }`}
                  >
                    {choice.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Sequence order question */
        <div className="space-y-2">
          <ul className="space-y-2" aria-label="Liste ordonnée">
            {sequenceIds.map((id, index) => {
              const choice = data.choices.find((c) => c.id === id);
              if (!choice) return null;
              return (
                <li
                  key={id}
                  className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                      {index + 1}
                    </span>
                    <span>{choice.label}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, "up")}
                      aria-label={`Monter ${choice.label}`}
                      className="p-1 px-2 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-arrow-up" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sequenceIds.length - 1}
                      onClick={() => moveItem(index, "down")}
                      aria-label={`Descendre ${choice.label}`}
                      className="p-1 px-2 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-arrow-down" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleVerifySequence}
              className="erp-tutorial-btn erp-tutorial-btn--primary text-xs"
            >
              Vérifier l&apos;ordre
            </button>
            {sequenceSubmitted && (
              <span className="text-xs font-semibold">
                {sequenceIds.every(
                  (id, idx) =>
                    id ===
                    (data.correctSequenceIds || data.choices.map((c) => c.id))[
                      idx
                    ],
                ) ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-check mr-1" />
                    Ordre correct !
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">
                    <i className="fa-solid fa-xmark mr-1" />
                    Ordre incorrect. Réessayez.
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
