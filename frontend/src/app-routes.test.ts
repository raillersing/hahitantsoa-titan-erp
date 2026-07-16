import { describe, expect, it } from "vitest";

import { formatHash, parseHash } from "./app-routes";

describe("hash routes", () => {
  it("canonicalizes a missing hash to the dashboard route", () => {
    expect(parseHash("")).toEqual({ kind: "known", scope: "dashboard" });
  });

  it("parses known routes and preserves a multi-segment parameter", () => {
    expect(parseHash("#reservation-new/titan/CUST-001")).toEqual({
      kind: "known",
      scope: "reservation-new",
      param: "titan/CUST-001",
    });
  });

  it("round-trips encoded route parameters", () => {
    const hash = formatHash("customer", "client été/001");
    expect(hash).toBe("#customer/client%20%C3%A9t%C3%A9%2F001");
    expect(parseHash(hash)).toEqual({ kind: "known", scope: "customer", param: "client été/001" });
  });

  it("does not crash on malformed parameter encoding", () => {
    expect(parseHash("#customer/%E0%A4%A")).toEqual({
      kind: "known",
      scope: "customer",
      param: "%E0%A4%A",
    });
  });

  it("keeps an unknown hash explicit", () => {
    expect(parseHash("#missing/route")).toEqual({ kind: "not-found", requestedHash: "#missing/route" });
  });
});
