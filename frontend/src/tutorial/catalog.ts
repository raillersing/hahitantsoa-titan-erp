/**
 * Tutorial Catalog Registry
 * Definitions for modules and steps.
 */

import type { AppScope } from "../App";
import type { TutorialDefinition } from "./types";
import {
  CUSTOMER_TUTORIAL,
  CALENDAR_TUTORIAL,
  HAH_NEW_TUTORIAL,
  TIT_NEW_TUTORIAL,
  AMEND_TUTORIAL,
} from "./content/commercial";
import {
  STOCK_TUTORIAL,
  SETS_TUTORIAL,
  PREP_TUTORIAL,
  DELIVERY_TUTORIAL,
  RETURN_TUTORIAL,
  CLOSE_TUTORIAL,
} from "./content/logistics";

export {
  CUSTOMER_TUTORIAL,
  CALENDAR_TUTORIAL,
  HAH_NEW_TUTORIAL,
  TIT_NEW_TUTORIAL,
  AMEND_TUTORIAL,
  STOCK_TUTORIAL,
  SETS_TUTORIAL,
  PREP_TUTORIAL,
  DELIVERY_TUTORIAL,
  RETURN_TUTORIAL,
  CLOSE_TUTORIAL,
};

export const START_TUTORIAL: TutorialDefinition = {
  id: "START",
  version: 1,
  title: "Bienvenue dans votre ERP",
  shortDescription: "Se repérer dans l'application, distinguer Titan et Hahitantsoa, comprendre la navigation et les statuts des dossiers.",
  category: "discovery",
  durationMinutes: 5,
  mode: "live-readonly",
  scope: "shared",
  associatedScopes: ["dashboard", "help", "user-manual"],
  steps: [
    {
      id: "start-welcome",
      title: "Bienvenue dans votre ERP",
      body: "Cette application centralise vos clients, vos réservations, le matériel et le suivi financier. Vous pouvez découvrir l'essentiel en quelques minutes ou poursuivre votre travail.",
      whyExplanation: "Comprendre le rôle central de l'ERP dans l'activité opérationnelle quotidienne.",
      target: "dashboard-kpi-summary",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "start-brand-choice",
      title: "Choisissez la bonne activité",
      body: "L'ERP sépare strictement deux métiers : Titan pour la location de matériel seul, et Hahitantsoa pour l'organisation complète d'événements avec salle et prestations.",
      whyExplanation: "Titan n'inclut jamais de lieu ni de prestation événementielle ou décoration.",
      target: "sidebar-brand-switch",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "start-navigation",
      title: "Retrouvez votre travail",
      body: "Le menu latéral donne accès à vos listes de dossiers, au planning et aux clients. Les références débutent par T- pour Titan et H- pour Hahitantsoa.",
      whyExplanation: "Repérer immédiatement l'activité rattachée à chaque numéro de dossier.",
      target: "sidebar-nav-reservations",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "start-statuses",
      title: "Lisez le statut avant d'agir",
      body: "Un dossier traverse plusieurs statuts : Brouillon, Confirmé, Clos ou Annulé. Seul le statut « Confirmé » réserve définitivement les matériels et la salle.",
      whyExplanation: "Un devis ou proforma ne bloque jamais les disponibilités pour les autres clients.",
      target: "dashboard-upcoming-events",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "start-team-work",
      title: "Travaillez avec vos collègues",
      body: "Les dossiers clients sont partagés entre tous les collaborateurs habilités. Vous pouvez consulter et compléter un dossier initié par un collègue selon vos droits.",
      whyExplanation: "Le créateur d'un dossier n'en est pas le propriétaire exclusif.",
      target: "header-user-menu",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "start-finish",
      title: "Vous pouvez revenir ici à tout moment",
      body: "Depuis la page « Aide & Support », vous retrouverez ce centre d'apprentissage ainsi que le manuel utilisateur complet pour vous guider.",
      whyExplanation: "L'aide reste toujours disponible sans jamais effacer votre saisie en cours.",
      target: "help-tutorial-center",
      route: "help",
      completion: "continue",
      missingTarget: "explain",
    },
  ],
};

export const CONTRACT_TUTORIAL: TutorialDefinition = {
  id: "CONTRACT",
  version: 1,
  title: "Du Proforma à la Confirmation",
  shortDescription: "Maîtriser l'enchaînement officiel : Proforma -> Contrat officiel -> Signature obligatoire -> Versement contractuel -> Confirmation.",
  category: "daily",
  durationMinutes: 4,
  mode: "exercise",
  scope: "hahitantsoa",
  associatedScopes: ["reservations", "reservation-detail", "documents"],
  steps: [
    {
      id: "contract-proforma",
      title: "Le Proforma n'est pas un contrat",
      body: "Le proforma (-PF) est une estimation tarifaire transmise au client. Est-ce que l'émission du proforma garantit la réservation définitive de la salle ?",
      whyExplanation: "Tant que le contrat n'est ni signé ni validé par le versement, les créneaux restent ouverts.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "multiple-choice",
        question: "L'émission d'un proforma réserve-t-elle définitivement les dates ?",
        choices: [
          {
            id: "choice-proforma-yes",
            label: "Oui, la date est désormais bloquée pour ce client.",
            isCorrect: false,
            explanation: "Incorrect. Le proforma est un devis chiffré sans engagement ferme.",
          },
          {
            id: "choice-proforma-no",
            label: "Non, le proforma est une simple estimation sans engagement ferme.",
            isCorrect: true,
            explanation: "Exact ! Les créneaux restent libres tant que le contrat n'a pas été signé et consolidé.",
          },
        ],
      },
    },
    {
      id: "contract-validity",
      title: "Vérifiez la durée de validité",
      body: "Le contrat officiel généré comporte une date limite de validité (paramétrable, 15 jours par défaut). Que se passe-t-il si le client signe après expiration de ce délai ?",
      whyExplanation: "Le système protège les réservations contre les signatures tardives sur créneaux caducs.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "multiple-choice",
        question: "Quelle est la conséquence d'un contrat officiel arrivé à échéance sans signature ?",
        choices: [
          {
            id: "choice-validity-caduc",
            label: "Le contrat est caduc ; il faut réémettre un contrat valide avant signature.",
            isCorrect: true,
            explanation: "Parfait ! Le système bloque la signature et l'encaissement d'un contrat expiré.",
          },
          {
            id: "choice-validity-pay",
            label: "L'application accepte le paiement quand même pour ne pas perdre le client.",
            isCorrect: false,
            explanation: "Non, un contrat expiré empêche tout versement contractuel (règle DEC-009).",
          },
        ],
      },
    },
    {
      id: "contract-signature-first",
      title: "Signature préalable obligatoire",
      body: "Selon la décision métier DEC-009, quel est l'ordre chronologique obligatoire pour confirmer un dossier ?",
      whyExplanation: "Aucun paiement ne peut être saisi tant que la signature n'est pas enregistrée.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "sequence-order",
        question: "Ordonnez les étapes dans l'ordre chronologique obligatoire :",
        choices: [
          {
            id: "seq-contract-issued",
            label: "1. Émission du contrat officiel (-CT)",
            isCorrect: true,
            explanation: "Étape 1",
          },
          {
            id: "seq-contract-signed",
            label: "2. Signature du contrat par le client",
            isCorrect: true,
            explanation: "Étape 2",
          },
          {
            id: "seq-deposit-paid",
            label: "3. Enregistrement du versement contractuel",
            isCorrect: true,
            explanation: "Étape 3",
          },
          {
            id: "seq-final-confirm",
            label: "4. Confirmation définitive de la réservation",
            isCorrect: true,
            explanation: "Étape 4",
          },
        ],
        correctSequenceIds: [
          "seq-contract-issued",
          "seq-contract-signed",
          "seq-deposit-paid",
          "seq-final-confirm",
        ],
      },
    },
    {
      id: "contract-deposit-received",
      title: "Encaissement du versement contractuel",
      body: "Le montant contractuel est fixé à l'Article 5 : 1 000 000 Ar (location nue) ou 1 500 000 Ar (avec logistique). Comment enregistrez-vous ce paiement ?",
      whyExplanation: "Une référence saisie sans réception réelle constitue une anomalie financière.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "multiple-choice",
        question: "À quel moment enregistrer le versement contractuel dans l'ERP ?",
        choices: [
          {
            id: "choice-fake-ref",
            label: "J'entre une référence fictive pour bloquer la date immédiatement.",
            isCorrect: false,
            explanation: "Non, cela fausserait l'état de caisse et la comptabilité.",
          },
          {
            id: "choice-real-proof",
            label: "Je vérifie la réception réelle des fonds sur le compte ou en caisse avant de saisir le reçu.",
            isCorrect: true,
            explanation: "Exact ! La preuve de réception réelle est indispensable pour émettre le reçu officiel.",
          },
        ],
      },
    },
    {
      id: "contract-revalidation",
      title: "Revalidation transactionnelle",
      body: "Lors de la confirmation définitive, le serveur verrouille la transaction et revalide l'absence totale de conflit sur le lieu et le matériel.",
      whyExplanation: "Cette protection empêche les surréservations concurrentes.",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "contract-summary",
      title: "Synthèse du cycle contractuel",
      body: "Félicitations ! Vous maîtrisez désormais l'intégralité du cycle contractuel officiel de l'ERP Hahitantsoa / Titan.",
      completion: "continue",
      missingTarget: "explain",
    },
  ],
};

export const RECOVERY_TUTORIAL: TutorialDefinition = {
  id: "RECOVERY",
  version: 1,
  title: "Reprise de Brouillon et Synchronisation",
  shortDescription: "Savoir reprendre un assistant interrompu, comprendre la persistance serveur et réagir à un conflit 409.",
  category: "daily",
  durationMinutes: 3,
  mode: "exercise",
  scope: "shared",
  associatedScopes: ["reservations", "reservation-new", "reservation-detail"],
  steps: [
    {
      id: "recovery-sessions",
      title: "Sauvegarde automatique serveur",
      body: "Lorsque vous saisissez une réservation, chaque étape est sauvegardée sur le serveur. Si votre navigateur se ferme accidentellement, vous retrouverez votre session intacte.",
      whyExplanation: "Les étapes intermédiaires sont persistées pour éviter de recommencer la saisie.",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "recovery-multi-device",
      title: "Changement de terminal",
      body: "Vous avez commencé un dossier sur votre PC au bureau et vous souhaitez le continuer sur tablette en salle. Comment procéder ?",
      whyExplanation: "Vos brouillons temporaires sont liés à votre compte opérateur.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "multiple-choice",
        question: "Comment continuer une saisie commencée sur un autre terminal ?",
        choices: [
          {
            id: "choice-recovery-login",
            label: "Je me connecte avec le même compte sur la tablette et clique sur « Reprendre la session ».",
            isCorrect: true,
            explanation: "Parfait ! La session serveur est chargée avec les pièces jointes et matériels déjà choisis.",
          },
          {
            id: "choice-recovery-remake",
            label: "Je recrée un nouveau dossier en espérant que le serveur regroupe les deux.",
            isCorrect: false,
            explanation: "Non, cela créerait un doublon inutile. Utilisez la reprise de session.",
          },
        ],
      },
    },
    {
      id: "recovery-conflict",
      title: "Alerte de conflit (Erreur 409)",
      body: "Un message indique : « Ce brouillon a été modifié sur un autre appareil ». Quelle est la bonne réaction ?",
      whyExplanation: "L'optimistic locking empêche d'écraser involontairement les modifications d'une autre session.",
      completion: "exercise-answer",
      missingTarget: "explain",
      exercise: {
        kind: "multiple-choice",
        question: "Que faire en cas de conflit de révision 409 ?",
        choices: [
          {
            id: "choice-conflict-reload",
            label: "Recharger la version serveur pour examiner les changements récents avant de continuer.",
            isCorrect: true,
            explanation: "Exactement ! Recharger permet de synchroniser votre écran sans perdre le travail fait ailleurs.",
          },
          {
            id: "choice-conflict-force",
            label: "Forcer l'enregistrement pour écraser ce que l'autre appareil a fait.",
            isCorrect: false,
            explanation: "Non, forcer l'enregistrement détruirait le travail effectué sur l'autre appareil.",
          },
        ],
      },
    },
    {
      id: "recovery-offline",
      title: "Coupure de réseau temporaire",
      body: "Pendant une coupure Wi-Fi, l'ERP conserve votre saisie dans la mémoire locale du navigateur jusqu'au rétablissement du réseau.",
      whyExplanation: "La résilience aux micro-coupures protège la continuité du travail.",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "recovery-summary",
      title: "Session sécurisée",
      body: "Vous savez désormais travailler en toute confiance, même en alternant entre plusieurs postes ou terminaux mobiles.",
      completion: "continue",
      missingTarget: "explain",
    },
  ],
};

export const RIGHTS_TUTORIAL: TutorialDefinition = {
  id: "RIGHTS",
  version: 1,
  title: "Droits, Profil et Dossiers Partagés",
  shortDescription: "Comprendre ses habilitations, le partage de dossiers entre collègues et la demande d'accès sans assimiler un refus de droit à un bug.",
  category: "discovery",
  durationMinutes: 3,
  mode: "live-readonly",
  scope: "shared",
  associatedScopes: ["profile", "help"],
  steps: [
    {
      id: "rights-profile",
      title: "Mon compte & profil",
      body: "Consultez les rôles et permissions associés à votre compte dans l'en-tête et sur la page Profil.",
      whyExplanation: "Chaque utilisateur dispose d'un profil sécurisé issu de la session serveur.",
      target: "profile-card",
      route: "profile",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "rights-actions",
      title: "Mes actions autorisées",
      body: "Vos boutons d'action (création, confirmation, paiement) s'activent uniquement si votre rôle serveur dispose de l'habilitation correspondante.",
      whyExplanation: "Le frontend reflète strictement les autorisations serveur (principe du moindre privilège).",
      target: "profile-roles-section",
      route: "profile",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "rights-shared",
      title: "Dossiers partagés et collaboration",
      body: "Le créateur initial d'un dossier n'en est pas le propriétaire exclusif : chaque dossier validé est consultable et traçable par l'équipe autorisée.",
      whyExplanation: "L'activité de l'entreprise repose sur la continuité du service entre collègues.",
      target: "dashboard-kpi-summary",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "rights-distinction",
      title: "Accès restreint vs anomalie",
      body: "Si un bouton est absent ou grisé, ou si un message « Accès restreint » apparaît, il s'agit d'une politique de sécurité serveur et non d'une anomalie. Ne signalez pas un manque de droit comme un bug.",
      whyExplanation: "Un accès refusé par la sécurité est un comportement normal de protection des données.",
      target: "help-bug-report-card",
      route: "help",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "rights-request",
      title: "Demander un accès étendu",
      body: "Pour accéder à un module sensible (caisse, clôture, administration), adressez-vous directement à votre administrateur d'établissement.",
      whyExplanation: "Seul l'administrateur peut faire évoluer vos rôles applicatifs.",
      target: "help-tutorial-center",
      route: "help",
      completion: "continue",
      missingTarget: "explain",
    },
  ],
};

export const SUPPORT_TUTORIAL: TutorialDefinition = {
  id: "SUPPORT",
  version: 1,
  title: "Aide, Support et Notifications",
  shortDescription: "Maîtriser les notifications, le signalement d'anomalies réelles, le manuel d'utilisation et les rappels opérationnels.",
  category: "discovery",
  durationMinutes: 4,
  mode: "live-readonly",
  scope: "shared",
  associatedScopes: ["help", "dashboard", "notifications", "user-manual"],
  steps: [
    {
      id: "support-notifications",
      title: "Notifications d'activité",
      body: "La cloche en haut de l'écran vous alerte des validations, des rappels de contrat et des alertes opérationnelles sur vos dossiers.",
      whyExplanation: "Permet de suivre en temps réel les actions effectuées par vos collaborateurs.",
      target: "topbar-notifications-btn",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "support-bug-reporting",
      title: "Signaler une anomalie sans données privées",
      body: "En cas de dysfonctionnement avéré, décrivez le problème rencontré sans jamais inclure de mot de passe, de coordonnées bancaires ou de pièces d'identité réelles.",
      whyExplanation: "La protection des données clients et des identifiants est une obligation absolue.",
      target: "help-bug-report-card",
      route: "help",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "support-manual",
      title: "Manuel d'utilisation officiel",
      body: "Le manuel utilisateur présente la référence exhaustive des procédures opérationnelles et des règles de gestion.",
      whyExplanation: "Une documentation complète reste toujours consultable sans interrompre votre session.",
      target: "help-user-manual-card",
      route: "help",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "support-whatsapp",
      title: "Rappels et communication client",
      body: "Les messages et rappels clients sont préparés par l'ERP mais toujours relus et transmis humainement par l'opérateur pour garantir un accompagnement de qualité.",
      whyExplanation: "Aucun envoi automatique incontrôlé n'est effectué à votre insu.",
      target: "dashboard-kpi-summary",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
    {
      id: "support-preferences",
      title: "Confort visuel et accessibilité",
      body: "Basculez librement entre les thèmes clair et sombre pour adapter l'application à vos conditions de travail.",
      whyExplanation: "Le choix du thème est mémorisé sur votre appareil.",
      target: "topbar-theme-btn",
      route: "dashboard",
      completion: "continue",
      missingTarget: "explain",
    },
  ],
};

export const TUTORIAL_CATALOG: readonly TutorialDefinition[] = [
  START_TUTORIAL,
  RIGHTS_TUTORIAL,
  SUPPORT_TUTORIAL,
  CUSTOMER_TUTORIAL,
  CALENDAR_TUTORIAL,
  HAH_NEW_TUTORIAL,
  TIT_NEW_TUTORIAL,
  CONTRACT_TUTORIAL,
  RECOVERY_TUTORIAL,
  AMEND_TUTORIAL,
  STOCK_TUTORIAL,
  SETS_TUTORIAL,
  PREP_TUTORIAL,
  DELIVERY_TUTORIAL,
  RETURN_TUTORIAL,
  CLOSE_TUTORIAL,
];

export function getTutorialById(id: string): TutorialDefinition | undefined {
  return TUTORIAL_CATALOG.find((t) => t.id === id);
}

export function getTutorialsForScope(scope: AppScope): TutorialDefinition[] {
  return TUTORIAL_CATALOG.filter((t) => {
    if (t.associatedScopes?.includes(scope)) return true;
    return t.steps.some((s) => s.route === scope);
  });
}
