import { useEffect, useState } from "react";
import {
  generateHahitantsoaEventDraftDocumentInstancePdf,
  generateReservationDraftDocumentInstancePdf,
  getDocumentArtifactHtml,
  getDocumentInstancePdfBlob,
} from "../api";
import DocumentCanvasViewer from "./DocumentCanvasViewer";

export default function OfficialPaymentReceipt({ documentId, draftId, domain }: {
  documentId?: string | null;
  draftId?: string | null;
  domain?: string | null;
}) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setHtml(""); setError(null);
    if (!documentId) return;
    const controller = new AbortController();
    setLoading(true);
    void getDocumentArtifactHtml(documentId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setHtml(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Le reçu officiel ne peut pas être chargé. Vous pouvez réessayer sans enregistrer de nouveau paiement."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [documentId, attempt]);

  if (!documentId) return <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Aucun reçu officiel n’est associé à ce paiement. Actualisez le dossier pour vérifier son état.</p>;
  const download = async () => {
    if (!draftId || downloading) return;
    setDownloading(true); setError(null);
    try {
      if (domain === "hahitantsoa") await generateHahitantsoaEventDraftDocumentInstancePdf(draftId, documentId);
      else await generateReservationDraftDocumentInstancePdf(draftId, documentId);
      const blob = await getDocumentInstancePdfBlob(documentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `recu-${documentId}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Le PDF du reçu ne peut pas être téléchargé. Réessayez sans enregistrer de nouveau paiement."); }
    finally { setDownloading(false); }
  };
  return <section aria-label="Reçu officiel" className="space-y-3">
    {loading && <p role="status">Chargement du reçu officiel…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Réessayer le chargement du reçu</button></div>}
    {html && <>
      {draftId && <button type="button" disabled={downloading} onClick={() => void download()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{downloading ? "Préparation du PDF…" : "Télécharger le reçu PDF"}</button>}
      <DocumentCanvasViewer html={html} title="Reçu officiel de paiement" showPrintButton />
    </>}
  </section>;
}
