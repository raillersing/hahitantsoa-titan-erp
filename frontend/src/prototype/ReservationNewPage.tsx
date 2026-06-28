import React, { useState, useEffect } from "react";
import { 
  mockClients, Client, hahitantsoaRentalTypes, hahitantsoaDurationOptions, 
  hahitantsoaEventTypes, hahitantsoaDefaultDepositAmount, 
  titanDepositThreshold, titanSmallRentalDeposit, titanLargeRentalDepositRate,
  hahitantsoaMockPackages, mockCatalog, hahitantsoaMockServices,
  hahitantsoaMockVenuePrice, hahitantsoaMockLogisticsPrice,
  titanUsageTypes, titanMovementModes, titanDefaultAdvanceRate, titanTransportRequirement,
  titanBalanceDueDaysBeforePickup
} from "./mockData";
import { DocumentPreview } from "./DocumentPreview";

interface ReservationNewPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
}

type PathType = "client_first" | "domain_first" | null;
type DomainType = "hahitantsoa" | "titan" | null;

interface NewClientData {
  name: string;
  phone: string;
  email: string;
  type: "Particulier" | "Entreprise";
  notes: string;
  civilite?: "Monsieur" | "Madame" | "";
  birthDate?: string;
  birthPlace?: string;
  idType?: "CIN" | "Passeport";
  idNumber?: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  idDuplicataDate?: string;
  idDuplicataPlace?: string;
  address?: string;
  nif?: string;
  stat?: string;
  rcs?: string;
  repFirstName?: string;
  repRole?: string;
}

interface HahitantsoaDetails {
  eventType: string;
  eventTypeOther?: string;
  date: string;
  venue: string;
  guests: string;
  remarks: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  rentalType: string;
  durationOption: string;
  durationOptionPrice: number;
  packageId?: string;
  
  mariageGroomName?: string;
  mariageBrideName?: string;
  mariageReferentName?: string;
  
  fiancaillesPerson1?: string;
  fiancaillesPerson2?: string;
  
  baptemeChildName?: string;
  baptemeParentName?: string;
  baptemeDate?: string;
  
  otherReferentName?: string;
  
  venuePrice: number;
  logisticsPrice: number;
  packageMode?: 'package' | 'free';
}

interface TitanDetails {
  period: string; // Keep for fallback
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  pickupDate: string;
  returnDate: string;
  remarks: string;
  usageType: string;
  usageTypeOther: string;
  destinationLocation: string;
  destinationAddress: string;
  destinationContact: string;
  accessNote: string;
  movementMode: string;
  deliveryTime: string;
  returnTime: string;
  deliveryAddress: string;
  pickupTime: string;
  clientReturnTime: string;
  vehicleType: string;
  transportPerson: string;
  advanceRate: number;
  obligationsAccepted: boolean;
  returnConditionsAccepted: boolean;
  transportConditionAccepted: boolean;
}

interface PaymentData {
  method: string;
  amount: string;
  percent: string;
}

interface Attachment {
  id: string;
  name: string;
  category: string;
}

interface SelectedMaterial {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SelectedService {
  id: string;
  name: string;
  price: number;
}



export default function ReservationNewPage({ onNavigate, param }: ReservationNewPageProps) {
  // State
  const [path, setPath] = useState<PathType>(null);
  const [step, setStep] = useState<number>(0);
  const [maxReachedStep, setMaxReachedStep] = useState<number>(0);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newClient, setNewClient] = useState<NewClientData>({ name: "", phone: "", email: "", type: "Particulier", notes: "", civilite: "", idType: "CIN" });
  
  const [domain, setDomain] = useState<DomainType>(null);
  
  const [hDetails, setHDetails] = useState<HahitantsoaDetails>({ eventType: "", eventTypeOther: "", date: "", venue: "", guests: "", remarks: "", startDate: "", startTime: "", endDate: "", endTime: "", rentalType: "Location nue + logistique", durationOption: "", durationOptionPrice: 0, venuePrice: hahitantsoaMockVenuePrice, logisticsPrice: hahitantsoaMockLogisticsPrice });
  const [tDetails, setTDetails] = useState<TitanDetails>({ 
    period: "", startDate: "", startTime: "", endDate: "", endTime: "", pickupDate: "", returnDate: "", remarks: "",
    usageType: "Mariage", usageTypeOther: "", destinationLocation: "", destinationAddress: "", destinationContact: "", accessNote: "",
    movementMode: "Livraison par Titan", deliveryTime: "", returnTime: "", deliveryAddress: "",
    pickupTime: "", clientReturnTime: "", vehicleType: "", transportPerson: "", advanceRate: titanDefaultAdvanceRate,
    obligationsAccepted: false, returnConditionsAccepted: false, transportConditionAccepted: false
  });
  
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<string>("");

  const [payment, setPayment] = useState<PaymentData>({ method: "Espèces", amount: "", percent: "50" });
  
  const [proformaValidity, setProformaValidity] = useState<number>(15);
  const [proformaGenerated, setProformaGenerated] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [clientAttachments, setClientAttachments] = useState<Attachment[]>([]);
  const [paymentAttachments, setPaymentAttachments] = useState<Attachment[]>([]);

  // Init from URL param if needed
  useEffect(() => {
    if (param === 'hahitantsoa' || param === 'titan') {
      setPath('domain_first');
      setDomain(param as DomainType);
      setStep(2); // Domain is known (step 1 in domain_first is domain, step 2 is client)
      setMaxReachedStep(2);
    }
  }, [param]);

  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountIsPercentage, setDiscountIsPercentage] = useState<boolean>(true);

  // Draft persistence
  const saveDraft = () => {
    const draft = {
      path, step, maxReachedStep, clientMode, selectedClientId, newClient, domain,
      hDetails, tDetails, selectedMaterials, selectedServices, deliveryFee, payment, clientAttachments,
      discountValue, discountIsPercentage
    };
    localStorage.setItem("prototypeReservationDraft", JSON.stringify(draft));
    alert("Brouillon sauvegardé localement !");
  };

  const restoreDraft = () => {
    const saved = localStorage.getItem("prototypeReservationDraft");
    if (saved) {
      const data = JSON.parse(saved);
      setPath(data.path); setStep(data.step); setMaxReachedStep(data.maxReachedStep);
      setClientMode(data.clientMode); setSelectedClientId(data.selectedClientId); setNewClient(data.newClient);
      setDomain(data.domain); setHDetails(data.hDetails); setTDetails(data.tDetails);
      setSelectedMaterials(data.selectedMaterials || []); setSelectedServices(data.selectedServices || []);
      setDeliveryFee(data.deliveryFee || ""); setPayment(data.payment); setClientAttachments(data.clientAttachments || []);
      setDiscountValue(data.discountValue || 0); setDiscountIsPercentage(data.discountIsPercentage ?? true);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem("prototypeReservationDraft");
    window.location.reload();
  };

  const addAttachment = (type: 'client' | 'payment', category: string, fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const newAtt: Attachment = { id: Math.random().toString(36).substring(7), name: fileList[0].name, category };
    if (type === 'client') setClientAttachments([...clientAttachments, newAtt]);
    else setPaymentAttachments([...paymentAttachments, newAtt]);
  };
  const removeAttachment = (type: 'client' | 'payment', id: string) => {
    if (type === 'client') setClientAttachments(clientAttachments.filter(a => a.id !== id));
    else setPaymentAttachments(paymentAttachments.filter(a => a.id !== id));
  };

  const activeClient: Client | null = clientMode === "existing" && selectedClientId 
    ? mockClients.find(c => c.id === selectedClientId) || null
    : clientMode === "new" && newClient.name 
      ? { 
          id: "NEW", 
          initials: newClient.name.substring(0, 2).toUpperCase(), 
          name: newClient.name, 
          phone: newClient.phone, 
          email: newClient.email, 
          type: newClient.type, 
          colorClass: "bg-slate-100 text-slate-700",
          civilite: newClient.civilite,
          firstName: newClient.type === 'Particulier' ? newClient.name.split(' ')[0] : undefined,
          lastName: newClient.type === 'Particulier' ? newClient.name.split(' ').slice(1).join(' ') : undefined,
          birthDate: newClient.birthDate,
          birthPlace: newClient.birthPlace,
          idType: newClient.idType,
          idNumber: newClient.idNumber,
          idIssueDate: newClient.idIssueDate,
          idIssuePlace: newClient.idIssuePlace,
          idDuplicataDate: newClient.idDuplicataDate,
          idDuplicataPlace: newClient.idDuplicataPlace,
          address: newClient.address,
          nif: newClient.nif,
          stat: newClient.stat,
          rcs: newClient.rcs,
          repFirstName: newClient.repFirstName,
          repRole: newClient.repRole
        } 
      : null;

  const servicesTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const deliveryTotal = domain === 'titan' && deliveryFee ? parseInt(deliveryFee, 10) : 0;
  const durationTotal = domain === 'hahitantsoa' ? (hDetails.durationOptionPrice || 0) : 0;
  
  let venueAndLogisticsTotal = 0;
  if (domain === 'hahitantsoa') {
    venueAndLogisticsTotal += hDetails.venuePrice || 0;
    if (hDetails.rentalType === 'Location nue + logistique') {
      venueAndLogisticsTotal += hDetails.logisticsPrice || 0;
    }
  }

  let packageTotal = 0;
  let materialsTotal = 0;
  
  if (domain === 'hahitantsoa' && hDetails.rentalType === 'Location avec package' && hDetails.packageId) {
    const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
    if (pkg) {
      packageTotal = pkg.price;
      // Calculate extra cost/discount based on qty diff
      materialsTotal = selectedMaterials.reduce((acc, m) => {
        const pkgArt = pkg.articles.find(a => a.id === m.id);
        const pkgQty = pkgArt ? pkgArt.qty : 0;
        const diffQty = m.quantity - pkgQty;
        return acc + (diffQty * m.price);
      }, 0);
      // Need to subtract items removed from package that are completely missing from selectedMaterials
      pkg.articles.forEach(pkgArt => {
        if (!selectedMaterials.find(m => m.id === pkgArt.id)) {
          const catItem = mockCatalog.find(c => c.id === pkgArt.id);
          if (catItem) {
            materialsTotal -= (pkgArt.qty * catItem.price);
          }
        }
      });
    }
  } else {
    materialsTotal = selectedMaterials.reduce((acc, m) => acc + (m.price * m.quantity), 0);
  }

  const subTotalAmount = venueAndLogisticsTotal + packageTotal + materialsTotal + servicesTotal + deliveryTotal + durationTotal;
  const discountAmount = discountIsPercentage ? subTotalAmount * (discountValue / 100) : discountValue;
  const totalAmount = Math.max(0, subTotalAmount - discountAmount);

  // Navigation
  const goNext = () => {
    let nextStep = step + 1;
    if (step === 3 && domain === 'hahitantsoa' && (hDetails.rentalType === 'Location nue' || hDetails.rentalType === 'Location nue + logistique')) {
      nextStep = 5; // Skip catalog
    }
    setStep(nextStep);
    setMaxReachedStep(Math.max(maxReachedStep, nextStep));
  };
  const goBack = () => {
    let prevStep = step - 1;
    if (step === 5 && domain === 'hahitantsoa' && (hDetails.rentalType === 'Location nue' || hDetails.rentalType === 'Location nue + logistique')) {
      prevStep = 3;
    }
    setStep(Math.max(0, prevStep));
  };
  const jumpTo = (targetStep: number) => {
    if (targetStep <= maxReachedStep) setStep(targetStep);
  };

  const getStepTitle = (idx: number) => {
    if (idx === 0) return "Départ";
    if (path === "client_first") {
      if (idx === 1) return "Client";
      if (idx === 2) return "Volet";
    } else {
      if (idx === 1) return "Volet";
      if (idx === 2) return "Client";
    }
    if (idx === 3) return "Détails";
    if (idx === 4) return "Catalogue";
    if (idx === 5) return domain === "hahitantsoa" ? "Services" : "Livraison";
    if (idx === 6) return "Résumé";
    if (idx === 7) return "Devis";
    if (idx === 8) return "Paiement";
    if (idx === 9) return "Contrat";
    return "";
  };

  const renderStepper = () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return (
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4 text-sm scrollbar-hide">
        {steps.map((s, i) => {
          const isActive = step === s;
          const isReached = s <= maxReachedStep;
          const isClickable = isReached;
          return (
            <React.Fragment key={s}>
              <div 
                className={`flex items-center space-x-2 shrink-0 ${isClickable ? 'cursor-pointer hover:opacity-80' : 'opacity-40'} transition-opacity`}
                onClick={() => isClickable && jumpTo(s)}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-indigo-600 text-white shadow-md' : isReached ? 'bg-green-500 text-white' : 'border-2 border-slate-300 text-slate-500'} font-bold transition-all`}>
                  {isReached && !isActive ? <i className="fa-solid fa-check"></i> : s}
                </div>
                <span className={`font-semibold ${isActive ? 'text-slate-900' : isReached ? 'text-green-600' : 'text-slate-500'} hidden md:inline-block`}>{getStepTitle(s)}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 min-w-[10px] md:mx-4 md:min-w-[20px] ${s < maxReachedStep ? 'bg-green-500' : 'bg-slate-200'} transition-colors`}></div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderStep0 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-slate-800 text-center flex-1">Comment voulez-vous commencer ?</h3>
        {localStorage.getItem("prototypeReservationDraft") && (
           <button onClick={restoreDraft} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">
             Reprendre le brouillon
           </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="bg-white rounded-2xl border-2 border-transparent hover:border-indigo-300 p-8 shadow-sm cursor-pointer transition-all hover:shadow-md text-center"
          onClick={() => { setPath("client_first"); goNext(); }}
        >
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto mb-4">
            <i className="fa-solid fa-user"></i>
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">Commencer par le client</h4>
          <p className="text-sm text-slate-500">Le client vous contacte et vous identifiez d'abord son profil avant de définir le besoin.</p>
        </div>
        <div 
          className="bg-white rounded-2xl border-2 border-transparent hover:border-indigo-300 p-8 shadow-sm cursor-pointer transition-all hover:shadow-md text-center"
          onClick={() => { setPath("domain_first"); goNext(); }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-4">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <h4 className="text-lg font-bold text-slate-800 mb-2">Commencer par le volet</h4>
          <p className="text-sm text-slate-500">Vous savez déjà s'il s'agit d'une location Titan ou d'un événement Hahitantsoa.</p>
        </div>
      </div>
    </div>
  );

  const renderClientStep = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Sélection ou création du client</h3>
      {param && (
        <div className="bg-indigo-50 text-indigo-700 text-sm p-3 rounded-lg mb-6 border border-indigo-200 flex items-center gap-2">
          <i className="fa-solid fa-lock text-indigo-400"></i>
          Volet sélectionné : <strong>{param === 'hahitantsoa' ? 'Hahitantsoa' : 'Titan Rental'}</strong>
        </div>
      )}
      <div className="flex gap-4 mb-6">
        <button 
          className={`px-4 py-2 rounded-lg text-sm font-medium ${clientMode === 'existing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-600 border border-transparent'}`}
          onClick={() => setClientMode("existing")}
        >
          Client existant
        </button>
        <button 
          className={`px-4 py-2 rounded-lg text-sm font-medium ${clientMode === 'new' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-600 border border-transparent'}`}
          onClick={() => setClientMode("new")}
        >
          Nouveau client
        </button>
      </div>

      {clientMode === "existing" ? (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Choisir dans la base mockée</label>
          <select 
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
          >
            <option value="">-- Sélectionner --</option>
            {mockClients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.type} onChange={e => setNewClient({...newClient, type: e.target.value as any})}>
                <option value="Particulier">Particulier</option>
                <option value="Entreprise">Entreprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (optionnel)</label>
              <input type="email" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="email@domaine.mg" />
            </div>
          </div>
          
          {newClient.type === "Particulier" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-2">
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Civilité</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.civilite || ''} onChange={e => setNewClient({...newClient, civilite: e.target.value as any})}>
                    <option value="">-</option>
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Ex: Jean Dupont" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="+261..." />
              </div>
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Né(e) le</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.birthDate || ''} onChange={e => setNewClient({...newClient, birthDate: e.target.value})} />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Né(e) à</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.birthPlace || ''} onChange={e => setNewClient({...newClient, birthPlace: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pièce</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idType || 'CIN'} onChange={e => setNewClient({...newClient, idType: e.target.value as any})}>
                    <option value="CIN">CIN</option>
                    <option value="Passeport">Passeport</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numéro</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idNumber || ''} onChange={e => setNewClient({...newClient, idNumber: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Délivrée le</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idIssueDate || ''} onChange={e => setNewClient({...newClient, idIssueDate: e.target.value})} />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Délivrée à</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idIssuePlace || ''} onChange={e => setNewClient({...newClient, idIssuePlace: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata du (opt.)</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idDuplicataDate || ''} onChange={e => setNewClient({...newClient, idDuplicataDate: e.target.value})} />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata à (opt.)</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.idDuplicataPlace || ''} onChange={e => setNewClient({...newClient, idDuplicataPlace: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Adresse / Demeurant à</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.address || ''} onChange={e => setNewClient({...newClient, address: e.target.value})} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'entreprise</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Ex: Ergon Group" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="+261..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIF</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.nif || ''} onChange={e => setNewClient({...newClient, nif: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">STAT</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.stat || ''} onChange={e => setNewClient({...newClient, stat: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">RCS</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.rcs || ''} onChange={e => setNewClient({...newClient, rcs: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom et prénom du représentant</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.repFirstName || ''} onChange={e => setNewClient({...newClient, repFirstName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qualité du représentant</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={newClient.repRole || ''} onChange={e => setNewClient({...newClient, repRole: e.target.value})} placeholder="Ex: Gérant" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-slate-100">
        <h4 className="text-md font-bold text-slate-800 mb-1">Pièces jointes client</h4>
        <p className="text-xs text-slate-500 mb-4">Ajoutez CIN, NIF, STAT, RCS ou justificatifs selon le type de client. (Mock/Simulation)</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
           <select id="clientCat" className="border border-slate-300 rounded-lg p-2 text-sm bg-white min-w-[150px]">
             <option value="CIN">CIN</option>
             <option value="NIF">NIF</option>
             <option value="STAT">STAT</option>
             <option value="RCS">RCS</option>
             <option value="Logo">Logo</option>
             <option value="Pièce jointe email">Pièce jointe email</option>
             <option value="Autre">Autre</option>
           </select>
           <input type="file" id="clientFile" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" accept=".jpg,.jpeg,.png,.webp,.pdf" />
           <input type="file" id="clientCamera" className="hidden" accept="image/*" capture="environment" onChange={(e) => {
               const cat = (document.getElementById('clientCat') as HTMLSelectElement).value;
               addAttachment('client', cat, e.target.files);
               e.target.value = "";
           }} />
           <button 
             className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors whitespace-nowrap"
             onClick={() => {
               const cat = (document.getElementById('clientCat') as HTMLSelectElement).value;
               const fileInput = document.getElementById('clientFile') as HTMLInputElement;
               addAttachment('client', cat, fileInput.files);
               fileInput.value = "";
             }}
           >
             <i className="fa-solid fa-plus mr-1"></i> Ajouter
           </button>
           <button 
             className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors whitespace-nowrap md:hidden"
             onClick={() => document.getElementById('clientCamera')?.click()}
           >
             <i className="fa-solid fa-camera mr-1"></i> Prendre une photo
           </button>
        </div>
        {clientAttachments.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Aucune pièce jointe enregistrée.</p>
        ) : (
          <ul className="space-y-2">
            {clientAttachments.map(att => (
              <li key={att.id} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-lg text-sm border border-slate-100">
                <span><span className="font-semibold text-slate-700">{att.category} :</span> <span className="text-slate-600">{att.name}</span></span>
                <button className="text-red-400 hover:text-red-600" onClick={() => removeAttachment('client', att.id)} title="Supprimer">
                  <i className="fa-solid fa-trash"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
        <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
          onClick={goNext}
          disabled={!activeClient}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderDomainStep = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
      <h3 className="text-lg font-bold text-slate-800 mb-6">Choix du volet métier</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${domain === 'hahitantsoa' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
          onClick={() => setDomain('hahitantsoa')}
        >
          <div className="flex items-center gap-3 mb-2">
            <i className="fa-solid fa-champagne-glasses text-indigo-600 text-xl"></i>
            <h4 className="font-bold text-slate-800">Hahitantsoa</h4>
          </div>
          <p className="text-sm text-slate-600">Événement complet (mariage, séminaire). Inclut local, matériels, services, et règles événementielles.</p>
        </div>
        <div 
          className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${domain === 'titan' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}
          onClick={() => setDomain('titan')}
        >
          <div className="flex items-center gap-3 mb-2">
            <i className="fa-solid fa-box text-amber-600 text-xl"></i>
            <h4 className="font-bold text-slate-800">Titan Rental</h4>
          </div>
          <p className="text-sm text-slate-600">Location pure de matériels et packs. Aucun local ni prestation de service.</p>
        </div>
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
        <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
        <button 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
          onClick={goNext}
          disabled={!domain}
        >
          Continuer
        </button>
      </div>
    </div>
  );

  const renderDetailsStep = () => {
    if (domain === 'hahitantsoa') {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Détails Événement (Hahitantsoa)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type d'événement</label>
              <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.eventType} onChange={e => setHDetails({...hDetails, eventType: e.target.value})}>
                <option value="">Sélectionner un type</option>
                {hahitantsoaEventTypes.map(et => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
              {hDetails.eventType === 'Autre' && (
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm mt-2" value={hDetails.eventTypeOther} onChange={e => setHDetails({...hDetails, eventTypeOther: e.target.value})} placeholder="Préciser le type d'événement" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Local / Lieu</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.venue} onChange={e => setHDetails({...hDetails, venue: e.target.value})} placeholder="Domaine Ambohimanga..." />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4">Personnes concernées / Référents</h4>
            </div>
            {hDetails.eventType === 'Mariage' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marié(e) 1</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.mariageGroomName || ''} onChange={e => setHDetails({...hDetails, mariageGroomName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marié(e) 2</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.mariageBrideName || ''} onChange={e => setHDetails({...hDetails, mariageBrideName: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact référent (opt.)</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.mariageReferentName || ''} onChange={e => setHDetails({...hDetails, mariageReferentName: e.target.value})} />
                </div>
              </>
            ) : hDetails.eventType === 'Fiançailles' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fiancé(e) 1</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.fiancaillesPerson1 || ''} onChange={e => setHDetails({...hDetails, fiancaillesPerson1: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fiancé(e) 2</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.fiancaillesPerson2 || ''} onChange={e => setHDetails({...hDetails, fiancaillesPerson2: e.target.value})} />
                </div>
              </>
            ) : hDetails.eventType === 'Baptême' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom/prénom de l'enfant</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.baptemeChildName || ''} onChange={e => setHDetails({...hDetails, baptemeChildName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom/prénom parent/tuteur</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.baptemeParentName || ''} onChange={e => setHDetails({...hDetails, baptemeParentName: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date de baptême (si différente de l'événement)</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.baptemeDate || ''} onChange={e => setHDetails({...hDetails, baptemeDate: e.target.value})} />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Personnes concernées / Référents événement (optionnel)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.otherReferentName || ''} onChange={e => setHDetails({...hDetails, otherReferentName: e.target.value})} />
              </div>
            )}
            
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4">Durée et horaires de l’événement</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" min={new Date().toISOString().split('T')[0]} value={hDetails.startDate} onChange={e => setHDetails({...hDetails, startDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure de début</label>
              <input type="time" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.startTime} onChange={e => setHDetails({...hDetails, startTime: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" min={hDetails.startDate || new Date().toISOString().split('T')[0]} value={hDetails.endDate} onChange={e => setHDetails({...hDetails, endDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure de fin</label>
              <input type="time" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.endTime} onChange={e => setHDetails({...hDetails, endTime: e.target.value})} />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4">Type de location</h4>
            </div>
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hahitantsoaRentalTypes.map(opt => (
                  <label key={opt} className={`border p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${hDetails.rentalType === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 hover:border-indigo-400'}`}>
                    <input type="radio" name="rentalType" value={opt} checked={hDetails.rentalType === opt} onChange={(e) => setHDetails({...hDetails, rentalType: e.target.value})} className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4">Durée (Option horaire)</h4>
            </div>
            <div className="md:col-span-2 space-y-2">
              {hahitantsoaDurationOptions.map(opt => (
                <div key={opt.label} className={`border p-3 rounded-lg transition-colors ${hDetails.durationOption === opt.label ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="durationOption" value={opt.label} checked={hDetails.durationOption === opt.label} onChange={(e) => {
                      const updates: any = { durationOption: e.target.value, durationOptionPrice: 0 };
                      if (e.target.value.includes('20:00')) updates.endTime = '20:00';
                      else if (e.target.value.includes('22:30')) updates.endTime = '22:30';
                      else if (e.target.value.includes('03:30')) updates.endTime = '03:30';
                      setHDetails({...hDetails, ...updates});
                    }} className="w-4 h-4 text-indigo-600" />
                    <span className={`font-medium text-sm ${hDetails.durationOption === opt.label ? 'text-indigo-700' : 'text-slate-800'}`}>{opt.label}</span>
                  </label>
                  {hDetails.durationOption === opt.label && (
                    <div className="mt-3 ml-7">
                      <label className="block text-xs font-medium text-indigo-800 mb-1">Tarif (si facturé en supplément) :</label>
                      <div className="flex items-center gap-2 max-w-xs">
                        <input type="number" className="flex-1 border border-indigo-200 rounded p-1.5 text-sm" value={hDetails.durationOptionPrice || ''} onChange={e => setHDetails({...hDetails, durationOptionPrice: parseInt(e.target.value || '0', 10)})} placeholder="Ex: 50000" />
                        <span className="text-sm font-bold text-indigo-600">Ar</span>
                      </div>
                      <p className="text-xs text-indigo-500 mt-1 italic">Tarif configurable par l’entreprise</p>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-slate-500 mt-2"><i className="fa-solid fa-info-circle mr-1"></i>Cette option pré-remplira l'heure de fin estimée ci-dessus. Vous pouvez la corriger manuellement.</p>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-4">Autres informations</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre d'invités estimé</label>
              <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.guests} onChange={e => setHDetails({...hDetails, guests: e.target.value})} placeholder="Ex: 200" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarques</label>
              <textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" rows={2} value={hDetails.remarks} onChange={e => setHDetails({...hDetails, remarks: e.target.value})} placeholder="Notes spécifiques..."></textarea>
            </div>
          </div>

          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-coins text-indigo-500"></i> Tarifs de base Hahitantsoa
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prix location local</label>
                <div className="flex items-center gap-2">
                  <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.venuePrice || ''} onChange={e => setHDetails({...hDetails, venuePrice: parseInt(e.target.value || '0', 10)})} />
                  <span className="text-slate-600 font-medium">Ar</span>
                </div>
              </div>
              {hDetails.rentalType === 'Location nue + logistique' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarif logistique</label>
                  <div className="flex items-center gap-2">
                    <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={hDetails.logisticsPrice || ''} onChange={e => setHDetails({...hDetails, logisticsPrice: parseInt(e.target.value || '0', 10)})} />
                    <span className="text-slate-600 font-medium">Ar</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3 italic">Tarifs modifiables par l'entreprise selon les négociations client.</p>
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>
              {(hDetails.rentalType === 'Location nue' || hDetails.rentalType === 'Location nue + logistique') ? 'Suivant (Services)' : 'Aller au catalogue / package'}
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Détails Location (Titan)</h3>
          <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-4">
            <i className="fa-solid fa-info-circle mr-2"></i><strong>Rappel Titan :</strong> Aucun champ lié à un local ou un service événementiel ne doit figurer ici. Uniquement de la location de matériels.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <h4 className="font-bold text-slate-800 mb-2">Destination de la location</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type d'usage</label>
              <select className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.usageType} onChange={e => setTDetails({...tDetails, usageType: e.target.value})}>
                {titanUsageTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            {tDetails.usageType === 'Autre' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Précision (Autre)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.usageTypeOther} onChange={e => setTDetails({...tDetails, usageTypeOther: e.target.value})} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lieu de destination</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.destinationLocation} onChange={e => setTDetails({...tDetails, destinationLocation: e.target.value})} placeholder="Ex: Espace Fitiavana" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse exacte de destination</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.destinationAddress} onChange={e => setTDetails({...tDetails, destinationAddress: e.target.value})} placeholder="Ex: Lot XYZ Ambohibao" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact sur site (Nom et Téléphone)</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.destinationContact} onChange={e => setTDetails({...tDetails, destinationContact: e.target.value})} placeholder="Ex: Jean - 034 00 000 00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Note d'accès</label>
              <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.accessNote} onChange={e => setTDetails({...tDetails, accessNote: e.target.value})} placeholder="Ex: Portail bleu au fond de l'impasse" />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-2">Période de location</h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date début de location</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" min={new Date().toISOString().split('T')[0]} value={tDetails.startDate || ''} onChange={e => setTDetails({...tDetails, startDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure début location</label>
              <input type="time" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.startTime || ''} onChange={e => setTDetails({...tDetails, startTime: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date fin de location</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" min={tDetails.startDate || new Date().toISOString().split('T')[0]} value={tDetails.endDate || ''} onChange={e => setTDetails({...tDetails, endDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure fin location</label>
              <input type="time" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.endTime || ''} onChange={e => setTDetails({...tDetails, endTime: e.target.value})} />
            </div>
            
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-2">Mode mouvement & Logistique</h4>
            </div>
            <div className="md:col-span-2">
              <div className="flex gap-4">
                {titanMovementModes.map(mode => (
                  <label key={mode} className={`border p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors flex-1 ${tDetails.movementMode === mode ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 hover:border-indigo-400'}`}>
                    <input type="radio" name="movementMode" value={mode} checked={tDetails.movementMode === mode} onChange={(e) => setTDetails({...tDetails, movementMode: e.target.value})} className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-sm">{mode}</span>
                  </label>
                ))}
              </div>
            </div>

            {tDetails.movementMode === 'Livraison par Titan' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date et Heure Livraison prévue</label>
                  <div className="flex gap-2">
                    <input type="date" className="w-2/3 border border-slate-300 rounded-lg p-2.5 text-sm" min={new Date().toISOString().split('T')[0]} value={tDetails.pickupDate || ''} onChange={e => setTDetails({...tDetails, pickupDate: e.target.value})} />
                    <input type="time" className="w-1/3 border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.deliveryTime || ''} onChange={e => setTDetails({...tDetails, deliveryTime: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date et Heure Récupération prévue</label>
                  <div className="flex gap-2">
                    <input type="date" className="w-2/3 border border-slate-300 rounded-lg p-2.5 text-sm" min={tDetails.pickupDate || new Date().toISOString().split('T')[0]} value={tDetails.returnDate || ''} onChange={e => setTDetails({...tDetails, returnDate: e.target.value})} />
                    <input type="time" className="w-1/3 border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.returnTime || ''} onChange={e => setTDetails({...tDetails, returnTime: e.target.value})} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse livraison (si différente de la destination)</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.deliveryAddress || ''} onChange={e => setTDetails({...tDetails, deliveryAddress: e.target.value})} placeholder="Laisser vide si identique" />
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-2 flex items-start gap-2">
                    <i className="fa-solid fa-truck mt-0.5"></i>
                    <div>
                      <strong>Note obligatoire :</strong> {titanTransportRequirement}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date et Heure Prélèvement prévue</label>
                  <div className="flex gap-2">
                    <input type="date" className="w-2/3 border border-slate-300 rounded-lg p-2.5 text-sm" min={new Date().toISOString().split('T')[0]} value={tDetails.pickupDate || ''} onChange={e => setTDetails({...tDetails, pickupDate: e.target.value})} />
                    <input type="time" className="w-1/3 border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.pickupTime || ''} onChange={e => setTDetails({...tDetails, pickupTime: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date et Heure Restitution prévue</label>
                  <div className="flex gap-2">
                    <input type="date" className="w-2/3 border border-slate-300 rounded-lg p-2.5 text-sm" min={tDetails.pickupDate || new Date().toISOString().split('T')[0]} value={tDetails.returnDate || ''} onChange={e => setTDetails({...tDetails, returnDate: e.target.value})} />
                    <input type="time" className="w-1/3 border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.clientReturnTime || ''} onChange={e => setTDetails({...tDetails, clientReturnTime: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type de véhicule prévu</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.vehicleType || ''} onChange={e => setTDetails({...tDetails, vehicleType: e.target.value})} placeholder="Ex: Sprinter Fourgon" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Personne chargée du transport</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" value={tDetails.transportPerson || ''} onChange={e => setTDetails({...tDetails, transportPerson: e.target.value})} placeholder="Ex: Chauffeur Rabe" />
                </div>
              </>
            )}

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 mb-2">Engagements client</h4>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded" checked={tDetails.obligationsAccepted} onChange={e => setTDetails({...tDetails, obligationsAccepted: e.target.checked})} />
                <span className="text-sm text-slate-700">Le client est informé de ses obligations d'usage en "bon père de famille" et de l'interdiction de modification.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded" checked={tDetails.returnConditionsAccepted} onChange={e => setTDetails({...tDetails, returnConditionsAccepted: e.target.checked})} />
                <span className="text-sm text-slate-700">Le client est informé des conditions de retour, de pénalités de retard (50% par jour) et de frais liés à la casse ou perte.</span>
              </label>
              {tDetails.movementMode === 'Prélèvement par le client' && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4 text-indigo-600 rounded" checked={tDetails.transportConditionAccepted} onChange={e => setTDetails({...tDetails, transportConditionAccepted: e.target.checked})} />
                  <span className="text-sm text-slate-700">Le client est expressément avisé qu'un véhicule FOURGON est obligatoire.</span>
                </label>
              )}
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarques matériels</label>
              <textarea className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" rows={3} value={tDetails.remarks} onChange={e => setTDetails({...tDetails, remarks: e.target.value})} placeholder="Conditions d'accès, etc..."></textarea>
            </div>
          </div>
          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>Aller au catalogue</button>
          </div>
        </div>
      );
    }
  };

  const [catalogSubStep, setCatalogSubStep] = useState(1);

  const renderCatalogStep = () => {
    const handleMaterialToggle = (mat: any, qty: number) => {
      if (qty <= 0) {
        setSelectedMaterials(selectedMaterials.filter(m => m.id !== mat.id));
      } else {
        const existing = selectedMaterials.find(m => m.id === mat.id);
        if (existing) {
          setSelectedMaterials(selectedMaterials.map(m => m.id === mat.id ? { ...m, quantity: qty } : m));
        } else {
          setSelectedMaterials([...selectedMaterials, { id: mat.id, name: mat.name, price: mat.price, quantity: qty }]);
        }
      }
    };

    const handlePackageSelect = (pkgId: string) => {
      setHDetails({...hDetails, packageId: pkgId});
      const pkg = hahitantsoaMockPackages.find(p => p.id === pkgId);
      if (pkg) {
        // Only reset if empty or switching package entirely. Let's merge or reset.
        const newMaterials = pkg.articles.map(art => {
          const catItem = mockCatalog.find(c => c.id === art.id);
          return {
            id: art.id,
            name: catItem ? catItem.name : "Article Inconnu",
            price: catItem ? catItem.price : 0,
            quantity: art.qty
          };
        });
        setSelectedMaterials(newMaterials);
      } else {
        setSelectedMaterials([]);
      }
    };

    if (domain === 'hahitantsoa' && hDetails.rentalType === 'Location avec package') {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Parcours Package Hahitantsoa</h3>
          
          <div className="flex items-center gap-4 mb-6">
            <button className={`text-sm font-medium px-4 py-2 rounded-full ${catalogSubStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`} onClick={() => setCatalogSubStep(1)}>1. Choisir package</button>
            <button className={`text-sm font-medium px-4 py-2 rounded-full ${catalogSubStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'} ${!hDetails.packageId ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => hDetails.packageId && setCatalogSubStep(2)}>2. Ajuster package</button>
            <button className={`text-sm font-medium px-4 py-2 rounded-full ${catalogSubStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'} ${!hDetails.packageId ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => hDetails.packageId && setCatalogSubStep(3)}>3. Articles complémentaires</button>
          </div>

          {catalogSubStep === 1 && (
            <div className="mb-6 animate-fade-in">
              <label className="block text-sm font-medium text-slate-700 mb-2">Packages disponibles</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hahitantsoaMockPackages.filter(p => p.active !== false).map(p => (
                  <div key={p.id} className={`border rounded-xl p-4 cursor-pointer transition-colors ${hDetails.packageId === p.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`} onClick={() => handlePackageSelect(p.id)}>
                    <div className="w-full h-32 bg-slate-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <i className="fa-solid fa-box-open text-4xl text-slate-400"></i>}
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-slate-800">{p.name}</h5>
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-1 rounded text-xs">{p.price.toLocaleString('fr-FR')} Ar</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {catalogSubStep === 2 && hDetails.packageId && (
            <div className="mb-6 animate-fade-in">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                <h4 className="font-bold text-indigo-900 mb-1">Ajustement du package</h4>
                <p className="text-sm text-indigo-700">Modifiez les quantités prévues pour ce dossier. Retirez à 0 pour enlever un article. Le prix du package s'ajustera automatiquement.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                  if (!pkg) return null;
                  return pkg.articles.map(art => {
                    const catItem = mockCatalog.find(c => c.id === art.id);
                    if (!catItem) return null;
                    const selected = selectedMaterials.find(m => m.id === catItem.id);
                    const currentQty = selected ? selected.quantity : 0;
                    return (
                      <div key={catItem.id} className="border border-slate-200 rounded-xl p-4 flex gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <i className="fa-solid fa-image text-xl"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-sm mb-1">{catItem.name}</h4>
                          <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                            <span>Quantité base: {art.qty}</span>
                            <span className="font-bold text-indigo-600">{catItem.price.toLocaleString('fr-FR')} Ar/u</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" min="0" max={catItem.available}
                              className="w-full border border-slate-300 rounded p-1 text-sm text-center"
                              value={currentQty || ''} placeholder="0"
                              onChange={e => handleMaterialToggle(catItem, parseInt(e.target.value || '0', 10))}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {catalogSubStep === 3 && hDetails.packageId && (
            <div className="mb-6 animate-fade-in">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                <h4 className="font-bold text-slate-800 mb-1">Articles complémentaires</h4>
                <p className="text-sm text-slate-600">Ajoutez des articles hors package depuis le catalogue complet.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockCatalog.filter(item => {
                  const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                  return !pkg?.articles.find(a => a.id === item.id);
                }).map(item => {
                  const selected = selectedMaterials.find(m => m.id === item.id);
                  const currentQty = selected ? selected.quantity : 0;
                  return (
                    <div key={item.id} className={`border rounded-xl p-4 flex gap-4 transition-colors ${selected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <i className="fa-solid fa-image text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{item.name}</h4>
                        <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                          <span>{item.category}</span>
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{item.available} dispo</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-bold text-indigo-600 text-sm">{item.price.toLocaleString('fr-FR')} Ar</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" min="0" max={item.available} 
                              className="w-16 border border-slate-300 rounded p-1 text-sm text-center"
                              value={currentQty || ''} placeholder="0"
                              onChange={e => handleMaterialToggle(item, parseInt(e.target.value || '0', 10))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">Total Package (Ajusté) :</span>
              <span className="text-lg font-bold text-indigo-600">{(packageTotal + materialsTotal - selectedMaterials.filter(m => {
                const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                return !pkg?.articles.find(a => a.id === m.id);
              }).reduce((acc, m) => acc + m.price * m.quantity, 0)).toLocaleString('fr-FR')} Ar</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">Total Articles complémentaires :</span>
              <span className="text-lg font-bold text-emerald-600">{selectedMaterials.filter(m => {
                const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                return !pkg?.articles.find(a => a.id === m.id);
              }).reduce((acc, m) => acc + m.price * m.quantity, 0).toLocaleString('fr-FR')} Ar</span>
            </div>
          </div>
          
          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
            <div className="flex gap-2">
              {catalogSubStep < 3 && hDetails.packageId && (
                <button className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-300" onClick={() => setCatalogSubStep(catalogSubStep + 1)}>Étape suivante</button>
              )}
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext} disabled={!hDetails.packageId}>Aller aux Services</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Catalogue Matériels</h3>
        <p className="text-sm text-slate-500 mb-6">Sélectionnez les articles souhaités.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {mockCatalog.map(item => {
              const selected = selectedMaterials.find(m => m.id === item.id);
              const currentQty = selected ? selected.quantity : 0;
              return (
                <div key={item.id} className={`border rounded-xl p-4 flex gap-4 transition-colors ${selected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-image text-2xl"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{item.name}</h4>
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
                      <span>{item.category}</span>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{item.available} dispo</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-bold text-indigo-600 text-sm">{item.price.toLocaleString('fr-FR')} Ar</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0" 
                          max={item.available} 
                          className="w-16 border border-slate-300 rounded p-1 text-sm text-center"
                          value={currentQty || ''}
                          placeholder="0"
                          onChange={e => handleMaterialToggle(item, parseInt(e.target.value || '0', 10))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
          <span className="font-semibold text-slate-700">Total Matériels sélectionnés :</span>
          <span className="text-xl font-bold text-indigo-600">{materialsTotal.toLocaleString('fr-FR')} Ar</span>
        </div>

        <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
          <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>{domain === 'hahitantsoa' ? 'Aller aux Services' : 'Aller à la Livraison'}</button>
        </div>
      </div>
    );
  };

  const renderServicesStep = () => {
    if (domain === 'hahitantsoa') {
      const handleServiceToggle = (srv: any) => {
        const existing = selectedServices.find(s => s.id === srv.id);
        if (existing) setSelectedServices(selectedServices.filter(s => s.id !== srv.id));
        else setSelectedServices([...selectedServices, { id: srv.id, name: srv.name, price: srv.price }]);
      };
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Services Hahitantsoa</h3>
          <p className="text-sm text-slate-500 mb-6">Ajoutez les services événementiels souhaités (Traiteur, Déco, etc.)</p>
          
          <div className="space-y-3 mb-6">
            {hahitantsoaMockServices.filter(s => s.active !== false).map(srv => {
              const selected = selectedServices.find(s => s.id === srv.id);
              const isSelected = !!selected;
              return (
                <div key={srv.id} className={`p-4 border rounded-xl transition-colors ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="w-5 h-5 mt-0.5 text-indigo-600 rounded" checked={isSelected} onChange={() => handleServiceToggle(srv)} />
                      <div>
                        <span className="font-medium text-slate-800 block">{srv.name}</span>
                        <span className="text-xs text-slate-500">{srv.desc}</span>
                      </div>
                    </div>
                  </label>
                  {isSelected && (
                    <div className="mt-3 ml-8 flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Prix :</label>
                      <input 
                        type="number" 
                        className="w-32 border border-slate-300 rounded-lg p-1.5 text-sm"
                        value={selected.price || ''} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value || '0', 10);
                          setSelectedServices(selectedServices.map(s => s.id === srv.id ? { ...s, price: val } : s));
                        }}
                      />
                      <span className="text-sm font-bold text-slate-600">Ar</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>Vérifier le résumé</button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Option Livraison (Titan)</h3>
          <p className="text-sm text-slate-500 mb-6">Souhaitez-vous inclure un service de livraison matériels ?</p>
          
          <div className="mb-6 max-w-md">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tarif de livraison (Saisir un montant ou laisser vide si pas de livraison)</label>
            <div className="relative">
              <input 
                type="number" 
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm pl-4 pr-12" 
                placeholder="Ex: 50000"
                value={deliveryFee}
                onChange={e => setDeliveryFee(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Ar</span>
            </div>
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>Vérifier le résumé</button>
          </div>
        </div>
      );
    }
  };

  const renderSummaryStep = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">Résumé modifiable</h3>
        <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium" onClick={saveDraft}>
          <i className="fa-solid fa-save mr-2"></i> Enregistrer brouillon
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-slate-700 text-sm uppercase">Client</h4>
            <button className="text-indigo-600 text-xs hover:underline" onClick={() => jumpTo(path === 'client_first' ? 1 : 2)}>Modifier</button>
          </div>
          {activeClient && (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">{activeClient.name}</p>
              <p>{activeClient.phone}</p>
              <p>{activeClient.type}</p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-slate-700 text-sm uppercase">Volet Métier & Détails</h4>
            <button className="text-indigo-600 text-xs hover:underline" onClick={() => jumpTo(3)}>Modifier</button>
          </div>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900 capitalize">{domain}</p>
            {domain === 'hahitantsoa' ? (
              <>
                <p>{hDetails.venue} • {hDetails.guests} pax</p>
                <p className="mt-1">Du {hDetails.startDate} à {hDetails.startTime} au {hDetails.endDate} à {hDetails.endTime}</p>
                <p className="mt-1 font-medium">{hDetails.rentalType}</p>
                <p className="text-xs">{hDetails.durationOption}</p>
              </>
            ) : (
              <p>{tDetails.period} • Sortie: {tDetails.pickupDate}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h4 className="font-semibold text-slate-700 text-sm uppercase">{domain === 'hahitantsoa' && hDetails.rentalType === 'Location avec package' ? 'Détails Package & Matériels' : 'Matériels sélectionnés'}</h4>
          <button className="text-indigo-600 text-xs hover:underline" onClick={() => jumpTo(4)}>Modifier catalogue</button>
        </div>
        
        {domain === 'hahitantsoa' && hDetails.rentalType === 'Location avec package' && hDetails.packageId && (
          <div className="mb-4 pb-4 border-b border-slate-100">
            <h5 className="font-bold text-slate-800 text-sm mb-2">Package choisi : {hahitantsoaMockPackages.find(p => p.id === hDetails.packageId)?.name}</h5>
            
            <h6 className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2">Articles du package ajustés</h6>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left">
                <tbody>
                  {selectedMaterials.filter(m => {
                    const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                    return pkg?.articles.find(a => a.id === m.id);
                  }).map(m => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 font-medium w-16">{m.quantity}</td>
                      <td className="px-4 py-2">{m.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h6 className="text-xs font-semibold text-slate-500 uppercase mb-2">Articles complémentaires du catalogue</h6>
            {selectedMaterials.filter(m => {
              const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
              return !pkg?.articles.find(a => a.id === m.id);
            }).length === 0 ? (
              <p className="text-xs text-slate-400 italic px-4">Aucun article complémentaire.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <tbody>
                    {selectedMaterials.filter(m => {
                      const pkg = hahitantsoaMockPackages.find(p => p.id === hDetails.packageId);
                      return !pkg?.articles.find(a => a.id === m.id);
                    }).map(m => (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 font-medium w-16">{m.quantity}</td>
                        <td className="px-4 py-2">{m.name}</td>
                        <td className="px-4 py-2 text-right">{(m.price * m.quantity).toLocaleString('fr-FR')} Ar</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!(domain === 'hahitantsoa' && hDetails.rentalType === 'Location avec package' && hDetails.packageId) && (
          selectedMaterials.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucun matériel sélectionné.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 rounded-l-lg">Qté</th>
                    <th className="px-4 py-2">Article</th>
                    <th className="px-4 py-2">P.U</th>
                    <th className="px-4 py-2 rounded-r-lg text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMaterials.map(m => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 font-medium">{m.quantity}</td>
                      <td className="px-4 py-2">{m.name}</td>
                      <td className="px-4 py-2">{m.price.toLocaleString('fr-FR')} Ar</td>
                      <td className="px-4 py-2 text-right font-medium">{(m.price * m.quantity).toLocaleString('fr-FR')} Ar</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {(selectedServices.length > 0 || deliveryFee) && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-slate-700 text-sm uppercase">{domain === 'hahitantsoa' ? 'Services sélectionnés' : 'Livraison'}</h4>
            <button className="text-indigo-600 text-xs hover:underline" onClick={() => jumpTo(5)}>Modifier</button>
          </div>
          <div className="text-sm text-slate-600">
            {selectedServices.map(s => (
              <div key={s.id} className="flex justify-between py-1">
                <span>{s.name}</span>
                <span className="font-medium">{s.price.toLocaleString('fr-FR')} Ar</span>
              </div>
            ))}
            {deliveryFee && (
              <div className="flex justify-between py-1">
                <span>Frais de livraison</span>
                <span className="font-medium">{parseInt(deliveryFee, 10).toLocaleString('fr-FR')} Ar</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="font-semibold text-slate-700 text-sm uppercase mb-1">Remise commerciale</h4>
          <p className="text-xs text-slate-500">Appliquer une remise sur le sous-total</p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            min="0"
            className="w-24 border border-slate-300 rounded-lg p-2 text-sm text-right"
            value={discountValue}
            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
          />
          <button 
            className={`px-3 py-1.5 rounded-l-lg border border-slate-300 text-sm font-medium ${discountIsPercentage ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setDiscountIsPercentage(true)}
          >
            %
          </button>
          <button 
            className={`px-3 py-1.5 rounded-r-lg border border-slate-300 -ml-2 text-sm font-medium ${!discountIsPercentage ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setDiscountIsPercentage(false)}
          >
            Ar
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 text-indigo-900 p-6 rounded-xl border border-indigo-100 mb-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium opacity-80">Sous-total</p>
          <p className="text-sm font-medium">{subTotalAmount.toLocaleString('fr-FR')} Ar</p>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between items-center mb-2 text-emerald-600">
            <p className="text-sm font-medium">Remise {discountIsPercentage ? `(${discountValue}%)` : ''}</p>
            <p className="text-sm font-medium">- {discountAmount.toLocaleString('fr-FR')} Ar</p>
          </div>
        )}
        <div className="flex justify-between items-end mt-4 pt-4 border-t border-indigo-200/50">
          <p className="text-xs font-semibold uppercase opacity-70">Montant total net</p>
          <p className="text-3xl font-black">{totalAmount.toLocaleString('fr-FR')} Ar</p>
        </div>
      </div>

      <div className="bg-orange-50 text-orange-800 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">Caution obligatoire (Dépôt de garantie)</p>
          <p className="text-lg font-bold">{(domain === 'hahitantsoa' ? hahitantsoaDefaultDepositAmount : (totalAmount < titanDepositThreshold ? titanSmallRentalDeposit : totalAmount * titanLargeRentalDepositRate)).toLocaleString('fr-FR')} Ar</p>
          <p className="text-xs opacity-80 mt-1">À verser en plus du total. Restituée après l'événement en l'absence de casse.</p>
        </div>
        <i className="fa-solid fa-shield-halved text-2xl opacity-50"></i>
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
        <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour</button>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm" onClick={goNext}>Générer Devis/Proforma</button>
      </div>
    </div>
  );

  const renderProformaStep = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm animate-fade-in relative">
      <div className="absolute top-8 right-8 text-slate-200">
        <i className="fa-solid fa-file-invoice fa-4x"></i>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-2">Aperçu Proforma</h3>
      <div className="flex items-center gap-3 mb-6">
         <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Valide</span>
         <span className="text-sm text-slate-500">Réf : PROF-2026-9042</span>
         <span className="text-sm text-slate-500">Émise le : {new Date().toLocaleDateString('fr-FR')}</span>
      </div>
      
      <DocumentPreview 
        type="proforma"
        domain={domain as 'titan' | 'hahitantsoa'}
        client={activeClient}
        date={new Date().toLocaleDateString('fr-FR')}
        refNumber="PROF-2026-9042"
        eventDate={domain === 'hahitantsoa' ? hDetails.date : tDetails.period}
        materials={selectedMaterials}
        services={selectedServices}
        deliveryFee={deliveryFee}
        totalAmount={totalAmount}
        subTotalAmount={subTotalAmount}
        discountAmount={discountAmount}
        hDetails={hDetails}
        tDetails={tDetails}
      />
      
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex justify-between items-center text-sm mb-6">
        <div>
          <span className="block text-indigo-700 font-bold mb-1">Durée de validité</span>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              className="w-16 border border-slate-300 rounded p-1 text-center text-sm" 
              value={proformaValidity}
              onChange={e => setProformaValidity(parseInt(e.target.value || "0", 10))}
            />
            <span className="text-slate-600">jours</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
        <button className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm" onClick={() => jumpTo(4)}>Modifier lignes</button>
        <div className="flex gap-4">
          <button 
            className="px-6 py-2.5 bg-slate-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-slate-700 transition-colors"
            onClick={() => { 
               setProformaGenerated(true);
               saveDraft();
               alert("Proforma confirmée — en attente de décision client. État sauvegardé.");
            }}
          >
            Confirmer proforma
          </button>
          <button 
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-indigo-700 transition-colors"
            onClick={() => { setProformaGenerated(true); goNext(); }}
          >
            Passer au paiement
          </button>
        </div>
      </div>
    </div>
  );

  const renderPaymentStep = () => {
    const activePercent = payment.percent ? parseInt(payment.percent, 10) : (domain === 'titan' ? (tDetails.advanceRate * 100) : 50);
    const currentRequestedPayment = (totalAmount * activePercent / 100).toString();

    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Acompte / Paiement (Mock)</h3>
        <p className="text-sm text-slate-500 mb-6">Selon les règles A/B, un paiement d'acompte est souvent requis pour valider formellement la réservation en contrat.</p>
        
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 mb-6 flex justify-between items-center">
          <div>
            <h4 className="font-bold text-orange-800 text-sm mb-1">Caution obligatoire</h4>
            <p className="text-xs text-orange-700">À régler lors du solde. Restituée après l'événement s'il n'y a pas de casse. Déduite en cas de dommages (solde restant à la charge du client si dépassement).</p>
          </div>
          <div className="font-bold text-lg text-orange-900 ml-4 whitespace-nowrap">
            {(domain === 'hahitantsoa' ? hahitantsoaDefaultDepositAmount : (totalAmount < titanDepositThreshold ? titanSmallRentalDeposit : totalAmount * titanLargeRentalDepositRate)).toLocaleString('fr-FR')} Ar
          </div>
        </div>

        {domain === 'titan' && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6">
             <h4 className="font-bold text-blue-800 text-sm mb-1">Règles Financières Titan</h4>
             <ul className="list-disc pl-5 text-sm text-blue-700 space-y-1">
               <li>Acompte par défaut : <strong>{tDetails.advanceRate * 100}%</strong></li>
               <li>Solde dû <strong>{titanBalanceDueDaysBeforePickup} jours</strong> avant le prélèvement/livraison (soit le {new Date(new Date(tDetails.pickupDate || tDetails.startDate).getTime() - (titanBalanceDueDaysBeforePickup * 24 * 60 * 60 * 1000)).toLocaleDateString('fr-FR')})</li>
               <li>Dépôt de garantie Titan : <strong>{totalAmount < titanDepositThreshold ? titanSmallRentalDeposit.toLocaleString('fr-FR') : (totalAmount * titanLargeRentalDepositRate).toLocaleString('fr-FR')} Ar</strong></li>
             </ul>
          </div>
        )}

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mode de paiement</label>
              <select 
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                value={payment.method}
                onChange={e => setPayment({...payment, method: e.target.value})}
              >
                <option>Espèces</option>
                <option>Chèque</option>
                <option>Mobile Money</option>
                <option>Virement</option>
                <option>Carte Bancaire</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Acompte % (sur total {totalAmount.toLocaleString('fr-FR')})</label>
              <input 
                type="number" 
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" 
                value={payment.percent === "50" && domain === 'titan' ? (tDetails.advanceRate * 100).toString() : payment.percent} 
                onChange={e => {
                  const pct = e.target.value;
                  const amt = (totalAmount * (parseInt(pct || "0", 10)) / 100).toString();
                  setPayment({...payment, percent: pct, amount: amt});
                }} 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Montant perçu (Ar)</label>
              <input 
                type="number" 
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold" 
                value={payment.amount || currentRequestedPayment} 
                onChange={e => {
                  const amt = e.target.value;
                  const pct = ((parseInt(amt || "0", 10) / totalAmount) * 100).toFixed(1);
                  setPayment({...payment, amount: amt, percent: pct});
                }} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reste à payer</label>
              <div className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-600">
                {Math.max(0, totalAmount - parseInt(payment.amount || currentRequestedPayment, 10)).toLocaleString('fr-FR')} Ar
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <h4 className="text-md font-bold text-slate-800 mb-1">Pièces jointes paiement</h4>
          <p className="text-xs text-slate-500 mb-4">Preuves de paiement, captures, reçus. (Mock/Simulation)</p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
             <select id="paymentCat" className="border border-slate-300 rounded-lg p-2 text-sm bg-white min-w-[200px]">
               <option value="Justificatif paiement">Justificatif paiement</option>
               <option value="Reçu">Reçu</option>
               <option value="Capture Mobile Money">Capture Mobile Money</option>
               <option value="Copie chèque">Copie chèque</option>
               <option value="Bordereau virement">Bordereau virement</option>
               <option value="Preuve carte bancaire">Preuve carte bancaire</option>
               <option value="Pièce jointe email">Pièce jointe email</option>
               <option value="Autre">Autre</option>
             </select>
             <input type="file" id="paymentFile" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" accept=".jpg,.jpeg,.png,.webp,.pdf" />
             <button 
               className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors whitespace-nowrap"
               onClick={() => {
                 const cat = (document.getElementById('paymentCat') as HTMLSelectElement).value;
                 const fileInput = document.getElementById('paymentFile') as HTMLInputElement;
                 addAttachment('payment', cat, fileInput.files);
                 fileInput.value = "";
               }}
             >
               <i className="fa-solid fa-plus mr-1"></i> Ajouter
             </button>
          </div>
          {paymentAttachments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucune pièce jointe enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {paymentAttachments.map(att => (
                <li key={att.id} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-lg text-sm border border-slate-100">
                  <span><span className="font-semibold text-slate-700">{att.category} :</span> <span className="text-slate-600">{att.name}</span></span>
                  <button className="text-red-400 hover:text-red-600" onClick={() => removeAttachment('payment', att.id)} title="Supprimer">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
          <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour au proforma</button>
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 shadow-md hover:bg-green-700"
            onClick={() => { setPaymentDone(true); goNext(); }}
          >
            Valider paiement et Aperçu Contrat
          </button>
        </div>
      </div>
    );
  };

  const renderContractPreviewStep = () => {
    const paidAmount = parseInt(payment.amount || ((totalAmount * parseInt(payment.percent || "50", 10)) / 100).toString(), 10);
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm animate-fade-in relative">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Aperçu Contrat</h3>
        <div className="flex items-center gap-3 mb-6">
           <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Prêt à signer</span>
           <span className="text-sm text-slate-500">Brouillon de Contrat : CTR-2026-9042</span>
        </div>
        
      <div className="mb-8">
        <DocumentPreview 
          type="contrat"
          domain={domain as 'titan' | 'hahitantsoa'}
          client={activeClient}
          date={new Date().toLocaleDateString('fr-FR')}
          refNumber="CTR-2026-9042"
          eventDate={domain === 'hahitantsoa' ? hDetails.date : tDetails.period}
          materials={selectedMaterials}
          services={selectedServices}
          deliveryFee={deliveryFee}
          totalAmount={totalAmount}
          subTotalAmount={subTotalAmount}
          discountAmount={discountAmount}
          paidAmount={parseInt(payment.amount || '0', 10)}
          paymentMethod={payment.method}
          hDetails={hDetails}
        />
      </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm" onClick={goBack}>Retour au paiement</button>
          <button 
            className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold text-md shadow-lg hover:bg-green-700 transition-all hover:-translate-y-1"
            onClick={() => {
              clearDraft();
              onNavigate("dashboard");
            }}
          >
            <i className="fa-solid fa-signature mr-2"></i> Valider et Clôturer le Dossier
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (step === 0) return renderStep0();
    
    if (path === "client_first") {
      if (step === 1) return renderClientStep();
      if (step === 2) return renderDomainStep();
    } else {
      if (step === 1) return renderDomainStep();
      if (step === 2) return renderClientStep();
    }

    if (step === 3) return renderDetailsStep();
    if (step === 4) return renderCatalogStep();
    if (step === 5) return renderServicesStep();
    if (step === 6) return renderSummaryStep();
    if (step === 7) return renderProformaStep();
    if (step === 8) return renderPaymentStep();
    if (step === 9) return renderContractPreviewStep();

    return null;
  };

  return (
    <div className="page active space-y-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Assistant de Création</h2>
        <p className="text-sm text-slate-500">Parcours modulable mocké, strictement séparé Hahitantsoa / Titan.</p>
      </div>

      {step > 0 && renderStepper()}

      {renderCurrentStep()}
    </div>
  );
}
