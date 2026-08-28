import React, { useMemo, useState } from "react";
import type { AppScope } from "../App";

type UserManualPageProps = { onNavigate: (scope: AppScope, param?: string) => void };
type ManualSection = { id: string; title: string; icon: string; content: React.ReactNode };

const available = "Disponible dans l’application";
const configured = "Selon les droits et les paramètres de l’entreprise";

export default function UserManualPage({ onNavigate }: UserManualPageProps) {
  const [activeSection, setActiveSection] = useState("start");
  const sections = useMemo<ManualSection[]>(() => [
    {
      id: "start",
      title: "Bien démarrer",
      icon: "fa-rocket",
      content: <>
        <p>Connectez-vous avec votre compte, puis utilisez le menu latéral pour accéder aux espaces métier. Le tableau de bord donne accès au planning, aux clients, aux deux volets commerciaux et aux opérations.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5"><li>Vérifiez le nom de l’utilisateur et l’état « En ligne » dans le menu utilisateur.</li><li>Choisissez un espace dans le menu latéral.</li><li>Utilisez le bouton « Retour » ou le fil de navigation lorsqu’une fiche est ouverte.</li><li>Déconnectez-vous depuis le menu utilisateur en fin de session.</li></ol>
        <Info title="Compte de test" tone="amber">L’environnement de test utilise actuellement <strong>admin / admin</strong>. Ce mot de passe doit être remplacé avant tout déploiement réel.</Info>
      </>,
    },
    {
      id: "clients",
      title: "Clients et prospects",
      icon: "fa-users",
      content: <><p>Ouvrez <strong>Clients & Prospects</strong> pour rechercher, créer et consulter une fiche client.</p><ol className="mt-4 list-decimal space-y-2 pl-5"><li>Créez un client en choisissant <strong>Particulier</strong> ou <strong>Entreprise</strong>.</li><li>Renseignez les coordonnées et, pour une entreprise, les identifiants NIF, STAT, RCS et le représentant.</li><li>Ouvrez la fiche pour consulter l’historique, les réservations, documents, paiements et relances.</li><li>Depuis la fiche, démarrez une réservation : le volet sera choisi ensuite.</li></ol><Info title="Données importantes" tone="blue">Les informations d’entreprise sont conservées dans la fiche et peuvent être reprises dans les contrats et documents.</Info></>,
    },
    {
      id: "hahitantsoa",
      title: "Réservation Hahitantsoa",
      icon: "fa-champagne-glasses",
      content: <><p>Le parcours Hahitantsoa couvre les événements, la location du lieu, la logistique, les articles et les services.</p><ol className="mt-4 list-decimal space-y-2 pl-5"><li>Choisissez le client, puis <strong>Hahitantsoa</strong>.</li><li>Renseignez le type d’événement, les dates et heures via le calendrier, le lieu et le nombre d’invités.</li><li>Choisissez l’un des deux types : <strong>Location nue</strong> ou <strong>Location + logistique</strong>.</li><li>Avec la logistique, sélectionnez directement les articles ou construisez un pack personnalisable, puis ajoutez les services nécessaires.</li><li>Contrôlez le résumé et le montant total, puis générez le proforma.</li><li>Après acompte et validation du contrat, le dossier devient une réservation confirmée selon les contrôles métier.</li></ol><Info title="Documents associés" tone="green">Le contrat Hahitantsoa peut être accompagné de la décharge de responsabilité et, dans le workflow logistique, de la checklist manuelle.</Info></>,
    },
    {
      id: "titan",
      title: "Réservation Titan",
      icon: "fa-truck",
      content: <><p>Titan est le volet de location de matériels et articles.</p><ol className="mt-4 list-decimal space-y-2 pl-5"><li>Choisissez le client, puis <strong>Titan</strong>.</li><li>Renseignez la période, l’usage, la destination et les informations de livraison ou retrait.</li><li>Sélectionnez les articles disponibles dans le catalogue.</li><li>Contrôlez les dates de livraison/retrait et de retour/récupération proposées.</li><li>Générez le proforma, enregistrez l’acompte puis générez le contrat.</li></ol><Info title="Règle Titan" tone="blue">Les opérations sont prévues entre 06h00 et 22h00, hors dimanches et jours fériés. Le système propose alors le jour ouvré précédent ou suivant selon l’opération.</Info></>,
    },
    {
      id: "amendments",
      title: "Avenants",
      icon: "fa-file-signature",
      content: <><p>Une réservation peut être amendée jusqu’au jour J lorsque le métier l’autorise.</p><ol className="mt-4 list-decimal space-y-2 pl-5"><li>Ouvrez la réservation depuis le volet ou la liste globale.</li><li>Choisissez « Créer un avenant ».</li><li>Indiquez le motif, les nouvelles dates/heures, les informations d’événement et les articles concernés.</li><li>Vérifiez le préflight de disponibilité et le résumé.</li><li>Créez l’avenant puis consultez son document généré.</li></ol><p className="mt-4">Les changements acceptés doivent être repris dans les étapes aval du workflow : contrat, documents, opérations logistiques et disponibilité.</p></>,
    },
    {
      id: "documents",
      title: "Documents et modèles",
      icon: "fa-file-lines",
      content: <><p>La page <strong>Documents & Modèles</strong> permet de consulter les modèles vierges et leurs variables.</p><ul className="mt-4 list-disc space-y-2 pl-5"><li>Cliquez sur un document pour afficher son aperçu.</li><li>Utilisez les boutons pour afficher ou masquer les variables.</li><li>Naviguez entre les documents avec les contrôles de présentation.</li><li>Les documents générés depuis une réservation restent rattachés au dossier.</li><li>Les coordonnées bancaires utilisées dans les documents proviennent de la banque sélectionnée et configurée.</li></ul><Info title="Fidélité documentaire" tone="green">Les contrats et proformas validés doivent être générés depuis leur parcours métier afin de conserver leurs modèles et leur mise en forme.</Info></>,
    },
    {
      id: "operations",
      title: "Stock et logistique",
      icon: "fa-boxes-stacked",
      content: <><p>Les opérations logistiques se consultent dans les espaces de préparation, livraison, retour et mouvements de stock.</p><ul className="mt-4 list-disc space-y-2 pl-5"><li>Le bon de préparation sert à organiser la sortie interne.</li><li>Le bon de livraison matérialise la sortie opérationnelle.</li><li>Pour Hahitantsoa, la checklist manuelle accompagne le bon de livraison.</li><li>Le retour permet de renseigner l’état des articles et les éventuelles pertes ou casses.</li><li>La disponibilité est recalculée à partir des mouvements réels, pas uniquement de l’aperçu commercial.</li></ul><Info title="Point de contrôle" tone="amber">La sortie de stock ne doit pas être considérée comme effectuée avant l’émission du bon de livraison selon le volet concerné.</Info></>,
    },
    {
      id: "finance",
      title: "Finance, caisse et banques",
      icon: "fa-coins",
      content: <><p>Utilisez <strong>Facturation & Paiements</strong> pour suivre les paiements liés aux dossiers, <strong>Caisse</strong> pour les opérations de caisse et <strong>Coordonnées bancaires</strong> pour les profils bancaires.</p><ul className="mt-4 list-disc space-y-2 pl-5"><li>Enregistrez le paiement avec son mode et son montant.</li><li>Confirmez le paiement lorsque la preuve est contrôlée.</li><li>Vérifiez son apparition dans le résumé financier.</li><li>Ouvrez une caisse utilisateur avant les opérations qui l’exigent, puis clôturez-la avec son rapprochement.</li><li>Configurez une banque par volet et choisissez la banque par défaut pour les documents.</li></ul><Info title="Sécurité financière" tone="blue">Les passerelles de paiement externes ne sont pas utilisées dans l’application. Les paiements sont enregistrés et confirmés par un utilisateur autorisé.</Info></>,
    },
    {
      id: "other",
      title: "Autres espaces",
      icon: "fa-layer-group",
      content: <><div className="grid gap-3 sm:grid-cols-2">{[
        ["Planning", "Consulter les dates et disponibilités opérationnelles."], ["Reporting", "Lire les indicateurs et rapports disponibles."], ["Audit & Sécurité", "Consulter les événements d’audit selon vos droits."], ["Personnel & Paie", "Consulter l’espace RH ; les règles doivent être paramétrées par le DRH."], ["Achats & Fournisseurs", "Suivre les commandes et dépenses d’approvisionnement."], ["Notifications", "Consulter les notifications générées par le système."],
      ].map(([title, text]) => <div key={title} className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold text-slate-800">{title}</h4><p className="mt-1 text-sm text-slate-600">{text}</p></div>)}</div><Info title="Droits d’accès" tone="amber">Certains menus, créations, validations et suppressions dépendent des autorisations attribuées à l’utilisateur.</Info></>,
    },
    {
      id: "support",
      title: "Aide et signalement",
      icon: "fa-headset",
      content: <><p>Depuis <strong>Aide & Support</strong>, consultez ce manuel ou signalez un problème.</p><ol className="mt-4 list-decimal space-y-2 pl-5"><li>Décrivez précisément ce qui était attendu et ce qui s’est produit.</li><li>Choisissez une gravité réaliste.</li><li>Envoyez le signalement.</li><li>Suivez son statut après rechargement de la page.</li></ol><p className="mt-4">Les erreurs d’affichage frontend sont également enregistrées automatiquement lorsque l’écran de récupération est déclenché.</p><button type="button" onClick={() => onNavigate("help")} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Ouvrir Aide & Support</button></>,
    },
  ], [onNavigate]);

  const current = sections.find((section) => section.id === activeSection) ?? sections[0];

  return <div className="page active space-y-6">
    <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Guide opérationnel</p>
      <h1 className="mt-2 text-2xl font-bold">Manuel utilisateur Hahitantsoa / Titan</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">Ce manuel décrit les parcours actuellement disponibles dans l’application. Les actions restent contrôlées par les droits et les validations du backend.</p>
      <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">{available}</span><span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">{configured}</span></div>
    </header>
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Sections du manuel" className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6">{sections.map((section) => <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${activeSection === section.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><i className={`fa-solid ${section.icon} w-5 text-center`} aria-hidden="true"></i>{section.title}</button>)}</nav>
      <article className="min-h-[520px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600"><i className={`fa-solid ${current.icon}`} aria-hidden="true"></i></div><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Section {sections.indexOf(current) + 1} / {sections.length}</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{current.title}</h2></div></div><div className="prose prose-slate mt-8 max-w-none text-sm leading-6">{current.content}</div><div className="mt-10 flex justify-between border-t border-slate-100 pt-4"><button type="button" disabled={sections.indexOf(current) === 0} onClick={() => setActiveSection(sections[Math.max(0, sections.indexOf(current) - 1)].id)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">← Précédent</button><button type="button" disabled={sections.indexOf(current) === sections.length - 1} onClick={() => setActiveSection(sections[Math.min(sections.length - 1, sections.indexOf(current) + 1)].id)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Suivant →</button></div></article>
    </div>
  </div>;
}

function Info({ title, tone, children }: { title: string; tone: "blue" | "green" | "amber"; children: React.ReactNode }) {
  const colors = { blue: "border-blue-200 bg-blue-50 text-blue-900", green: "border-emerald-200 bg-emerald-50 text-emerald-900", amber: "border-amber-200 bg-amber-50 text-amber-900" };
  return <div className={`mt-5 rounded-xl border p-4 ${colors[tone]}`}><p className="font-semibold">{title}</p><p className="mt-1 text-sm">{children}</p></div>;
}
