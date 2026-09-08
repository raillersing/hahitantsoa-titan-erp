import React, { useId, useMemo, useRef, useState } from "react";
import { recordConfirmedDeposit, getCashboxSessions, createCashboxMovement } from "../api";
import { DepositRecordingResult, DocumentInstance, PaymentMethod, CashboxSession } from "../types";
import { printDocumentHtml } from "./DocumentCanvasViewer";

export interface ExistingPaymentItem {
  id?: string;
  date: string;
  method: string;
  amount: number;
  note?: string;
  reference?: string;
  receipt_document?: DocumentInstance | null;
  payment_status?: string;
  payment_kind?: string;
  is_current?: boolean;
}

export interface PaymentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: "titan" | "hahitantsoa";
  draftId: string;
  draftReference: string;
  proformaReference?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  eventDateLabel?: string;
  totalAmount: number;
  paidAmount: number;
  requiredDepositAmount: number;
  cautionAmount?: number;
  existingPayments: ExistingPaymentItem[];
  onPaymentRecorded: (result: DepositRecordingResult) => Promise<void> | void;
  initialAmount?: string;
  initialPaymentKind?: string;
}

// ─── Currency & Words Helpers ──────────────────────────────────────────────────

export function formatMoney(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? Number(amount) : Number(amount || 0);
  if (!Number.isFinite(num)) return "0 Ar";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(Math.round(num)) + " Ar"
  );
}

export function numberToFrenchWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) return "";
  const integerPart = Math.floor(num);
  if (integerPart === 0) return "Zéro Ariary";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = [
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  const tens = [
    "",
    "dix",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante-dix",
    "quatre-vingts",
    "quatre-vingt-dix",
  ];

  function convertUnder100(n: number): string {
    if (n < 10) return units[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const t = Math.floor(n / 10);
    const u = n % 10;

    if (t === 7) {
      if (u === 1) return "soixante et onze";
      return "soixante-" + teens[u];
    }
    if (t === 8) {
      if (u === 0) return "quatre-vingts";
      return "quatre-vingt-" + units[u];
    }
    if (t === 9) {
      if (u === 0) return "quatre-vingt-dix";
      return "quatre-vingt-" + teens[u];
    }
    if (u === 1 && t < 7) return tens[t] + " et un";
    if (u === 0) return tens[t];
    return tens[t] + "-" + units[u];
  }

  function convertUnder1000(n: number, isTerminal = true): string {
    if (n === 0) return "";
    const c = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (c === 1) res = "cent";
    else if (c > 1) res = units[c] + (rest === 0 && isTerminal ? " cents" : " cent");

    const restStr = convertUnder100(rest);
    if (res && restStr) return res + " " + restStr;
    if (res) return res;
    return restStr;
  }

  function convertChunks(n: number): string {
    if (n === 0) return "";
    const billions = Math.floor(n / 1000000000);
    const millions = Math.floor((n % 1000000000) / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    const parts: string[] = [];
    if (billions > 0) {
      parts.push(
        convertUnder1000(billions, remainder === 0 && thousands === 0 && millions === 0) +
          (billions > 1 ? " milliards" : " milliard"),
      );
    }
    if (millions > 0) {
      parts.push(
        convertUnder1000(millions, remainder === 0 && thousands === 0) +
          (millions > 1 ? " millions" : " million"),
      );
    }
    if (thousands > 0) {
      if (thousands === 1) parts.push("mille");
      else parts.push(convertUnder1000(thousands, false) + " mille");
    }
    if (remainder > 0) {
      parts.push(convertUnder1000(remainder, true));
    }
    return parts.join(" ");
  }

  const words = convertChunks(integerPart);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} Ariary`;
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case "cash":
      return "Espèces (Caisse)";
    case "mobile_money":
      return "Mobile Money (MVola / Orange / Airtel)";
    case "bank_transfer":
      return "Virement Bancaire (BMOI / BNI / BOA)";
    case "cheque":
      return "Chèque";
    default:
      return "Autre mode";
  }
}

export function getPaymentKindLabel(kind: string): string {
  switch (kind) {
    case "deposit":
      return "Acompte Réservation (50%)";
    case "installment_1":
      return "1ère Tranche (M-1)";
    case "installment_2":
      return "2ème Tranche / Solde (J-10)";
    case "balance":
      return "Règlement du Solde";
    case "caution":
      return "Caution / Dépôt de garantie";
    default:
      return "Autre versement";
  }
}

// ─── Thermal Receipt HTML Generator ──────────────────────────────────────────

export function generateThermalReceiptHtml(params: {
  domain: "titan" | "hahitantsoa";
  receiptTitle: string;
  receiptNumber: string;
  paymentDate: string;
  customerName: string;
  customerPhone?: string;
  eventDateLabel?: string;
  amount: number;
  amountInWords: string;
  paymentMethodLabel: string;
  transactionReference?: string;
  paymentKindLabel: string;
  historyPayments: ExistingPaymentItem[];
  currentPaymentItem?: {
    date: string;
    amount: number;
    methodLabel: string;
    isDraft?: boolean;
  };
  totalDepositAmount: number;
  draftReference?: string;
  proformaReference?: string;
  proformaAmount: number;
  remainingBalance: number;
}): string {
  const isTitan = params.domain === "titan";
  const logoSrc = isTitan ? "/brand/titan-rental-logo.png" : "/brand/hahitantsoa-logo.png";
  const brandName = isTitan ? "Titan Rental" : "Domaine Hahitantsoa";
  const brandSubtitle = isTitan
    ? "Location Matériels Événementiels · Titan ERP"
    : "Espace Événementiel & Réception · Hahitantsoa ERP";

  const allHistory = [...params.historyPayments];

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${params.receiptTitle} - ${params.receiptNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    body {
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: 80mm;
      padding: 5mm 4mm 6mm;
      overflow-wrap: anywhere;
    }
    .header {
      text-align: center;
      margin-bottom: 3.5mm;
      border-bottom: 1.5px dashed #374151;
      padding-bottom: 3mm;
    }
    .brand-logo {
      display: block;
      width: 28mm;
      max-height: 18mm;
      object-fit: contain;
      margin: 0 auto 2mm;
    }
    .brand-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
      margin: 0;
    }
    .brand-sub {
      font-size: 7.5px;
      color: #6b7280;
      margin-top: 1px;
    }
    .doc-title {
      margin: 2.5mm 0 1.5mm;
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #1e1b4b;
      background: #f1f5f9;
      padding: 1.5mm 1mm;
      border-radius: 3px;
    }
    .field {
      display: grid;
      grid-template-columns: 28mm minmax(0, 1fr);
      gap: 1.5mm;
      margin: 1.2mm 0;
      font-size: 9.5px;
    }
    .label {
      font-weight: 700;
      color: #4b5563;
    }
    .value {
      color: #111827;
      font-weight: 500;
    }
    .value-bold {
      font-weight: 700;
    }
    .amount-highlight-box {
      margin: 2.5mm 0;
      padding: 2.5mm 2mm;
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      text-align: center;
    }
    .amount-highlight-label {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .amount-highlight-value {
      font-size: 14px;
      font-weight: 900;
      color: #047857;
      margin: 1mm 0 0.5mm;
    }
    .amount-in-words {
      font-size: 8px;
      font-style: italic;
      color: #334155;
      line-height: 1.2;
    }
    .section-title {
      margin: 3mm 0 1.5mm;
      font-weight: 800;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #1f2937;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.8mm;
    }
    .history-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.5px;
      margin-bottom: 2mm;
    }
    .history-table th,
    .history-table td {
      padding: 1mm 0.5mm;
      vertical-align: top;
      text-align: left;
    }
    .history-table th {
      font-weight: 700;
      border-bottom: 1px solid #cbd5e1;
      color: #475569;
    }
    .history-table th:nth-child(1), .history-table td:nth-child(1) { width: 22mm; }
    .history-table th:nth-child(2), .history-table td:nth-child(2) { width: 22mm; text-align: right; }
    .history-table th:nth-child(3), .history-table td:nth-child(3) { padding-left: 2mm; font-size: 8px; }
    .row-current {
      background-color: #ecfdf5;
      font-weight: 700;
    }
    .summary-box {
      margin-top: 2.5mm;
      padding-top: 1.5mm;
      border-top: 1.5px solid #111827;
      font-size: 9px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin: 1mm 0;
    }
    .summary-row.total-paid {
      font-weight: 800;
      font-size: 9.5px;
      color: #065f46;
    }
    .summary-row.remaining {
      font-weight: 800;
      font-size: 10px;
      color: #b91c1c;
      padding-top: 1mm;
      border-top: 1px dashed #cbd5e1;
    }
    .signature-area {
      margin-top: 4mm;
      padding-top: 2mm;
      border-top: 1px dotted #94a3b8;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      font-size: 7.5px;
      text-align: center;
    }
    .signature-title {
      font-weight: 700;
      color: #475569;
      margin-bottom: 6mm;
    }
    .footer {
      margin-top: 3.5mm;
      text-align: center;
      font-size: 7px;
      color: #94a3b8;
      line-height: 1.3;
      border-top: 1px dashed #e2e8f0;
      padding-top: 2mm;
    }
    .live-badge {
      display: inline-block;
      font-size: 7.5px;
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.5mm 1.5mm;
      border-radius: 2px;
      font-weight: 800;
      margin-left: 1mm;
    }
  </style>
</head>
<body>
  <main class="receipt">
    <div class="header">
      <img class="brand-logo" src="${logoSrc}" alt="${brandName}" onerror="this.style.display='none'">
      <div class="brand-title">${brandName}</div>
      <div class="brand-sub">${brandSubtitle}</div>
    </div>

    <div class="doc-title">
      ${params.receiptTitle}
      <span class="live-badge">OFFICIEL</span>
    </div>

    <div class="field"><span class="label">N° Reçu</span><span class="value value-bold font-mono">${params.receiptNumber}</span></div>
    <div class="field"><span class="label">Réf. Dossier</span><span class="value value-bold font-mono">${params.draftReference || params.proformaReference || "—"}</span></div>
    <div class="field"><span class="label">Date & Heure</span><span class="value">${params.paymentDate}</span></div>
    <div class="field"><span class="label">Nom Client</span><span class="value value-bold">${params.customerName || "—"}</span></div>
    ${params.customerPhone ? `<div class="field"><span class="label">Téléphone</span><span class="value">${params.customerPhone}</span></div>` : ""}
    ${params.eventDateLabel ? `<div class="field"><span class="label">Date Prestation</span><span class="value">${params.eventDateLabel}</span></div>` : ""}
    <div class="field"><span class="label">Objet / Tranche</span><span class="value">${params.paymentKindLabel}</span></div>
    <div class="field"><span class="label">Mode de règlement</span><span class="value value-bold">${params.paymentMethodLabel}</span></div>
    <div class="field"><span class="label">Réf. Transaction</span><span class="value font-mono">${params.transactionReference || "—"}</span></div>

    <div class="amount-highlight-box">
      <div class="amount-highlight-label">Montant Réglé Ce Jour</div>
      <div class="amount-highlight-value">${formatMoney(params.amount)}</div>
      <div class="amount-in-words">${params.amountInWords ? params.amountInWords : "—"}</div>
    </div>

    <div class="section-title">Historique des règlements</div>
    <table class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th style="text-align: right;">Montant</th>
          <th>Mode / Réf</th>
        </tr>
      </thead>
      <tbody>
        ${
          allHistory.length === 0 && !params.currentPaymentItem
            ? `<tr><td colspan="3" style="text-align:center; color:#9ca3af; padding: 2mm 0;">Premier versement sur ce dossier.</td></tr>`
            : allHistory
                .map(
                  (item) => `
          <tr class="${item.is_current ? "row-current" : ""}">
            <td>${item.is_current ? "★ " : ""}${item.date.slice(0, 10)}${item.is_current ? " <strong>(Ce reçu)</strong>" : ""}</td>
            <td style="text-align: right;">${item.is_current ? "+ " : ""}${formatMoney(item.amount)}</td>
            <td>${item.method || "—"}</td>
          </tr>`,
                )
                .join("")
        }
        ${
          params.currentPaymentItem && params.currentPaymentItem.amount > 0
            ? `
          <tr class="row-current">
            <td>★ ${params.currentPaymentItem.date.slice(0, 10)} <strong>(Ce reçu)</strong></td>
            <td style="text-align: right;">+ ${formatMoney(params.currentPaymentItem.amount)}</td>
            <td>${params.currentPaymentItem.methodLabel}</td>
          </tr>`
            : ""
        }
      </tbody>
    </table>

    ${
      params.receiptTitle.toLowerCase().includes("caution")
        ? `
    <div class="summary-box">
      <div class="summary-row">
        <span>N° Dossier</span>
        <span class="value-bold font-mono">${params.proformaReference || params.draftReference || "—"}</span>
      </div>
      <div class="summary-row">
        <span>Type d'encaissement</span>
        <span class="value-bold" style="color: #b45309;">DÉPÔT DE GARANTIE / CAUTION</span>
      </div>
      <div class="summary-row total-paid">
        <span>MONTANT CAUTION VERSÉ</span>
        <span>${formatMoney(params.amount)}</span>
      </div>
      <div class="summary-row" style="margin-top: 1.5mm; font-size: 7.5px; color: #4b5563; font-style: italic; line-height: 1.2;">
        <span>Nature : Somme séquestrée (hors devis prestation), restituable en fin de contrat conformément à l'article 7 après contrôle de retour sans dommage.</span>
      </div>
    </div>`
        : `
    <div class="summary-box">
      <div class="summary-row">
        <span>N° Dossier Proforma</span>
        <span class="value-bold font-mono">${params.proformaReference || params.draftReference || "—"}</span>
      </div>
      <div class="summary-row">
        <span>Montant Total Devis TTC</span>
        <span class="value-bold">${formatMoney(params.proformaAmount)}</span>
      </div>
      <div class="summary-row total-paid">
        <span>TOTAL CUMULÉ RÉGLÉ</span>
        <span>${formatMoney(params.totalDepositAmount)}</span>
      </div>
      <div class="summary-row remaining">
        <span>SOLDE RESTANT À PAYER</span>
        <span>${formatMoney(params.remainingBalance)}</span>
      </div>
    </div>`
    }

    <div class="signature-area">
      <div>
        <div class="signature-title">Signature / Visa Caisse</div>
        <div style="height: 5mm;"></div>
        <div style="font-size: 7px; color:#94a3b8;">Pour l'Établissement</div>
      </div>
      <div>
        <div class="signature-title">Signature Client</div>
        <div style="height: 5mm;"></div>
        <div style="font-size: 7px; color:#94a3b8;">Pour acquit</div>
      </div>
    </div>

    <div class="footer">
      Document officiel généré par ${brandName} · Reçu libératoire sous réserve d'encaissement.<br>
      Titan ERP / Hahitantsoa Platform
    </div>
  </main>
</body>
</html>`;
}

// ─── Main PaymentRegistrationModal Component ──────────────────────────────────

export const PaymentRegistrationModal: React.FC<PaymentRegistrationModalProps> = ({
  isOpen,
  onClose,
  domain,
  draftId,
  draftReference,
  proformaReference,
  customerName,
  customerPhone,
  customerAddress,
  eventDateLabel,
  totalAmount,
  paidAmount,
  requiredDepositAmount,
  cautionAmount,
  existingPayments,
  onPaymentRecorded,
  initialAmount = "",
  initialPaymentKind = "deposit",
}) => {
  const isTitan = domain === "titan";
  const depositRecordingKeyRef = useRef<string | null>(null);

  // Form State
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [amountInput, setAmountInput] = useState<string>(initialAmount);
  const [paymentKind, setPaymentKind] = useState<string>(initialPaymentKind);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [externalReference, setExternalReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [activeCashboxSession, setActiveCashboxSession] = useState<CashboxSession | null>(null);

  // Load open cashbox sessions safely
  React.useEffect(() => {
    let isMounted = true;
    if (typeof getCashboxSessions === "function") {
      try {
        const res = getCashboxSessions();
        if (res && typeof res.then === "function") {
          res
            .then((sessions) => {
              if (isMounted && Array.isArray(sessions)) {
                const open = sessions.find((s) => s.status === "open") || null;
                setActiveCashboxSession(open);
              }
            })
            .catch(() => {});
        }
      } catch {
        // silent catch
      }
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Async & UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPastPayment, setSelectedPastPayment] = useState<ExistingPaymentItem | null>(null);
  const [previewViewMode, setPreviewViewMode] = useState<"live" | "past">("live");

  // Accessibility IDs
  const titleId = useId();
  const descId = useId();
  const amountInputId = useId();
  const methodSelectId = useId();
  const paidAtInputId = useId();
  const externalRefId = useId();
  const notesInputId = useId();

  // ── Financial Calculations ─────────────────────────────────────────────────
  const numericAmount = Math.max(0, Number(amountInput) || 0);
  const currentPaid = paidAmount || 0;
  const currentRemaining = Math.max(0, totalAmount - currentPaid);
  const depositShortfall = Math.max(0, requiredDepositAmount - currentPaid);

  // Projections
  const projectedPaid = currentPaid + numericAmount;
  const projectedRemaining = Math.max(0, totalAmount - projectedPaid);
  const isOverpayment = numericAmount > currentRemaining && currentRemaining > 0;
  const isFullySettled = projectedRemaining === 0 && totalAmount > 0;
  const isDepositMet = projectedPaid >= requiredDepositAmount;

  // Percentage calculations
  const currentPaidPercent =
    totalAmount > 0 ? Math.min(100, Math.round((currentPaid / totalAmount) * 100)) : 0;
  const additionalPercent =
    totalAmount > 0
      ? Math.min(100 - currentPaidPercent, Math.round((numericAmount / totalAmount) * 100))
      : 0;
  const projectedTotalPercent = Math.min(100, currentPaidPercent + additionalPercent);

  // Amount in French Words
  const amountInWords = useMemo(
    () => numberToFrenchWords(numericAmount),
    [numericAmount],
  );

  // ── Receipt Generation ──────────────────────────────────────────────────────
  const liveReceiptHtml = useMemo(() => {
    const todayLabel = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const receiptNum = `REC-${(proformaReference || draftReference).replace(/[^a-zA-Z0-9-]/g, "")}-${(existingPayments.length + 1).toString().padStart(2, "0")}`;

    return generateThermalReceiptHtml({
      domain,
      receiptTitle:
        paymentKind === "deposit"
          ? "Reçu de Paiement d'Acompte"
          : paymentKind === "balance"
            ? "Reçu de Règlement du Solde"
            : paymentKind === "caution"
              ? "Reçu de Dépôt de Caution"
              : "Reçu de Versement",
      receiptNumber: receiptNum,
      paymentDate: todayLabel,
      customerName,
      customerPhone,
      eventDateLabel,
      amount: numericAmount,
      amountInWords,
      paymentMethodLabel: getPaymentMethodLabel(paymentMethod),
      transactionReference: externalReference.trim() || undefined,
      paymentKindLabel: getPaymentKindLabel(paymentKind),
      historyPayments: existingPayments,
      currentPaymentItem:
        numericAmount > 0
          ? {
              date: paidAt || new Date().toISOString(),
              amount: numericAmount,
              methodLabel: getPaymentMethodLabel(paymentMethod),
              isDraft: true,
            }
          : undefined,
      totalDepositAmount: projectedPaid,
      draftReference: draftReference || proformaReference,
      proformaReference: proformaReference || draftReference,
      proformaAmount: totalAmount,
      remainingBalance: projectedRemaining,
    });
  }, [
    domain,
    paymentKind,
    proformaReference,
    draftReference,
    existingPayments,
    customerName,
    customerPhone,
    eventDateLabel,
    numericAmount,
    amountInWords,
    paymentMethod,
    externalReference,
    paidAt,
    projectedPaid,
    totalAmount,
    projectedRemaining,
  ]);

  const pastReceiptHtml = useMemo(() => {
    if (!selectedPastPayment) return "";
    const receiptNum = `REC-${(proformaReference || draftReference).replace(/[^a-zA-Z0-9-]/g, "")}-${selectedPastPayment.id?.slice(0, 4) || "HIST"}`;
    return generateThermalReceiptHtml({
      domain,
      receiptTitle: "Reçu de Paiement Confirmé",
      receiptNumber: receiptNum,
      paymentDate: selectedPastPayment.date.slice(0, 10),
      customerName,
      customerPhone,
      eventDateLabel,
      amount: selectedPastPayment.amount,
      amountInWords: numberToFrenchWords(selectedPastPayment.amount),
      paymentMethodLabel: getPaymentMethodLabel(selectedPastPayment.method),
      transactionReference: selectedPastPayment.reference,
      paymentKindLabel: getPaymentKindLabel(selectedPastPayment.payment_kind || "deposit"),
      historyPayments: existingPayments.filter((p) => p.id !== selectedPastPayment.id),
      currentPaymentItem: {
        date: selectedPastPayment.date,
        amount: selectedPastPayment.amount,
        methodLabel: getPaymentMethodLabel(selectedPastPayment.method),
        isDraft: false,
      },
      totalDepositAmount: existingPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
      draftReference: draftReference || proformaReference,
      proformaReference: proformaReference || draftReference,
      proformaAmount: totalAmount,
      remainingBalance: Math.max(
        0,
        totalAmount - existingPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
      ),
    });
  }, [
    selectedPastPayment,
    domain,
    proformaReference,
    draftReference,
    customerName,
    customerPhone,
    eventDateLabel,
    existingPayments,
    totalAmount,
  ]);

  const displayedReceiptHtml = previewViewMode === "past" && pastReceiptHtml ? pastReceiptHtml : liveReceiptHtml;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSelectPastPayment = (item: ExistingPaymentItem) => {
    setSelectedPastPayment(item);
    setPreviewViewMode("past");
  };

  const handleBackToLivePreview = () => {
    setSelectedPastPayment(null);
    setPreviewViewMode("live");
  };

  const handlePrintCurrentReceipt = () => {
    printDocumentHtml(displayedReceiptHtml);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage("Veuillez saisir un montant de versement supérieur à 0 Ar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = depositRecordingKeyRef.current ?? crypto.randomUUID();
      depositRecordingKeyRef.current = idempotencyKey;

      const payload = {
        reservation_draft: isTitan ? draftId : null,
        hahitantsoa_event_draft: !isTitan ? draftId : null,
        payment_method: paymentMethod,
        amount: numericAmount.toFixed(2),
        paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
        external_reference: externalReference.trim() || undefined,
        notes:
          paymentNotes.trim() ||
          `Versement ${getPaymentKindLabel(paymentKind)} enregistré depuis le dossier ${draftReference}.`,
        idempotency_key: idempotencyKey,
      };

      const result = await recordConfirmedDeposit(payload);
      depositRecordingKeyRef.current = null;

      // Auto-link to open cashbox session if paid in cash
      if (paymentMethod === "cash" && activeCashboxSession && typeof createCashboxMovement === "function") {
        try {
          await createCashboxMovement(activeCashboxSession.id, {
            direction: "cash_in",
            amount: numericAmount,
            payment: result.payment.id,
            note: `[ENCAISSEMENT_RESERVATION] [Tiers: ${customerName}] [Réf: ${draftReference}] ${
              paymentNotes.trim() || `Versement ${getPaymentKindLabel(paymentKind)}`
            }`,
          });
        } catch (cashErr) {
          console.warn("Could not record linked cashbox movement:", cashErr);
        }
      }

      setSuccessMessage(
        result.replayed
          ? "Ce versement a été repris sans doublon (déjà enregistré)."
          : "Versement enregistré et confirmé avec succès !",
      );

      await onPaymentRecorded(result);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Une erreur est survenue lors de l'enregistrement du versement.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                isTitan
                  ? "bg-gradient-to-br from-blue-600 to-indigo-700"
                  : "bg-gradient-to-br from-amber-500 to-emerald-700"
              }`}
            >
              <i className="fa-solid fa-cash-register text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-900">
                  Enregistrement d'un Versement & Reçu Officiel
                </h2>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    isTitan
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {isTitan ? "Titan Rental" : "Domaine Hahitantsoa"}
                </span>
              </div>
              <p id={descId} className="text-xs text-slate-500">
                Dossier <strong className="text-slate-800">{draftReference}</strong> · Client :{" "}
                <strong className="text-slate-800">{customerName}</strong>
                {eventDateLabel ? ` · Événement : ${eventDateLabel}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* ─── Body (Dual Panel Layout) ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">

          {/* ════ LEFT PANEL: Accounting & Form & History (7 Cols) ═════════════ */}
          <div className="lg:col-span-7 p-6 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col space-y-5 overflow-y-auto">

            {/* View switcher tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "form"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-calculator"></i>
                  <span>Saisie & Comptabilité en direct</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "history"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Historique des reçus ({existingPayments.length})</span>
                </button>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Devise : <span className="text-slate-700 font-mono">Ariary (MGA)</span>
              </span>
            </div>

            {/* ── Section A: Accounting Overview (État de la comptabilité) ────── */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <i className="fa-solid fa-chart-pie text-indigo-600"></i> État de la Comptabilité du Dossier
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {currentPaidPercent}% réglé
                </span>
              </div>

              {/* 4 Financial KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Devis TTC</span>
                  <span className="text-sm font-black text-slate-900">{formatMoney(totalAmount)}</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Déjà Réglé</span>
                  <span className="text-sm font-black text-emerald-600">{formatMoney(currentPaid)}</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-rose-100 shadow-xs">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block">Reste Dû Actuel</span>
                  <span className="text-sm font-black text-rose-600">{formatMoney(currentRemaining)}</span>
                </div>
                <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">Acompte Requis</span>
                    <span
                      className={`text-[9px] font-extrabold px-1 rounded ${
                        depositShortfall === 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {depositShortfall === 0 ? "Couvert" : "Manque"}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-700">
                    {formatMoney(requiredDepositAmount)}
                  </span>
                </div>
              </div>

              {/* Double Progress Bar (Current + Projected) */}
              <div className="space-y-1">
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  {/* Current paid */}
                  <div
                    style={{ width: `${currentPaidPercent}%` }}
                    className="bg-emerald-500 h-full transition-all duration-300"
                    title={`Déjà payé : ${currentPaidPercent}%`}
                  ></div>
                  {/* Additional projected */}
                  {numericAmount > 0 && (
                    <div
                      style={{ width: `${additionalPercent}%` }}
                      className="bg-indigo-500 h-full animate-pulse transition-all duration-300"
                      title={`Versement en cours : +${additionalPercent}%`}
                    ></div>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold px-0.5">
                  <span>0 Ar</span>
                  {numericAmount > 0 && (
                    <span className="text-indigo-600 font-bold">
                      Nouveau cumul : {formatMoney(projectedPaid)} ({projectedTotalPercent}%)
                    </span>
                  )}
                  <span>{formatMoney(totalAmount)}</span>
                </div>
              </div>

              {/* Live projection badge */}
              {numericAmount > 0 && (
                <div
                  className={`rounded-xl p-2.5 text-xs font-medium flex items-center justify-between ${
                    isOverpayment
                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                      : isFullySettled
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : isDepositMet
                          ? "bg-blue-50 text-blue-900 border border-blue-200"
                          : "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <i
                      className={`fa-solid ${
                        isOverpayment
                          ? "fa-triangle-exclamation text-amber-600"
                          : isFullySettled
                            ? "fa-circle-check text-emerald-600"
                            : isDepositMet
                              ? "fa-badge-check text-blue-600"
                              : "fa-info-circle text-slate-600"
                      }`}
                    ></i>
                    <span>
                      {isOverpayment
                        ? `Ce versement dépasse le solde restant de ${formatMoney(numericAmount - currentRemaining)}`
                        : isFullySettled
                          ? "✨ Ce versement solde intégralement le dossier (100% Réglé)"
                          : isDepositMet
                            ? "✓ L'acompte légal de 50% est couvert — Reste solde à payer"
                            : `Acompte partiel (Reste ${formatMoney(Math.max(0, requiredDepositAmount - projectedPaid))} pour couvrir l'acompte)`}
                    </span>
                  </div>
                  <span className="font-bold">
                    Nouveau solde : {formatMoney(projectedRemaining)}
                  </span>
                </div>
              )}
            </div>

            {/* ── Section B: Formulaire de Saisie ────────────────────────────── */}
            {activeTab === "form" && (
              <form onSubmit={handleFormSubmit} className="space-y-4">

                {/* Tranche / Échéance */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tranche / Type de versement
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "deposit", label: "Acompte (50%)", icon: "fa-shield-halved" },
                      { id: "installment_1", label: "1ère Tranche", icon: "fa-layer-group" },
                      { id: "balance", label: "Solde final", icon: "fa-flag-checkered" },
                      { id: "caution", label: "Caution", icon: "fa-lock" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPaymentKind(item.id);
                          if (item.id === "deposit" && depositShortfall > 0) {
                            setAmountInput(depositShortfall.toString());
                          } else if (item.id === "balance" && currentRemaining > 0) {
                            setAmountInput(currentRemaining.toString());
                          }
                        }}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          paymentKind === item.id
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <i className={`fa-solid ${item.icon} text-[11px]`}></i>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Montant Input & Quick Fill Shortcuts */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={amountInputId} className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <i className="fa-solid fa-money-bill-wave text-emerald-600"></i> Montant du Versement (Ar) *
                    </label>
                    {/* Quick fill buttons */}
                    <div className="flex items-center gap-1.5">
                      {depositShortfall > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmountInput(depositShortfall.toString())}
                          className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-[10px] font-bold border border-amber-200 cursor-pointer"
                        >
                          Acompte restant ({formatMoney(depositShortfall)})
                        </button>
                      )}
                      {currentRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmountInput(currentRemaining.toString())}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold border border-emerald-200 cursor-pointer"
                        >
                          Tout solder ({formatMoney(currentRemaining)})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      id={amountInputId}
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="Ex: 500000"
                      className="w-full rounded-xl border border-slate-300 p-3 text-lg font-black text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 tracking-wide"
                    />
                    <span className="absolute right-3.5 top-3 text-sm font-bold text-slate-400">
                      Ariary
                    </span>
                  </div>

                  {/* Amount in French words in real time */}
                  {numericAmount > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Montant en toutes lettres (sur le reçu) :
                      </span>
                      <p className="font-semibold text-slate-700 italic mt-0.5">
                        « {amountInWords} »
                      </p>
                    </div>
                  )}
                </div>

                {/* Mode de règlement & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={methodSelectId} className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Mode de règlement
                    </label>
                    <select
                      id={methodSelectId}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-600"
                    >
                      <option value="cash">💵 Espèces (Caisse)</option>
                      <option value="mobile_money">📱 Mobile Money (MVola / Orange / Airtel)</option>
                      <option value="bank_transfer">🏦 Virement Bancaire (BMOI / BNI / BOA)</option>
                      <option value="cheque">📝 Chèque de banque</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={paidAtInputId} className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Date du versement
                    </label>
                    <input
                      id={paidAtInputId}
                      type="date"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Cashbox Detection Badge */}
                {paymentMethod === "cash" && (
                  <div
                    className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
                      activeCashboxSession
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        activeCashboxSession ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <i className={`fa-solid ${activeCashboxSession ? "fa-cash-register" : "fa-triangle-exclamation"}`}></i>
                    </div>
                    <div className="flex-1">
                      {activeCashboxSession ? (
                        <p className="font-semibold">
                          <strong>Caisse active détectée (#{activeCashboxSession.id.slice(0, 8)})</strong> : Ce versement en espèces sera automatiquement crédité dans votre tiroir-caisse de la session.
                        </p>
                      ) : (
                        <p className="font-semibold">
                          <strong>Information Caisse</strong> : Aucune session de caisse n'est ouverte pour votre compte. Le paiement sera enregistré au grand livre financier.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Référence transaction & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={externalRefId} className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Référence transaction / N° Chèque
                    </label>
                    <input
                      id={externalRefId}
                      type="text"
                      value={externalReference}
                      onChange={(e) => setExternalReference(e.target.value)}
                      placeholder="Ex: MVOLA-98234 ou N° Chèque 00412"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label htmlFor={notesInputId} className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Note interne (facultatif)
                    </label>
                    <input
                      id={notesInputId}
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Ex: Remis en main propre à l'agence"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Messages d'erreur ou succès */}
                {errorMessage && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-600 text-sm"></i>
                    <span>{errorMessage}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || numericAmount <= 0}
                    className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Enregistrement en cours...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check-double"></i>
                        <span>Enregistrer & Valider le versement</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── Section C: Historique des Reçus ────────────────────────────── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase">
                    Versements enregistrés sur ce dossier
                  </h4>
                  <span className="text-xs text-slate-500 font-semibold">
                    {existingPayments.length} versement(s)
                  </span>
                </div>

                {existingPayments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
                    <i className="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i>
                    <p className="text-sm font-semibold">Aucun versement enregistré pour le moment.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Basculez sur l'onglet de saisie pour enregistrer le premier acompte.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Mode</th>
                          <th className="py-2.5 px-3">Référence</th>
                          <th className="py-2.5 px-3">Note / Motif</th>
                          <th className="py-2.5 px-3 text-right">Montant</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {existingPayments.map((p, idx) => (
                          <tr key={p.id || `hist-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {p.date.slice(0, 10)}
                            </td>
                            <td className="py-2.5 px-3 capitalize text-slate-600">
                              {p.method}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {p.reference || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {p.note || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                              {formatMoney(p.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleSelectPastPayment(p)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  selectedPastPayment?.id === p.id && previewViewMode === "past"
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                }`}
                              >
                                <i className="fa-solid fa-receipt"></i>
                                <span>Voir le reçu</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════ RIGHT PANEL: Live Receipt Real-Time Preview (5 Cols) ═════════ */}
          <div className="lg:col-span-5 p-6 bg-slate-100/70 flex flex-col space-y-4">

            {/* Live Preview Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-receipt text-indigo-600"></i> Aperçu Reçu en Direct
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Format thermique officiel 80 mm
                </span>
              </div>

              <div className="flex items-center gap-2">
                {previewViewMode === "past" && (
                  <button
                    type="button"
                    onClick={handleBackToLivePreview}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    ← Reçu en direct
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintCurrentReceipt}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimer</span>
                </button>
              </div>
            </div>

            {/* If previewing past receipt notification */}
            {previewViewMode === "past" && selectedPastPayment && (
              <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-2.5 text-xs text-indigo-900 flex items-center justify-between">
                <span className="font-semibold">
                  Aperçu du reçu de versement du {selectedPastPayment.date.slice(0, 10)} ({formatMoney(selectedPastPayment.amount)})
                </span>
                <button
                  type="button"
                  onClick={handleBackToLivePreview}
                  className="text-indigo-700 font-bold underline text-[11px] cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* Thermal Receipt Paper Card (Live Canvas) */}
            <div className="flex-1 flex justify-center items-start overflow-y-auto max-h-[68vh] p-2 bg-slate-200/60 rounded-2xl border border-slate-300 shadow-inner">
              <div
                className="w-full max-w-[320px] bg-white rounded-lg shadow-xl p-1 overflow-hidden border border-slate-300/80"
                style={{ width: "320px" }}
              >
                <iframe
                  title="Aperçu Reçu de Paiement"
                  srcDoc={displayedReceiptHtml}
                  className="w-full border-0"
                  style={{ height: "600px" }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <p className="text-[10px] text-center text-slate-500 italic">
              L'aperçu et le montant en toutes lettres s'actualisent en temps réel lors de votre saisie.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PaymentRegistrationModal;
