import React, { useCallback, useEffect, useRef, useState } from "react";
import { getDocumentArtifactHtml, overrideDocumentInstanceContent } from "./api";
import type { DocumentInstance } from "./types";
import { printDocumentHtml } from "./prototype/DocumentCanvasViewer";

export interface DocumentLiveEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentInstanceId: string;
  title: string;
  templateKey?: string;
  onSaved?: (instance: DocumentInstance) => void;
}

const FONT_FAMILIES = [
  { label: "Century Gothic", value: "'Century Gothic', 'DejaVu Sans', sans-serif" },
  { label: "DejaVu Sans", value: "'DejaVu Sans', sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const FONT_SIZES = [
  { label: "8 pt", value: "1" },
  { label: "9 pt", value: "2" },
  { label: "10 pt", value: "2" },
  { label: "11 pt", value: "3" },
  { label: "12 pt", value: "3" },
  { label: "14 pt", value: "4" },
  { label: "18 pt", value: "5" },
  { label: "24 pt", value: "6" },
];

const TEXT_COLORS = [
  { label: "Noir", value: "#111111" },
  { label: "Gris foncé", value: "#444444" },
  { label: "Gris moyen", value: "#666666" },
  { label: "Bleu Titan", value: "#1e40af" },
  { label: "Indigo", value: "#4338ca" },
  { label: "Vert", value: "#15803d" },
  { label: "Rouge", value: "#b91c1c" },
  { label: "Orange", value: "#c2410c" },
];

const HIGHLIGHT_COLORS = [
  { label: "Aucun", value: "transparent" },
  { label: "Jaune fluo", value: "#fef08a" },
  { label: "Vert clair", value: "#bbf7d0" },
  { label: "Bleu clair", value: "#bfdbfe" },
  { label: "Rose clair", value: "#fbcfe8" },
  { label: "Orange clair", value: "#fed7aa" },
];

export function DocumentLiveEditorModal({
  isOpen,
  onClose,
  documentInstanceId,
  title,
  templateKey,
  onSaved,
}: DocumentLiveEditorModalProps) {
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [headingStyle, setHeadingStyle] = useState("p");
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = useState("3");
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  // Load document HTML artifact
  const loadArtifact = useCallback(async () => {
    if (!documentInstanceId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const html = await getDocumentArtifactHtml(documentInstanceId);
      setInitialHtml(html);
      setIsDirty(false);
      isInitializedRef.current = false;
    } catch (err: any) {
      setErrorMessage(err?.message || "Impossible de charger le document.");
    } finally {
      setLoading(false);
    }
  }, [documentInstanceId]);

  useEffect(() => {
    if (isOpen && documentInstanceId) {
      void loadArtifact();
    } else {
      setInitialHtml(null);
      setIsDirty(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      isInitializedRef.current = false;
    }
  }, [isOpen, documentInstanceId, loadArtifact]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIframeDoc = (): Document | null => {
    return iframeRef.current?.contentDocument || null;
  };

  // Update active formatting states based on cursor selection
  const updateFormattingStates = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    try {
      setIsBold(doc.queryCommandState("bold"));
      setIsItalic(doc.queryCommandState("italic"));
      setIsUnderline(doc.queryCommandState("underline"));
      setIsStrike(doc.queryCommandState("strikeThrough"));
    } catch {
      // Ignore if document not editable or selection query fails
    }
  }, []);

  // Initialize iframe content and setup listeners
  const handleIframeLoad = () => {
    const doc = getIframeDoc();
    if (!doc || isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      if (doc.body) {
        doc.body.contentEditable = "true";
        doc.body.spellcheck = false;

        // Inject editor helper styles if not present
        if (!doc.head.querySelector("style[data-editor-helper]")) {
          const style = doc.createElement("style");
          style.setAttribute("data-editor-helper", "true");
          style.textContent = `
            [contenteditable="true"] { outline: none; }
            .check {
              cursor: pointer;
              user-select: none;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              transition: background-color 0.15s, border-color 0.15s;
            }
            .check:hover {
              background-color: #f1f5f9;
              outline: 1px dashed #6366f1;
            }
            table {
              border-collapse: collapse;
              margin: 3mm 0;
              width: 100%;
            }
            th, td {
              border: 0.3mm solid #999999;
              padding: 1.5mm 2mm;
              min-height: 5mm;
            }
            th {
              background-color: #f8fafc;
              font-weight: bold;
              border-bottom: none !important;
            }
          `;
          doc.head.appendChild(style);
        }

        // Input & mutation tracking
        const markDirty = () => {
          setIsDirty(true);
          updateFormattingStates();
        };

        doc.addEventListener("input", markDirty);
        doc.addEventListener("keyup", updateFormattingStates);
        doc.addEventListener("mouseup", updateFormattingStates);

        // Interactive checkbox toggle
        doc.addEventListener("click", (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          const checkEl = target?.closest(".check") as HTMLElement | null;
          if (checkEl) {
            e.preventDefault();
            e.stopPropagation();
            if (checkEl.textContent?.trim() === "✓") {
              checkEl.textContent = "";
              checkEl.classList.remove("checked");
            } else {
              checkEl.textContent = "✓";
              checkEl.classList.add("checked");
            }
            setIsDirty(true);
          }
        });

        // Keyboard shortcut Ctrl+S / Cmd+S
        doc.addEventListener("keydown", (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            void handleSave();
          }
        });
      }
    } catch {
      // Fallback if writing into iframe errors
    }
  };

  // Prevent toolbar clicks from clearing iframe selection
  const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Execute standard rich-text command
  const exec = (command: string, value: string | undefined = undefined) => {
    const doc = getIframeDoc();
    if (doc) {
      try {
        doc.execCommand(command, false, value);
      } catch {}
    }
    setIsDirty(true);
    updateFormattingStates();
    iframeRef.current?.contentWindow?.focus();
  };

  // Helper to find currently selected table cell
  const getActiveTableCell = (): HTMLTableCellElement | null => {
    const doc = getIframeDoc();
    if (!doc) return null;
    const selection = doc.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement;
    return (element?.closest("td, th") as HTMLTableCellElement) || null;
  };

  // Insert Checklist Item
  const insertCheckboxItem = () => {
    const doc = getIframeDoc();
    if (!doc) return;
    const selection = doc.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    const span = doc.createElement("span");
    span.className = "check";
    span.innerHTML = "";
    const space = doc.createTextNode("\u00a0");

    range.insertNode(space);
    range.insertNode(span);

    // Position cursor after space
    range.setStartAfter(space);
    range.setEndAfter(space);
    selection.removeAllRanges();
    selection.addRange(range);

    setIsDirty(true);
    iframeRef.current?.contentWindow?.focus();
  };

  // Insert Table
  const insertTable = (rows: number, cols: number) => {
    const doc = getIframeDoc();
    if (!doc) return;
    const selection = doc.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    const table = doc.createElement("table");
    table.className = "document-table";
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.margin = "3mm 0";

    const thead = doc.createElement("thead");
    const headerRow = doc.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const th = doc.createElement("th");
      th.style.border = "0.3mm solid #999999";
      th.style.borderBottom = "none";
      th.style.padding = "1.5mm 2mm";
      th.style.backgroundColor = "#f8fafc";
      th.textContent = `Colonne ${c + 1}`;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = doc.createElement("tbody");
    for (let r = 1; r < rows; r++) {
      const row = doc.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = doc.createElement("td");
        td.style.border = "0.3mm solid #999999";
        td.style.padding = "1.5mm 2mm";
        td.textContent = `Donnée ${r}.${c + 1}`;
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    range.deleteContents();
    range.insertNode(table);
    setIsDirty(true);
    setShowTableMenu(false);
    iframeRef.current?.contentWindow?.focus();
  };

  // Table manipulation helpers
  const handleInsertRowAbove = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const row = cell.closest("tr");
    if (!row) return;
    const colCount = row.children.length;
    const isHeader = cell.tagName.toLowerCase() === "th";
    const newRow = row.ownerDocument.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const newCell = row.ownerDocument.createElement(isHeader ? "th" : "td");
      newCell.style.border = "0.3mm solid #999999";
      if (isHeader) newCell.style.borderBottom = "none";
      newCell.style.padding = "1.5mm 2mm";
      newCell.innerHTML = "&nbsp;";
      newRow.appendChild(newCell);
    }
    row.parentNode?.insertBefore(newRow, row);
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleInsertRowBelow = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const row = cell.closest("tr");
    if (!row) return;
    const colCount = row.children.length;
    const newRow = row.ownerDocument.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const newCell = row.ownerDocument.createElement("td");
      newCell.style.border = "0.3mm solid #999999";
      newCell.style.padding = "1.5mm 2mm";
      newCell.innerHTML = "&nbsp;";
      newRow.appendChild(newCell);
    }
    row.parentNode?.insertBefore(newRow, row.nextSibling);
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleDeleteRow = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const row = cell.closest("tr");
    const table = cell.closest("table");
    if (!row || !table) return;
    if (table.querySelectorAll("tr").length <= 1) {
      table.remove();
    } else {
      row.remove();
    }
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleInsertColumnLeft = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll("tr");
    rows.forEach((r) => {
      const isHeader = r.parentElement?.tagName.toLowerCase() === "thead" || r.children[0]?.tagName.toLowerCase() === "th";
      const newCell = table.ownerDocument.createElement(isHeader ? "th" : "td");
      newCell.style.border = "0.3mm solid #999999";
      if (isHeader) newCell.style.borderBottom = "none";
      newCell.style.padding = "1.5mm 2mm";
      newCell.innerHTML = "&nbsp;";
      const targetCell = r.children[colIndex];
      if (targetCell) {
        r.insertBefore(newCell, targetCell);
      } else {
        r.appendChild(newCell);
      }
    });
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleInsertColumnRight = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll("tr");
    rows.forEach((r) => {
      const isHeader = r.parentElement?.tagName.toLowerCase() === "thead" || r.children[0]?.tagName.toLowerCase() === "th";
      const newCell = table.ownerDocument.createElement(isHeader ? "th" : "td");
      newCell.style.border = "0.3mm solid #999999";
      if (isHeader) newCell.style.borderBottom = "none";
      newCell.style.padding = "1.5mm 2mm";
      newCell.innerHTML = "&nbsp;";
      const targetCell = r.children[colIndex];
      if (targetCell && targetCell.nextSibling) {
        r.insertBefore(newCell, targetCell.nextSibling);
      } else {
        r.appendChild(newCell);
      }
    });
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleDeleteColumn = () => {
    const cell = getActiveTableCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const colIndex = cell.cellIndex;
    const rows = table.querySelectorAll("tr");
    let remaining = false;
    rows.forEach((r) => {
      if (r.children.length > 1) {
        remaining = true;
        if (r.children[colIndex]) {
          r.removeChild(r.children[colIndex]);
        }
      }
    });
    if (!remaining) {
      table.remove();
    }
    setIsDirty(true);
    setShowTableMenu(false);
  };

  const handleDeleteTable = () => {
    const cell = getActiveTableCell();
    const table = cell?.closest("table");
    if (table) {
      table.remove();
      setIsDirty(true);
      setShowTableMenu(false);
    }
  };

  // Save current HTML to backend
  const handleSave = async () => {
    if (!documentInstanceId) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const doc = getIframeDoc();
      let cleanHtml = "";
      if (doc?.documentElement) {
        const clone = doc.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
        const body = clone.querySelector("body");
        if (body) {
          body.removeAttribute("contenteditable");
          body.removeAttribute("spellcheck");
        }
        clone.querySelectorAll("style[data-editor-helper]").forEach((el) => el.remove());
        cleanHtml = "<!doctype html>\n" + clone.outerHTML;
      } else if (initialHtml) {
        cleanHtml = initialHtml;
      }

      const updated = await overrideDocumentInstanceContent(documentInstanceId, cleanHtml);

      setIsDirty(false);
      setSuccessMessage("Document enregistré et PDF synchronisé avec succès !");
      setTimeout(() => setSuccessMessage(null), 3500);
      onSaved?.(updated);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erreur lors de l'enregistrement du document.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm close if dirty
  const handleClose = () => {
    if (isDirty) {
      const confirmClose = window.confirm(
        "Des modifications n'ont pas été enregistrées. Voulez-vous vraiment fermer l'éditeur ?",
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  // Print current content
  const handlePrint = () => {
    const doc = getIframeDoc();
    if (!doc) {
      if (initialHtml) printDocumentHtml(initialHtml);
      return;
    }
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    clone.querySelectorAll("style[data-editor-helper]").forEach((el) => el.remove());
    printDocumentHtml("<!doctype html>\n" + clone.outerHTML);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-editor-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs animate-fade-in"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
            <i className="fa-solid fa-file-pen"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="live-editor-title" className="text-base font-bold text-slate-900">
                {title}
              </h2>
              {templateKey && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {templateKey}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {isDirty ? (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Modifications non enregistrées
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-check text-[11px]"></i>
                  Document à jour
                </span>
              )}
              {successMessage && (
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
                  {successMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            title="Imprimer le document dans son état actuel"
          >
            <i className="fa-solid fa-print"></i>
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            data-testid="editor-save"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition cursor-pointer"
            title="Enregistrer (Ctrl+S / Cmd+S)"
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i>
                <span>Enregistrer</span>
                <span className="hidden sm:inline-block ml-1 opacity-75 font-normal text-[10px]">
                  (Ctrl+S)
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            aria-label="Fermer l'éditeur"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      </header>

      {/* ── Google Docs Style Formatting Toolbar ────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-1 px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0 text-slate-700 select-none shadow-xs"
        role="toolbar"
        aria-label="Barre d'outils de mise en forme"
      >
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            type="button"
            data-testid="editor-undo"
            title="Annuler (Ctrl+Z)"
            onMouseDown={preventBlur}
            onClick={() => exec("undo")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <i className="fa-solid fa-rotate-left text-sm"></i>
          </button>
          <button
            type="button"
            data-testid="editor-redo"
            title="Rétablir (Ctrl+Y)"
            onMouseDown={preventBlur}
            onClick={() => exec("redo")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <i className="fa-solid fa-rotate-right text-sm"></i>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Headings / Style */}
        <select
          data-testid="editor-heading"
          aria-label="Style de paragraphe"
          value={headingStyle}
          onChange={(e) => {
            setHeadingStyle(e.target.value);
            exec("formatBlock", `<${e.target.value}>`);
          }}
          className="text-xs py-1 px-2 border border-slate-300 rounded bg-white font-medium hover:border-slate-400 focus:outline-hidden"
        >
          <option value="p">Texte normal</option>
          <option value="h1">Titre 1</option>
          <option value="h2">Titre 2</option>
          <option value="h3">Titre 3</option>
        </select>

        {/* Font Family */}
        <select
          data-testid="editor-font-family"
          aria-label="Police d'écriture"
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            exec("fontName", e.target.value);
          }}
          className="text-xs py-1 px-2 border border-slate-300 rounded bg-white font-medium hover:border-slate-400 focus:outline-hidden max-w-[130px]"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Font Size */}
        <select
          data-testid="editor-font-size"
          aria-label="Taille de police"
          value={fontSize}
          onChange={(e) => {
            setFontSize(e.target.value);
            exec("fontSize", e.target.value);
          }}
          className="text-xs py-1 px-1.5 border border-slate-300 rounded bg-white font-medium hover:border-slate-400 focus:outline-hidden"
        >
          {FONT_SIZES.map((size) => (
            <option key={size.label} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Text Style: Bold, Italic, Underline, Strike */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            data-testid="editor-bold"
            title="Gras (Ctrl+B)"
            onMouseDown={preventBlur}
            onClick={() => exec("bold")}
            className={`p-1.5 rounded font-bold transition cursor-pointer ${
              isBold ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-700"
            }`}
          >
            <i className="fa-solid fa-bold text-xs"></i>
          </button>

          <button
            type="button"
            data-testid="editor-italic"
            title="Italique (Ctrl+I)"
            onMouseDown={preventBlur}
            onClick={() => exec("italic")}
            className={`p-1.5 rounded transition cursor-pointer ${
              isItalic ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-700"
            }`}
          >
            <i className="fa-solid fa-italic text-xs"></i>
          </button>

          <button
            type="button"
            data-testid="editor-underline"
            title="Souligné (Ctrl+U)"
            onMouseDown={preventBlur}
            onClick={() => exec("underline")}
            className={`p-1.5 rounded transition cursor-pointer ${
              isUnderline ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-700"
            }`}
          >
            <i className="fa-solid fa-underline text-xs"></i>
          </button>

          <button
            type="button"
            data-testid="editor-strike"
            title="Barré"
            onMouseDown={preventBlur}
            onClick={() => exec("strikeThrough")}
            className={`p-1.5 rounded transition cursor-pointer ${
              isStrike ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-700"
            }`}
          >
            <i className="fa-solid fa-strikethrough text-xs"></i>
          </button>
        </div>

        {/* Text Color Dropdown */}
        <div className="relative">
          <button
            type="button"
            data-testid="editor-text-color-btn"
            title="Couleur du texte"
            onMouseDown={preventBlur}
            onClick={() => {
              setShowColorMenu(!showColorMenu);
              setShowHighlightMenu(false);
            }}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 flex items-center gap-1 transition cursor-pointer"
          >
            <span className="font-bold border-b-2 border-slate-800 leading-none">A</span>
            <i className="fa-solid fa-caret-down text-[9px] text-slate-500"></i>
          </button>
          {showColorMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Couleur</span>
              {TEXT_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => {
                    exec("foreColor", col.value);
                    setShowColorMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300"
                    style={{ backgroundColor: col.value }}
                  ></span>
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Dropdown */}
        <div className="relative">
          <button
            type="button"
            data-testid="editor-highlight-btn"
            title="Surlignage"
            onMouseDown={preventBlur}
            onClick={() => {
              setShowHighlightMenu(!showHighlightMenu);
              setShowColorMenu(false);
            }}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 flex items-center gap-1 transition cursor-pointer"
          >
            <i className="fa-solid fa-highlighter text-xs text-amber-500"></i>
            <i className="fa-solid fa-caret-down text-[9px] text-slate-500"></i>
          </button>
          {showHighlightMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Surligner</span>
              {HIGHLIGHT_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  onMouseDown={preventBlur}
                  onClick={() => {
                    exec("hiliteColor", col.value);
                    setShowHighlightMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded border border-slate-300"
                    style={{ backgroundColor: col.value }}
                  ></span>
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Alignments */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            data-testid="editor-align-left"
            title="Aligner à gauche"
            onMouseDown={preventBlur}
            onClick={() => exec("justifyLeft")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-align-left text-xs"></i>
          </button>
          <button
            type="button"
            data-testid="editor-align-center"
            title="Centrer"
            onMouseDown={preventBlur}
            onClick={() => exec("justifyCenter")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-align-center text-xs"></i>
          </button>
          <button
            type="button"
            data-testid="editor-align-right"
            title="Aligner à droite"
            onMouseDown={preventBlur}
            onClick={() => exec("justifyRight")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-align-right text-xs"></i>
          </button>
          <button
            type="button"
            data-testid="editor-align-justify"
            title="Justifier"
            onMouseDown={preventBlur}
            onClick={() => exec("justifyFull")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-align-justify text-xs"></i>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Lists */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            data-testid="editor-bullet-list"
            title="Liste à puces"
            onMouseDown={preventBlur}
            onClick={() => exec("insertUnorderedList")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-list-ul text-xs"></i>
          </button>
          <button
            type="button"
            data-testid="editor-number-list"
            title="Liste numérotée"
            onMouseDown={preventBlur}
            onClick={() => exec("insertOrderedList")}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-list-ol text-xs"></i>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Checklist Item Insertion */}
        <button
          type="button"
          data-testid="editor-insert-checkbox"
          title="Insérer une case à cocher pour checklist"
          onMouseDown={preventBlur}
          onClick={insertCheckboxItem}
          className="flex items-center gap-1.5 px-2 py-1 hover:bg-indigo-50 text-indigo-700 rounded text-xs font-semibold transition border border-indigo-200/60 cursor-pointer"
        >
          <i className="fa-solid fa-square-check"></i>
          <span>Case à cocher</span>
        </button>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Table Management */}
        <div className="relative" ref={tableMenuRef}>
          <button
            type="button"
            data-testid="editor-table-menu"
            title="Gestion des tableaux"
            onMouseDown={preventBlur}
            onClick={() => setShowTableMenu(!showTableMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition border cursor-pointer ${
              showTableMenu
                ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                : "hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            <i className="fa-solid fa-table"></i>
            <span>Tableau</span>
            <i className="fa-solid fa-caret-down text-[9px]"></i>
          </button>

          {showTableMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50 flex flex-col gap-1 min-w-[200px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-2 py-0.5">
                Insérer un tableau
              </span>
              <div className="grid grid-cols-3 gap-1 px-1 mb-1">
                <button
                  type="button"
                  data-testid="editor-insert-table-2x2"
                  onMouseDown={preventBlur}
                  onClick={() => insertTable(2, 2)}
                  className="px-2 py-1 text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded text-center cursor-pointer"
                >
                  2 × 2
                </button>
                <button
                  type="button"
                  data-testid="editor-insert-table-3x3"
                  onMouseDown={preventBlur}
                  onClick={() => insertTable(3, 3)}
                  className="px-2 py-1 text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded text-center font-bold cursor-pointer"
                >
                  3 × 3
                </button>
                <button
                  type="button"
                  data-testid="editor-insert-table-4x3"
                  onMouseDown={preventBlur}
                  onClick={() => insertTable(4, 3)}
                  className="px-2 py-1 text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded text-center cursor-pointer"
                >
                  4 × 3
                </button>
              </div>

              <div className="w-full h-px bg-slate-200 my-1"></div>

              <span className="text-[10px] font-bold text-slate-500 uppercase px-2 py-0.5">
                Lignes & Colonnes
              </span>
              <button
                type="button"
                data-testid="editor-row-above"
                onMouseDown={preventBlur}
                onClick={handleInsertRowAbove}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left text-slate-700 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-up text-slate-400"></i>
                <span>Ligne au-dessus</span>
              </button>
              <button
                type="button"
                data-testid="editor-row-below"
                onMouseDown={preventBlur}
                onClick={handleInsertRowBelow}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left text-slate-700 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-down text-slate-400"></i>
                <span>Ligne au-dessous</span>
              </button>
              <button
                type="button"
                data-testid="editor-delete-row"
                onMouseDown={preventBlur}
                onClick={handleDeleteRow}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-rose-50 rounded text-left text-rose-700 cursor-pointer"
              >
                <i className="fa-solid fa-trash-can text-rose-500"></i>
                <span>Supprimer la ligne</span>
              </button>

              <div className="w-full h-px bg-slate-200 my-0.5"></div>

              <button
                type="button"
                data-testid="editor-col-left"
                onMouseDown={preventBlur}
                onClick={handleInsertColumnLeft}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left text-slate-700 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-slate-400"></i>
                <span>Colonne à gauche</span>
              </button>
              <button
                type="button"
                data-testid="editor-col-right"
                onMouseDown={preventBlur}
                onClick={handleInsertColumnRight}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded text-left text-slate-700 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-right text-slate-400"></i>
                <span>Colonne à droite</span>
              </button>
              <button
                type="button"
                data-testid="editor-delete-col"
                onMouseDown={preventBlur}
                onClick={handleDeleteColumn}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-rose-50 rounded text-left text-rose-700 cursor-pointer"
              >
                <i className="fa-solid fa-trash-can text-rose-500"></i>
                <span>Supprimer la colonne</span>
              </button>

              <div className="w-full h-px bg-slate-200 my-0.5"></div>

              <button
                type="button"
                data-testid="editor-delete-table"
                onMouseDown={preventBlur}
                onClick={handleDeleteTable}
                className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-rose-100 rounded text-left text-rose-800 font-semibold cursor-pointer"
              >
                <i className="fa-solid fa-trash text-rose-600"></i>
                <span>Supprimer le tableau</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1"></div>

        {/* Clear formatting */}
        <button
          type="button"
          data-testid="editor-clear-format"
          title="Effacer le formatage"
          onMouseDown={preventBlur}
          onClick={() => exec("removeFormat")}
          className="p-1.5 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <i className="fa-solid fa-eraser text-xs"></i>
        </button>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 text-rose-800 px-6 py-2.5 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ── Document Page Canvas ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-slate-300/70 p-6 flex justify-center items-start">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-600">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
            <span className="text-sm font-medium">Chargement du document pour édition...</span>
          </div>
        ) : (
          <div className="relative mx-auto my-2 rounded-md shadow-2xl bg-white overflow-hidden transition-all max-w-[210mm] w-full min-h-[297mm]">
            <iframe
              ref={iframeRef}
              title={`Éditeur direct: ${title}`}
              data-testid="document-live-editor-iframe"
              srcDoc={initialHtml || ""}
              onLoad={handleIframeLoad}
              className="w-full min-h-[297mm] border-0 bg-white block"
              style={{
                height: "100%",
                minHeight: "1123px",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Footer status bar ────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-6 py-2 bg-white border-t border-slate-200 shrink-0 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>
            <i className="fa-solid fa-circle-info text-indigo-500 mr-1"></i>
            Cliquez directement sur le texte pour modifier. Les cases à cocher se cochent d'un clic.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Format A4 standard</span>
          <span>·</span>
          <span>PDF synchronisé automatiquement à l'enregistrement</span>
        </div>
      </footer>
    </div>
  );
}

export default DocumentLiveEditorModal;
