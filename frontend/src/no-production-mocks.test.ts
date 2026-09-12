/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";

const modules = import.meta.glob("./**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("Phase 10: No production mocks & placeholders guard", () => {
  const productionEntries = Object.entries(modules).filter(([filePath]) => {
    return (
      !filePath.includes(".test.") &&
      !filePath.includes(".spec.") &&
      !filePath.includes("/test/")
    );
  });

  it("trouve les fichiers de code source de production", () => {
    expect(productionEntries.length).toBeGreaterThan(10);
  });

  it("interdit les imports de fixtures de test ou de modules mock dans le code de production", () => {
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    const violations: string[] = [];

    for (const [filePath, content] of productionEntries) {
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1].toLowerCase();
        if (
          specifier.includes("mock") ||
          specifier.includes("fixture") ||
          specifier.includes(".test") ||
          specifier.includes(".spec") ||
          specifier.includes("/test/")
        ) {
          violations.push(`${filePath}: ${match[1]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("interdit les notices de développement résiduelles et fausses alertes", () => {
    const forbiddenPatterns: { pattern: RegExp; desc: string }[] = [
      { pattern: /en cours de d[eé]veloppement/i, desc: "en cours de développement" },
      { pattern: /fonctionnalit[eé]\s+en cours/i, desc: "fonctionnalité en cours" },
      { pattern: /alert\(["'][^"']*à venir/i, desc: "alert à venir" },
      { pattern: /\bmock(Data|Users|Items|Reservations)\b/i, desc: "mock business data identifier" },
    ];

    const violations: string[] = [];

    for (const [filePath, content] of productionEntries) {
      for (const { pattern, desc } of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${filePath} contains '${desc}'`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("limite strictement l'accès localStorage aux préférences d'interface et brouillons locaux", () => {
    const storageAccessRegex = /localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*([^,\)]+)/g;
    const allowedExpressions = new Set([
      '"theme"',
      '"theme-mode"',
      "STORAGE_KEY",
      '"prototypeReservationDraft"',
      "INVENTORY_COLUMNS_STORAGE_KEY",
      '"titan.inventory.visible-columns.v1"',
    ]);

    const violations: string[] = [];

    for (const [filePath, content] of productionEntries) {
      let match: RegExpExecArray | null;
      while ((match = storageAccessRegex.exec(content)) !== null) {
        const keyExpr = match[1].trim();
        if (!allowedExpressions.has(keyExpr)) {
          violations.push(`${filePath} accesses unauthorized key: ${keyExpr}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("confirme la suppression des pages prototypes obsolètes non montées", () => {
    const hasPlaceholderPage = Object.keys(modules).some((p) =>
      p.toLowerCase().includes("placeholderpage")
    );
    expect(hasPlaceholderPage).toBe(false);
  });
});
