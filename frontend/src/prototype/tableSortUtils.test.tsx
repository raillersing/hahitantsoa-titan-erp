import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  sortData,
  getNextSortDirection,
  useTableSort,
  SortableHeader,
  SortConfig,
} from "./tableSortUtils";

describe("tableSortUtils", () => {
  interface TestItem {
    id: string;
    name: string;
    quantity: number;
    price: number | null;
    createdAt: Date;
  }

  const sampleData: TestItem[] = [
    { id: "3", name: "Écran LED 55", quantity: 5, price: 150000, createdAt: new Date("2026-06-03") },
    { id: "1", name: "Chaise Napoléon", quantity: 100, price: 5000, createdAt: new Date("2026-06-01") },
    { id: "2", name: "Chaise Banquet", quantity: 50, price: null, createdAt: new Date("2026-06-02") },
    { id: "4", name: "Article 10", quantity: 10, price: 20000, createdAt: new Date("2026-06-04") },
    { id: "5", name: "Article 2", quantity: 2, price: 30000, createdAt: new Date("2026-06-05") },
  ];

  describe("getNextSortDirection", () => {
    it("cycles through asc -> desc -> null for same key", () => {
      expect(getNextSortDirection("name", "name", null)).toBe("asc");
      expect(getNextSortDirection("name", "name", "asc")).toBe("desc");
      expect(getNextSortDirection("name", "name", "desc")).toBe(null);
    });

    it("resets to default asc when switching keys", () => {
      expect(getNextSortDirection("name", "price", "desc")).toBe("asc");
    });
  });

  describe("sortData", () => {
    it("returns original data if sort direction is null", () => {
      const result = sortData(sampleData, { key: null, direction: null });
      expect(result).toBe(sampleData);
    });

    it("sorts numbers ascending and descending", () => {
      const asc = sortData(sampleData, { key: "quantity", direction: "asc" });
      expect(asc.map((i) => i.quantity)).toEqual([2, 5, 10, 50, 100]);

      const desc = sortData(sampleData, { key: "quantity", direction: "desc" });
      expect(desc.map((i) => i.quantity)).toEqual([100, 50, 10, 5, 2]);
    });

    it("sorts strings with French natural collation (Article 2 before Article 10, accents handled)", () => {
      const asc = sortData(sampleData, { key: "name", direction: "asc" });
      expect(asc.map((i) => i.name)).toEqual([
        "Article 2",
        "Article 10",
        "Chaise Banquet",
        "Chaise Napoléon",
        "Écran LED 55",
      ]);
    });

    it("places null/undefined values at the bottom in both directions", () => {
      const asc = sortData(sampleData, { key: "price", direction: "asc" });
      expect(asc[asc.length - 1].price).toBeNull();
      expect(asc[0].price).toBe(5000);

      const desc = sortData(sampleData, { key: "price", direction: "desc" });
      expect(desc[desc.length - 1].price).toBeNull();
      expect(desc[0].price).toBe(150000);
    });

    it("supports custom extractors and date comparisons", () => {
      const asc = sortData(
        sampleData,
        { key: "created", direction: "asc" },
        { created: (item) => item.createdAt }
      );
      expect(asc.map((i) => i.id)).toEqual(["1", "2", "3", "4", "5"]);

      const desc = sortData(
        sampleData,
        { key: "created", direction: "desc" },
        { created: (item) => item.createdAt }
      );
      expect(desc.map((i) => i.id)).toEqual(["5", "4", "3", "2", "1"]);
    });
  });

  describe("SortableHeader component", () => {
    it("renders label and sort icon with accessibility attributes", () => {
      const onSort = vi.fn();
      render(
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Article"
                sortKey="name"
                currentSortKey="name"
                currentDirection="asc"
                onSort={onSort}
              />
            </tr>
          </thead>
        </table>
      );

      const header = screen.getByRole("columnheader", { name: /Article/i });
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("aria-sort", "ascending");

      fireEvent.click(header);
      expect(onSort).toHaveBeenCalledWith("name");
    });

    it("handles keyboard Enter and Space activation", () => {
      const onSort = vi.fn();
      render(
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Quantité"
                sortKey="quantity"
                currentSortKey={null}
                currentDirection={null}
                onSort={onSort}
              />
            </tr>
          </thead>
        </table>
      );

      const header = screen.getByRole("columnheader", { name: /Quantité/i });
      expect(header).toHaveAttribute("aria-sort", "none");

      fireEvent.keyDown(header, { key: "Enter" });
      expect(onSort).toHaveBeenCalledWith("quantity");

      fireEvent.keyDown(header, { key: " " });
      expect(onSort).toHaveBeenCalledTimes(2);
    });
  });
});
