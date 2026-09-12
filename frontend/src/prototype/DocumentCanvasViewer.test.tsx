import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DocumentCanvasViewer,
  detectLandscapeCount,
  detectPageCount,
  detectPaperSize,
} from "./DocumentCanvasViewer";

afterEach(() => {
  cleanup();
});

describe("DocumentCanvasViewer", () => {
  it("detects A4 paper size by default and renders an A4 canvas container", () => {
    const html = "<!doctype html><html><body><h1>Devis</h1></body></html>";
    expect(detectPaperSize(html)).toBe("A4");
    expect(detectPageCount(html)).toBe(1);
    expect(detectLandscapeCount(html)).toBe(0);

    render(<DocumentCanvasViewer html={html} title="Test Document" />);

    const container = screen.getByTestId("document-canvas-container");
    expect(container).toHaveAttribute("data-paper-size", "A4");
    expect(container).toHaveAttribute("data-page-count", "1");
    expect(container).toHaveAttribute("data-landscape-count", "0");

    const iframe = screen.getByTitle("Test Document");
    expect(iframe).toHaveAttribute("srcdoc", html);
    expect(iframe).toHaveStyle({ width: "794px" });
  });

  it("detects thermal 80mm paper size when @page includes 80mm", () => {
    const html = "<style>@page { size: 80mm 120mm; }</style><div>Ticket</div>";
    expect(detectPaperSize(html)).toBe("THERMAL_80MM");

    render(<DocumentCanvasViewer html={html} title="Ticket Thermique" />);

    const container = screen.getByTestId("document-canvas-container");
    expect(container).toHaveAttribute("data-paper-size", "THERMAL_80MM");

    const iframe = screen.getByTitle("Ticket Thermique");
    expect(iframe).toHaveStyle({ width: "302px" });
  });

  it("detects multi-page contracts and scales the canvas container height accordingly", () => {
    const html = `
      <section class="contract-page">Page 1</section>
      <section class="contract-page">Page 2</section>
      <section class="contract-page">Page 3</section>
    `;
    expect(detectPageCount(html)).toBe(3);
    expect(detectLandscapeCount(html)).toBe(0);

    render(<DocumentCanvasViewer html={html} title="Contrat 3 Pages" />);

    const container = screen.getByTestId("document-canvas-container");
    expect(container).toHaveAttribute("data-page-count", "3");

    const iframe = screen.getByTitle("Contrat 3 Pages");
    // 3 pages * 1123px = 3369px
    expect(iframe).toHaveStyle({ height: "3369px" });
  });

  it("detects landscape pages (e.g. Annexe 2 plan de masse) and adjusts width to horizontal 1123px", () => {
    const html = `<!doctype html><html><head><title>Contrat</title></head><body>
      <section class="contract-page">Page 1</section>
      <section class="contract-page">Page 2</section>
      <section class="contract-page">Page 3</section>
      <section class="contract-page landscape annex"><h2>Annexe 2 : Plan de masse</h2></section>
      <section class="contract-page annex">Annexe 3</section>
    </body></html>`;

    expect(detectPageCount(html)).toBe(5);
    expect(detectLandscapeCount(html)).toBe(1);

    render(<DocumentCanvasViewer html={html} title="Contrat avec Annexe 2 Horizontale" />);

    const container = screen.getByTestId("document-canvas-container");
    expect(container).toHaveAttribute("data-paper-size", "A4");
    expect(container).toHaveAttribute("data-page-count", "5");
    expect(container).toHaveAttribute("data-landscape-count", "1");
    expect(container).toHaveStyle({ maxWidth: "1123px" });

    const iframe = screen.getByTitle("Contrat avec Annexe 2 Horizontale");
    // 4 portrait pages * 1123px + 1 landscape page * 794px = 4492px + 794px = 5286px
    expect(iframe).toHaveStyle({ width: "1123px", height: "5286px" });
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("canvas-landscape-preview-override");
    expect(srcDoc).toContain("width: 297mm !important;");
  });
});
