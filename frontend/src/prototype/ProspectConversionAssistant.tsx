import React, { useState } from "react";
import type { Client } from "../types";

interface ProspectConversionAssistantProps {
  client: Client;
  proformaAmount: number;
  onCancel: () => void;
  onSuccess: (updatedClient: Client, payment: any) => void;
}

export function ProspectConversionAssistant({ client, proformaAmount, onCancel, onSuccess }: ProspectConversionAssistantProps) {
  const [step, setStep] = useState(1);
  const [draftClient, setDraftClient] = useState<Client>({ ...client });
  
  // Payment state
  const [paymentAmount, setPaymentAmount] = useState<number>(Math.max(1, Math.round(proformaAmount / 2)));
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [paymentRef, setPaymentRef] = useState("");
  
  const isParticulier = draftClient.type === "Particulier";
  
  const isLegalComplete = () => {
    if (isParticulier) {
      return !!(draftClient.name && draftClient.phone && draftClient.address && draftClient.idNumber && draftClient.idIssueDate && draftClient.idIssuePlace);
    } else {
      return !!(draftClient.name && draftClient.phone && draftClient.address && draftClient.nif && draftClient.stat && draftClient.repFirstName && draftClient.repRole);
    }
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!isLegalComplete()) {
        setErrorMsg("Veuillez remplir toutes les informations légales obligatoires.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (paymentAmount <= 0 || paymentAmount > proformaAmount) {
        setErrorMsg("Montant invalide.");
        return;
      }
      setStep(3);
    }
  };

  const handleConfirm = () => {
    const payment = {
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentRef,
      date: new Date().toISOString().split("T")[0]
    };
    onSuccess(draftClient, payment);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Conversion en client</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex mb-8">
            <div className={`flex-1 text-center border-b-2 pb-2 ${step >= 1 ? 'border-indigo-600 text-indigo-600 font-bold' : 'border-slate-200 text-slate-400'}`}>1. Infos légales</div>
            <div className={`flex-1 text-center border-b-2 pb-2 ${step >= 2 ? 'border-indigo-600 text-indigo-600 font-bold' : 'border-slate-200 text-slate-400'}`}>2. Acompte mock</div>
            <div className={`flex-1 text-center border-b-2 pb-2 ${step >= 3 ? 'border-indigo-600 text-indigo-600 font-bold' : 'border-slate-200 text-slate-400'}`}>3. Confirmation</div>
          </div>

          {errorMsg && (
            <div className="p-3 mb-4 bg-rose-50 text-rose-700 text-sm font-semibold rounded-lg border border-rose-200">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg mb-4">
                Pour éditer un contrat, les informations légales sont obligatoires.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom / Raison sociale *</label>
                  <input type="text" value={draftClient.name || ""} onChange={e => setDraftClient({...draftClient, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone *</label>
                  <input type="text" value={draftClient.phone || ""} onChange={e => setDraftClient({...draftClient, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                  <input type="text" value={draftClient.email || ""} onChange={e => setDraftClient({...draftClient, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Adresse *</label>
                  <input type="text" value={draftClient.address || ""} onChange={e => setDraftClient({...draftClient, address: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                
                {isParticulier ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CIN / Passeport *</label>
                      <input type="text" value={draftClient.idNumber || ""} onChange={e => setDraftClient({...draftClient, idNumber: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré le *</label>
                      <input type="date" value={draftClient.idIssueDate || ""} onChange={e => setDraftClient({...draftClient, idIssueDate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré à *</label>
                      <input type="text" value={draftClient.idIssuePlace || ""} onChange={e => setDraftClient({...draftClient, idIssuePlace: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">NIF *</label>
                      <input type="text" value={draftClient.nif || ""} onChange={e => setDraftClient({...draftClient, nif: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">STAT *</label>
                      <input type="text" value={draftClient.stat || ""} onChange={e => setDraftClient({...draftClient, stat: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">RCS</label>
                      <input type="text" value={draftClient.rcs || ""} onChange={e => setDraftClient({...draftClient, rcs: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Représentant *</label>
                      <input type="text" value={draftClient.repFirstName || ""} onChange={e => setDraftClient({...draftClient, repFirstName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Qualité *</label>
                      <input type="text" value={draftClient.repRole || ""} onChange={e => setDraftClient({...draftClient, repRole: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Total proforma</span>
                <span className="font-bold text-slate-800">{proformaAmount.toLocaleString('fr-FR')} Ar</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Montant acompte (Ar)</label>
                <input type="number" min="1" max={proformaAmount} value={paymentAmount || ""} onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-indigo-700" />
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                <span>Solde restant :</span>
                <span className="font-bold">{(proformaAmount - paymentAmount).toLocaleString('fr-FR')} Ar</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mode de paiement</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option>Espèces</option>
                  <option>MVola</option>
                  <option>Virement</option>
                  <option>Chèque</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Référence (Optionnel)</label>
                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Réf MVola, Numéro de chèque..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
                <i className="fa-solid fa-check"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Résumé de la conversion</h3>
                <p className="text-sm text-slate-500 mt-2">Le prospect va devenir <strong>Client</strong>.</p>
                <p className="text-sm text-slate-500">Un dossier de réservation va être confirmé.</p>
                <p className="text-sm text-slate-500">Acompte enregistré : <strong>{paymentAmount.toLocaleString('fr-FR')} Ar ({paymentMethod})</strong></p>
                <p className="text-sm text-slate-500">Le contrat et l'accès aux factures seront débloqués.</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
          <button onClick={step === 1 ? onCancel : () => setStep(step - 1)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-200 rounded-lg transition-colors">
            {step === 1 ? 'Annuler' : 'Retour'}
          </button>
          {step < 3 ? (
            <button onClick={handleNext} className="px-6 py-2 bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 rounded-lg transition-colors">
              Suivant
            </button>
          ) : (
            <button onClick={handleConfirm} className="px-6 py-2 bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 rounded-lg transition-colors">
              Confirmer la conversion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
