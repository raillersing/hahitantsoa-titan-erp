import React from "react";

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  icon = "fa-folder-open",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
      <i className={`fas ${icon} text-4xl text-slate-300 dark:text-slate-600 mb-4`}></i>
      {title && (
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {title}
        </h3>
      )}
      <p className="text-slate-500 dark:text-slate-400 font-medium">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
