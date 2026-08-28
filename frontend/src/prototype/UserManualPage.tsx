import React, { useMemo, useState } from "react";
import type { AppScope } from "../App";

type UserManualPageProps = { onNavigate: (scope: AppScope, param?: string) => void };
type ManualSection = { id: string; title: string; icon: string; content: React.ReactNode };

const available = "Disponible dans l’application";
const validated2026 = "Conforme Barèmes & Processus 2026";

export default function UserManualPage({ onNavigate }: UserManualPageProps) {
  const [activeSection, setActiveSection] = useState("start");

  const sections = useMemo<ManualSection[]>(() => [
    {
      id: "start",
      title: "1. Bien démarrer & Navigation",
      icon: "fa-rocket",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Bienvenue sur <strong>Ergon ERP</strong>, la plateforme unifiée de gestion opérationnelle pour <strong>Hahitantsoa</strong> (domaine événementiel & salle) et <strong>Titan Rental</strong> (location de matériel).
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li><strong>Authentification</strong> : Connectez-vous avec votre identifiant et votre mot de passe attribué.</li>
            <li><strong>Menu latéral</strong> : Naviguez facilement entre les espaces commerciaux (Réservations, Clients, Packs, Services), opérationnels (Planning, Préparation, Livraison, Retours, Casse & Caution) et financiers (Caisse, Facturation).</li>
            <li><strong>Rôles & Habilitations</strong> : Selon votre rôle (Super-Admin, Commercial, Caissier, Logisticien), certaines actions sensibles (confirmation, encaissement, clôture) sont automatiquement filtrées et protégées.</li>
            <li><strong>Indicateur d'état</strong> : Le badge en haut à droite indique l'état de la connexion en direct avec le serveur d'agence.</li>
          </ol>
          <Info title="Recommandation de sécurité" tone="amber">
            Ne partagez jamais vos identifiants. Chaque validation financière et confirmation contractuelle est durablement tracée et auditée sous votre nom.
          </Info>
        </>
      ),
    },
    {
      id: "clients",
      title: "2. Clients, Contacts & Rendez-vous",
      icon: "fa-users",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            L'espace <strong>Clients & Prospects</strong> (<code>#customers</code>) centralise la gestion de vos contacts particuliers et entreprises.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li><strong>Création d'un client</strong> : Choisissez le type <em>Particulier</em> (Nom, Prénom, CIN, Téléphones) ou <em>Entreprise / Association</em> (Raison sociale, NIF, STAT, RCS, Représentant légal).</li>
            <li><strong>Pièces jointes & Identité</strong> : Téléversez les copies de cartes d'identité (CIN) ou passeports du signataire directement sur la fiche.</li>
            <li><strong>Points de contact multiples</strong> : Enregistrez plusieurs numéros de téléphone et emails avec leurs libellés (ex : Conjoint, Organisateur, Assistant).</li>
            <li><strong>Liste d'attente & Visites</strong> : Enregistrez les dates souhaitées (<code>#desired-dates</code>) et planifiez les rendez-vous de visite de salle dans l'agenda des visiteurs (<code>#agenda-visitors</code>).</li>
          </ol>
          <Info title="Continuité contractuelle" tone="blue">
            Les coordonnées et identifiants fiscaux saisis sur la fiche client sont automatiquement réinjectés dans les factures proformas et les contrats officiels.
          </Info>
        </>
      ),
    },
    {
      id: "hahitantsoa",
      title: "3. Réservations Hahitantsoa (Salle & Événement)",
      icon: "fa-champagne-glasses",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Le parcours <strong>Hahitantsoa</strong> (<code>#hahitantsoa</code>) gère l'organisation complète des réceptions au domaine selon le barème officiel 2026.
          </p>
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2 text-xs sm:text-sm text-slate-800">
            <p className="font-bold text-indigo-900">Règles Tarifaires Officielles 2026 :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Forfait Location Nue de base</strong> : <strong>6 500 000 Ar TTC</strong> incluant jusqu'à 250 invités.</li>
              <li><strong>Dépassement d'invités</strong> : <strong>+5 000 Ar TTC</strong> par personne supplémentaire au-delà de 250.</li>
              <li><strong>Horaires de jour</strong> : Accès préparatifs J-1 (15h30 ou 23h30) ou Jour J (07h00) — Libération impérative à <strong>20h00</strong>.</li>
              <li><strong>Option Nuit 1</strong> : <strong>+300 000 Ar</strong> (Fin de réception 21h00, libération 22h30).</li>
              <li><strong>Option Nuit 2</strong> : <strong>+500 000 Ar</strong> (Fin de réception 00h00, libération 03h30).</li>
              <li><strong>Sécurité de Nuit</strong> : <strong>+120 000 Ar</strong> (Automatiquement ajoutée dès qu'une option nuit est cochée).</li>
              <li><strong>Caution de garantie</strong> : <strong>500 000 Ar</strong> (Obligatoire, restituée après état des lieux de retour).</li>
            </ul>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Ouvrez l'assistant de nouvelle réservation (<code>#reservation-new</code>) et sélectionnez <strong>Hahitantsoa</strong>.</li>
            <li>Renseignez le client, la date, le type d'événement (Mariage, Fiançailles, Anniversaire, Banquet d'entreprise) et le nombre d'invités.</li>
            <li>Sélectionnez les prestations de scénographie 2026 souhaitées (Draperie, Voilage, Ciel étoilé, etc.).</li>
            <li>Le calculateur dynamique affiche en temps réel le total TTC, le montant de l'acompte requis et la caution.</li>
          </ol>
        </>
      ),
    },
    {
      id: "titan",
      title: "4. Titan Rental (Location Pure de Matériel)",
      icon: "fa-truck",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Le parcours <strong>Titan Rental</strong> (<code>#titan</code>) est exclusivement dédié à la location de matériels événementiels (chaises, tables, vaisselle, tentes, sono, éclairage).
          </p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 space-y-1">
            <p className="font-bold"><i className="fa-solid fa-shield-halved mr-1"></i> Frontière Métier Inviolable :</p>
            <p>Titan Rental n'expose <strong>JAMAIS</strong> de salles, lieux de réception, services traiteur ou prestations événementielles. Il accepte uniquement les articles individuels et les packs de matériel.</p>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Sélectionnez <strong>Titan Rental</strong> dans l'assistant de réservation.</li>
            <li>Définissez les dates de mise à disposition et de restitution du matériel.</li>
            <li>Sélectionnez les articles du catalogue ou choisissez un <strong>Pack de matériel prêt à l'emploi</strong>.</li>
            <li>Spécifiez le mode logistique (Livraison par Titan ou Retrait client au dépôt).</li>
            <li>Générez la facture proforma et planifiez les opérations de sortie de stock.</li>
          </ol>
        </>
      ),
    },
    {
      id: "packages",
      title: "5. Packages Commerciaux & Offres Clé en main",
      icon: "fa-boxes-packing",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Le <strong>Générateur de Packages</strong> (<code>#packages</code>) vous permet de concevoir des formules attractives combinant plusieurs articles avec une remise forfaitaire.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li><strong>Photos & Visuels</strong> : Glissez-déposez une photo locale ou saisissez une URL d'image pour illustrer le pack.</li>
            <li><strong>Calculateur de remise</strong> : Le système compare automatiquement la somme au détail des articles avec votre tarif forfaitaire et affiche l'économie réalisée par le client.</li>
            <li><strong>3 Modes de vue</strong> : Visualisez vos packs sous forme de <em>Cartes Visuelles</em> (pour la présentation client), de <em>Fiches Détaillées</em> ou de <em>Tableau de Gestion</em>.</li>
            <li><strong>Duplication rapide</strong> : Dupliquez un pack existant en un clic pour créer rapidement une variante (ex : déclinaison 100 pax / 200 pax).</li>
          </ol>
        </>
      ),
    },
    {
      id: "confirmation",
      title: "6. Tunnel de Confirmation à 5 Prérequis",
      icon: "fa-lock",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Pour garantir une sécurité juridique et financière totale, une réservation en statut <em>Option / Devis</em> ne peut être convertie en <strong>Réservation Confirmée</strong> qu'après validation stricte des <strong>5 prérequis cumulatifs</strong> :
          </p>
          <div className="mt-4 space-y-2">
            {[
              ["1. Contrat Officiel Généré", "Le contrat A4 avec ses Annexes 1, 2 et 3 doit être créé depuis le dossier."],
              ["2. Contrat Signé par le Client", "L'accord formel du client doit être enregistré et daté dans l'application."],
              ["3. Acompte Obligatoire Encaissé", "L'acompte d'engagement doit être validé par la caisse ou le compte bancaire."],
              ["4. Disponibilité Revalidée", "Le système revérifie automatiquement en temps réel l'absence de conflit sur la salle et les matériels."],
              ["5. Autorisation & Audit Backend", "Un opérateur habilité valide la confirmation finale avec enregistrement d'une trace d'audit inviolable."],
            ].map(([title, desc], index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">{index + 1}</div>
                <div>
                  <strong className="text-slate-900">{title}</strong>
                  <p className="text-slate-600 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: "logistics",
      title: "7. Logistique, Préparation & Sortie de Stock",
      icon: "fa-truck-ramp-box",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            La gestion opérationnelle du matériel s'effectue via les écrans de logistique :
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li><strong>Préparation de Stock (<code>#stock-preparation</code>)</strong> : L'équipe dépôt prépare et rassemble les articles selon le bon de préparation.</li>
            <li><strong>Bon de Livraison (BL) (<code>#logistics-dispatch</code>)</strong> : Dès le départ du camion ou la mise à disposition au client, le BL est émis et signé contradictoirement.</li>
            <li><strong>Mouvement de stock effectif</strong> : La sortie de stock comptable et physique s'opère formellement à l'émission du BL.</li>
          </ol>
        </>
      ),
    },
    {
      id: "returns",
      title: "8. Retours, Constat de Casse & Cautions",
      icon: "fa-rotate-left",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            À la fin de l'événement ou de la période de location, la clôture matérielle et financière se déroule en 3 étapes :
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li><strong>Pointage des Retours (<code>#logistics-returns</code>)</strong> : L'agent de réception pointe chaque article retourné et ventile les quantités : <em>Intact</em>, <em>Cassé / Détérioré</em>, ou <em>Manquant</em>.</li>
            <li><strong>Règlement de Casse (<code>#breakage-loss</code>)</strong> : En cas de détérioration, la facture de casse est automatiquement valorisée selon la grille tarifaire officielle (Annexe 3 du contrat).</li>
            <li><strong>Restitution de Caution (<code>#caution</code>)</strong> : La caution de 500 000 Ar est débloquée : le montant de la casse éventuelle est déduit, et le reliquat est remboursé au client avec émission du reçu justificatif.</li>
          </ol>
        </>
      ),
    },
    {
      id: "cashbox",
      title: "9. Caisse, Facturation & Tickets 80 mm",
      icon: "fa-cash-register",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            L'espace financier garantit une gestion étanche de la trésorerie et des justificatifs comptables :
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li><strong>Sessions de Caisse (<code>#cashbox</code>)</strong> : Ouverture de session chaque matin avec fond de caisse, encaissements au fil de l'eau, et clôture de caisse avec contrôle d'écart en fin de journée.</li>
            <li><strong>Reçus Thermiques 80 mm (XPrinter)</strong> : Pour chaque acompte ou règlement en espèces/chèque/virement, imprimez instantanément le reçu thermique conforme 80 mm.</li>
            <li><strong>Facturation Légale (<code>#billing</code>)</strong> : Suivi des factures proformas, factures d'acomptes intermédiaires et facture finale de solde.</li>
          </ul>
        </>
      ),
    },
    {
      id: "amendments",
      title: "10. Avenants & Modifications de Contrat",
      icon: "fa-file-signature",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Toute modification convenue avec le client avant le jour J (changement d'horaire, ajout d'invités, options de nuit, articles supplémentaires) doit faire l'objet d'un <strong>Avenant Contractuel</strong> :
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Ouvrez le dossier de réservation concerné.</li>
            <li>Cliquez sur <strong>« Créer un avenant »</strong>.</li>
            <li>Saisissez les ajustements souhaités. Le système exécute un <em>préflight de disponibilité</em> pour vérifier que les ressources supplémentaires sont bien libres.</li>
            <li>Générez l'avenant A4 à faire signer au client et recalculez l'échéancier financier.</li>
          </ol>
        </>
      ),
    },
    {
      id: "audit",
      title: "11. Planning, Reporting & Journal d'Audit",
      icon: "fa-chart-pie",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            Outils de pilotage et de contrôle pour la direction et les managers :
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Planning Général (#planning)", "Visualisation globale du calendrier des événements, des disponibilités de la salle et des réservations de matériel."],
              ["Rapports & KPI (#reporting)", "Suivi du chiffre d'affaires mensuel, du taux d'occupation de la salle, du volume de matériel loué et des encaissements."],
              ["Journal d'Audit (#audit)", "Historique exhaustif et horodaté de toutes les modifications, suppressions et confirmations sensibles avec nom de l'opérateur."],
              ["Ressources Humaines & Paie (#hr)", "Suivi du personnel d'agence et des fiches d'activité selon les règles paramétrées."],
            ].map(([title, desc], i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-slate-900 text-sm">{title}</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: "support",
      title: "12. Aide, Raccourcis & Signalements",
      icon: "fa-headset",
      content: (
        <>
          <p className="text-slate-700 leading-relaxed">
            En cas de difficulté ou de comportement inattendu lors de votre utilisation :
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
            <li>Consultez la rubrique correspondante de ce manuel utilisateur.</li>
            <li>Ouvrez l'écran <strong>Aide & Support (<code>#help</code>)</strong> pour transmettre un signalement détaillé à l'administrateur technique.</li>
            <li>En cas de coupure réseau temporaire, l'application vous avertit par un bandeau d'alerte et reprend automatiquement dès la reconnexion au serveur d'agence.</li>
          </ol>
          <button
            type="button"
            onClick={() => onNavigate("help")}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition"
          >
            Ouvrir l'Espace Aide & Support
          </button>
        </>
      ),
    },
  ], [onNavigate]);

  const current = sections.find((section) => section.id === activeSection) ?? sections[0];

  return (
    <div className="page active space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Documentation Officielle</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold">Manuel Utilisateur Ergon ERP</h1>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm text-slate-300">
              Guide complet des fonctionnalités, parcours métier, règles de confirmation et processus opérationnels pour Hahitantsoa et Titan Rental.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">{available}</span>
            <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-300">{validated2026}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav aria-label="Sections du manuel" className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold transition ${
                activeSection === section.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <i className={`fa-solid ${section.icon} w-5 text-center`} aria-hidden="true"></i>
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </nav>

        <article className="min-h-[560px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600">
                <i className={`fa-solid ${current.icon}`} aria-hidden="true"></i>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Section {sections.indexOf(current) + 1} / {sections.length}
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">{current.title}</h2>
              </div>
            </div>

            <div className="mt-6 text-sm leading-relaxed">{current.content}</div>
          </div>

          <div className="mt-10 flex justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={sections.indexOf(current) === 0}
              onClick={() => setActiveSection(sections[Math.max(0, sections.indexOf(current) - 1)].id)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              ← Précédent
            </button>
            <button
              type="button"
              disabled={sections.indexOf(current) === sections.length - 1}
              onClick={() => setActiveSection(sections[Math.min(sections.length - 1, sections.indexOf(current) + 1)].id)}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 transition"
            >
              Suivant →
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}

function Info({ title, tone, children }: { title: string; tone: "blue" | "green" | "amber"; children: React.ReactNode }) {
  const colors = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`mt-5 rounded-xl border p-4 ${colors[tone]}`}>
      <p className="font-bold text-xs sm:text-sm">{title}</p>
      <p className="mt-1 text-xs sm:text-sm leading-relaxed">{children}</p>
    </div>
  );
}

