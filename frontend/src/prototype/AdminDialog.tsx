import { useEffect, useRef, type ReactNode } from "react";

/** Local administration dialog: initial focus, keyboard containment and restoration. */
export function AdminDialog({ titleId, onClose, busy = false, className, children }: {
  titleId: string; onClose: () => void; busy?: boolean; className: string; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = root.current;
    const focusInside = () => (dialog?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]') ?? dialog)?.focus();
    focusInside();
    const containFocus = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) focusInside();
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <div ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1} className={className}
    onClickCapture={event => { if (busy && (event.target as HTMLElement).closest("button")) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') ?? []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); root.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>{children}</div>;
}
