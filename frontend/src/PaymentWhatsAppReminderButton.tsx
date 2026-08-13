import { useState } from "react";
import { preparePaymentReminderDispatch } from "./api";
import type { PaymentReminderDispatch, PaymentWhatsAppReminder } from "./types";

type Props = {
  draftId: string;
  businessScope: "titan" | "hahitantsoa";
};

export default function PaymentWhatsAppReminderButton({ draftId, businessScope }: Props) {
  const [reminder, setReminder] = useState<PaymentWhatsAppReminder | null>(null);
  const [dispatch, setDispatch] = useState<PaymentReminderDispatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareReminder = async () => {
    setLoading(true);
    setError(null);
    try {
      const prepared = await preparePaymentReminderDispatch(draftId, businessScope);
      setReminder(prepared.reminder);
      setDispatch(prepared);
      if (prepared.whatsapp_url) window.open(prepared.whatsapp_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer le rappel WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
      <button
        type="button"
        onClick={() => void prepareReminder()}
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        <i className="fa-brands fa-whatsapp mr-2" aria-hidden="true" />
        {loading ? "Préparation…" : "Préparer le rappel WhatsApp"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
      {reminder && (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p role="status">
            Récapitulatif prêt : <strong>{reminder.confirmed_amount} MGA</strong> confirmé(s).
          </p>
          {dispatch && <p className="text-xs text-emerald-700">Brouillon enregistré dans les notifications ({dispatch.reminder_key}).</p>}
          {!reminder.whatsapp_available && (
            <p className="text-amber-700">Aucun numéro international exploitable; copiez le message ci-dessous.</p>
          )}
          <textarea
            aria-label="Message de rappel WhatsApp"
            readOnly
            value={reminder.message}
            className="min-h-32 w-full rounded-lg border border-emerald-200 bg-white p-3 text-xs"
          />
        </div>
      )}
    </div>
  );
}
