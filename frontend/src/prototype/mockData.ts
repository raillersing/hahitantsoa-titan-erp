export interface Client {
  id: string;
  initials: string;
  name: string; // Used for companyName or full name depending on type
  email: string;
  phone: string;
  type: "Particulier" | "Entreprise";
  status: "Prospect" | "Client" | "Inactif";
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
  notes?: string;
  reservationCount?: number;
  eventCount?: number;
  documentCount?: number;
}

export interface Reservation {
  id: string;
  clientId: string;
  title: string;
  date: string;
  amount: number;
  status: "Proforma" | "Contrat signé" | "En attente" | "Confirmée" | "À préparer" | "En sortie" | "Terminée";
  type: "Hahitantsoa" | "Titan";
  paidAmount?: number;
  lines?: { type: string; desc: string; qty: string; price: string; total: string; statusClass: string }[];
}

export function clampQuantity(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function formatMoney(value: number | string | undefined | null, fallback = "0 Ar"): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/\s/g, "").replace(/,/g, ".")) : Number(value);
  if (Number.isNaN(num)) return fallback;
  return `${num.toLocaleString("fr-FR")} Ar`;
}

export function formatMoneyRaw(value: number | string | undefined | null, fallback = "0,00"): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/\s/g, "").replace(/,/g, ".")) : Number(value);
  if (Number.isNaN(num)) return fallback;
  return num.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function safeNumber(value: number | string | undefined | null, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "string" ? parseFloat(value.replace(/\s/g, "").replace(/,/g, ".")) : Number(value);
  return Number.isNaN(num) ? fallback : num;
}

export function formatDateFr(dateStr: string | undefined): string {
  if (!dateStr) return "Date non renseignée";
  // Attempt to parse "YYYY-MM-DD" or similar ISO date
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2].substring(0,2), 10);
    
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    if (month >= 1 && month <= 12 && !isNaN(day)) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      return `${dayStr} ${months[month-1]} ${year}`;
    }
  }
  
  // Fallback if not matching YYYY-MM-DD
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // If it's already a formatted string like "15 Juin 2026", just try to normalize it roughly
    return dateStr.replace(/([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{4})/, (m, d, mo, y) => {
      const dd = d.length === 1 ? `0${d}` : d;
      return `${dd} ${mo.toLowerCase()} ${y}`;
    });
  }
  
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return formatter.format(date);
}

export function formatNumber(value: number | string | undefined | null, fallback = "0"): string {
  const num = safeNumber(value, Number.NaN);
  if (Number.isNaN(num)) return fallback;
  return num.toLocaleString("fr-FR");
}

export function formatQuantity(value: number | string | undefined | null, fallback = 0): number {
  return safeNumber(value, fallback);
}

export let mockClients: Client[] = [
  { id: "CUST-001", initials: "AR", name: "Ando Rakoto", email: "ando.rakoto@email.mg", phone: "+261 34 12 345 67", type: "Particulier", status: "Client", colorClass: "bg-indigo-100 text-indigo-700" },
  { id: "CUST-002", initials: "RN", name: "Rasoa Nomena", email: "rasoa.nomena@entreprise.mg", phone: "+261 32 98 765 43", type: "Entreprise", status: "Client", colorClass: "bg-emerald-100 text-emerald-700" },
  { id: "CUST-003", initials: "TR", name: "Traiteur Royal", email: "contact@traiteur-royal.mg", phone: "+261 33 45 678 90", type: "Entreprise", status: "Client", colorClass: "bg-amber-100 text-amber-700" },
  { id: "PROS-001", initials: "JD", name: "Jean Dupont", email: "jean.dupont@test.com", phone: "+261 34 00 111 22", type: "Particulier", status: "Prospect", colorClass: "bg-blue-100 text-blue-700" }
];

export function updateMockClient(updatedClient: Client) {
  const index = mockClients.findIndex(c => c.id === updatedClient.id);
  if (index >= 0) {
    mockClients[index] = updatedClient;
  }
}

export function addMockClient(newClient: Client) {
  mockClients.push(newClient);
}

export function addMockReservation(newRes: Reservation) {
  mockReservations.push(newRes);
}

export let mockReservations: Reservation[] = [
  { id: "RES-2026-0142", clientId: "CUST-001", title: "Mariage Domaine Ambohimanga", date: "15 Juin 2026", amount: 2400000, status: "Confirmée", type: "Hahitantsoa", lines: [
    { type: "Local", desc: "Salle des fêtes principale", qty: "1", price: "1 000 000 Ar", total: "1 000 000 Ar", statusClass: "info" },
    { type: "Article", desc: "Chaise pliante", qty: "200", price: "2 000 Ar", total: "400 000 Ar", statusClass: "ok" },
    { type: "Service", desc: "Service traiteur", qty: "150", price: "6 667 Ar", total: "1 000 000 Ar", statusClass: "warn" }
  ]},
  { id: "LOC-2026-0089", clientId: "CUST-001", title: "Location chaises et tables", date: "14-16 Juin 2026", amount: 850000, status: "Confirmée", type: "Titan" },
  { id: "LOC-2026-0088", clientId: "CUST-003", title: "Location matériel réception", date: "18-19 Juin 2026", amount: 1150000, status: "En sortie", type: "Titan" }
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

export const mockVenues = [
  {
    id: "VENUE-HAH-DEFAULT",
    name: "Salle des fêtes + jardin",
    type: "location_event",
    usage: "location",
    volet: "Hahitantsoa",
    active: true,
    isDefault: true,
    capacity: "Jusqu'à 300 personnes",
    note: "Local principal par défaut Hahitantsoa"
  },
  {
    id: "VENUE-HAH-GARDEN",
    name: "Jardin seul",
    type: "location_event",
    usage: "location",
    volet: "Hahitantsoa",
    active: true,
    isDefault: false,
    capacity: "Jusqu'à 150 personnes",
    note: ""
  },
  {
    id: "VENUE-LOG-MAIN",
    name: "Dépôt principal matériel",
    type: "depot_stock",
    usage: "depot_interne",
    volet: "Logistique",
    active: true,
    isDefault: false,
    capacity: "",
    note: "Stock Titan"
  },
  {
    id: "VENUE-LOG-CONS",
    name: "Dépôt consommables",
    type: "depot_stock",
    usage: "depot_interne",
    volet: "Logistique",
    active: true,
    isDefault: false,
    capacity: "",
    note: "Stock Hahitantsoa"
  }
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

export const hahitantsoaAnnex1Rules = [
  "Interdiction de fumer à l’intérieur des locaux (chapiteau et bâtiments).",
  "Puissance d’appareils en cuisine limitée à 6 000 W (hors congélateur et réfrigérateur).",
  "Interdiction de toucher aux plantes du jardin (surtout pour les décorateurs).",
  "Interdiction de s’asseoir, s’appuyer sur les pierres décoratives.",
  "Mise en place de tout support suspendu assurée par notre équipe (sur devis) / à confirmer au plus tard 10 jours avant l’événement.",
  "Accès au salon restreint (mariés et proches à présenter aux responsables avant l’événement).",
  "Nourriture interdite au salon (sauf boissons).",
  "Aucun intervenant ne pourra accéder sur site avant la passation avec le représentant du Client.",
  "Accès sur site des intervenants réglementé par le port de badge mis à la disposition du Client.",
  "Badges à retourner par le Client lors de la passation de sortie.",
  "Les matériels sont loués propres ; ils devront être rendus de même.",
  "Les poubelles doivent être enlevées par les soins des intervenants.",
  "Pour raison de sécurité, lors des préparatifs, fermeture du portail à 23h00 ou 01h00 selon horaire d’entrée.",
  "Réouverture du portail à 04h30.",
  "Respecter le silence lors des préparatifs en soirée.",
  "Le client est responsable du respect du règlement par ses invités et prestataires.",
  "Le lieu doit être restitué vidé de tous les contenus et déchets.",
  "Tout dommage causé par le non-respect du règlement est à la charge du client."
];

export const hahitantsoaAnnex2Zones = [
  { label: "Entrée principale", description: "Accès clients et invités, circulation vers le parking intérieur." },
  { label: "Salle de réception", description: "Zone principale, capacité 600 m², accès direct aux toilettes." },
  { label: "Cuisine équipée", description: "Zone réservée aux traiteurs, réfrigérateur et congélateur." },
  { label: "Salon / Loge", description: "Espace réservé aux mariés et proches." },
  { label: "Parking intérieur", description: "50 places sécurisées, accès contrôlé." },
  { label: "Parking extérieur", description: "Places supplémentaires, zone de manœuvre livraisons." },
  { label: "Issue de secours Nord", description: "Issue principale, largeur 1,50 m, signalée." },
  { label: "Issue de secours Sud", description: "Issue secondaire, accès parking extérieur." },
  { label: "Extincteurs", description: "Répartis le long des murs, vérifiés annuellement." }
];

export const hahitantsoaMockVenuePrice = 1500000;
export const hahitantsoaMockLogisticsPrice = 500000;

export const mockCatalog = [
  { id: "MAT-01", name: "Chaise Napoléon transparente", category: "Mobilier", available: 150, price: 5000, imageUrl: "" },
  { id: "MAT-02", name: "Table rectangulaire 8 places", category: "Mobilier", available: 20, price: 15000, imageUrl: "" },
  { id: "MAT-03", name: "Tente 5x5m", category: "Structure", available: 5, price: 150000, imageUrl: "" },
  { id: "MAT-04", name: "Sono complète + Micro", category: "Sonorisation", available: 2, price: 300000, imageUrl: "" },
  { id: "MAT-05", name: "Chaise chiavari", category: "Mobilier", available: 200, price: 8000, imageUrl: "" },
  { id: "MAT-06", name: "Lumières d'ambiance", category: "Eclairage", available: 10, price: 50000, imageUrl: "" }
];

const PACKAGES_STORAGE_KEY = 'hahitantsoa-titan.mock.packages.v1';

const seedPackages = [
  { id: "PACK-1", name: "Package Standard 100 pax", price: 2000000, desc: "Local + 100 chaises + 10 tables", imageUrl: "", active: true, articles: [{id: "MAT-01", qty: 100}, {id: "MAT-02", qty: 10}] },
  { id: "PACK-2", name: "Package Premium 200 pax", price: 3500000, desc: "Local + 200 chaises chiavari + 20 tables + Sono", imageUrl: "", active: true, articles: [{id: "MAT-05", qty: 200}, {id: "MAT-02", qty: 20}, {id: "MAT-04", qty: 1}] },
  { id: "PACK-3", name: "Package VIP 300 pax", price: 5000000, desc: "Local + 300 chaises + 30 tables + Sono + Lumières", imageUrl: "", active: true, articles: [{id: "MAT-01", qty: 300}, {id: "MAT-02", qty: 30}, {id: "MAT-04", qty: 1}, {id: "MAT-06", qty: 4}] }
];

export let hahitantsoaMockPackages = [...seedPackages];

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const stored = localStorage.getItem(PACKAGES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        hahitantsoaMockPackages = parsed;
      }
    }
  } catch (e) {
    console.warn("Persistance frontend mock locale (packages) - erreur de chargement", e);
  }
}

export const saveMockPackages = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(hahitantsoaMockPackages));
    } catch (e) {
      console.warn("Persistance frontend mock locale (packages) - erreur de sauvegarde", e);
    }
  }
};

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

export interface InventoryArticle {
  id: string;
  name: string;
  category: string;
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  outStock: number;
  expectedReturnStock: number;
  brokenLostStock: number;
  unitPrice: number;
  breakagePrice: number;
  status: "OK" | "Bas" | "Rupture";
  type: "Location" | "Consommable" | "Uniforme";
  imageUrl?: string;
  description?: string;
}

export const mockInventory: InventoryArticle[] = [
  { id: "MAT-01", name: "Chaise Napoléon transparente", category: "Mobilier", totalStock: 200, availableStock: 150, reservedStock: 0, outStock: 40, expectedReturnStock: 10, brokenLostStock: 0, unitPrice: 5000, breakagePrice: 150000, status: "OK", type: "Location" },
  { id: "MAT-02", name: "Table rectangulaire 8 places", category: "Mobilier", totalStock: 30, availableStock: 20, reservedStock: 0, outStock: 10, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 15000, breakagePrice: 200000, status: "OK", type: "Location" },
  { id: "MAT-03", name: "Tente 5x5m", category: "Structure", totalStock: 5, availableStock: 5, reservedStock: 0, outStock: 0, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 150000, breakagePrice: 1000000, status: "OK", type: "Location" },
  { id: "MAT-04", name: "Sono complète + Micro", category: "Sonorisation", totalStock: 2, availableStock: 0, reservedStock: 0, outStock: 2, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 300000, breakagePrice: 1500000, status: "Rupture", type: "Location" },
  { id: "MAT-05", name: "Chaise chiavari", category: "Mobilier", totalStock: 250, availableStock: 200, reservedStock: 50, outStock: 0, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 8000, breakagePrice: 120000, status: "OK", type: "Location" },
  { id: "MAT-06", name: "Lumières d'ambiance", category: "Eclairage", totalStock: 15, availableStock: 10, reservedStock: 5, outStock: 0, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 50000, breakagePrice: 300000, status: "OK", type: "Location" },
  { id: "CONS-01", name: "Savon liquide main 5L", category: "Nettoyage", totalStock: 10, availableStock: 10, reservedStock: 0, outStock: 0, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 25000, breakagePrice: 0, status: "OK", type: "Consommable" },
  { id: "UNIF-01", name: "Polo staff Titan taille M", category: "Vêtement", totalStock: 20, availableStock: 15, reservedStock: 0, outStock: 5, expectedReturnStock: 0, brokenLostStock: 0, unitPrice: 0, breakagePrice: 50000, status: "OK", type: "Uniforme" }
];

export interface StockMovement {
  id: string;
  type: "Entrée" | "Sortie" | "Retour" | "Casse" | "Perte" | "Ajustement" | "Réservation" | "Annulation";
  date: string;
  operator: string;
  articleId: string;
  quantity: number;
  reason: string;
  dossierRef?: string;
  attachments?: string[];
}

export const mockMovements: StockMovement[] = [
  { id: "MOV-001", type: "Sortie", date: "10 Juin 2026 08:00", operator: "Jean R.", articleId: "MAT-01", quantity: 40, reason: "Livraison client", dossierRef: "LOC-2026-0087" },
  { id: "MOV-002", type: "Retour", date: "11 Juin 2026 18:00", operator: "Marc T.", articleId: "MAT-01", quantity: 10, reason: "Retour anticipé", dossierRef: "LOC-2026-0087" },
  { id: "MOV-003", type: "Réservation", date: "12 Juin 2026 10:00", operator: "Alice D.", articleId: "MAT-05", quantity: 50, reason: "Réservation mariage", dossierRef: "RES-2026-0142" }
];

export interface Preparation {
  id: string;
  dossierRef: string;
  clientName: string;
  dateSortie: string;
  status: "À préparer" | "Partiel" | "Prêt" | "Bloqué";
  items: { articleId: string; name: string; qtyOrdered: number; qtyPrepared: number; available: number }[];
}

export const mockPreparations: Preparation[] = [
  { 
    id: "PREP-001", 
    dossierRef: "LOC-2026-0089", 
    clientName: "Ando Rakoto", 
    dateSortie: "14 Juin 2026", 
    status: "À préparer", 
    items: [
      { articleId: "MAT-01", name: "Chaise Napoléon transparente", qtyOrdered: 50, qtyPrepared: 0, available: 150 },
      { articleId: "MAT-02", name: "Table rectangulaire 8 places", qtyOrdered: 5, qtyPrepared: 0, available: 20 }
    ] 
  }
];

export interface Sortie {
  id: string;
  dossierRef: string;
  mode: "Livraison Titan" | "Prélèvement client" | "Livraison Hahitantsoa";
  responsable: string;
  datePrevue: string;
  dateReelle?: string;
  vehicule?: string;
  items: { articleId: string; name: string; qty: number; etatInitial: string }[];
  photos?: string[];
  signature?: string;
}

export const mockSorties: Sortie[] = [
  {
    id: "OUT-001",
    dossierRef: "LOC-2026-0087",
    mode: "Livraison Titan",
    responsable: "Chauffeur Michel",
    datePrevue: "18 Juin 2026 09:00",
    vehicule: "Fourgon 12m3",
    items: [
      { articleId: "MAT-01", name: "Chaise Napoléon transparente", qty: 40, etatInitial: "Bon état" },
      { articleId: "MAT-02", name: "Table rectangulaire 8 places", qty: 10, etatInitial: "Bon état" }
    ]
  }
];

export interface Retour {
  id: string;
  dossierRef: string;
  datePrevue: string;
  dateReelle?: string;
  items: { articleId: string; name: string; qtyExpected: number; qtyReturned: number; etat: "Bon état" | "Cassé" | "Manquant" | "Sale / non lavé" }[];
  photos?: string[];
  notes?: string;
  status?: "En retard" | "Aujourd'hui" | "À venir";
}

export const mockRetours: Retour[] = [
  {
    id: "RET-001",
    dossierRef: "LOC-2026-0087",
    datePrevue: "19 Juin 2026 18:00",
    items: [
      { articleId: "MAT-01", name: "Chaise Napoléon transparente", qtyExpected: 40, qtyReturned: 38, etat: "Manquant" },
      { articleId: "MAT-02", name: "Table rectangulaire 8 places", qtyExpected: 10, qtyReturned: 10, etat: "Bon état" },
      { articleId: "MAT-12", name: "Nappe rectangulaire blanche", qtyExpected: 10, qtyReturned: 10, etat: "Sale / non lavé" }
    ],
    notes: "2 chaises manquantes.",
    status: "En retard"
  },
  {
    id: "RET-002",
    dossierRef: "LOC-2026-0099",
    datePrevue: "22 Juin 2026 10:00",
    items: [
      { articleId: "MAT-03", name: "Guirlande lumineuse", qtyExpected: 5, qtyReturned: 5, etat: "Bon état" },
    ],
    notes: "",
    status: "Aujourd'hui"
  },
  {
    id: "RET-003",
    dossierRef: "LOC-2026-0105",
    datePrevue: "25 Juin 2026 14:00",
    items: [
      { articleId: "MAT-08", name: "Assiette plate design", qtyExpected: 100, qtyReturned: 100, etat: "Bon état" },
    ],
    notes: "",
    status: "À venir"
  }
];

export interface CassePerte {
  id: string;
  dossierRef: string;
  articleId: string;
  articleName: string;
  qtyBroken: number;
  qtyLost: number;
  priceBreakage: number;
  totalAmount: number;
  cautionAvailable: number;
  cautionRetained: number;
  diffToPay: number;
  status: "À traiter" | "Retenue validée" | "Différence à facturer" | "Clôturé";
  photos?: string[];
  notes?: string;
}

export const mockCassesPertes: CassePerte[] = [
  {
    id: "BRK-001",
    dossierRef: "LOC-2026-0087",
    articleId: "MAT-01",
    articleName: "Chaise Napoléon transparente",
    qtyBroken: 0,
    qtyLost: 2,
    priceBreakage: 150000,
    totalAmount: 300000,
    cautionAvailable: 500000,
    cautionRetained: 300000,
    diffToPay: 0,
    status: "À traiter",
    notes: "2 chaises perdues lors du retour."
  }
];

export interface Caution {
  id: string;
  dossierRef: string;
  clientName: string;
  type: "Chèque" | "Espèces" | "Virement";
  amount: number;
  status: "Conservée" | "Restituée" | "Partiellement retenue" | "Totalement retenue";
  retainedAmount: number;
  refundedAmount: number;
  notes?: string;
}

export const mockCautions: Caution[] = [
  {
    id: "CAUT-001",
    dossierRef: "LOC-2026-0089",
    clientName: "Ando R.",
    type: "Chèque",
    amount: 500000,
    status: "Conservée",
    retainedAmount: 0,
    refundedAmount: 0,
  },
  {
    id: "CAUT-002",
    dossierRef: "LOC-2026-0087",
    clientName: "Traiteur Royal",
    type: "Espèces",
    amount: 500000,
    status: "Partiellement retenue",
    retainedAmount: 300000,
    refundedAmount: 200000,
    notes: "Retenue pour 2 chaises cassées"
  }
];

// ---- Document Templates Mock ----

export interface DocumentTemplatePdfImportMetadata {
  filename: string;
  size: number;
  mimeType: string;
}

export interface MockCommercialDocumentTemplate {
  id: string;
  name: string;
  code: string;
  family: "Documents commerciaux" | "Communications" | "Clauses et textes";
  volet: "Hahitantsoa" | "Titan" | "Commun";
  type: "Avenant" | "Bon de livraison" | "Constat casse/perte" | "Contrat" | "Facture" | "Proforma" | "Bon de retour" | string;
  description: string;
  content: string;
  variables: string[];
  status: "Brouillon" | "Actif" | "Archivé";
  version: number;
  lastModified: string;
  author: string;
  pdfImportMetadata?: DocumentTemplatePdfImportMetadata;
  previousVersions?: Omit<MockCommercialDocumentTemplate, "previousVersions">[];
}

const TEMPLATES_STORAGE_KEY_V1 = 'hahitantsoa-titan.mock.document-templates.v1';
const TEMPLATES_STORAGE_KEY_V2 = 'hahitantsoa-titan.mock.commercial-document-templates.v3'; // Changed to v3 to invalidate cache

const seedTemplatesV2: MockCommercialDocumentTemplate[] = [
  // HAHITANTSOA
  { id: "TPL-H1", name: "Avenant Hahitantsoa Standard", code: "HAH-AVENANT", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Avenant", description: "Pour toute modification de la réservation", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"AVENANT AU CONTRAT\"},{\"id\":\"2\",\"type\":\"Paragraphe\",\"title\":\"\",\"text\":\"Suite à la demande de {{client.name}}...\"}]", variables: ["client.name"], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H2", name: "Bon de livraison Hahitantsoa", code: "HAH-BL", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Bon de livraison", description: "Document de livraison matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"BON DE LIVRAISON\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H3", name: "Constat casse/perte Hahitantsoa", code: "HAH-CONSTAT", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Constat casse/perte", description: "Constat de casse ou perte de matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"CONSTAT DE CASSE / PERTE\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H4", name: "Contrat Hahitantsoa Full Service", code: "HAH-CONTRAT", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Contrat", description: "Inclut traiteur, lieu et logistique complète.", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"CONTRAT DE LOCATION « HAHITANTSOA »\"},{\"id\":\"2\",\"type\":\"Paragraphe\",\"title\":\"\",\"text\":\"Entre {{client.name}} et Ergon Group...\"}]", variables: ["client.name"], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H5", name: "Facture Hahitantsoa", code: "HAH-FACTURE", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Facture", description: "Facture de la prestation", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"FACTURE\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H6", name: "Proforma Hahitantsoa", code: "HAH-PROFORMA", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Proforma", description: "Devis proforma de la prestation", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"FACTURE PROFORMA\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-H7", name: "Bon de retour Hahitantsoa", code: "HAH-RETOUR", family: "Documents commerciaux", volet: "Hahitantsoa", type: "Bon de retour", description: "Document de retour matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"BON DE RETOUR\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },

  // TITAN
  { id: "TPL-T1", name: "Bon de livraison Titan", code: "TITAN-BL", family: "Documents commerciaux", volet: "Titan", type: "Bon de livraison", description: "Document de livraison matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"BON DE LIVRAISON\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-T2", name: "Constat casse/perte Titan", code: "TITAN-CONSTAT", family: "Documents commerciaux", volet: "Titan", type: "Constat casse/perte", description: "Constat de casse ou perte de matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"CONSTAT DE CASSE / PERTE\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-T3", name: "Contrat Location Titan Standard", code: "TITAN-CONTRAT", family: "Documents commerciaux", volet: "Titan", type: "Contrat", description: "Utilisé pour les locations pures sans livraison.", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"CONTRAT DE LOCATION DE MATÉRIELS ÉVÉNEMENTIELS « TITAN RENTAL »\"},{\"id\":\"2\",\"type\":\"Paragraphe\",\"title\":\"\",\"text\":\"Entre {{client.name}} et Ergon Group...\"}]", variables: ["client.name"], status: "Actif", version: 2, lastModified: "2026-07-11", author: "Mock Admin", previousVersions: [{ id: "TPL-T3-v1", name: "Contrat Location Titan Standard", code: "TITAN-CONTRAT", family: "Documents commerciaux", volet: "Titan", type: "Contrat", description: "Brouillon initial", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"CONTRAT DE LOCATION\"}]", variables: [], status: "Archivé", version: 1, lastModified: "2026-06-01", author: "Mock Admin" }] },
  { id: "TPL-T4", name: "Facture Titan", code: "TITAN-FACTURE", family: "Documents commerciaux", volet: "Titan", type: "Facture", description: "Facture de location", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"FACTURE\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-T5", name: "Proforma Titan", code: "TITAN-PROFORMA", family: "Documents commerciaux", volet: "Titan", type: "Proforma", description: "Devis proforma de location", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"FACTURE PROFORMA\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
  { id: "TPL-T6", name: "Bon de retour Titan", code: "TITAN-RETOUR", family: "Documents commerciaux", volet: "Titan", type: "Bon de retour", description: "Document de retour matériel", content: "[{\"id\":\"1\",\"type\":\"Titre\",\"title\":\"\",\"text\":\"BON DE RETOUR\"}]", variables: [], status: "Actif", version: 1, lastModified: "2026-07-11", author: "Mock Admin" },
];

export let mockDocumentTemplates = [...seedTemplatesV2];

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const storedV2 = localStorage.getItem(TEMPLATES_STORAGE_KEY_V2);
    if (storedV2) {
      const parsed = JSON.parse(storedV2);
      if (Array.isArray(parsed)) {
        mockDocumentTemplates = parsed;
      }
    } else {
      // Fallback to V1
      const storedV1 = localStorage.getItem(TEMPLATES_STORAGE_KEY_V1);
      if (storedV1) {
        const parsed = JSON.parse(storedV1);
        if (Array.isArray(parsed)) {
          // simple migration
          mockDocumentTemplates = parsed.map((p: any) => ({
            ...p,
            variables: [],
            author: "System (Migration)",
            previousVersions: []
          }));
          localStorage.setItem(TEMPLATES_STORAGE_KEY_V2, JSON.stringify(mockDocumentTemplates));
        }
      }
    }
  } catch (e) {
    console.warn("Persistance frontend mock locale (templates v2) - erreur de chargement", e);
  }
}

export const saveMockTemplates = (templates: MockCommercialDocumentTemplate[]) => {
  mockDocumentTemplates = templates;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY_V2, JSON.stringify(mockDocumentTemplates));
    } catch (e) {
      console.warn("Persistance frontend mock locale (templates v2) - erreur de sauvegarde", e);
    }
  }
};
