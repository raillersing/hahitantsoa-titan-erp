import React, { useState } from "react";
import { AppScope } from "../App";
import { Client, getClient, mockReservations, updateMockClient, addMockReservation } from "./mockData";
import { ProspectConversionAssistant } from "./ProspectConversionAssistant";
interface CustomerDetailPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
  returnContext?: { from: string; param?: string } | null;
}

export default function CustomerDetailPage({ onNavigate, param, onBack, returnContext }: CustomerDetailPageProps) {
  const clientId = param || "CUST-001";
  const baseClient = getClient(clientId);
  const [client, setClient] = useState<Client>(baseClient);
  const [isEditing, setIsEditing] = useState(false);
  const [showConversionAssistant, setShowConversionAssistant] = useState(false);
  const reservations = mockReservations.filter(r => r.clientId === client.id);

  const [draftExists, setDraftExists] = useState(false);
  const [draftDomain, setDraftDomain] = useState("");

  React.useEffect(() => {
    const saved = localStorage.getItem("prototypeReservationDraft");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.selectedClientId === client.id && data.step >= 2) {
          setDraftExists(true);
          setDraftDomain(data.domain || "Non spécifié");
        }
      } catch (e) {}
    }
  }, [client.id]);

  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  
  const [tasks, setTasks] = useState([
    { id: 1, type: "Appel", icon: "fa-phone", title: "Appel téléphonique", desc: "Prévu pour relance devis. Le 10 Juillet 2026.", status: "À faire", color: "blue" },
    { id: 2, type: "Visite", icon: "fa-handshake", title: "Visite terrain", desc: "Repérage domaine. Le 25 Juin 2026.", status: "Fait", color: "slate" }
  ]);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  const handleTaskAction = (action: string, id?: number) => {
    if (action === "done" && id) {
      setTasks(tasks.map(t => t.id === id ? { ...t, status: "Fait", color: "slate" } : t));
      setTaskFeedback("Action marquée comme faite.");
    } else if (action === "plan") {
      setTaskFeedback("Nouvelle relance planifiée.");
    } else if (action === "postpone") {
      setTaskFeedback("Relance reportée.");
    }
    setTimeout(() => setTaskFeedback(null), 3000);
  };

  const handleSave = () => {
    updateMockClient(client);
    setIsEditing(false);
    setEditFeedback("Modifications enregistrées en local (mock)");
    setTimeout(() => setEditFeedback(null), 3000);
  };

  const handleCancel = () => {
    setClient(baseClient);
    setIsEditing(false);
  };

  const handleConvert = () => {
    // This simple convert is now replaced by the assistant, but we keep it for fallback if needed.
    const updated = { ...client, status: "Client" as const };
    setClient(updated);
    updateMockClient(updated);
    setEditFeedback("Prospect converti en Client !");
    setTimeout(() => setEditFeedback(null), 3000);
  };

  const handleConversionSuccess = (updatedClient: Client, payment: any) => {
    // Update Client
    const finalizedClient = { ...updatedClient, status: "Client" as const };
    setClient(finalizedClient);
    updateMockClient(finalizedClient);
    
    // Create Confirmed Reservation
    const linkedProforma = reservations.find(r => r.status === "Proforma");
    if (linkedProforma) {
      const newRes = {
        ...linkedProforma,
        id: linkedProforma.id.replace("PROF-PROS", "RES").replace("PROF", "RES"),
        status: "Confirmée" as const,
        paidAmount: payment.amount
      };
      addMockReservation(newRes);
    }
    
    setShowConversionAssistant(false);
    setEditFeedback(`Conversion réussie avec acompte de ${payment.amount.toLocaleString('fr-FR')} Ar`);
    setTimeout(() => setEditFeedback(null), 5000);
  };

  const totalBilled = reservations.reduce((acc, r) => acc + r.amount, 0);
  const totalPaid = reservations.reduce((acc, r) => acc + (r.paidAmount || 0), 0);
  const totalDue = totalBilled - totalPaid;

  let reqType = "Non spécifiée";
  let reqVolet = "Indéfini";
  let reqDate = "Aucune";
  if (client.status === 'Prospect' && client.notes && client.notes.startsWith('Demande :')) {
    const lines = client.notes.split('\n');
    reqType = lines[0]?.split(': ')[1] || reqType;
    reqVolet = lines[1]?.split(': ')[1] || reqVolet;
    reqDate = lines[2]?.split(': ')[1] || reqDate;
  }
  const linkedProforma = reservations.find(r => r.status === "Proforma");

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onBack ? onBack() : onNavigate("customers")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Retour">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Fiche {client.status === 'Prospect' ? 'prospect' : 'client'} — {client.name}</h2>
            <p className="text-sm text-slate-500">Détails, historique et documents liés</p>
          </div>
        </div>
      </div>
      
      {client.status === 'Prospect' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
          <div>
            <h4 className="font-semibold text-blue-800 text-sm">Prospect : ce contact a demandé un tarif, une disponibilité ou une visite, mais n'a pas encore confirmé de réservation.</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Demande actuelle : {reqType}</li>
              <li>• Volet d'intérêt : Hahitantsoa / Indécis</li>
              <li>• Date souhaitée : Août 2026</li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne de gauche: Actions et Infos Rapides */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 ${client.colorClass}`}>
              {client.initials}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h3>
            
            <div className="flex items-center gap-2 mt-2 mb-6">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{client.type}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${client.status === 'Prospect' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{client.status}</span>
            </div>
            
            {client.status === 'Prospect' ? (
              <div className="w-full flex justify-center text-xs text-slate-500 italic mb-2">
                Conversion via Demande commerciale
              </div>
            ) : (
              <button className="w-full px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 mb-2 transition-colors" onClick={() => onNavigate("reservation-new", client.id)}>
                <i className="fa-solid fa-plus mr-2"></i> Nouvelle réservation
              </button>
            )}
          </div>

          {/* Solde / Demande commerciale */}
          {client.status === 'Prospect' ? (
            <div className="space-y-6">
              {linkedProforma && (
                <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-4">Conversion en client</h3>
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Proforma liée</span>
                      <span className="font-bold text-slate-800">{linkedProforma.id}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Total estimatif</span>
                      <span className="font-bold text-slate-800">{linkedProforma.amount.toLocaleString('fr-FR')} Ar</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Statut</span>
                      <span className="font-semibold text-amber-600">Prospect non confirmé</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Prochaine étape</span>
                      <span className="font-semibold text-indigo-600 text-right">Acompte +<br/>Infos légales</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setShowConversionAssistant(true)} className="w-full px-4 py-2 bg-emerald-600 text-white font-medium text-sm rounded-lg hover:bg-emerald-700 transition-colors">
                      <i className="fa-solid fa-check-circle mr-2"></i> Confirmer avec acompte
                    </button>
                    <button onClick={() => setIsEditing(true)} className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors">
                      <i className="fa-solid fa-file-contract mr-2"></i> Compléter infos légales
                    </button>
                    <button onClick={() => onNavigate("reservation-detail", linkedProforma.id)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-indigo-700 font-medium text-sm rounded-lg hover:bg-indigo-50 transition-colors">
                      <i className="fa-solid fa-eye mr-2"></i> Voir proforma
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Demande commerciale</h3>
              <div className="space-y-4">
                <div className="text-sm">
                  <span className="font-medium text-slate-500 block mb-1">Demande actuelle</span>
                  <span className="font-semibold text-slate-800">{client.notes?.includes("Demande : ") ? client.notes.split("Demande : ")[1].split("\n")[0] : "Proforma demandée"}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-slate-500 block mb-1">Volet d'intérêt</span>
                  <span className="font-semibold text-slate-800">{client.notes?.includes("Volet : ") ? client.notes.split("Volet : ")[1].split("\n")[0] : "Hahitantsoa"}</span>
                </div>
                
                {client.notes?.includes("Proforma demandée") || !client.notes?.includes("Demande : ") ? (
                  <div className="text-sm">
                    <span className="font-medium text-slate-500 block mb-1">Proforma liée</span>
                    <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-indigo-700">#PROF-MOCK</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Brouillon</span>
                      </div>
                      <button className="w-full text-xs text-center py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium">Voir proforma mock</button>
                    </div>
                  </div>
                ) : null}

                {client.notes?.includes("Disponibilité demandée") ? (
                  <div className="text-sm">
                    <span className="font-medium text-slate-500 block mb-1">Disponibilité demandée</span>
                    <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="font-semibold text-slate-700 block mb-2">{client.notes?.includes("Date : ") ? client.notes.split("Date : ")[1].split("\n")[0] || "Juillet 2026" : "Juillet 2026"}</span>
                      <button className="w-full text-xs text-center py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium mb-2">Voir calendrier disponibilité</button>
                      <button className="w-full text-xs text-center py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded hover:bg-indigo-100 font-bold">Vérifier disponibilité mock</button>
                    </div>
                  </div>
                ) : null}

                {client.notes?.includes("Visite demandée") ? (
                  <div className="text-sm">
                    <span className="font-medium text-slate-500 block mb-1">Visite demandée</span>
                    <div className="mt-1 bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <span className="font-semibold text-slate-700 block mb-1"><i className="fa-solid fa-calendar mr-1"></i> Date à confirmer</span>
                      <span className="text-slate-600 block text-xs mb-2">Lieu : Hahitantsoa (Salle des fêtes)</span>
                      <button className="w-full text-xs text-center py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium">Voir agenda visite</button>
                    </div>
                  </div>
                ) : null}

                <div className="text-sm border-t border-slate-100 pt-3 mt-3">
                  <span className="font-medium text-slate-500 block mb-1">Dernier échange</span>
                  <span className="text-slate-700">Appel entrant du prospect. Intéressé par le jardin.</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-slate-500 block mb-1">Prochaine relance</span>
                  <span className="text-rose-600 font-semibold"><i className="fa-solid fa-clock mr-1"></i> 10 Août 2026</span>
                </div>
                <button className="w-full mt-2 py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-slate-400">Planifier relance</button>
              </div>
            </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Situation financière (Mock)</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total facturé</span>
                  <span className="text-sm font-semibold text-slate-800">{totalBilled.toLocaleString('fr-FR')} Ar</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total payé</span>
                  <span className="text-sm font-semibold text-emerald-600">{totalPaid.toLocaleString('fr-FR')} Ar</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">Reste à payer</span>
                  <span className={`text-lg font-bold ${totalDue > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{totalDue.toLocaleString('fr-FR')} Ar</span>
                </div>
              </div>
            </div>
          )}

          {/* Pièces jointes (Client uniquement) */}
          {client.status !== 'Prospect' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex justify-between items-center">
                Pièces jointes 
                <button className="text-indigo-600 hover:text-indigo-800 text-xs"><i className="fa-solid fa-plus"></i></button>
              </h3>
              <ul className="space-y-3">
                {client.type === "Particulier" ? (
                  <>
                    <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <i className="fa-solid fa-id-card text-slate-400"></i> CIN / Passeport
                      </div>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md font-semibold">Présent</span>
                    </li>
                    <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <i className="fa-solid fa-file-invoice text-slate-400"></i> Justificatif domicile
                      </div>
                      <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-semibold">Manquant</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <i className="fa-solid fa-file-contract text-slate-400"></i> NIF / STAT / RCS
                      </div>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md font-semibold">Présent</span>
                    </li>
                    <li className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <i className="fa-solid fa-image text-slate-400"></i> Logo entreprise
                      </div>
                      <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-md font-semibold">Non requis</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Colonne de droite : Coordonnées, Historique, Agenda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coordonnées */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Coordonnées principales</h3>
              <div className="flex items-center gap-3">
                {isEditing && (
                  <button onClick={handleCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Annuler</button>
                )}
                <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  {isEditing ? "Enregistrer (local)" : "Modifier"}
                </button>
              </div>
            </div>
            {editFeedback && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{editFeedback}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client.type === "Particulier" ? (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom complet</label>
                    {isEditing ? (
                      <input type="text" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                    {isEditing ? (
                      <input type="email" value={client.email} onChange={e => setClient({ ...client, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.email || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone</label>
                    {isEditing ? (
                      <input type="tel" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Adresse</label>
                    {isEditing ? (
                      <input type="text" value={client.address || ""} onChange={e => setClient({ ...client, address: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Adresse du client" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.address || "Non renseignée"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CIN / Passeport</label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select value={client.idType || "CIN"} onChange={e => setClient({ ...client, idType: e.target.value as any })} className="w-1/3 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="CIN">CIN</option>
                          <option value="Passeport">Passeport</option>
                        </select>
                        <input type="text" value={client.idNumber || ""} onChange={e => setClient({ ...client, idNumber: e.target.value })} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Numéro" />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">
                        {client.idNumber ? `${client.idType || "CIN"} ${client.idNumber}` : "Non renseigné"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré le</label>
                    {isEditing ? (
                      <input type="date" value={client.idIssueDate || ""} onChange={e => setClient({ ...client, idIssueDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.idIssueDate || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré à</label>
                    {isEditing ? (
                      <input type="text" value={client.idIssuePlace || ""} onChange={e => setClient({ ...client, idIssuePlace: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.idIssuePlace || "Non renseigné"}</div>
                    )}
                  </div>
                  {(isEditing || client.idDuplicataDate || client.idDuplicataPlace) && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duplicata du (Date)</label>
                        {isEditing ? (
                          <input type="date" value={client.idDuplicataDate || ""} onChange={e => setClient({ ...client, idDuplicataDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                          <div className="text-sm text-slate-800 font-medium">{client.idDuplicataDate || "Non renseigné"}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duplicata à (Lieu)</label>
                        {isEditing ? (
                          <input type="text" value={client.idDuplicataPlace || ""} onChange={e => setClient({ ...client, idDuplicataPlace: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                          <div className="text-sm text-slate-800 font-medium">{client.idDuplicataPlace || "Non renseigné"}</div>
                        )}
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date de naissance</label>
                    {isEditing ? (
                      <input type="date" value={client.birthDate || ""} onChange={e => setClient({ ...client, birthDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.birthDate || "Non renseignée"}</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Raison sociale</label>
                    {isEditing ? (
                      <input type="text" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Pro</label>
                    {isEditing ? (
                      <input type="email" value={client.email} onChange={e => setClient({ ...client, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.email || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone Pro</label>
                    {isEditing ? (
                      <input type="tel" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">NIF / STAT</label>
                    {isEditing ? (
                      <input type="text" value={client.nif || ""} onChange={e => setClient({ ...client, nif: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Numéros fiscaux" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.nif || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Représentant</label>
                    {isEditing ? (
                      <input type="text" value={client.repFirstName || ""} onChange={e => setClient({ ...client, repFirstName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nom du représentant" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.repFirstName || "Non renseigné"}</div>
                    )}
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes internes</label>
                {isEditing ? (
                  <textarea value={client.notes || ""} onChange={e => setClient({ ...client, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20" placeholder="Remarques..." />
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">{client.notes || "Aucune note."}</div>
                )}
              </div>
            </div>
          </div>

          {/* Demande Commerciale (Prospect) */}
          {client.status === 'Prospect' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Demande commerciale</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Demande actuelle</span>
                  <span className="font-semibold text-slate-800">{reqType}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Volet d'intérêt</span>
                  <span className="font-semibold text-slate-800">{reqVolet}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Date souhaitée</span>
                  <span className="font-semibold text-slate-800">{reqDate}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Dernier échange</span>
                  <span className="font-semibold text-slate-800">Aujourd'hui</span>
                </div>
              </div>

              <div className="space-y-4">
                {linkedProforma && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-file-invoice text-indigo-500"></i> Proforma liée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{linkedProforma.id} • {linkedProforma.amount.toLocaleString('fr-FR')} Ar • Brouillon</p>
                    </div>
                    <button onClick={() => onNavigate("reservation-detail", linkedProforma.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                      Voir proforma mock
                    </button>
                  </div>
                )}

                {reqType === 'Disponibilité demandée' && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-emerald-500"></i> Disponibilité demandée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{reqVolet} • {reqDate} • À vérifier</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onNavigate("planning")} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap">
                        Voir calendrier disponibilité
                      </button>
                      <button onClick={() => setEditFeedback("Disponibilité vérifiée et validée (mock)")} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap">
                        Vérifier mock
                      </button>
                    </div>
                  </div>
                )}
                
                {reqType === 'Visite demandée' && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-emerald-500"></i> Visite demandée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{reqVolet} • Date souhaitée : {reqDate}</p>
                    </div>
                    <button onClick={() => setEditFeedback("Agenda visite ouvert (mock)")} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap">
                      Voir agenda de visite
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agenda / Relances */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Agenda commercial / Relances</h3>
              <button onClick={() => handleTaskAction('plan')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                <i className="fa-solid fa-plus mr-1"></i> Planifier une relance
              </button>
            </div>
            {taskFeedback && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{taskFeedback}</div>
            )}
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg text-center">Aucune relance planifiée.</div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className={`flex flex-col sm:flex-row sm:items-start gap-4 p-3 rounded-xl border border-slate-100 ${task.status === 'Fait' ? 'bg-slate-50 opacity-60' : 'bg-white shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${task.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                      <i className={`fa-solid ${task.icon}`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-bold text-slate-800">{task.title}</h4>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide ${task.status === 'Fait' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{task.desc}</p>
                      
                      {task.status !== 'Fait' && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                          <button onClick={() => handleTaskAction('done', task.id)} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                            <i className="fa-solid fa-check mr-1"></i> Marquer comme fait
                          </button>
                          <button onClick={() => handleTaskAction('postpone')} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                            <i className="fa-solid fa-calendar-day mr-1"></i> Reporter
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Réservation en cours (Draft) */}
          {draftExists && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-6 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-file-signature text-indigo-500"></i> Réservation en cours
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">Un brouillon de réservation ({draftDomain}) a été sauvegardé récemment.</p>
                </div>
                <button 
                  onClick={() => onNavigate("reservation-new", client.id)} 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  Reprendre le brouillon
                </button>
              </div>
            </div>
          )}

          {/* Historique des dossiers */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Historique des dossiers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                    <th className="text-left pb-3 font-semibold">Dossier</th>
                    <th className="text-left pb-3 font-semibold">Volet</th>
                    <th className="text-left pb-3 font-semibold">Date prévue</th>
                    <th className="text-left pb-3 font-semibold">Statut</th>
                    <th className="text-right pb-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucun dossier trouvé pour ce contact.</td>
                    </tr>
                  )}
                  {reservations.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <button onClick={() => onNavigate("reservation-detail", res.id)} className="text-left group">
                          <div className="font-medium text-indigo-600 group-hover:underline">{res.id}</div>
                          <div className="text-xs text-slate-500">{res.title}</div>
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${res.type === 'Hahitantsoa' ? 'bg-hah-100 text-hah-700' : 'bg-tit-100 text-tit-700'}`}>{res.type}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{res.date}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{res.status}</span>
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-800">
                        {res.amount.toLocaleString('fr-FR')} Ar
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {showConversionAssistant && linkedProforma && (
        <ProspectConversionAssistant 
          client={client}
          proformaAmount={linkedProforma.amount}
          onCancel={() => setShowConversionAssistant(false)}
          onSuccess={handleConversionSuccess}
        />
      )}
    </div>
  );
}
