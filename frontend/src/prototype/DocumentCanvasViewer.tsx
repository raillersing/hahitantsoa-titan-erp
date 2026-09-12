import React, { useEffect, useRef, useState } from "react";

export type PaperSize = "A4" | "THERMAL_80MM";

export const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  // CSS pixels at 96 dpi: 80 mm x 120 mm thermal receipt.
  THERMAL_80MM: { width: 302, height: 454 },
};

export const PAPER_LABELS: Record<PaperSize, string> = {
  A4: "A4",
  THERMAL_80MM: "80 mm thermique",
};

export function detectPaperSize(html: string): PaperSize {
  if (/@page\s*\{[^}]*size:\s*80mm\b/i.test(html)) return "THERMAL_80MM";
  return "A4";
}

export function detectPageCount(html: string): number {
  const pageMarkers = html.match(
    /class=["'][^"']*\b(?:document-page|contract-page|page)\b[^"']*["']/g,
  );
  return Math.max(1, pageMarkers?.length ?? 1);
}

export function detectLandscapeCount(html: string): number {
  const matches = html.match(/class=["'][^"']*\blandscape\b[^"']*["']/g);
  return matches?.length ?? 0;
}

const LANDSCAPE_SCREEN_STYLE = `<style id="canvas-landscape-preview-override">
@media screen {
  html, body {
    width: 297mm !important;
    max-width: 297mm !important;
    min-width: 297mm !important;
    margin: 0 auto !important;
  }
  .contract-document {
    width: 297mm !important;
    max-width: 297mm !important;
    margin: 0 auto !important;
  }
  .contract-page:not(.landscape) {
    width: 210mm !important;
    max-width: 210mm !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .contract-page.landscape {
    width: 297mm !important;
    max-width: 297mm !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}
</style>`;

export function injectLandscapePreviewStyles(html: string): string {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${LANDSCAPE_SCREEN_STYLE}</head>`);
  }
  return `${LANDSCAPE_SCREEN_STYLE}${html}`;
}

export function printDocumentHtml(html: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.setAttribute("aria-hidden", "true");
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    printFrame.contentWindow?.focus();
    setTimeout(() => {
      printFrame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 1500);
    }, 250);
  }
}

export interface DocumentCanvasViewerProps {
  html: string;
  title?: string;
  paperSize?: PaperSize;
  className?: string;
  sandbox?: string;
  showPrintButton?: boolean;
}

/**
 * Reusable high-fidelity document canvas viewer.
 * Renders A4 / thermal HTML documents with exact print proportions,
 * automatic multi-page height detection, responsive scale transform,
 * and a realistic paper sheet appearance on a desk workspace.
 */
export function DocumentCanvasViewer({
  html,
  title = "Aperçu du document",
  paperSize: initialPaperSize,
  className = "",
  sandbox = "",
  showPrintButton = false,
}: DocumentCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const paperSize = initialPaperSize || detectPaperSize(html);
  const pageCount = detectPageCount(html);
  const landscapeCount = detectLandscapeCount(html);
  const isLandscapeDocument = paperSize === "A4" && landscapeCount > 0;
  const dimensions = PAPER_DIMENSIONS[paperSize];

  const contentWidth = isLandscapeDocument ? PAPER_DIMENSIONS.A4.height : dimensions.width;
  const portraitCount = Math.max(0, pageCount - landscapeCount);
  const contentHeight = isLandscapeDocument
    ? portraitCount * dimensions.height + landscapeCount * dimensions.width
    : dimensions.height * pageCount;

  const resolvedHtml = isLandscapeDocument ? injectLandscapePreviewStyles(html) : html;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const computedScale = Math.min(1, container.clientWidth / contentWidth);
      // When scale is close to 1 (>= 0.98), snap to 1 to avoid bilinear downsampling blur
      // and allow the browser to use native crisp vector font antialiasing.
      setScale(computedScale >= 0.98 ? 1 : computedScale);
    };

    updateScale();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [contentWidth]);

  const isNativeScale = scale >= 0.99;

  return (
    <div className="flex flex-col items-center w-full">
      {showPrintButton && (
        <div className="w-full flex justify-end mb-3" style={{ maxWidth: `${contentWidth}px` }}>
          <button
            type="button"
            onClick={() => printDocumentHtml(html)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-print" aria-hidden="true"></i>
            <span>Imprimer</span>
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        data-testid="document-canvas-container"
        data-paper-size={paperSize}
        data-page-count={pageCount}
        data-landscape-count={landscapeCount}
        className={`relative mx-auto flex justify-center overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-2xl transition-all ${className}`}
        style={{
          width: "100%",
          maxWidth: `${contentWidth}px`,
          height: `${Math.round(contentHeight * scale)}px`,
        }}
      >
        <iframe
          title={title}
          srcDoc={resolvedHtml}
          loading="lazy"
          sandbox={sandbox}
          className="block border-0 bg-white shrink-0"
          style={{
            width: `${contentWidth}px`,
            height: `${contentHeight}px`,
            transform: isNativeScale ? "none" : `scale(${scale})`,
            transformOrigin: "top left",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            textRendering: "optimizeLegibility",
          }}
        />
      </div>
    </div>
  );
}

export default DocumentCanvasViewer;
