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

export interface DocumentCanvasViewerProps {
  html: string;
  title?: string;
  paperSize?: PaperSize;
  className?: string;
  sandbox?: string;
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
}: DocumentCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const paperSize = initialPaperSize || detectPaperSize(html);
  const pageCount = detectPageCount(html);
  const dimensions = PAPER_DIMENSIONS[paperSize];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const computedScale = Math.min(1, container.clientWidth / dimensions.width);
      // When scale is close to 1 (>= 0.98), snap to 1 to avoid bilinear downsampling blur
      // and allow the browser to use native crisp vector font antialiasing.
      setScale(computedScale >= 0.98 ? 1 : computedScale);
    };

    updateScale();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [html, dimensions.width]);

  const isNativeScale = scale >= 0.99;

  return (
    <div
      ref={containerRef}
      data-testid="document-canvas-container"
      data-paper-size={paperSize}
      data-page-count={pageCount}
      className={`relative mx-auto flex justify-center overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-2xl transition-all ${className}`}
      style={{
        width: "100%",
        maxWidth: `${dimensions.width}px`,
        height: `${Math.round(dimensions.height * pageCount * scale)}px`,
      }}
    >
      <iframe
        title={title}
        srcDoc={html}
        loading="lazy"
        sandbox={sandbox}
        className="block border-0 bg-white shrink-0"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height * pageCount}px`,
          transform: isNativeScale ? "none" : `scale(${scale})`,
          transformOrigin: "top left",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
        }}
      />
    </div>
  );
}

export default DocumentCanvasViewer;
