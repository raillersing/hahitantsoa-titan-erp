import type { ApplicationRole, User } from "../types";

export interface PermissionMatrixItem {
  domain: string;
  icon: string;
  allowed: boolean;
  actionText: string;
}

export interface RolePresentationInfo {
  slug: string;
  title: string;
  subtitle: string;
  category: "direction" | "commercial" | "caisse" | "logistique" | "comptabilite" | "rh" | "personnalise";
  categoryLabel: string;
  badgeClass: string;
  iconClass: string;
  iconBgClass: string;
  targetAudience: string;
  summary: string;
  keyRights: string[];
  restrictions: string[];
  matrix: PermissionMatrixItem[];
  memberCount: number;
  memberNames: string[];
}

export const ROLE_PRESENTATION_CATALOG: Record<string, Omit<RolePresentationInfo, "slug" | "memberCount" | "memberNames">> = {
  // 1. Rôles Système Majeurs
  identity_admin: {
    title: "Administrateur des Accès & Sécurité",
    subtitle: "Gestion des utilisateurs, affectation des rôles et contrôle d'accès",
    category: "direction",
    categoryLabel: "Sécurité & Accès",
    badgeClass: "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    iconClass: "fa-user-shield text-purple-600 dark:text-purple-400",
    iconBgClass: "bg-purple-500/10 border-purple-500/20",
    targetAudience: "Responsable informatique, Direction générale ou administrateur délégué.",
    summary: "Responsable de la création des comptes collaborateurs, de l'attribution des rôles applicatifs et de la réinitialisation des accès. Garant de la politique de sécurité de l'ERP.",
    keyRights: [
      "Création, modification et suspension des comptes collaborateurs",
      "Attribution et révocation sécurisée des rôles applicatifs",
      "Réinitialisation immédiate des mots de passe",
      "Consultation de la piste d'audit des identités",
    ],
    restrictions: [
      "Ne peut pas modifier les barèmes comptables et tarifaires",
      "Toutes les opérations d'attribution sont tracées nominativement",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Consultation administrative des devis et dossiers" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Dédié au rôle commercial habilité" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: false, actionText: "Consultation générale des plannings" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Pas de manipulation d'espèces ni d'encaissement direct" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Téléchargement des exports pour audit et contrôle" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: true, actionText: "Administration intégrale des utilisateurs et des habilitations" },
    ],
  },

  reservation_sensitive_operator: {
    title: "Chargé d'Affaires & Confirmation Commerciale",
    subtitle: "Gestion du cycle client, signature contractuelle et confirmation formelle",
    category: "commercial",
    categoryLabel: "Commerce & Vente",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    iconClass: "fa-file-signature text-indigo-600 dark:text-indigo-400",
    iconBgClass: "bg-indigo-500/10 border-indigo-500/20",
    targetAudience: "Commerciaux seniors, chefs de projets événementiels, chargés d'affaires Titan et Hahitantsoa.",
    summary: "Rôle clé habilité à engager formellement l'agence : création de devis proformas, validation des contrats signés, constat des acomptes perçus et déclenchement de la confirmation atomique avec réservation de stock garantie.",
    keyRights: [
      "Confirmation atomique des réservations (Titan & Hahitantsoa)",
      "Validation des prérequis obligatoires (contrat signé & acompte)",
      "Création et ajustement des devis, proformas et avenants",
      "Consultation du journal d'audit des engagements commerciaux",
    ],
    restrictions: [
      "Interdiction de suppression directe de données historiques",
      "Ne peut pas modifier les comptes utilisateurs ni les paramètres système",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Création, modification et chiffrage des devis et avenants" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: true, actionText: "Signature, validation acompte et confirmation formelle" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Consultation du planning de préparation et des fiches" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Validation des montants sans tenue directe de la caisse" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Génération des proformas et suivi de facturation" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Accès restreint aux données commerciales" },
    ],
  },

  cashbox_operator: {
    title: "Caissier & Opérateur d'Encaissement",
    subtitle: "Tenue de caisse au guichet, encaissements multi-moyens et reçus 80mm",
    category: "caisse",
    categoryLabel: "Caisse & Trésorerie",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    iconClass: "fa-cash-register text-emerald-600 dark:text-emerald-400",
    iconBgClass: "bg-emerald-500/10 border-emerald-500/20",
    targetAudience: "Personnel d'accueil, caissiers d'agence, assistants de gestion financière.",
    summary: "Assure l'exploitation quotidienne du poste de caisse : ouverture et fermeture de session, saisie des règlements (espèces, chèques, virements, MVola), impression immédiate des reçus thermiques 80 mm et restitution des cautions débouclées.",
    keyRights: [
      "Ouverture et clôture des sessions de caisse physique",
      "Encaissement tous canaux (Espèces, Chèque, Virement, Mobile Money)",
      "Émission et impression directe des reçus thermiques 80 mm",
      "Remboursement des cautions sur présentation de l'obligation validée",
    ],
    restrictions: [
      "Ne peut pas modifier les tarifs du catalogue ni les forfaits",
      "Ne peut pas rouvrir une session clôturée sans supervision",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Consultation des montants à percevoir sur les dossiers" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Enregistrement des paiements déclenchant le reçu" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: false, actionText: "Non concerné par la manutention physique" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: true, actionText: "Encaissements, mouvements de caisse et reçus 80mm" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Émission de reçus et consultation des soldes clients" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès aux configurations d'utilisateurs" },
    ],
  },

  cashbox_supervisor: {
    title: "Superviseur Trésorerie & Contrôle Caisse",
    subtitle: "Validation des arrêtés de caisse, arbitrage des écarts et réouvertures",
    category: "caisse",
    categoryLabel: "Contrôle Financier",
    badgeClass: "border-teal-200 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
    iconClass: "fa-coins text-teal-600 dark:text-teal-400",
    iconBgClass: "bg-teal-500/10 border-teal-500/20",
    targetAudience: "Chef comptable, responsable administratif et financier (RAF), auditeur interne.",
    summary: "Supervise la régularité des flux d'espèces et bancaires. Habilité à valider contradictoirement les clôtures de caisse, constater les écarts et autoriser la réouverture exceptionnelle d'une session avec motif obligatoire.",
    keyRights: [
      "Validation contradictoire des arrêtés journaliers de caisse",
      "Autorisation de réouverture exceptionnelle d'une caisse clôturée",
      "Supervision transversale de tous les opérateurs de caisse",
      "Consultation des journaux d'audit de trésorerie",
    ],
    restrictions: [
      "Toute réouverture fait l'objet d'un enregistrement d'audit infalsifiable",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Vérification des montants facturés et encaissés" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: true, actionText: "Contrôle de conformité des flux d'acompte" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: false, actionText: "Périmètre financier exclusif" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: true, actionText: "Validation des arrêtés, contrôle des écarts et réouvertures" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Audit des journaux de trésorerie et réconciliation" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Séparation stricte entre contrôle et administration" },
    ],
  },

  // 2. Rôles Opérationnels Métier (Entreprise)
  logistics_manager: {
    title: "Responsable Logistique & Chef de Parc",
    subtitle: "Coordination des sorties de matériel, livraisons et suivi des retours",
    category: "logistique",
    categoryLabel: "Logistique & Parc",
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
    iconClass: "fa-truck-ramp-box text-cyan-600 dark:text-cyan-400",
    iconBgClass: "bg-cyan-500/10 border-cyan-500/20",
    targetAudience: "Responsable d'entrepôt, coordinateur logistique des événements, chef de parc matériel.",
    summary: "Pilote la logistique matérielle de bout en bout : planification des départs, génération des fiches de préparation et bons de livraison (BL), pointage contradictoire des retours et constat officiel des casses et pertes.",
    keyRights: [
      "Génération et émargement des fiches de préparation de commande",
      "Émission et signature des Bons de Livraison (BL) et fiches de passation",
      "Pointage contradictoire des retours de matériel en dépôt",
      "Constatation et déclaration de casse ou de perte matérielle",
    ],
    restrictions: [
      "Ne peut pas modifier les conditions tarifaires ni les remises",
      "Ne gère pas l'encaissement direct au guichet",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Consultation des listes d'articles et quantités réservées" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Préparation conditionnée à la confirmation validée" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Gestion totale des sorties, BL, passation et retours" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Déclaration de casse transmise pour imputation financière" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Transmission des constats au service facturation" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès aux configurations système" },
    ],
  },

  storekeeper: {
    title: "Magasinier & Gestionnaire de Stock",
    subtitle: "Préparation physique au dépôt, inventaire et réception des retours",
    category: "logistique",
    categoryLabel: "Entrepôt & Stock",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    iconClass: "fa-boxes-stacked text-sky-600 dark:text-sky-400",
    iconBgClass: "bg-sky-500/10 border-sky-500/20",
    targetAudience: "Magasiniers, préparateurs de commandes matérielles, agents de stock.",
    summary: "Prépare physiquement les articles au dépôt, effectue le comptage contradictoire avant chargement et contrôle l'état du matériel lors de la restitution client.",
    keyRights: [
      "Consultation des fiches de préparation d'expédition",
      "Pointage physique des matériels, articles et packs loués",
      "Alerte immédiate en cas de matériel abîmé ou manquant au retour",
      "Mise à jour des mouvements de stock en entrepôt",
    ],
    restrictions: [
      "Pas de modification contractuelle ni financière",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Lecture des matériels à préparer" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Exécution subordonnée aux dossiers confirmés" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Pointage physique, préparation et réception retours" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Pas d'accès à la caisse" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Aucun accès comptable" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès aux paramètres" },
    ],
  },

  accountant: {
    title: "Comptable & Gestionnaire Financier",
    subtitle: "Facturation définitive, lettrage des règlements et exports PCG 2005 / CGI",
    category: "comptabilite",
    categoryLabel: "Comptabilité & Finance",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    iconClass: "fa-file-invoice-dollar text-emerald-600 dark:text-emerald-400",
    iconBgClass: "bg-emerald-500/10 border-emerald-500/20",
    targetAudience: "Comptable d'agence, contrôleur de gestion, responsable de la facturation.",
    summary: "Assure la régularité comptable et fiscale : émission des factures définitives et de pénalité de casse, lettrage des paiements reçus et génération des journaux comptables au format standard malgache (PCG 2005 / CGI).",
    keyRights: [
      "Émission et numérotation séquentielle des factures définitives",
      "Émission des factures de dédommagement en cas de casse ou perte",
      "Téléchargement des exports tabulaires (Journal Ventes, Caisse, Cautions, Casses)",
      "Rapprochement bancaire et suivi des créances clients",
    ],
    restrictions: [
      "Ne modifie pas les plannings d'occupation des salles ni les stocks",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Consultation et conversion en factures définitives" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: true, actionText: "Suivi des engagements financiers et cautions" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: false, actionText: "Réception des procès-verbaux de casse pour facturation" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: true, actionText: "Suivi des encaissements et arrêtés de trésorerie" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Émission complète et exports comptables certifiés" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Consultation des séquences de numérotation" },
    ],
  },

  owner_manager: {
    title: "Direction Générale & Gérant",
    subtitle: "Pilotage stratégique, arbitrages d'exception et gouvernance globale",
    category: "direction",
    categoryLabel: "Direction & Décision",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    iconClass: "fa-crown text-amber-600 dark:text-amber-400",
    iconBgClass: "bg-amber-500/10 border-amber-500/20",
    targetAudience: "Gérant, propriétaire de l'entreprise, directoire.",
    summary: "Vision et autorité complète sur l'ensemble de l'activité de l'agence. Arbitre les litiges commerciaux, autorise les dérogations exceptionnelles et consulte l'ensemble des indicateurs de rentabilité et d'audit.",
    keyRights: [
      "Accès transversal à l'ensemble des modules opérationnels",
      "Validation des remises exceptionnelles et arbitrages de caution",
      "Consultation des tableaux de bord financiers et de performance",
      "Inspection complète de la piste d'audit de l'agence",
    ],
    restrictions: [
      "Les suppressions de données restent sécurisées (soft-delete obligatoire)",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Accès total, révision et arbitrages" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: true, actionText: "Validation et confirmation de haut niveau" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Supervision globale du parc et des plannings" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: true, actionText: "Supervision financière et arrêtés de comptes" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Consultation et extraction des rapports complets" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: true, actionText: "Supervision des habilitations et paramètres de l'agence" },
    ],
  },

  manager: {
    title: "Responsable Opérationnel / Manager",
    subtitle: "Coordination quotidienne de l'agence, des ventes et des opérations",
    category: "direction",
    categoryLabel: "Management & Opérations",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    iconClass: "fa-briefcase text-blue-600 dark:text-blue-400",
    iconBgClass: "bg-blue-500/10 border-blue-500/20",
    targetAudience: "Directeur adjoint, chef d'agence, manager des opérations.",
    summary: "Coordonne l'activité quotidienne de l'agence entre le service commercial, l'entrepôt logistique et l'accueil client. Assure la fluidité des parcours de réservation et la résolution rapide des aléas.",
    keyRights: [
      "Supervision du calendrier des événements et de la disponibilité du matériel",
      "Validation des devis et des contrats de location",
      "Coordination des plannings logistiques et des retours",
      "Consultation des rapports d'activité opérationnels",
    ],
    restrictions: [
      "Ne peut pas modifier la configuration technique du serveur",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Validation et suivi des offres clients" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: true, actionText: "Confirmation et arbitrage des disponibilités" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Supervision des expéditions et réceptions" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: true, actionText: "Consultation des encaissements et soldes" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: true, actionText: "Accès aux rapports et indicateurs d'agence" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès aux configurations de sécurité système" },
    ],
  },

  hr_manager: {
    title: "Responsable Ressources Humaines",
    subtitle: "Gestion administrative du personnel et suivi des règles de paie",
    category: "rh",
    categoryLabel: "Ressources Humaines",
    badgeClass: "border-pink-200 bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800",
    iconClass: "fa-users text-pink-600 dark:text-pink-400",
    iconBgClass: "bg-pink-500/10 border-pink-500/20",
    targetAudience: "Responsable RH, gestionnaire de paie, assistant administratif.",
    summary: "Gère les dossiers administratifs des collaborateurs de l'agence, le suivi des heures, des congés et les paramètres des fiches de paie.",
    keyRights: [
      "Gestion des fiches collaborateurs et contacts",
      "Paramétrage des règles de paie et indemnités de l'agence",
      "Suivi des plannings des équipes de livraison et d'entretien",
    ],
    restrictions: [
      "Pas d'accès aux flux financiers commerciaux ni aux caisses",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: false, actionText: "Non concerné par le cycle de vente" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Aucune action contractuelle client" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: false, actionText: "Planning des chauffeurs et manutentionnaires" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Périmètre RH uniquement" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Pas d'accès aux factures commerciales" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: true, actionText: "Gestion des profils collaborateurs et données RH" },
    ],
  },

  delivery_driver: {
    title: "Chauffeur / Livreur Matériel",
    subtitle: "Acheminement sur site, émargement de livraison et reprise",
    category: "logistique",
    categoryLabel: "Transport & Livraison",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    iconClass: "fa-truck text-amber-600 dark:text-amber-400",
    iconBgClass: "bg-amber-500/10 border-amber-500/20",
    targetAudience: "Chauffeurs, livreurs, agents de transport événementiel.",
    summary: "Prend en charge le transport du matériel de l'entrepôt jusqu'au lieu de l'événement. Fait signer le Bon de Livraison contradictoire sur site et ramène le matériel au dépôt.",
    keyRights: [
      "Consultation des adresses de livraison et créneaux horaires",
      "Accès aux fiches de passation et bons de livraison",
      "Recueil de la signature client à la livraison sur site",
    ],
    restrictions: [
      "Aucun accès aux montants financiers ni aux données sensibles",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: false, actionText: "Pas d'accès aux devis" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Intervention uniquement après confirmation" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Consultation des adresses, fiches de route et signature BL" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Pas de manipulation de caisse" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Aucun accès comptable" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès aux configurations" },
    ],
  },

  cleaner: {
    title: "Agent d'Entretien & Nettoyage",
    subtitle: "Nettoyage, vérification de propreté des salles et remise en état",
    category: "logistique",
    categoryLabel: "Entretien & Salle",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconClass: "fa-broom text-slate-600 dark:text-slate-400",
    iconBgClass: "bg-slate-500/10 border-slate-500/20",
    targetAudience: "Équipe d'entretien, agents de remise en état des salles Hahitantsoa.",
    summary: "Assure le nettoyage rigoureux de la salle, des sanitaires et du mobilier avant et après chaque événement pour garantir une prestation impeccable.",
    keyRights: [
      "Consultation des créneaux de préparation et de fin d'événement",
      "Validation de l'état de propreté pour libération de la salle",
    ],
    restrictions: [
      "Accès strictement limité aux plannings d'entretien",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: false, actionText: "Pas d'accès" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Pas d'accès" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Consultation des horaires de mise à disposition" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Pas d'accès" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Pas d'accès" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Pas d'accès" },
    ],
  },
};

/**
 * Retourne la fiche de présentation enrichie d'un rôle avec comptage des utilisateurs réels.
 */
export function getRolePresentation(role: ApplicationRole, users: User[] = []): RolePresentationInfo {
  const slug = role.slug;
  const catalogEntry = ROLE_PRESENTATION_CATALOG[slug];

  // Calcul dynamique des membres affectés à ce rôle
  const matchingUsers = users.filter((u) => {
    // Vérifier si le rôle correspond par slug ou nom
    return (
      (u.role_names && u.role_names.some((rn) => rn.toLowerCase() === role.name.toLowerCase() || rn.toLowerCase() === role.slug.toLowerCase())) ||
      (role.slug === "identity_admin" && u.is_staff) ||
      (role.slug === "owner_manager" && u.is_staff)
    );
  });

  const memberNames = matchingUsers.map((u) => u.display_name || u.username);
  const memberCount = matchingUsers.length;

  if (catalogEntry) {
    return {
      slug,
      memberCount,
      memberNames,
      ...catalogEntry,
      // Si le rôle en base a une description plus personnalisée que le catalogue par défaut, la respecter si approprié
      title: catalogEntry.title,
    };
  }

  // Rôle Personnalisé (créé par l'utilisateur) ou non répertorié
  return {
    slug,
    title: role.name,
    subtitle: role.is_system_managed ? "Habilitation système standard" : "Rôle d'agence personnalisé",
    category: "personnalise",
    categoryLabel: role.is_system_managed ? "Système" : "Personnalisé",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconClass: "fa-shield-halved text-slate-600 dark:text-slate-400",
    iconBgClass: "bg-slate-500/10 border-slate-500/20",
    targetAudience: "Collaborateurs désignés par la direction selon la fiche de poste.",
    summary: role.description || "Rôle applicatif paramétré pour les besoins spécifiques de l'agence.",
    keyRights: [
      "Habilitations définies selon la politique de profil de l'agence",
      "Traçabilité des opérations dans le journal d'audit",
    ],
    restrictions: [
      "Ne peut effectuer que les actions expressément allouées",
    ],
    matrix: [
      { domain: "Devis & Proformas", icon: "fa-file-lines", allowed: true, actionText: "Accès standard selon permissions" },
      { domain: "Confirmation & Contrats", icon: "fa-lock", allowed: false, actionText: "Restreint par défaut" },
      { domain: "Logistique & Entrepôt", icon: "fa-truck-ramp-box", allowed: true, actionText: "Accès opérationnel" },
      { domain: "Caisse & Règlements", icon: "fa-cash-register", allowed: false, actionText: "Restreint par défaut" },
      { domain: "Factures & Exports", icon: "fa-file-invoice-dollar", allowed: false, actionText: "Restreint par défaut" },
      { domain: "Accès & Paramètres", icon: "fa-sliders", allowed: false, actionText: "Restreint par défaut" },
    ],
    memberCount,
    memberNames,
  };
}
