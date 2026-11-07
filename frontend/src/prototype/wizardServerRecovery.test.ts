import { beforeEach, describe, expect, it, vi } from "vitest";
import { WizardServerRecovery } from "./wizardServerRecovery";
import { ApiError, createWizardSession, deleteWizardFile, updateWizardSession, uploadWizardFile, createWizardDraft, promoteWizardFile, createWizardDischarge, prepareWizardProforma } from "../api";
vi.mock("../api", async importOriginal => ({ ...(await importOriginal<typeof import("../api")>()), createWizardSession: vi.fn(), updateWizardSession: vi.fn(), uploadWizardFile: vi.fn(), deleteWizardFile: vi.fn(), createWizardDraft: vi.fn(), promoteWizardFile: vi.fn(), createWizardDischarge: vi.fn(), prepareWizardProforma: vi.fn() }));
const session = { id: "session", client_key: "key", version: 1, files: [], state: {}, domain: null, status: "active", step: 0, updated_at: "2026-11-07T10:00:00Z" } as const;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createWizardSession).mockResolvedValue({ ...session, files: [] });
  vi.mocked(updateWizardSession).mockImplementation(async (_id, version, value) => ({ ...session, ...value, version: version + 1, files: [] }));
});
describe("private wizard recovery", () => {
  it("serializes validated snapshots using the returned version", async () => {
    const writer = new WizardServerRecovery("key");
    await Promise.all([writer.save({ step: 2, state: { newClient: { name: "Ando" } } }), writer.save({ step: 3 })]);
    expect(createWizardSession).toHaveBeenCalledExactlyOnceWith("key", {});
    expect(vi.mocked(updateWizardSession).mock.calls.map(call => call[1])).toEqual([1, 2]);
  });
  it("replays a lost response verbatim before newer edits", async () => {
    vi.mocked(updateWizardSession).mockRejectedValueOnce(new Error("network"));
    const writer = new WizardServerRecovery("key");
    const first = { step: 2, state: { newClient: { name: "Ando" } } };
    await expect(writer.save(first)).rejects.toThrow("network");
    await writer.save({ step: 3 });
    expect(vi.mocked(updateWizardSession).mock.calls.map(call => [call[1], call[2]])).toEqual([[1, first], [1, first], [2, { step: 3 }]]);
  });
  it("blocks stale writes after a conflict without adopting the server version", async () => {
    vi.mocked(updateWizardSession).mockRejectedValueOnce(new ApiError("version", 409));
    const writer = new WizardServerRecovery("key");
    await expect(writer.save({ step: 2 })).rejects.toThrow("version");
    await expect(writer.save({ step: 3 })).rejects.toThrow("autre version");
    expect(updateWizardSession).toHaveBeenCalledTimes(1);
    expect(writer.session?.version).toBe(1);
  });
  it("uploads actual files once, replays their lost response and saves metadata after uploads", async () => {
    const file = new File(["%PDF-1.4"], "identity.pdf", { type: "application/pdf" });
    const metadata = { id: "f", client_file_key: "page", category: "identity", label: "CIN", original_name: file.name, content_type: file.type, size_bytes: file.size, download_url: "/private" };
    vi.mocked(uploadWizardFile).mockRejectedValueOnce(new Error("lost")).mockResolvedValue({ file: metadata, version: 2 });
    const writer = new WizardServerRecovery("key");
    const pages = [{ id: "page", file, category: "identity", label: "CIN" }];
    await expect(writer.save({ step: 2 }, pages)).rejects.toThrow("lost");
    await writer.save({ step: 2 }, pages);
    expect(uploadWizardFile).toHaveBeenCalledTimes(2);
    expect(uploadWizardFile).toHaveBeenLastCalledWith("session", 1, "page", file, "identity", "CIN");
    expect(updateWizardSession).toHaveBeenLastCalledWith("session", 2, { step: 2 });
  });
  it("removes discarded private files with optimistic concurrency after saving the new snapshot", async () => {
    const writer = new WizardServerRecovery("key");
    writer.session = { ...session, version: 4, files: [{ id: "removed", client_file_key: "page" }] as never };
    vi.mocked(updateWizardSession).mockResolvedValueOnce({ ...writer.session!, version: 5 });
    vi.mocked(deleteWizardFile).mockResolvedValue({ version: 6 });
    await writer.save({ state: { clientAttachments: [] } });
    expect(deleteWizardFile).toHaveBeenCalledWith("session", 5, "removed");
    expect(updateWizardSession).toHaveBeenCalledWith("session", 4, { state: { clientAttachments: [] } });
  });
  it("allows correction after a definitive upload rejection instead of replaying the invalid file", async () => {
    const writer = new WizardServerRecovery("key");
    vi.mocked(uploadWizardFile).mockRejectedValueOnce(new ApiError("format", 400));
    await expect(writer.save({ step: 2 }, [{ id: "bad", category: "CIN", file: new File(["bad"], "bad.pdf") }])).rejects.toThrow("format");
    await writer.save({ step: 2, state: { clientAttachments: [] } });
    expect(uploadWizardFile).toHaveBeenCalledTimes(1);
    expect(updateWizardSession).toHaveBeenCalledWith("session", 1, { step: 2, state: { clientAttachments: [] } });
  });
  it("does not send personal state from a disposed user session after a pending creation returns", async () => {
    let resolve!: (value: typeof session & { files: never[] }) => void;
    vi.mocked(createWizardSession).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const writer = new WizardServerRecovery("key");
    const saving = writer.save({ state: { newClient: { name: "Account A" } } });
    await Promise.resolve(); await Promise.resolve();
    writer.dispose(); resolve({ ...session, files: [] });
    await expect(saving).rejects.toThrow("session utilisateur terminée");
    expect(createWizardSession).toHaveBeenCalledWith("key", {});
    expect(updateWizardSession).not.toHaveBeenCalled();
  });
  it("does not adopt a newer version returned by a replayed creation", async () => {
    vi.mocked(createWizardSession).mockRejectedValueOnce(new Error("lost creation")).mockResolvedValueOnce({ ...session, version: 3, files: [], state: { newClient: { name: "Remote edit" } } });
    const writer = new WizardServerRecovery("key");
    await expect(writer.save({ step: 1 })).rejects.toThrow("lost creation");
    await expect(writer.save({ step: 2 })).rejects.toThrow("autre appareil");
    expect(writer.conflict).toBe(true);
    expect(updateWizardSession).not.toHaveBeenCalled();
  });
  it("replays atomic dossier creation with the exact payload before newer private state", async () => {
    const writer = new WizardServerRecovery("key"); writer.session = { ...session, files: [] };
    const payload = { customer_id: "customer", start_at: "2027-08-25T08:00:00+03:00", end_at: "2027-08-26T08:00:00+03:00", lines: [] };
    vi.mocked(createWizardDraft).mockRejectedValueOnce(new Error("lost draft")).mockResolvedValue({ draft: { id: "draft" }, version: 2, proforma_id: "proforma" } as never);
    await expect(writer.createDraft("titan", payload, 30)).rejects.toThrow("lost draft");
    await writer.save({ step: 6 });
    expect(vi.mocked(createWizardDraft).mock.calls).toEqual([["session", 1, "titan", payload, 30], ["session", 1, "titan", payload, 30]]);
    expect(updateWizardSession).toHaveBeenCalledWith("session", 2, { step: 6 });
    expect(writer.proformaId).toBe("proforma");
  });
  it("replays a lost file promotion before subsequent snapshots without a second official upload", async () => {
    const writer = new WizardServerRecovery("key"); writer.session = { ...session, files: [{ id: "private", client_file_key: "page" }] as never };
    vi.mocked(promoteWizardFile).mockRejectedValueOnce(new Error("lost promotion")).mockResolvedValue({ attachment: { id: "official" }, version: 2 } as never);
    await expect(writer.promoteFile("page", "draft")).rejects.toThrow("lost promotion");
    await writer.save({ state: { clientAttachments: [{ id: "page", uploadedId: "official" }] } }, [{ id: "page", category: "CIN" }]);
    expect(vi.mocked(promoteWizardFile).mock.calls).toEqual([["session", 1, "private", "draft"], ["session", 1, "private", "draft"]]);
    expect(updateWizardSession).toHaveBeenCalledWith("session", 2, expect.any(Object));
  });
  it("serializes custom proforma validity and the fixed discharge using the current server version", async () => {
    const writer = new WizardServerRecovery("key"); writer.session = { ...session, files: [] };
    vi.mocked(prepareWizardProforma).mockResolvedValue({ document: { id: "proforma" }, version: 2 } as never);
    vi.mocked(createWizardDischarge).mockResolvedValue({ document: { id: "discharge" }, version: 3 } as never);
    await writer.prepareProforma(30);
    await writer.createDischarge({ template_key: "hahitantsoa.liability_release.v1", notes: "Décharge générée avec le contrat." });
    expect(prepareWizardProforma).toHaveBeenCalledWith("session", 1, 30, undefined);
    expect(createWizardDischarge).toHaveBeenCalledWith("session", 2, expect.objectContaining({ template_key: "hahitantsoa.liability_release.v1" }));
    expect(writer.session?.version).toBe(3);
  });
  it("resumes the confirmed version on another terminal and completes only on explicit success", async () => {
    const writer = new WizardServerRecovery("key"); writer.session = { ...session, version: 7, files: [] };
    await writer.save({ status: "completed" });
    expect(createWizardSession).not.toHaveBeenCalled();
    expect(updateWizardSession).toHaveBeenCalledWith("session", 7, { status: "completed" });
  });
});
