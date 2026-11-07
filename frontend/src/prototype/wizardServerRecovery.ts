import { ApiError, createWizardSession, deleteWizardFile, updateWizardSession, uploadWizardFile, createWizardDraft, promoteWizardFile, createWizardDischarge, prepareWizardProforma } from "../api";
import type { WizardSession, WizardWrite, WizardDraftPayload, WizardDraftResult } from "../api";

export interface RecoveryAttachment { id: string; file?: File; category: string; label?: string }

// ponytail: one serialized writer for the existing assistant snapshot and its two atomic business actions.
export class WizardServerRecovery {
  session: WizardSession | null = null;
  proformaId: string | null = null;
  conflict = false;
  private disposed = false;
  private tail: Promise<unknown> = Promise.resolve();
  private pending: (() => Promise<void>) | null = null;
  constructor(public clientKey: string) {}
  dispose(): void { this.disposed = true; }

  private assertWritable(): void {
    if (this.disposed) throw new Error("Ce parcours appartient à une session utilisateur terminée.");
    if (this.conflict) throw new Error("Une autre version existe sur le serveur. Choisissez comment reprendre avant de continuer.");
  }
  private async checkpoint(operation: () => Promise<void>): Promise<void> {
    this.assertWritable();
    this.pending = operation;
    await operation();
    this.pending = null;
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.tail.catch(() => undefined).then(async () => {
      this.assertWritable();
      try {
        // Only an uncertain response is replayed verbatim, before newer edits.
        if (this.pending) await this.checkpoint(this.pending);
        return await operation();
      } catch (error) {
        if (error instanceof ApiError && error.status < 500) this.pending = null;
        if (error instanceof ApiError && error.status === 409) { this.conflict = true; this.pending = null; }
        throw error;
      }
    });
    this.tail = run;
    return run;
  }

  save(value: WizardWrite, attachments: RecoveryAttachment[] = []): Promise<void> {
    return this.enqueue(async () => {
      if (!this.session) await this.checkpoint(async () => {
        const created = await createWizardSession(this.clientKey, {});
        if (created.version !== 1) throw new ApiError("Ce parcours a été modifié depuis un autre appareil. Choisissez sa version serveur avant de continuer.", 409);
        this.session = created;
      });
      for (const page of attachments) {
        if (!page.file || this.session!.files.some(file => file.client_file_key === page.id)) continue;
        const session = this.session!;
        await this.checkpoint(async () => {
          const result = await uploadWizardFile(session.id, session.version, page.id, page.file!, page.category, page.label || page.category);
          this.session = { ...this.session!, version: result.version, files: [...this.session!.files.filter(file => file.client_file_key !== page.id), result.file] };
        });
      }
      const session = this.session!;
      await this.checkpoint(async () => { this.session = await updateWizardSession(session.id, session.version, value); });
      for (const file of this.session!.files.filter(file => value.status !== "completed" && !attachments.some(page => page.id === file.client_file_key))) {
        const current = this.session!;
        await this.checkpoint(async () => {
          const result = await deleteWizardFile(current.id, current.version, file.id);
          this.session = { ...this.session!, version: result.version, files: this.session!.files.filter(row => row.id !== file.id) };
        });
      }
    });
  }

  createDraft(domain: "titan" | "hahitantsoa", payload: WizardDraftPayload, validity: number): Promise<WizardDraftResult> {
    return this.enqueue(async () => {
      if (!this.session) throw new Error("Sauvegardez le parcours avant de créer son dossier.");
      const session = this.session;
      let result!: WizardDraftResult;
      await this.checkpoint(async () => {
        result = await createWizardDraft(session.id, session.version, domain, payload, validity);
        this.proformaId = result.proforma_id;
        this.session = { ...this.session!, version: result.version };
      });
      return result;
    });
  }

  prepareProforma(validity: number, options?: Parameters<typeof prepareWizardProforma>[3]): ReturnType<typeof prepareWizardProforma> {
    return this.enqueue(async () => {
      const session = this.session;
      if (!session) throw new Error("Sauvegardez le parcours avant de préparer son proforma.");
      let result!: Awaited<ReturnType<typeof prepareWizardProforma>>;
      await this.checkpoint(async () => {
        result = await prepareWizardProforma(session.id, session.version, validity, options);
        this.proformaId = result.document.id;
        this.session = { ...this.session!, version: result.version };
      });
      return result;
    });
  }

  createDischarge(payload: Parameters<typeof createWizardDischarge>[2]): ReturnType<typeof createWizardDischarge> {
    return this.enqueue(async () => {
      const session = this.session;
      if (!session) throw new Error("Sauvegardez le parcours avant de préparer sa décharge.");
      let result!: Awaited<ReturnType<typeof createWizardDischarge>>;
      await this.checkpoint(async () => {
        result = await createWizardDischarge(session.id, session.version, payload);
        this.session = { ...this.session!, version: result.version };
      });
      return result;
    });
  }

  promoteFile(clientFileKey: string, target: "customer" | "draft"): ReturnType<typeof promoteWizardFile> {
    return this.enqueue(async () => {
      const session = this.session;
      const file = session?.files.find(row => row.client_file_key === clientFileKey);
      if (!session || !file) throw new Error("Sauvegardez ce fichier sur le serveur avant de le joindre au dossier.");
      let result!: Awaited<ReturnType<typeof promoteWizardFile>>;
      await this.checkpoint(async () => {
        result = await promoteWizardFile(session.id, session.version, file.id, target);
        this.session = { ...this.session!, version: result.version };
      });
      return result;
    });
  }
}
