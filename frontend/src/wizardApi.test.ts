import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWizardSession, getWizardSessions, getWizardSession, updateWizardSession, uploadWizardFile, downloadWizardFile, createWizardDraft, promoteWizardFile, createWizardDischarge, prepareWizardProforma } from "./api";
const session = { id: "session", client_key: "key", version: 1, files: [], state: {}, domain: null, step: 1, status: "active", updated_at: "2026-11-07T10:00:00Z" };
beforeEach(() => { document.cookie = "csrftoken=csrf-test; path=/"; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
const reply = (value: unknown) => vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }));
describe("wizard API live contract", () => {
  it("lists metadata and fetches detail through authenticated private reads", async () => {
    reply([session]); await getWizardSessions(); reply(session); await getWizardSession("session");
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/v1/reservations/wizard-sessions/", expect.objectContaining({ credentials: "include", cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/v1/reservations/wizard-sessions/session/", expect.objectContaining({ credentials: "include" }));
  });
  it("uses idempotent client_key and expected_version with CSRF", async () => {
    reply(session); await createWizardSession("key", { step: 2 });
    reply(session); await updateWizardSession("session", 7, { step: 3, state: { step: 3 } });
    const create = vi.mocked(fetch).mock.calls[0][1]!;
    const update = vi.mocked(fetch).mock.calls[1][1]!;
    expect(JSON.parse(String(create.body))).toEqual({ client_key: "key", step: 2 });
    expect(update.method).toBe("PUT");
    expect(new Headers(update.headers).get("X-CSRFToken")).toBe("csrf-test");
    expect(JSON.parse(String(update.body))).toEqual({ expected_version: 7, step: 3, state: { step: 3 } });
  });
  it("sends real multipart files with their stable identity and recreates a File after private download", async () => {
    const file = new File(["%PDF-1.4"], "cin.pdf", { type: "application/pdf" });
    const metadata = { id: "file", client_file_key: "page", category: "CIN", label: "CIN", original_name: "cin.pdf", content_type: file.type, size_bytes: file.size, download_url: "https://untrusted.invalid/never-use" };
    reply({ file: metadata, version: 8 }); await uploadWizardFile("session", 7, "page", file, "CIN", "CIN");
    const body = vi.mocked(fetch).mock.calls[0][1]!.body as FormData;
    expect(body.get("expected_version")).toBe("7"); expect(body.get("client_file_key")).toBe("page"); expect(body.get("file")).toBeInstanceOf(File);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("%PDF-1.4"));
    const restored = await downloadWizardFile("session", metadata);
    expect(restored).toBeInstanceOf(File); expect(restored.name).toBe("cin.pdf"); expect(restored.size).toBe(file.size);
    expect(fetch).toHaveBeenLastCalledWith("/api/v1/reservations/wizard-sessions/session/files/file/download/", expect.objectContaining({ credentials: "include" }));
  });
  it("calls the atomic dossier, file promotion, proforma and discharge contracts", async () => {
    const payload = { customer_id: "customer", start_at: "2027-08-25T08:00:00+03:00", end_at: "2027-08-26T08:00:00+03:00", lines: [] };
    reply({ draft: { id: "draft" }, version: 2, proforma_id: "proforma" }); await createWizardDraft("session", 1, "titan", payload, 30);
    reply({ attachment: { id: "official" }, version: 3 }); await promoteWizardFile("session", 2, "file", "draft");
    reply({ document: { id: "proforma" }, version: 4 }); await prepareWizardProforma("session", 3, 30);
    reply({ document: { id: "discharge" }, version: 5 }); await createWizardDischarge("session", 4, { template_key: "hahitantsoa.liability_release.v1" });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url]) => url)).toEqual(["/api/v1/reservations/wizard-sessions/session/draft/", "/api/v1/reservations/wizard-sessions/session/files/file/promote/", "/api/v1/reservations/wizard-sessions/session/proforma/", "/api/v1/reservations/wizard-sessions/session/discharge/"]);
    expect(calls.map(([, init]) => JSON.parse(String(init!.body)))).toEqual([
      { expected_version: 1, domain: "titan", payload, proforma_validity_days: 30 },
      { expected_version: 2, target: "draft" }, { expected_version: 3, proforma_validity_days: 30 },
      { expected_version: 4, payload: { template_key: "hahitantsoa.liability_release.v1" } },
    ]);
    expect(calls.every(([, init]) => init!.credentials === "include" && new Headers(init!.headers).get("X-CSRFToken") === "csrf-test")).toBe(true);
  });
  it("transmits the durable revision key and exact legacy source without replacing either", async () => {
    reply({ document: { id: "revision" }, version: 8 });
    await prepareWizardProforma("session", 7, 30, { proforma_id: "source-proforma", revision_key: "durable-revision-key" });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body))).toEqual({ expected_version: 7, proforma_validity_days: 30, proforma_id: "source-proforma", revision_key: "durable-revision-key" });
  });
  it("surfaces a protected file denial instead of returning an empty File", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Accès refusé" }), { status: 403 }));
    await expect(downloadWizardFile("session", { id: "file" } as never)).rejects.toMatchObject({ status: 403 });
  });
});
