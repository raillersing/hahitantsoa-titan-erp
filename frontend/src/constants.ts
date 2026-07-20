// ---- Business constants for document preview and UI ----

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
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export const hahitantsoaDefaultDepositAmount = 500000;
export const titanDepositThreshold = 200000;
export const titanSmallRentalDeposit = 100000;
export const titanLargeRentalDepositRate = 0.5;

export const hahitantsoaBreakagePrices = [
  { item: "Table", price: 500000 },
  { item: "Chaise", price: 300000 },
  { item: "Coussin", price: 50000 },
  { item: "Couvert argenté", price: 15000 },
  { item: "Couvert rose gold", price: 25000 },
  { item: "Couvert doré", price: 25000 },
  { item: "Badge", price: 2000 },
];

export const hahitantsoaAnnex2PlanPath = "/brand/Plan de masse évacuation incendie.png";

export const hahitantsoaAnnex1Rules = [
  "Interdiction de fumer à l'intérieur des locaux (chapiteau et bâtiments).",
  "Puissance d'appareils en cuisine limitée à 6 000 W (hors congélateur et réfrigérateur).",
  "Interdiction de toucher aux plantes du jardin (surtout pour les décorateurs).",
  "Interdiction de s'asseoir, s'appuyer sur les pierres décoratives.",
  "Mise en place de tout support suspendu assurée par notre équipe (sur devis) / à confirmer au plus tard 10 jours avant l'événement.",
  "Accès au salon restreint (mariés et proches à présenter aux responsables avant l'événement).",
  "Nourriture interdite au salon (sauf boissons).",
  "Aucun intervenant ne pourra accéder sur site avant la passation avec le représentant du Client.",
  "Accès sur site des intervenants réglementé par le port de badge mis à la disposition du Client.",
  "Badges à retourner par le Client lors de la passation de sortie.",
  "Les matériels sont loués propres ; ils devront être rendus de même.",
  "Les poubelles doivent être enlevées par les soins des intervenants.",
  "Pour raison de sécurité, lors des préparatifs, fermeture du portail à 23h00 ou 01h00 selon horaire d'entrée.",
  "Réouverture du portail à 04h30.",
  "Respecter le silence lors des préparatifs en soirée.",
  "Le client est responsable du respect du règlement par ses invités et prestataires.",
  "Le lieu doit être restitué vidé de tous les contenus et déchets.",
  "Tout dommage causé par le non-respect du règlement est à la charge du client.",
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
  { label: "Extincteurs", description: "Répartis le long des murs, vérifiés annuellement." },
];
