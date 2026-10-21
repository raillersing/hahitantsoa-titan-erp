import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import OfficialPaymentReceipt from "./OfficialPaymentReceipt";
import { DocumentPreview } from "./DocumentPreview";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../api')>()).ApiError,
  getDocumentArtifactHtml: vi.fn(),
  getDocumentInstancePdfBlob: vi.fn(),
  generateReservationDraftDocumentInstancePdf: vi.fn(),
  generateHahitantsoaEventDraftDocumentInstancePdf: vi.fn(),
  recordConfirmedDeposit: vi.fn(),
  getDocumentTemplatePreview: vi.fn(),
  getHahitantsoaEventDraftDocumentPreview: vi.fn(),
  getReservationDraftDocumentPreview: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

describe("official payment receipts", () => {
  it("shows an explicit missing state without inventing a receipt or requesting a template", () => {
    render(<DocumentPreview type="recu_paiement" domain="titan" reservationDraftId="draft-1" />);
    expect(screen.getByRole("status")).toHaveTextContent("Aucun reçu officiel");
    expect(api.getDocumentTemplatePreview).not.toHaveBeenCalled();
    expect(api.getReservationDraftDocumentPreview).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Imprimer" })).not.toBeInTheDocument();
  });

  it("retries private artifact access and prints only server HTML", async () => {
    vi.mocked(api.getDocumentArtifactHtml).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce("<html><body>H-001/2026-REC-02</body></html>");
    render(<OfficialPaymentReceipt documentId="receipt-2" domain="hahitantsoa" draftId="draft-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("sans enregistrer de nouveau paiement");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer le chargement du reçu" }));
    expect(await screen.findByTitle("Reçu officiel de paiement")).toHaveAttribute("srcdoc", "<html><body>H-001/2026-REC-02</body></html>");
    expect(api.getDocumentArtifactHtml).toHaveBeenLastCalledWith("receipt-2", expect.any(AbortSignal));
    expect(api.recordConfirmedDeposit).not.toHaveBeenCalled();
  });

  it("retries PDF generation for the same official receipt without replaying payment", async () => {
    vi.mocked(api.getDocumentArtifactHtml).mockResolvedValue("<html>Receipt</html>");
    vi.mocked(api.getDocumentInstancePdfBlob).mockRejectedValue(new api.ApiError('Missing PDF', 404));
    vi.mocked(api.generateHahitantsoaEventDraftDocumentInstancePdf).mockRejectedValue(new Error("pdf down"));
    render(<OfficialPaymentReceipt documentId="receipt-2" domain="hahitantsoa" draftId="draft-1" />);
    const button = await screen.findByRole("button", { name: "Télécharger le reçu PDF" });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Le PDF du reçu");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(api.generateHahitantsoaEventDraftDocumentInstancePdf).toHaveBeenCalledTimes(2));
    expect(api.generateHahitantsoaEventDraftDocumentInstancePdf).toHaveBeenLastCalledWith("draft-1", "receipt-2");
    expect(api.recordConfirmedDeposit).not.toHaveBeenCalled();
  });

  it('downloads an already issued PDF repeatedly without generating another document', async () => {
    vi.mocked(api.getDocumentArtifactHtml).mockResolvedValue('<html>Receipt</html>');
    vi.mocked(api.getDocumentInstancePdfBlob).mockResolvedValue(new Blob(['%PDF-existing']));
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:existing-receipt') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<OfficialPaymentReceipt documentId="receipt-2" domain="hahitantsoa" draftId="draft-1" />);
      const button = await screen.findByRole('button', { name: 'Télécharger le reçu PDF' });
      vi.useFakeTimers();
      fireEvent.click(button);
      await act(async () => {});
      expect(click).toHaveBeenCalledTimes(1);
      expect(button).toBeEnabled();
      fireEvent.click(button);
      await act(async () => {});
      expect(click).toHaveBeenCalledTimes(2);
      expect(api.getDocumentInstancePdfBlob).toHaveBeenCalledTimes(2);
      expect(api.generateHahitantsoaEventDraftDocumentInstancePdf).not.toHaveBeenCalled();
      expect(api.generateReservationDraftDocumentInstancePdf).not.toHaveBeenCalled();
      expect(api.recordConfirmedDeposit).not.toHaveBeenCalled();
    } finally {
      await act(async () => { vi.runOnlyPendingTimers(); });
      vi.useRealTimers();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeUrl });
      click.mockRestore();
    }
  });

  it('does not attempt PDF generation when private access is denied', async () => {
    vi.mocked(api.getDocumentArtifactHtml).mockResolvedValue('<html>Receipt</html>');
    vi.mocked(api.getDocumentInstancePdfBlob).mockRejectedValue(new api.ApiError('Forbidden', 403));
    render(<OfficialPaymentReceipt documentId="receipt-2" domain="titan" draftId="draft-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le reçu PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le PDF du reçu');
    expect(api.generateReservationDraftDocumentInstancePdf).not.toHaveBeenCalled();
  });
});
