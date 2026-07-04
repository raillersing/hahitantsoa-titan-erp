import React, { useState } from "react";
import { AppScope } from "../App";
import { DocumentPreview } from "./DocumentPreview";
import { getReservation, getClient, formatMoney, safeNumber, formatDateFr, updateMockClient, addMockReservation } from "./mockData";
import { ProspectConversionAssistant } from "./ProspectConversionAssistant";

interface ReservationDetailPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
  returnContext?: { from: string; param?: string } | null;
}

type PreviewDoc = 'proforma' | 'facture' | 'contrat' | 'annexes' | null;

export default function ReservationDetailPage({ onNavigate, param, onBack, returnContext }: ReservationDetailPageProps) {
  const reservationId = param || "RES-2026-0142";
  const reservation = getReservation(reservationId);
  const client = getClient(reservation.clientId);

  const [activeTab, setActiveTab] = useState("contrat");
  const [prepStatus, setPrepStatus] = useState("à préparer");
  const [returnStatus, setReturnStatus] = useState("Bon état");

  const [prepQty1, setPrepQty1] = useState(100);
  const [prepQty2, setPrepQty2] = useState(10);
  
  const [returnQty1, setReturnQty1] = useState(98);
  const [returnQty2, setReturnQty2] = useState(10);
  const [toast, setToast] = useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc>(null);
  const [showConversionAssistant, setShowConversionAssistant] = useState(false);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const closePreview = () => setPreviewDoc(null);

  const handleConversionSuccess = (updatedClient: any, payment: any) => {
    const finalizedClient = { ...updatedClient, status: "Client" as const };
    updateMockClient(finalizedClient);
    
    const newRes = {
      ...reservation,
      id: reservation.id.replace("PROF-PROS", "RES").replace("PROF", "RES"),
      status: "Confirmée" as const,
      paidAmount: payment.amount
    };
    addMockReservation(newRes);
    
    setShowConversionAssistant(false);
    showToast(`Conversion réussie. Redirection vers le dossier confirmé...`, 'success');
    setTimeout(() => {
      onNavigate("reservation-detail", newRes.id);
    }, 1500);
  };

  const docClient = {
    ...client,
    type: client.type || "Particulier",
    address: client.address || "",
    idNumber: client.idNumber || "",
    idIssueDate: client.idIssueDate || "",
    idIssuePlace: client.idIssuePlace || "",
    nif: client.nif || "",
    stat: client.stat || "",
    rcs: client.rcs || "",
    repFirstName: client.repFirstName || "",
    repRole: client.repRole || ""
  };

  const safeAmount = safeNumber(reservation.amount, 0);
  const initialPaid = safeNumber(reservation.paidAmount, Math.round(safeAmount / 2));
  const [payments, setPayments] = useState<{ id: string; date: string; method: string; amount: number; note: string; reference?: string }[]>([
    { id: 'PAY-INIT', date: reservation.date, method: 'Espèces', amount: initialPaid, note: 'Acompte enregistré', reference: 'RECU-001' }
  ]);
  const paidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingAmount = Math.max(0, safeAmount - paidAmount);

  const materials = reservation.lines
    ? reservation.lines.filter(l => l.type.toLowerCase() === 'article' || l.type.toLowerCase() === 'material').map(l => ({
        id: `${reservation.id}-${l.desc}`,
        name: l.desc,
        designation: l.desc,
        quantity: safeNumber(l.qty, 1),
        price: safeNumber(l.price, 0)
      }))
    : [];
  const services = reservation.lines
    ? reservation.lines.filter(l => l.type.toLowerCase() === 'service').map(l => ({
        id: `${reservation.id}-${l.desc}`,
        name: l.desc,
        quantity: safeNumber(l.qty, 1),
        price: safeNumber(l.price, 0)
      }))
    : [];

  const isProspectProforma = reservationId.startsWith("PROF-PROS-");

  if (isProspectProforma) {
    return (
      <div className="page active space-y-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button onClick={() => onBack ? onBack() : onNavigate("dashboard")} className="text-slate-500 hover:text-indigo-600 mb-2 flex items-center gap-2 text-sm font-medium" aria-label="Retour">
              <i className="fa-solid fa-arrow-left"></i>
              {returnContext?.from === 'customer' ? `Retour à la fiche ${client.name}` : 'Retour'}
            </button>
            <h2 className="text-2xl font-bold text-slate-800">Proforma prospect — {reservation.id}</h2>
            <div className="flex items-center gap-3 mt-2">
               <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Prospect non confirmé</span>
               <span className="text-sm text-slate-500">Volet : {reservation.type}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Résumé de la demande</h3>
            <p className="text-slate-600 mb-1"><span className="font-medium text-slate-700">Client / Prospect :</span> {client.name}</p>
            <p className="text-slate-600 mb-1"><span className="font-medium text-slate-700">Titre :</span> {reservation.title}</p>
            <p className="text-slate-600 mb-4"><span className="font-medium text-slate-700">Date prévue :</span> {formatDateFr(reservation.date)}</p>
            <p className="text-slate-500 italic text-sm">Cette proforma ne crée aucun paiement, contrat, facture ou réservation confirmée.</p>
          </div>

          <div className="mb-8 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Aperçu du document</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <DocumentPreview 
                type="proforma"
                domain={reservation.type === "Titan" ? "titan" : "hahitantsoa"}
                client={docClient}
                date={formatDateFr(new Date().toISOString())}
                refNumber={reservation.id}
                eventDate={reservation.date}
                materials={materials}
                services={services}
                deliveryFee="0"
                totalAmount={safeAmount}
                subTotalAmount={safeAmount}
                discountAmount={0}
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-md font-bold text-blue-800 mb-1">Prochaine étape commerciale</h3>
              <p className="text-sm text-blue-700">
                Disponible après paiement/acompte et complétion des informations légales (CIN, NIF/STAT, etc.).
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => onNavigate('customer', client.id)} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-colors whitespace-nowrap">
                Retour à la fiche prospect
              </button>
              <button onClick={() => setShowConversionAssistant(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium whitespace-nowrap shadow-sm transition-colors">
                <i className="fa-solid fa-check-circle mr-2"></i> Confirmer avec acompte
              </button>
            </div>
          </div>
        </div>

        {showConversionAssistant && (
          <ProspectConversionAssistant 
            client={client}
            proformaAmount={safeAmount}
            onCancel={() => setShowConversionAssistant(false)}
            onSuccess={handleConversionSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => onBack ? onBack() : onNavigate("dashboard")} className="text-slate-500 hover:text-indigo-600 mb-2 flex items-center gap-2 text-sm font-medium" aria-label="Retour">
            <i className="fa-solid fa-arrow-left"></i>
            {returnContext?.from === 'customer' ? `Retour à la fiche ${client.name}` : 
             returnContext?.from === 'reservations' ? 'Retour à toutes les réservations' : 
             returnContext?.from === 'titan' ? 'Retour aux réservations Titan' :
             returnContext?.from === 'hahitantsoa' ? 'Retour aux réservations Hahitantsoa' :
             'Retour au tableau de bord'}
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Réservation {reservation.id}</h2>
          <p className="text-sm text-slate-500">État d'avancement, ressources, documents, paiements et actions sensibles.</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
        {["Proforma", "Contrat", "Acompte", "Confirmée", "Sortie", "Retour"].map((step, idx) => {
          const isDone = idx <= 3;
          const isActive = idx === 3;
          return (
            <React.Fragment key={step}>
              <div className="flex items-center space-x-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${isDone ? 'bg-indigo-600 text-white' : isActive ? 'bg-indigo-100 text-indigo-700 border border-indigo-600' : 'border-2 border-slate-300 text-slate-500'}`}>
                  {isDone && !isActive ? <i className="fa-solid fa-check"></i> : idx + 1}
                </div>
                <span className={`font-semibold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>{step}</span>
              </div>
              {idx < 5 && <div className={`h-0.5 min-w-[20px] flex-1 mx-4 ${isDone && !isActive ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>}
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{reservation.title}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client</label>
              <div className="text-sm text-slate-800 font-medium hover:text-indigo-600 hover:underline cursor-pointer" onClick={() => onNavigate("customer", client.id)}>
                {client.name}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone</label>
              <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
              <div className="text-sm text-slate-800 font-medium">{client.email}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
              <div className="text-sm text-slate-800 font-medium">{client.type}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Résumé financier</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Total TTC</span>
              <span className="font-bold text-slate-800">{formatMoney(safeAmount)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Montant perçu</span>
              <span className="font-bold text-emerald-600">{formatMoney(paidAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-rose-600">Reste à payer</span>
              <span className="font-bold text-rose-600">{formatMoney(remainingAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Paiements en tranches</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 rounded-l-lg">Date</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-left px-4 py-3">Justificatif</th>
                  <th className="text-right px-4 py-3 rounded-r-lg">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, idx) => (
                  <tr key={p.id} className={idx === payments.length - 1 && remainingAmount <= 0 ? 'bg-emerald-50/50' : ''}>
                    <td className="px-4 py-3 text-slate-600">{formatDateFr(p.date)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{p.method}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.reference || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.note}</td>
                    <td className="px-4 py-3 text-indigo-600 cursor-pointer hover:underline text-xs"><i className="fa-solid fa-download mr-1"></i>Reçu mock</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">+ {formatMoney(p.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">Reste dû</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatMoney(remainingAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {remainingAmount > 0 && (
            <form
              className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const fd = new FormData(form);
                const amount = safeNumber(fd.get('amount') as string, 0);
                if (amount <= 0 || amount > remainingAmount) {
                  showToast(`Le montant doit être compris entre 1 Ar et ${formatMoney(remainingAmount)}`, 'error');
                  return;
                }
                const newPayment = {
                  id: `PAY-${Date.now()}`,
                  date: new Date().toISOString().split('T')[0],
                  method: (fd.get('method') as string) || 'Espèces',
                  amount,
                  note: (fd.get('note') as string) || 'Nouvelle tranche',
                  reference: (fd.get('reference') as string) || ''
                };
                setPayments([...payments, newPayment]);
                form.reset();
                showToast(`Paiement de ${formatMoney(amount)} enregistré`, 'success');
              }}
            >
              <div>
                <label htmlFor="payment-method" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mode</label>
                <select id="payment-method" name="method" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="MVola">MVola</option>
                  <option value="Virement">Virement</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label htmlFor="payment-ref" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Référence</label>
                <input id="payment-ref" name="reference" type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: N° transaction" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="payment-note" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Note / Payeur</label>
                <input id="payment-note" name="note" type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Deuxième tranche" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="payment-amount" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Montant (Ar)</label>
                <input id="payment-amount" name="amount" type="number" min="1" max={remainingAmount} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 500000" required />
              </div>
              <div className="md:col-span-2 flex items-end">
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                  <i className="fa-solid fa-plus mr-2"></i> Enregistrer un paiement
                </button>
              </div>
            </form>
          )}
          {remainingAmount > 0 && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center">
              <i className="fa-solid fa-triangle-exclamation mr-2"></i>
              Solde à régler avant le jour J ou la sortie du matériel.
            </div>
          )}
          {remainingAmount <= 0 && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center">
              <i className="fa-solid fa-check-circle mr-2"></i>
              Le dossier est intégralement payé.
            </div>
          )}
        </div>
      )}

      {reservation.type === "Titan" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-6 overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
            {[
              { id: "contrat", label: "Contrat & Proforma", icon: "fa-file-signature" },
              { id: "prep", label: "Préparation", icon: "fa-box-open" },
              { id: "sortie", label: "Sortie / Livraison", icon: "fa-truck-fast" },
              { id: "retour", label: "Retour / Restitution", icon: "fa-rotate-left" },
              { id: "casse", label: "Casse & Pertes", icon: "fa-heart-crack" },
              { id: "caution", label: "Caution & Solde", icon: "fa-money-bill-transfer" }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>
          
          <div className="p-6">
            {activeTab === "contrat" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Documents du dossier</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setPreviewDoc('proforma')}
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-invoice"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Proforma</p>
                        <p className="text-xs text-slate-500">Généré le {formatDateFr(reservation.date)}</p>
                      </div>
                    </div>
                    <i className="fa-solid fa-eye text-slate-400 hover:text-indigo-600"></i>
                  </button>
                  <button
                    onClick={() => setPreviewDoc('contrat')}
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-contract"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Contrat Titan</p>
                        <p className="text-xs text-slate-500">Signé par le client</p>
                      </div>
                    </div>
                    <i className="fa-solid fa-eye text-slate-400 hover:text-amber-600"></i>
                  </button>
                  <button
                    onClick={() => setPreviewDoc('facture')}
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Facture</p>
                        <p className="text-xs text-slate-500">Règlement final</p>
                      </div>
                    </div>
                    <i className="fa-solid fa-eye text-slate-400 hover:text-emerald-600"></i>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-file-signature"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Avenant</p>
                        <p className="text-xs text-slate-500">Non généré</p>
                      </div>
                    </div>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-truck"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Bon de livraison / Sortie</p>
                        <p className="text-xs text-slate-500">Généré à la sortie</p>
                      </div>
                    </div>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-rotate-left"></i></div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Bon de retour</p>
                        <p className="text-xs text-slate-500">Généré au retour</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === "prep" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Préparation matériel</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-bold text-blue-900 block mb-1">Statut actuel</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${prepStatus === 'Prêt' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{prepStatus}</span>
                  </div>
                  {prepStatus !== 'Prêt' && (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-blue-700" onClick={() => setPrepStatus('Prêt')}>Marquer comme prêt</button>
                  )}
                </div>
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-3 font-semibold rounded-tl-lg">Article</th>
                      <th className="p-3 font-semibold text-center">Qté demandée</th>
                      <th className="p-3 font-semibold text-center">Qté préparée</th>
                      <th className="p-3 font-semibold rounded-tr-lg">Disponibilité mockée</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-3">Chaise Napoleon</td>
                      <td className="p-3 text-center font-medium">100</td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          className="w-16 border rounded p-1 text-center" 
                          value={prepQty1} 
                          onChange={e => setPrepQty1(Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10))))} 
                        />
                      </td>
                      <td className="p-3 text-emerald-600 font-medium"><i className="fa-solid fa-check-circle mr-1"></i> En stock</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3">Table rectangulaire</td>
                      <td className="p-3 text-center font-medium">10</td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" min="0" max="10" step="1"
                          className="w-16 border rounded p-1 text-center" 
                          value={prepQty2} 
                          onChange={e => setPrepQty2(Math.max(0, Math.min(10, parseInt(e.target.value || '0', 10))))} 
                        />
                      </td>
                      <td className="p-3 text-emerald-600 font-medium"><i className="fa-solid fa-check-circle mr-1"></i> En stock</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {activeTab === "sortie" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  Sortie / Livraison
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full"><i className="fa-solid fa-truck text-indigo-500 mr-2"></i> Prélèvement par le client</span>
                </h4>
                
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-6 text-sm flex gap-3">
                  <i className="fa-solid fa-triangle-exclamation mt-1"></i>
                  <div>
                    <strong>Note véhicule :</strong> Un véhicule fourgon est exigé pour le transport des matériels. Le client a prévu un "Sprinter Fourgon" avec "Chauffeur Rabe".
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date et heure de sortie</label>
                    <input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" defaultValue="2026-06-14T09:00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Responsable remise (Titan)</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" defaultValue="Jean (Magasinier)" />
                  </div>
                </div>

                <h5 className="font-bold text-slate-700 text-sm mb-3">État initial des articles</h5>
                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <th className="p-2">Article</th>
                      <th className="p-2 text-center">Qté</th>
                      <th className="p-2">État de sortie</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-2">Chaise Napoleon</td>
                      <td className="p-2 text-center font-medium">100</td>
                      <td className="p-2">
                        <select className="border border-slate-300 rounded p-1 text-xs w-full">
                          <option>Bon état</option>
                          <option>Usure normale</option>
                          <option>À signaler</option>
                        </select>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-2">Table rectangulaire</td>
                      <td className="p-2 text-center font-medium">10</td>
                      <td className="p-2">
                        <select className="border border-slate-300 rounded p-1 text-xs w-full" defaultValue="Usure normale">
                          <option>Bon état</option>
                          <option>Usure normale</option>
                          <option>À signaler</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preuves visuelles (Photos avant départ)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
                    <i className="fa-solid fa-camera text-2xl mb-2 block"></i>
                    <span className="text-sm">Ajouter une photo mockée</span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Signature mockée (Client/Livreur)</label>
                  <div className="border border-slate-300 rounded-lg p-8 bg-slate-50 flex items-center justify-center italic text-slate-400">
                    Zone de signature
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700" onClick={() => showToast('Bon de livraison généré et sortie validée', 'success')}>Valider la sortie / Bon de livraison</button>
                </div>
              </div>
            )}

            {activeTab === "retour" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Retour / Restitution</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Retour prévu le</label>
                    <div className="font-semibold text-slate-800">16 Juin 2026 12:00</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Retour réel le</label>
                    <input type="datetime-local" className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white" defaultValue="2026-06-16T15:00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-rose-500 uppercase mb-1">Retard calculé</label>
                    <div className="font-bold text-rose-600">0 jour(s)</div>
                    <div className="text-xs text-rose-500 italic mt-0.5">Pénalité 50% par jour si applicable.</div>
                  </div>
                </div>

                <h5 className="font-bold text-slate-700 text-sm mb-3">Contrôle des articles</h5>
                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <th className="p-2">Article</th>
                      <th className="p-2 text-center">Attendus</th>
                      <th className="p-2 text-center">Retournés</th>
                      <th className="p-2">État au retour</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-2">Chaise Napoleon</td>
                      <td className="p-2 text-center text-slate-500">100</td>
                      <td className="p-2 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          className="w-16 border rounded p-1 text-center" 
                          value={returnQty1} 
                          onChange={e => setReturnQty1(Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10))))} 
                        />
                      </td>
                      <td className="p-2">
                        <select className="border border-slate-300 rounded p-1 text-xs w-full text-rose-600 font-medium" value={returnStatus} onChange={e => setReturnStatus(e.target.value)}>
                          <option className="text-slate-700">Bon état</option>
                          <option className="text-rose-600">Cassé</option>
                          <option className="text-orange-600">Manquant</option>
                          <option className="text-amber-600">Sale / non lavé</option>
                        </select>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-2">Table rectangulaire</td>
                      <td className="p-2 text-center text-slate-500">10</td>
                      <td className="p-2 text-center">
                        <input 
                          type="number" min="0" max="10" step="1"
                          className="w-16 border rounded p-1 text-center" 
                          value={returnQty2} 
                          onChange={e => setReturnQty2(Math.max(0, Math.min(10, parseInt(e.target.value || '0', 10))))} 
                        />
                      </td>
                      <td className="p-2">
                        <select className="border border-slate-300 rounded p-1 text-xs w-full text-emerald-600 font-medium">
                          <option className="text-emerald-600">Bon état</option>
                          <option className="text-rose-600">Cassé</option>
                          <option className="text-orange-600">Manquant</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Constat</label>
                  <textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" rows={2} defaultValue="2 chaises manquantes au retour."></textarea>
                </div>

                <div className="flex justify-end gap-3">
                  <button className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-300" onClick={() => showToast('État de retour provisoire sauvegardé', 'info')}>Enregistrer provisoire</button>
                  <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700" onClick={() => { showToast('Retour validé', 'success'); setActiveTab('casse'); }}>Valider retour & Aller à Casse</button>
                </div>
              </div>
            )}

            {activeTab === "casse" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Casse & Pertes constatées</h4>
                
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 mb-6">
                  <h5 className="font-bold text-rose-800 mb-4 border-b border-rose-200 pb-2">Facturation des préjudices</h5>
                  
                  <table className="w-full text-sm text-left mb-4">
                    <thead>
                      <tr className="text-rose-700 text-xs uppercase">
                        <th className="p-2">Article concerné</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-right">Prix de casse unitaire</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-rose-100">
                        <td className="p-2 font-medium text-rose-900">Chaise Napoleon</td>
                        <td className="p-2 text-center text-rose-900">2</td>
                        <td className="p-2 text-rose-700">Manquant</td>
                        <td className="p-2 text-right">60 000 Ar</td>
                        <td className="p-2 text-right font-bold text-rose-900">120 000 Ar</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <p className="text-sm text-rose-700">Total préjudices à retenir :</p>
                      <p className="text-2xl font-black text-rose-700">120 000 Ar</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm text-amber-800">
                  <i className="fa-solid fa-circle-info mr-2"></i>
                  <strong>Rappel contrat :</strong> Ce montant sera déduit du dépôt de garantie (caution). Si le préjudice est supérieur à la caution, le client est tenu de régler la différence sous 8 jours avec +100% de frais si applicable.
                </div>
              </div>
            )}

            {activeTab === "caution" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-6">Traitement Caution & Solde de fin de location</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h5 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">1. Bilan Financier</h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Total de la location</span>
                        <span>850 000 Ar</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Solde location</span>
                        <span className="text-emerald-600 font-medium">Réglé (0 Ar)</span>
                      </div>
                      <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                        <span>Dépôt de garantie versé</span>
                        <span className="font-bold text-slate-800">425 000 Ar</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h5 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">2. Pénalités et Retenues</h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Pénalités de retard (50%/j)</span>
                        <span>0 Ar</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>Frais de casse / perte</span>
                        <span className="font-medium">- 120 000 Ar</span>
                      </div>
                      <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                        <span>Frais supplémentaires (100%)</span>
                        <span>0 Ar</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h5 className="text-sm font-bold text-indigo-800 uppercase mb-1">Reste à restituer au client</h5>
                      <p className="text-3xl font-black text-indigo-700">305 000 Ar</p>
                      <p className="text-xs text-indigo-600 mt-2">Dépôt de garantie initial de 425 000 Ar imputé de 120 000 Ar de casse.</p>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[200px]">
                      <button className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 text-center w-full" onClick={() => showToast('Remboursement de 305 000 Ar enregistré', 'success')}>Rembourser 305 000 Ar</button>
                      <button className="px-4 py-2.5 bg-rose-100 text-rose-700 rounded-lg text-sm font-bold shadow-sm hover:bg-rose-200 text-center w-full" onClick={() => showToast('Retenue totale de la caution appliquée', 'warning')}>Retenir caution totale</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reservation.type !== "Titan" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Documents du dossier</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setPreviewDoc('proforma')}
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-invoice"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Proforma</p>
                  <p className="text-xs text-slate-500">Généré le {formatDateFr(reservation.date)}</p>
                </div>
              </div>
              <i className="fa-solid fa-eye text-slate-400 hover:text-indigo-600"></i>
            </button>
            <button
              onClick={() => setPreviewDoc('contrat')}
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-contract"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Contrat Hahitantsoa</p>
                  <p className="text-xs text-slate-500">Signé par le client</p>
                </div>
              </div>
              <i className="fa-solid fa-eye text-slate-400 hover:text-amber-600"></i>
            </button>
            <button
              onClick={() => setPreviewDoc('facture')}
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Facture</p>
                  <p className="text-xs text-slate-500">Règlement final</p>
                </div>
              </div>
              <i className="fa-solid fa-eye text-slate-400 hover:text-emerald-600"></i>
            </button>
            <button
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
              disabled
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-file-signature"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Avenant</p>
                  <p className="text-xs text-slate-500">Non généré</p>
                </div>
              </div>
            </button>
            <button
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
              disabled
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-truck"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Bon de livraison / Sortie</p>
                  <p className="text-xs text-slate-500">Généré à la sortie</p>
                </div>
              </div>
            </button>
            <button
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
              disabled
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-rotate-left"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Bon de retour</p>
                  <p className="text-xs text-slate-500">Généré au retour</p>
                </div>
              </div>
            </button>
          </div>

          <h4 className="text-sm font-bold text-slate-800 mt-6 mb-4">Pièces contractuelles / Annexes du contrat</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setPreviewDoc('annexes')}
              className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-purple-50 text-left border-l-4 border-l-purple-500"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white text-purple-600 flex items-center justify-center text-lg shadow-sm"><i className="fa-solid fa-paperclip"></i></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Annexes Hahitantsoa</p>
                  <p className="text-xs text-slate-500">Plan, règlement, prix de casse</p>
                </div>
              </div>
              <i className="fa-solid fa-eye text-slate-400 hover:text-purple-600"></i>
            </button>
            <div className="p-4 flex flex-col justify-center text-sm text-slate-500">
              <span className="font-medium text-slate-600 mb-1"><i className="fa-solid fa-info-circle text-blue-500 mr-1"></i> Annexes intégrées au contrat Hahitantsoa</span>
              Les annexes font partie intégrante des conditions générales de location signées.
            </div>
          </div>
        </div>
      )}

      {reservation.type !== "Titan" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Lignes de réservation</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="text-left px-4 py-3 rounded-l-lg">Type</th>
                <th className="text-left px-4 py-3">Désignation</th>
                <th className="text-center px-4 py-3">Qté</th>
                <th className="text-right px-4 py-3">Prix unit.</th>
                <th className="text-right px-4 py-3 rounded-r-lg">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservation.lines?.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">{line.type}</span></td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{line.desc}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{line.qty}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{line.price}</td>
                  <td className="px-4 py-3 text-right text-slate-800 font-bold">{line.total}</td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">TOTAL TTC</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatMoney(safeAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 text-sm text-blue-800 mt-6">
        <i className="fa-solid fa-info-circle text-blue-600"></i>
        <strong>Information :</strong> Toute modification après contrat passe par avenant.
      </div>
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Aperçu {previewDoc === 'proforma' ? 'Proforma' : previewDoc === 'facture' ? 'Facture' : previewDoc === 'contrat' ? 'Contrat' : 'Annexes'}
              </h3>
              <button onClick={closePreview} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            {previewDoc === 'annexes' ? (
              <div className="space-y-8 text-sm text-slate-700 font-serif">
                <div className="text-center mb-8 border-b pb-4">
                  <h2 className="text-2xl font-bold mb-2 uppercase">Annexes Contractuelles</h2>
                  <p className="text-slate-500">Mises à jour pour la réservation {reservation.id}</p>
                </div>
                
                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">Annexe 1 : Règlement Intérieur Hahitantsoa</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>L'accès aux cuisines est strictement réservé au personnel autorisé et aux traiteurs agréés.</li>
                    <li>Le niveau sonore ne doit pas dépasser les limites légales en vigueur après 22h00.</li>
                    <li>L'utilisation de feux d'artifice, de fumigènes lourds ou de confettis en plastique est strictement interdite sur tout le domaine.</li>
                    <li>Le locataire est responsable du nettoyage préliminaire et de la gestion des déchets générés par ses prestataires.</li>
                  </ul>
                </section>
                
                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">Annexe 2 : Plan de masse et Évacuation</h4>
                  <p className="mb-2">Le plan d'évacuation est affiché dans le hall principal et doit être communiqué au responsable de la sécurité de l'événement.</p>
                  <div className="bg-slate-100 p-4 rounded text-center border border-slate-300 border-dashed">
                    [Aperçu du plan d'évacuation PDF/Image intégré ici dans la version finale]
                  </div>
                </section>
                
                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">Annexe 3 : Grille tarifaire des casses & pertes</h4>
                  <p className="mb-2">En cas de dommage ou de perte du matériel mis à disposition, la facturation se fera selon la grille suivante :</p>
                  <table className="w-full text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-200">Désignation</th>
                        <th className="p-2 border border-slate-200">Indemnité forfaitaire (Ar)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="p-2 border border-slate-200">Chaise Chiavari (casse/perte)</td><td className="p-2 border border-slate-200 font-mono">150 000</td></tr>
                      <tr><td className="p-2 border border-slate-200">Verre / Coupe (unité)</td><td className="p-2 border border-slate-200 font-mono">15 000</td></tr>
                      <tr><td className="p-2 border border-slate-200">Assiette de présentation</td><td className="p-2 border border-slate-200 font-mono">45 000</td></tr>
                      <tr><td className="p-2 border border-slate-200">Table ronde / rectangulaire</td><td className="p-2 border border-slate-200 font-mono">350 000</td></tr>
                    </tbody>
                  </table>
                </section>
                
                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">Annexe 4 : Liste des intervenants non autorisés</h4>
                  <p className="mb-2">Pour des raisons de qualité, de sécurité ou de litiges antérieurs, les prestataires suivants ne sont pas admis sur le domaine Hahitantsoa :</p>
                  <ul className="list-disc pl-5 space-y-1 text-rose-700">
                    <li>Prestataire Alpha (Sonorisation) - Dépassement récurrent des décibels</li>
                    <li>Traiteur Beta - Non-respect des règles d'hygiène</li>
                    <li>Décorateur Gamma - Utilisation de matériaux inflammables non homologués</li>
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 italic">Cette liste est mise à jour mensuellement par la direction technique.</p>
                </section>
              </div>
            ) : (
              <DocumentPreview
                type={previewDoc === 'contrat' ? 'contrat' : previewDoc}
                domain={reservation.type === "Titan" ? 'titan' : 'hahitantsoa'}
                client={docClient}
                date={reservation.date}
                refNumber={reservation.id}
                eventDate={reservation.date}
                materials={materials}
                services={services}
                totalAmount={safeAmount}
                subTotalAmount={safeAmount}
                paidAmount={paidAmount}
              />
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'warning' ? 'bg-amber-500 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-slate-800 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
