import React, { useState } from "react";
import { mockClients, mockReservations, Client, addMockClient, addMockReservation } from "./mockData";
import { MockAvailabilityCalendar } from "./MockAvailabilityCalendar";

interface CustomersPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
}

export default function CustomersPage({ onNavigate, canSensitiveWrite = false }: CustomersPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("Tous");
  
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<"Particulier" | "Entreprise">("Particulier");
  const [newStatus, setNewStatus] = useState<"Prospect" | "Client">("Prospect");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  
  // Extended fields for Client
  const [newCivilite, setNewCivilite] = useState<"Monsieur" | "Madame" | "">("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");
  // Particulier specific
  const [newIdType, setNewIdType] = useState<"CIN" | "Passeport">("CIN");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newIdIssuePlace, setNewIdIssuePlace] = useState("");
  const [newIdIssueDate, setNewIdIssueDate] = useState("");
  const [newIdDuplicataDate, setNewIdDuplicataDate] = useState("");
  const [newIdDuplicataPlace, setNewIdDuplicataPlace] = useState("");
  // Entreprise specific
  const [newNif, setNewNif] = useState("");
  const [newStat, setNewStat] = useState("");
  const [newRcs, setNewRcs] = useState("");
  const [newRepName, setNewRepName] = useState("");
  const [newRepRole, setNewRepRole] = useState("");
  
  const [wizardStep, setWizardStep] = useState(1);
  const [maxWizardStep, setMaxWizardStep] = useState(1);
  const [attachments, setAttachments] = useState<{id: string, name: string, category: string, status: string}[]>([]);
  
  // Prospect specific
  const [prospectRequestType, setProspectRequestType] = useState("Proforma demandée");
  const [prospectDomain, setProspectDomain] = useState("Hahitantsoa");
  const [prospectDate, setProspectDate] = useState("");
  const [prospectBudget, setProspectBudget] = useState("");
  const [prospectNote, setProspectNote] = useState("");
  const [prospectProforma, setProspectProforma] = useState(true);
  const [prospectDispo, setProspectDispo] = useState(false);
  const [prospectRelanceType, setProspectRelanceType] = useState("appel");
  const [prospectRelanceDate, setProspectRelanceDate] = useState("");
  const [prospectRelanceNote, setProspectRelanceNote] = useState("");
  
  // Proforma mock state
  const [profObjet, setProfObjet] = useState("");
  const [profElements, setProfElements] = useState("");
  const [profAmount, setProfAmount] = useState("");
  const [profStatus, setProfStatus] = useState("Brouillon");

  const filters = ["Tous", "Prospects", "Clients", "Particuliers", "Entreprises", "Avec solde restant", "Avec dossier actif", "À relancer"];

  const filteredClients = mockClients.filter(c => {
    // Text search
    const q = searchQuery.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || 
                        c.email.toLowerCase().includes(q) || 
                        c.phone.toLowerCase().includes(q) ||
                        c.id.toLowerCase().includes(q);
    if (!matchSearch) return false;

    // Filters
    if (filterType === "Prospects" && c.status !== "Prospect") return false;
    if (filterType === "Clients" && c.status !== "Client") return false;
    if (filterType === "Particuliers" && c.type !== "Particulier") return false;
    if (filterType === "Entreprises" && c.type !== "Entreprise") return false;
    
    // Derived filters
    const clientReservations = mockReservations.filter(r => r.clientId === c.id);
    
    if (filterType === "Avec solde restant") {
      const hasBalance = clientReservations.some(r => r.amount > (r.paidAmount || 0));
      if (!hasBalance) return false;
    }
    
    if (filterType === "Avec dossier actif") {
      const hasActive = clientReservations.some(r => !["Terminée", "Annulée"].includes(r.status));
      if (!hasActive) return false;
    }
    
    // À relancer is just mock logic, we'll say prospects are to be re-contacted
    if (filterType === "À relancer" && c.status !== "Prospect") return false;

    return true;
  });

  const goNextStep = () => {
    setWizardStep(s => {
      const next = s + 1;
      setMaxWizardStep(max => Math.max(max, next));
      return next;
    });
  };
  const goPrevStep = () => setWizardStep(s => s - 1);

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName && !newRepName) return;

    const finalName = newType === "Particulier" ? newName : (newName || newRepName);
    const initials = (finalName || "A").substring(0, 2).toUpperCase();
    const isProspect = newStatus === "Prospect";
    const id = `${isProspect ? 'PROS' : 'CUST'}-${Math.floor(100 + Math.random() * 900)}`;
    
    const colorClass = isProspect ? "bg-blue-100 text-blue-700" : (newType === "Particulier" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700");

    const newClient: Client = {
      id,
      initials,
      name: finalName,
      email: newEmail,
      phone: newPhone,
      type: newType,
      status: newStatus,
      colorClass,
      address: newAddress,
      idNumber: newIdNumber,
      idType: newIdType,
      idIssuePlace: newIdIssuePlace,
      idIssueDate: newIdIssueDate,
      idDuplicataDate: newIdDuplicataDate,
      idDuplicataPlace: newIdDuplicataPlace,
      nif: newNif,
      stat: newStat,
      rcs: newRcs,
      repLastName: newRepName,
      repRole: newRepRole,
      civilite: newCivilite,
      birthDate: newBirthDate,
      // We can also add prospect specific notes to notes if it's a prospect
      notes: isProspect ? `Demande : ${prospectRequestType}\nVolet : ${prospectDomain}\nDate : ${prospectDate}\nBudget : ${prospectBudget}\nNote : ${prospectNote}` : newNotes
    };

    addMockClient(newClient);

    if (canSensitiveWrite && isProspect && prospectRequestType === "Proforma demandée") {
      // Redirect to ReservationNewPage with prospect-proforma param
      const path = prospectDomain === "Titan Rental" ? "prospect-proforma-t" : "prospect-proforma-h";
      setIsAdding(false);
      onNavigate('reservation-new', `${path}/${id}`);
      return;
    }

    setIsAdding(false);
    
    // Optionally open the detail page for the newly created client
    onNavigate("customer", id);
  };

  const renderWizard = () => {
    const isProspect = newStatus === "Prospect";
    
    let prospectSteps: {id: number, title: string, type: string}[] = [];
    if (isProspect) {
      prospectSteps.push({id: 1, title: "Type de prospect", type: "type"});
      prospectSteps.push({id: 2, title: "Coordonnées", type: "coordonnees"});
      prospectSteps.push({id: 3, title: "Demande commerciale", type: "demande"});
      
      let nextId = 4;
      if (prospectRequestType === "Disponibilité demandée") {
        prospectSteps.push({id: nextId++, title: "Calendrier disponibilité", type: "calendrier"});
      } else if (prospectRequestType === "Visite demandée") {
        prospectSteps.push({id: nextId++, title: "Agenda visite", type: "visite"});
      } else if (prospectRequestType === "Autre") {
        prospectSteps.push({id: nextId++, title: "Notes", type: "notes"});
      }
      
      if (prospectRequestType !== "Proforma demandée") {
        prospectSteps.push({id: nextId++, title: "Relance", type: "relance"});
        prospectSteps.push({id: nextId++, title: "Résumé", type: "resume"});
      }
    }
    
    const steps = isProspect ? prospectSteps.map(s => s.id) : [1, 2, 3, 4, 5];
    const getStepTitle = (s: number) => {
      if (isProspect) {
        return prospectSteps.find(step => step.id === s)?.title || "";
      } else {
        if (s === 1) return "Type de client";
        if (s === 2) return "Identité / Coordonnées";
        if (s === 3) return "Informations légales";
        if (s === 4) return "Pièces jointes";
        if (s === 5) return "Résumé";
      }
      return "";
    };
    
    const getStepType = (s: number) => {
      if (isProspect) {
        return prospectSteps.find(step => step.id === s)?.type || "";
      }
      return "";
    };

    return (
      <div className="page active max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setIsAdding(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Création {isProspect ? "Prospect" : "Client"}</h2>
            <p className="text-sm text-slate-500">Assistant de création étape par étape</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4 text-sm scrollbar-hide">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div 
                className={`flex items-center space-x-2 shrink-0 ${maxWizardStep >= s ? 'cursor-pointer hover:opacity-80' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => { if (s <= maxWizardStep) setWizardStep(s); }}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${wizardStep === s ? 'bg-indigo-600 text-white shadow-md' : maxWizardStep >= s ? 'bg-green-500 text-white hover:bg-green-600' : 'border-2 border-slate-300 text-slate-500'} font-bold transition-all`}>
                  {wizardStep === s ? s : (maxWizardStep >= s ? <i className="fa-solid fa-check"></i> : s)}
                </div>
                <span className={`font-semibold ${wizardStep === s ? 'text-slate-900' : maxWizardStep >= s ? 'text-green-600 hover:text-green-700' : 'text-slate-500'} hidden md:inline-block`}>{getStepTitle(s)}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 min-w-[10px] md:mx-4 md:min-w-[20px] ${s < maxWizardStep ? 'bg-green-500' : 'bg-slate-200'} transition-colors`}></div>}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          {/* TYPE */}
          {(isProspect ? getStepType(wizardStep) === 'type' : wizardStep === 1) && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Sélectionnez le type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${newType === 'Particulier' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`} onClick={() => setNewType('Particulier')}>
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-user text-indigo-600 text-xl"></i>
                    <h4 className="font-bold text-slate-800">Particulier</h4>
                  </div>
                  <p className="text-sm text-slate-600">Personne physique avec CIN ou passeport.</p>
                </div>
                <div className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${newType === 'Entreprise' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`} onClick={() => setNewType('Entreprise')}>
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-building text-indigo-600 text-xl"></i>
                    <h4 className="font-bold text-slate-800">Entreprise</h4>
                  </div>
                  <p className="text-sm text-slate-600">Société, association, avec NIF/STAT.</p>
                </div>
              </div>
            </div>
          )}

          {/* COORDONNÉES */}
          {(isProspect ? getStepType(wizardStep) === 'coordonnees' : wizardStep === 2) && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Identité / Coordonnées</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {newType === "Particulier" ? (
                  <>
                    {!isProspect && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Civilité</label>
                        <select value={newCivilite} onChange={e => setNewCivilite(e.target.value as "Monsieur" | "Madame" | "")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">Sélectionner</option>
                          <option value="Monsieur">Monsieur (Mr)</option>
                          <option value="Madame">Madame (Mme)</option>
                        </select>
                      </div>
                    )}
                    <div className={isProspect ? "sm:col-span-2" : ""}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                      <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Rakoto Jean" />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Raison sociale</label>
                    <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nom de l'entreprise" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{newType === "Entreprise" ? "Téléphone Pro" : "Téléphone"}</label>
                  <input required type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: 034 00 000 00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{newType === "Entreprise" ? "Email Pro" : "Email"}</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="contact@email.com" />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
                  <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Adresse complète" />
                </div>
                
                {!isProspect && newType === "Particulier" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date de naissance</label>
                    <input type="date" value={newBirthDate} onChange={e => setNewBirthDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}

                {newType === "Entreprise" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom du représentant</label>
                      <input type="text" value={newRepName} onChange={e => setNewRepName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nom du responsable" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Qualité du représentant</label>
                      <input type="text" value={newRepRole} onChange={e => setNewRepRole(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Gérant" />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* DEMANDE COMMERCIALE / INFOS LÉGALES */}
          {(isProspect ? getStepType(wizardStep) === 'demande' : wizardStep === 3) && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">{isProspect ? "Demande commerciale" : "Informations légales"}</h3>
              {isProspect ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Demande actuelle</label>
                    <select value={prospectRequestType} onChange={e => {
                        setProspectRequestType(e.target.value);
                        if (e.target.value === 'Proforma demandée' && prospectDomain === 'Indécis') {
                          setProspectDomain('Hahitantsoa');
                        }
                        // Reset maxWizardStep to current step if we change path-affecting variables
                        if (maxWizardStep > wizardStep) setMaxWizardStep(wizardStep);
                      }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Proforma demandée">Proforma demandée</option>
                      <option value="Disponibilité demandée">Disponibilité demandée</option>
                      <option value="Visite demandée">Visite demandée</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Volet d'intérêt</label>
                    <select value={prospectDomain} onChange={e => setProspectDomain(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Hahitantsoa">Hahitantsoa</option>
                      <option value="Titan Rental">Titan Rental</option>
                      {prospectRequestType !== 'Proforma demandée' && <option value="Indécis">Indécis</option>}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note de besoin</label>
                    <textarea value={prospectNote} onChange={e => setProspectNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={3} placeholder="Détails de la demande..."></textarea>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {newType === "Particulier" ? (
                    <>
                      <div className="sm:col-span-2 flex gap-4">
                        <div className="w-1/3">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Type de pièce</label>
                          <select value={newIdType} onChange={e => setNewIdType(e.target.value as "CIN" | "Passeport")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="CIN">CIN</option>
                            <option value="Passeport">Passeport</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Numéro</label>
                          <input type="text" value={newIdNumber} onChange={e => setNewIdNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Numéro de la pièce" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Délivré le</label>
                        <input type="date" value={newIdIssueDate} onChange={e => setNewIdIssueDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Délivré à</label>
                        <input type="text" value={newIdIssuePlace} onChange={e => setNewIdIssuePlace(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Lieu de délivrance" />
                      </div>
                      
                      <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-4">Duplicata (optionnel)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata du (Date)</label>
                            <input type="date" value={newIdDuplicataDate} onChange={e => setNewIdDuplicataDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata à (Lieu)</label>
                            <input type="text" value={newIdDuplicataPlace} onChange={e => setNewIdDuplicataPlace(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Lieu du duplicata" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">NIF</label>
                        <input type="text" value={newNif} onChange={e => setNewNif(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="NIF" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">STAT</label>
                        <input type="text" value={newStat} onChange={e => setNewStat(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="STAT" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">RCS</label>
                        <input type="text" value={newRcs} onChange={e => setNewRcs(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="RCS" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* CALENDRIER DISPONIBILITÉ (Prospect uniquement) */}
          {(isProspect && getStepType(wizardStep) === 'calendrier') && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Calendrier de disponibilité</h3>
              <MockAvailabilityCalendar 
                selectedDate={prospectDate} 
                onDateSelect={setProspectDate}
              />
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
                <div className="text-center">
                  <button type="button" className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 text-sm">
                    Vérifier disponibilité mock
                  </button>
                  {prospectDate && (
                    <p className="text-xs text-emerald-600 font-bold mt-2">Date demandée : {prospectDate} — disponible en mock.</p>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <input type="checkbox" id="checkDispo2" checked={prospectDispo} onChange={e => setProspectDispo(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                  <label htmlFor="checkDispo2" className="text-sm font-medium text-slate-700">Enregistrer cette disponibilité pour le prospect</label>
                </div>
              </div>
            </div>
          )}

          {/* VISITE (Prospect uniquement) */}
          {(isProspect && getStepType(wizardStep) === 'visite') && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Agenda Visite</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Choisir une date</label>
                  <MockAvailabilityCalendar selectedDate={prospectDate} onDateSelect={setProspectDate} />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Créneau horaire</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["09:00", "10:30", "14:00", "15:30", "17:00"].map(time => (
                        <button key={time} type="button" onClick={() => setProspectNote(prev => prev ? prev.replace(/Heure: .*\n?/, '') + `\nHeure: ${time}` : `Heure: ${time}`)} className={`py-2 rounded-lg border text-sm font-medium ${prospectNote.includes(time) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Motif de visite</label>
                    <input type="text" value={profObjet} onChange={e => setProfObjet(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ex: Repérage salle" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lieu de visite</label>
                    <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option>Salle des fêtes principale (Hahitantsoa)</option>
                      <option>Jardin (Hahitantsoa)</option>
                      <option>Dépôt matériel</option>
                      <option>Bureau</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Moyen de contact</label>
                    <select value={prospectRelanceType} onChange={e => setProspectRelanceType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option value="visite_directe">Visite directe</option>
                      <option value="appel">Appel</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-sm font-bold text-slate-800 mb-2">Résumé contact</h4>
                    <ul className="text-xs text-slate-600 space-y-1">
                      <li>Nom : {newName || newRepName || "-"}</li>
                      <li>Téléphone : {newPhone || "-"}</li>
                      <li>Email : {newEmail || "-"}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTES (Prospect uniquement) */}
          {(isProspect && getStepType(wizardStep) === 'notes') && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Notes et Informations Générales</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Détails de la demande</label>
                <textarea value={prospectNote} onChange={e => setProspectNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={4} placeholder="Saisissez toutes les informations fournies par le prospect..."></textarea>
              </div>
            </div>
          )}

          {/* PIÈCES JOINTES (Client uniquement) */}
          {(!isProspect && wizardStep === 4) && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Pièces jointes</h3>
              {isProspect ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="checkProforma" checked={prospectProforma} onChange={e => setProspectProforma(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                    <label htmlFor="checkProforma" className="text-sm font-medium text-slate-700">Créer une proforma mock liée à ce prospect</label>
                  </div>
                  <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
                    La création de proforma ne convertit pas le prospect en client. Le prospect restera dans l'état "Prospect" jusqu'à confirmation explicite.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select id="attCategory" className="border border-slate-300 rounded-lg p-2 text-sm bg-white min-w-[150px]">
                      <option value="CIN">CIN / Passeport</option>
                      <option value="NIF">NIF / STAT</option>
                      <option value="Domicile">Justificatif domicile</option>
                      <option value="Autre">Autre</option>
                    </select>
                    <input type="file" id="attFile" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    <button 
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-100"
                      onClick={() => {
                        const cat = (document.getElementById('attCategory') as HTMLSelectElement).value;
                        const f = document.getElementById('attFile') as HTMLInputElement;
                        if (f.files?.length) {
                          setAttachments([...attachments, { id: Math.random().toString(), name: f.files[0].name, category: cat, status: 'Présent' }]);
                          f.value = "";
                        }
                      }}
                    >
                      Ajouter
                    </button>
                  </div>
                  {attachments.length > 0 && (
                    <ul className="space-y-2 mt-4">
                      {attachments.map(a => (
                        <li key={a.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <span className="font-semibold text-slate-700 text-sm">{a.category}</span>
                            <span className="text-slate-500 text-xs ml-2">{a.name}</span>
                          </div>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md font-semibold">{a.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RELANCE (Prospect uniquement) */}
          {(isProspect && getStepType(wizardStep) === 'relance') && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Relance commerciale</h3>
              {isProspect ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type de relance</label>
                    <select value={prospectRelanceType} onChange={e => setProspectRelanceType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="appel">Appel téléphonique</option>
                      <option value="visite">Visite client</option>
                      <option value="message">Email / Message</option>
                      <option value="rdv">Rendez-vous physique</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prochaine relance le</label>
                    <input type="date" value={prospectRelanceDate} onChange={e => setProspectRelanceDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note pour la relance</label>
                    <textarea value={prospectRelanceNote} onChange={e => setProspectRelanceNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={2}></textarea>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* RÉSUMÉ (Client et Prospect) */}
          {((isProspect && getStepType(wizardStep) === 'resume') || (!isProspect && wizardStep === 5)) && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Résumé</h3>
              {!isProspect ? (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4 text-sm text-slate-700">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Type</span>
                    <span>Client {newType}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Nom</span>
                    <span>{newName || newRepName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Contact</span>
                    <span>{newPhone} | {newEmail || "Non renseigné"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Pièces jointes</span>
                    <span>{attachments.length} document(s)</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4 text-sm text-slate-700">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Nom</span>
                    <span>{newName || newRepName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Demande</span>
                    <span>{prospectRequestType} ({prospectDomain})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold">Actions</span>
                    <span>{prospectProforma ? 'Proforma mock ' : ''}{prospectDispo ? 'Dispo mock ' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Relance</span>
                    <span>{prospectRelanceType} le {prospectRelanceDate || "non planifié"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm disabled:opacity-30" onClick={goPrevStep} disabled={wizardStep === 1}>Retour</button>
            {wizardStep < steps.length ? (
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm disabled:opacity-50" onClick={goNextStep} disabled={!newName && wizardStep === 2}>
                Continuer
              </button>
            ) : (
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm" onClick={() => handleCreate()}>
                {isProspect && prospectRequestType === 'Proforma demandée' ? "Créer prospect et préparer proforma" : `Créer le ${isProspect ? "prospect" : "client"}`}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isAdding) {
    return renderWizard();
  }

  return (
    <div className="page active space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients & Prospects</h2>
          <p className="text-sm text-slate-500">{mockClients.length} fiches enregistrées</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Rechercher nom, tel, ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" 
            />
          </div>
          <button onClick={() => { setIsAdding(true); setNewStatus("Prospect"); }} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors" title="Prospect : contact à suivre avant réservation.">
            Nouveau prospect
          </button>
          <button onClick={() => { setIsAdding(true); setNewStatus("Client"); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors" title="Client : contact pouvant être lié à un dossier, contrat, facture ou paiement.">
            Nouveau client
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button 
            key={f} 
            onClick={() => setFilterType(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filterType === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase bg-slate-50">
              <th className="text-left px-4 py-3 rounded-l-lg">Contact</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Dernier dossier</th>
              <th className="text-left px-4 py-3">Solde / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">Aucun résultat trouvé.</td>
              </tr>
            )}
            {filteredClients.map(client => {
              const clientReservations = mockReservations.filter(r => r.clientId === client.id);
              const lastRes = clientReservations.length > 0 ? clientReservations[clientReservations.length - 1] : null;
              
              const totalAmount = clientReservations.reduce((acc, r) => acc + r.amount, 0);
              const totalPaid = clientReservations.reduce((acc, r) => acc + (r.paidAmount || 0), 0);
              const balance = totalAmount - totalPaid;

              return (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <button onClick={() => onNavigate("customer", client.id)} className="flex items-center gap-3 group text-left">
                      <div className={`w-9 h-9 rounded-full ${client.colorClass} flex items-center justify-center font-semibold text-xs`}>{client.initials}</div>
                      <div>
                        <div className="font-medium text-slate-900 group-hover:text-indigo-600 group-hover:underline">{client.name}</div>
                        <div className="text-xs text-slate-500">{client.email || client.phone}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-600">{client.type}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${client.status === 'Prospect' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {lastRes ? (
                      <button onClick={() => onNavigate("reservation-detail", lastRes.id)} className="text-left group">
                        <div className="text-slate-700 font-medium group-hover:text-indigo-600 group-hover:underline">{lastRes.id}</div>
                        <div className="text-xs text-slate-500">{lastRes.title}</div>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Aucun dossier</span>
                    )}
                  </td>
                  <td className="px-4 py-4 rounded-r-lg">
                    {balance > 0 ? (
                      <div className="text-amber-600 font-medium text-xs">Reste : {balance.toLocaleString('fr-FR')} Ar</div>
                    ) : client.status === 'Prospect' ? (
                      <div className="text-blue-600 font-medium text-xs">À relancer</div>
                    ) : (
                      <div className="text-green-600 font-medium text-xs">À jour</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>


    </div>
  );
}
