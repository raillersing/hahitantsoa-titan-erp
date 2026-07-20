import React from 'react';

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg';

export interface LoadingSpinnerProps {
  /** Spinner size: sm (text-sm), md (text-2xl), lg (text-4xl). Default: md */
  size?: LoadingSpinnerSize;
  /** Optional message displayed below the spinner */
  message?: string;
  /** If true, renders a full-screen centered overlay */
  fullScreen?: boolean;
  /** Optional extra className on the outer wrapper */
  className?: string;
}

const sizeConfig: Record<LoadingSpinnerSize, { spinner: string; text: string }> = {
  sm: { spinner: 'text-base', text: 'text-xs' },
  md: { spinner: 'text-2xl', text: 'text-sm' },
  lg: { spinner: 'text-4xl', text: 'text-base' },
};

export default function LoadingSpinner({
  size = 'md',
  message,
  fullScreen = false,
  className = '',
}: LoadingSpinnerProps) {
  const { spinner: spinnerSize, text: textSize } = sizeConfig[size];

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <i className={`fas fa-spinner fa-spin ${spinnerSize} text-slate-400 dark:text-slate-500`} />
      {message && (
        <p className={`${textSize} text-slate-500 dark:text-slate-400 font-medium`}>{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}
