export interface Client {
  id: string;
  initials: string;
  name: string; // Used for companyName or full name depending on type
  email: string;
  phone: string;
  type: "Particulier" | "Entreprise";
  colorClass: string;
  
  // Particulier fields
  civilite?: "Monsieur" | "Madame" | "";
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  idType?: "CIN" | "Passeport";
  idNumber?: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  idDuplicataDate?: string;
  idDuplicataPlace?: string;
  address?: string;
  idPhotoUrl?: string;

  // Entreprise fields
  nif?: string;
  stat?: string;
  rcs?: string;
  repFirstName?: string;
  repLastName?: string;
  repRole?: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  title: string;
  date: string;
  amount: number;
  status: "Proforma" | "Contrat signé" | "En attente" | "Confirmée" | "À préparer" | "En sortie" | "Terminée";
  type: "Hahitantsoa" | "Titan";
  lines?: { type: string; desc: string; qty: string; price: string; total: string; statusClass: string }[];
}

export const mockClients: Client[] = [
  { id: "CUST-001", initials: "AR", name: "Ando Rakoto", email: "ando.rakoto@email.mg", phone: "+261 34 12 345 67", type: "Particulier", colorClass: "bg-indigo-100 text-indigo-700" },
  { id: "CUST-002", initials: "RN", name: "Rasoa Nomena", email: "rasoa.nomena@entreprise.mg", phone: "+261 32 98 765 43", type: "Entreprise", colorClass: "bg-emerald-100 text-emerald-700" },
  { id: "CUST-003", initials: "TR", name: "Traiteur Royal", email: "contact@traiteur-royal.mg", phone: "+261 33 45 678 90", type: "Entreprise", colorClass: "bg-amber-100 text-amber-700" }
];

export const mockReservations: Reservation[] = [
  { id: "RES-2026-0142", clientId: "CUST-001", title: "Mariage Domaine Ambohimanga", date: "15 Juin 2026", amount: 2400000, status: "Confirmée", type: "Hahitantsoa", lines: [
    { type: "Local", desc: "Salle des fêtes principale", qty: "1", price: "1 000 000 Ar", total: "1 000 000 Ar", statusClass: "info" },
    { type: "Article", desc: "Chaise pliante", qty: "200", price: "2 000 Ar", total: "400 000 Ar", statusClass: "ok" },
    { type: "Service", desc: "Service traiteur", qty: "150", price: "6 667 Ar", total: "1 000 000 Ar", statusClass: "warn" }
  ]},
  { id: "LOC-2026-0089", clientId: "CUST-001", title: "Location chaises et tables", date: "14-16 Juin 2026", amount: 850000, status: "Confirmée", type: "Titan" },
  { id: "LOC-2026-0087", clientId: "CUST-003", title: "Location matériel réception", date: "18-19 Juin 2026", amount: 1150000, status: "En sortie", type: "Titan" }
];

export const getClient = (id: string) => mockClients.find(c => c.id === id) || mockClients[0];
export const getReservation = (id: string) => mockReservations.find(r => r.id === id) || mockReservations[0];

export const hahitantsoaDefaultDepositAmount = 500000;

export const titanUsageTypes = [
  "Mariage", "Anniversaire", "Réception privée", "Séminaire", "Corporate", "Autre"
];

export const titanMovementModes = [
  "Livraison par Titan", "Prélèvement par le client"
];

export const titanDefaultAdvanceRate = 0.25;
export const titanBalanceDueDaysBeforePickup = 5;
export const titanDepositThreshold = 200000;
export const titanSmallRentalDeposit = 100000;
export const titanLargeRentalDepositRate = 0.5;
export const titanLateReturnPenaltyRate = 0.5;
export const titanDamageExtensionPenaltyRate = 1.0;
export const titanTransportRequirement = "Un véhicule fourgon est exigé pour le transport des matériels.";

export const titanPreparationMock = {
  status: "à préparer",
  preparedBy: ""
};

export const titanReturnMock = {
  returnExpected: "",
  returnActual: "",
  notes: ""
};

export const titanBreakageMock = {
  itemsBroken: [],
  itemsLost: []
};

export const hahitantsoaEventTypes = [
  "Mariage", "Baptême", "Anniversaire", "Réception privée", "Séminaire", 
  "Corporate", "Conférence", "Atelier / Formation", "Fête familiale", "Autre"
];

export const hahitantsoaRentalTypes = [
  "Location nue",
  "Location nue + logistique",
  "Location avec package"
];

export const hahitantsoaDurationOptions = [
  { label: "Fête de jour : Sortie J-J à 20:00", price: 0 },
  { label: "Utilisation de nuit Option 1 : Arrêt de fête 21:00 / Sortie J-J à 22:30", price: 0 },
  { label: "Utilisation de nuit Option 2 : Arrêt de fête 00:00 / Sortie J+1 à 03:30", price: 0 }
];

export const hahitantsoaBreakagePrices = [
  { item: "Table", price: 500000 },
  { item: "Chaise", price: 300000 },
  { item: "Coussin", price: 50000 },
  { item: "Couvert argenté", price: 15000 },
  { item: "Couvert rose gold", price: 25000 },
  { item: "Couvert doré", price: 25000 },
  { item: "Badge", price: 2000 }
];

export const hahitantsoaBlockedIntervenants = [
  { id: "INT-1", name: "Manantsoa Events", note: "Non respect du silence", active: true },
  { id: "INT-2", name: "Taokanto", note: "Dégradation local", active: true },
  { id: "INT-3", name: "Efficiency event", note: "", active: true },
  { id: "INT-4", name: "Cute deco", note: "Problème horaires", active: true },
  { id: "INT-5", name: "M&R’s wedding planner", note: "", active: true },
  { id: "INT-6", name: "FETE PAR FETE BY BOMMARTIN", note: "Non respect consignes", active: true }
];

export const hahitantsoaAnnex2PlanPath = "/brand/Plan de masse évacuation incendie.png";

export const hahitantsoaMockVenuePrice = 1500000;
export const hahitantsoaMockLogisticsPrice = 500000;

export const mockCatalog = [
  { id: "MAT-01", name: "Chaise Napoléon transparente", category: "Mobilier", available: 150, price: 5000 },
  { id: "MAT-02", name: "Table rectangulaire 8 places", category: "Mobilier", available: 20, price: 15000 },
  { id: "MAT-03", name: "Tente 5x5m", category: "Structure", available: 5, price: 150000 },
  { id: "MAT-04", name: "Sono complète + Micro", category: "Sonorisation", available: 2, price: 300000 },
  { id: "MAT-05", name: "Chaise chiavari", category: "Mobilier", available: 200, price: 8000 },
  { id: "MAT-06", name: "Lumières d'ambiance", category: "Eclairage", available: 10, price: 50000 }
];

export const hahitantsoaMockPackages = [
  { id: "PACK-1", name: "Package Standard 100 pax", price: 2000000, desc: "Local + 100 chaises + 10 tables", imageUrl: "", active: true, articles: [{id: "MAT-01", qty: 100}, {id: "MAT-02", qty: 10}] },
  { id: "PACK-2", name: "Package Premium 200 pax", price: 3500000, desc: "Local + 200 chaises chiavari + 20 tables + Sono", imageUrl: "", active: true, articles: [{id: "MAT-05", qty: 200}, {id: "MAT-02", qty: 20}, {id: "MAT-04", qty: 1}] },
  { id: "PACK-3", name: "Package VIP 300 pax", price: 5000000, desc: "Local + 300 chaises + 30 tables + Sono + Lumières", imageUrl: "", active: true, articles: [{id: "MAT-01", qty: 300}, {id: "MAT-02", qty: 30}, {id: "MAT-04", qty: 1}, {id: "MAT-06", qty: 4}] }
];

export const hahitantsoaMockServices = [
  { id: "SRV-H1", name: "Nettoyage après événement", desc: "Nettoyage complet de la salle et des extérieurs", price: 150000, active: true },
  { id: "SRV-H2", name: "Assistance logistique", desc: "Personnel pour l'aide au déplacement de matériel", price: 100000, active: true },
  { id: "SRV-H3", name: "Mise en place / passation", desc: "Aide à la mise en place des tables et chaises", price: 80000, active: true },
  { id: "SRV-H4", name: "Support décoration", desc: "Assistance pour la suspension d'éléments", price: 120000, active: true },
  { id: "SRV-H5", name: "Support technique", desc: "Technicien sur place (électricité, plomberie)", price: 200000, active: true },
  { id: "SRV-H6", name: "Autre service", desc: "À préciser", price: 0, active: true }
];

export interface ClientParticulier {
  type: "Particulier";
  civilite: "Monsieur" | "Madame" | "";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  birthPlace: string;
  idType: "CIN" | "Passeport";
  idNumber: string;
  idIssueDate: string;
  idIssuePlace: string;
  idDuplicataDate?: string;
  idDuplicataPlace?: string;
  address: string;
  idPhotoUrl?: string;
}

export interface ClientEntreprise {
  type: "Entreprise";
  companyName: string;
  email: string;
  phone: string;
  nif: string;
  stat: string;
  rcs: string;
  repFirstName: string;
  repLastName: string;
  repRole: string;
  attachments?: { type: string, url: string }[];
}

export interface HahitantsoaEventDetails {
  eventType: string;
  eventTypeOther?: string;
  rentalType: string;
  durationOption: string;
  durationOptionPrice: number;
  guests: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  
  // Package details
  selectedPackageId?: string;
  packageCustomQty?: Record<string, number>;
  
  // Personnes concernées
  mariageGroomName?: string;
  mariageBrideName?: string;
  mariageReferentName?: string;
  
  fiancaillesPerson1?: string;
  fiancaillesPerson2?: string;
  
  baptemeChildName?: string;
  baptemeParentName?: string;
  baptemeDate?: string;
  
  otherReferentName?: string;
}

export interface TitanRentalDetails {
  period: string; // fallback
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  returnDate?: string;
  returnTime?: string;
}
