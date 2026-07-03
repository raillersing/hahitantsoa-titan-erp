import React, { useState } from "react";
import { AppScope } from "../App";
import { DocumentPreview } from "./DocumentPreview";

interface CommercialOpsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function CommercialOpsPage({ onNavigate }: CommercialOpsPageProps) {
  const [selectedFacture, setSelectedFacture] = useState<string|null>(null);

  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Documents Commerciaux</h2>
        <p className="text-sm text-slate-500 mb-6">Proformas, factures, reçus et échéances de paiement</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Documents récents</h3>
          <button onClick={() => onNavigate("cashbox")} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
            <i className="fa-solid fa-cash-register mr-1"></i> Caisse
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 rounded-tl-lg">N°</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Montant</th>
              <th className="text-left px-3 py-2">Échéance</th>
              <th className="text-left px-3 py-2 rounded-tr-lg">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50">
              <td className="px-3 py-3 font-mono text-xs text-slate-600 hover:text-indigo-600 cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>PRO-2026-0142</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">Proforma</span></td>
              <td className="px-3 py-3 text-slate-700 hover:text-indigo-600 cursor-pointer" onClick={() => onNavigate("customer", "CUST-001")}>Rakoto Ando</td>
              <td className="px-3 py-3 font-medium text-slate-800">2 400 000 Ar</td>
              <td className="px-3 py-3 text-slate-500">15 juil. 2026</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">En attente</span></td>
            </tr>
            <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedFacture('FAC-2026-0089')}>
              <td className="px-3 py-3 font-mono text-xs text-slate-600 hover:text-indigo-600">FAC-2026-0089</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">Facture</span></td>
              <td className="px-3 py-3 text-slate-700">Rasoamanana L.</td>
              <td className="px-3 py-3 font-medium text-slate-800">1 150 000 Ar</td>
              <td className="px-3 py-3 text-slate-500">20 juin 2026</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Payée</span></td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-3 py-3 font-mono text-xs text-slate-600">REC-2026-0045</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Reçu</span></td>
              <td className="px-3 py-3 text-slate-700">Andriamampianina</td>
              <td className="px-3 py-3 font-medium text-slate-800">500 000 Ar</td>
              <td className="px-3 py-3 text-slate-500">—</td>
              <td className="px-3 py-3"><span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Validé</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Timeline des échéances</h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>

          <div className="relative flex items-start gap-4 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-file-invoice text-indigo-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-30 — Proforma envoyé</p>
              <p className="text-xs text-slate-500">Le client reçoit le proforma. Délai de réponse : 15 jours.</p>
              <p className="text-xs text-indigo-600 mt-1 hover:underline cursor-pointer" onClick={() => onNavigate("reservation-detail", "RES-2026-0142")}>PRO-2026-0142 — Rakoto Ando</p>
            </div>
          </div>

          <div className="relative flex items-start gap-4 mb-6">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-file-signature text-amber-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-10 — Contrat signé + Acompte</p>
              <p className="text-xs text-slate-500">50% d'acompte minimum requis pour confirmation.</p>
              <p className="text-xs text-amber-600 mt-1">1 200 000 Ar attendus avant le 5 juillet</p>
            </div>
          </div>
          
          <div className="relative flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-check text-green-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-3 — Confirmation finale</p>
              <p className="text-xs text-slate-500">Revalidation disponibilités, attribution durable, audit transaction.</p>
            </div>
          </div>
        </div>
      </div>

      {selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button 
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800"
              onClick={() => setSelectedFacture(null)}
            >
              <i className="fa-solid fa-xmark fa-xl"></i>
            </button>
            <div className="p-8">
              <DocumentPreview 
                type="facture"
                domain="hahitantsoa"
                client={{ name: "Rasoamanana L.", phone: "+261 34 11 111 11" }}
                date="20 juin 2026"
                refNumber={selectedFacture}
                eventDate="25 Juin 2026"
                materials={[
                  { id: '1', name: 'Chaise Napoléon transparente', price: 5000, quantity: 50 },
                  { id: '2', name: 'Table ronde 8 places', price: 15000, quantity: 10 }
                ]}
                services={[
                  { id: '10', name: 'Service Traiteur', price: 750000 }
                ]}
                totalAmount={1150000}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
