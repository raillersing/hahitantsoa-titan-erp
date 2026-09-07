import React, { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createCustomer,
  getCustomers,
  transitionProspectStatus,
  uploadAttachment,
} from "../api";
import type { Customer as ApiCustomer, CustomerContactPoint, Client } from "../types";
import { AvailabilityDatePicker, EmptyState, LoadingSpinner } from "../components";
import { useTableSort, SortableHeader } from "./tableSortUtils";

interface CustomersPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
  canSuperAdminDelete?: boolean;
}

type LegalAttachmentCategory = "CIN" | "Passeport" | "NIF" | "STAT" | "RCS";
type CustomerWizardAttachment = {
  id: string;
  name: string;
  category: string;
  label?: string;
  status: string;
  file: File;
};

type CustomerContactDraft = CustomerContactPoint & { id: string };

function AttachmentMiniPreview({ attachment }: { attachment: CustomerWizardAttachment }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = attachment.file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(attachment.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file, isImage]);

  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      title={attachment.name}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Aperçu ${attachment.category}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <i className="fa-solid fa-file-pdf text-rose-500" aria-hidden="true"></i>
      )}
    </span>
  );
}

export default function CustomersPage({
  onNavigate,
  canSensitiveWrite = false,
  canSuperAdminDelete = false,
}: CustomersPageProps) {
  const [apiClients, setApiClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("Tous");

  // Modes de création
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isAddingProspect, setIsAddingProspect] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // État pour la création EXPRESS de Prospect
  // -------------------------------------------------------------
  const [prospectType, setProspectType] = useState<"Particulier" | "Entreprise">("Particulier");
  const [prospectName, setProspectName] = useState("");
  const [prospectRepName, setProspectRepName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectDomain, setProspectDomain] = useState<"Hahitantsoa" | "Titan Rental" | "Indécis">("Hahitantsoa");
  const [prospectRequestedDate, setProspectRequestedDate] = useState("");
  const [prospectBudget, setProspectBudget] = useState("");
  const [prospectInitialStatus, setProspectInitialStatus] = useState<string>("new");
  const [prospectFollowUpDate, setProspectFollowUpDate] = useState("");
  const [prospectNote, setProspectNote] = useState("");

  // -------------------------------------------------------------
  // État pour l'assistant CLIENT officiel (KYC complet)
  // -------------------------------------------------------------
  const [newType, setNewType] = useState<"Particulier" | "Entreprise">("Particulier");
  const [newStatus, setNewStatus] = useState<"Prospect" | "Client">("Client");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState<CustomerContactDraft[]>([]);
  const [contactError, setContactError] = useState<string | null>(null);

  const [newCivilite, setNewCivilite] = useState<"Monsieur" | "Madame" | "">("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");
  // Particulier
  const [newIdType, setNewIdType] = useState<"CIN" | "Passeport">("CIN");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newIdIssuePlace, setNewIdIssuePlace] = useState("");
  const [newIdIssueDate, setNewIdIssueDate] = useState("");
  const [newIdDuplicataDate, setNewIdDuplicataDate] = useState("");
  const [newIdDuplicataPlace, setNewIdDuplicataPlace] = useState("");
  // Entreprise
  const [newNif, setNewNif] = useState("");
  const [newStat, setNewStat] = useState("");
  const [newRcs, setNewRcs] = useState("");
  const [newRepName, setNewRepName] = useState("");
  const [newRepRole, setNewRepRole] = useState("");

  const [wizardStep, setWizardStep] = useState(1);
  const [maxWizardStep, setMaxWizardStep] = useState(1);
  const [attachments, setAttachments] = useState<CustomerWizardAttachment[]>([]);
  const [legalAttachments, setLegalAttachments] = useState<Partial<Record<LegalAttachmentCategory, CustomerWizardAttachment>>>({});
  const [attachmentLabel, setAttachmentLabel] = useState("");

  // Pipeline status helpers
  const PROSPECT_STATUS_LABELS: Record<string, string> = {
    new: "Nouveau",
    contact_attempted: "Tentative de contact",
    contacted: "Contacté",
    qualified: "Qualifié",
    proforma_sent: "Proforma envoyée",
    to_recall: "À relancer",
    converted: "Converti",
    disqualified: "Non qualifié",
    lost: "Perdu",
  };

  const getProspectStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "new":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "contact_attempted":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "contacted":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "qualified":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "proforma_sent":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "to_recall":
        return "bg-yellow-50 text-yellow-800 border-yellow-200";
      case "converted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "disqualified":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "lost":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const mapApiCustomer = (customer: ApiCustomer): Client => {
    const isProspect = customer.lifecycle_status === "prospect";
    const isCompany = customer.party_type === "company";
    const name = customer.display_name || "Client sans nom";
    return {
      id: customer.id,
      initials: name.slice(0, 2).toUpperCase(),
      name,
      email: customer.email,
      phone: customer.phone,
      type: isCompany ? "Entreprise" : "Particulier",
      status: isProspect ? "Prospect" : "Client",
      colorClass: isProspect
        ? "bg-blue-100 text-blue-700"
        : isCompany
        ? "bg-emerald-100 text-emerald-700"
        : "bg-indigo-100 text-indigo-700",
      address: customer.address,
      notes: customer.notes,
      reservationCount: customer.reservation_count ?? 0,
      eventCount: customer.event_count ?? 0,
      documentCount: customer.document_count ?? 0,
      prospectStatus: customer.prospect_status,
      prospectStatusChangedAt: customer.prospect_status_changed_at,
      prospectStatusReason: customer.prospect_status_reason,
      prospectNextFollowUp: customer.prospect_next_follow_up,
    };
  };

  const loadCustomers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const customers = await getCustomers();
      setApiClients(customers.map(mapApiCustomer));
    } catch {
      setLoadError("Impossible de charger les fiches clients. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  // Compteurs par catégorie
  const counts = useMemo(() => {
    const total = apiClients.length;
    const prospects = apiClients.filter((c) => c.status === "Prospect").length;
    const clients = apiClients.filter((c) => c.status === "Client").length;
    const toRecall = apiClients.filter(
      (c) => c.status === "Prospect" && (c.prospectStatus === "to_recall" || Boolean(c.prospectNextFollowUp))
    ).length;
    const particuliers = apiClients.filter((c) => c.type === "Particulier").length;
    const entreprises = apiClients.filter((c) => c.type === "Entreprise").length;
    return { total, prospects, clients, toRecall, particuliers, entreprises };
  }, [apiClients]);

  const filteredClients = useMemo(() => {
    return apiClients.filter((c) => {
      // Recherche textuelle
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchSearch =
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // Filtres par onglet / type
      if (filterType === "Prospects" && c.status !== "Prospect") return false;
      if (filterType === "Clients" && c.status !== "Client") return false;
      if (filterType === "Particuliers" && c.type !== "Particulier") return false;
      if (filterType === "Entreprises" && c.type !== "Entreprise") return false;
      if (filterType === "Avec dossier actif" && !c.reservationCount) return false;
      if (filterType === "À relancer") {
        if (c.status !== "Prospect") return false;
        if (c.prospectStatus !== "to_recall" && !c.prospectNextFollowUp) return false;
      }

      return true;
    });
  }, [apiClients, searchQuery, filterType]);

  type CustomerSortKey = "name" | "type" | "category" | "status" | "followUp" | "reservationCount";

  const { sortConfig, handleSort, resetSort, sortItems } = useTableSort<Client, CustomerSortKey>({
    extractors: {
      followUp: (c) => c.prospectNextFollowUp || (c as any).lastActivity || "",
      category: (c) => (c as any).clientCategory || (c as any).category || "",
      reservationCount: (c) => c.reservationCount || 0,
    },
    tieBreaker: (a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }),
  });

  const sortedClients = useMemo(() => sortItems(filteredClients), [sortItems, filteredClients]);

  // -------------------------------------------------------------
  // GESTION CRÉATION PROSPECT EXPRESS
  // -------------------------------------------------------------
  const resetProspectForm = () => {
    setProspectType("Particulier");
    setProspectName("");
    setProspectRepName("");
    setProspectPhone("");
    setProspectEmail("");
    setProspectDomain("Hahitantsoa");
    setProspectRequestedDate("");
    setProspectBudget("");
    setProspectInitialStatus("new");
    setProspectFollowUpDate("");
    setProspectNote("");
    setCreateError(null);
  };

  const handleCreateProspect = async (
    e?: React.FormEvent,
    actionAfter: "detail" | "quote" | "visit" = "detail"
  ) => {
    if (e) e.preventDefault();
    if (!prospectName.trim() && !prospectRepName.trim()) return;

    const finalName =
      prospectType === "Particulier"
        ? prospectName.trim()
        : prospectName.trim() || prospectRepName.trim();

    setIsCreating(true);
    setCreateError(null);

    try {
      const contactPoints = [
        ...(prospectEmail.trim()
          ? [{ kind: "email" as const, value: prospectEmail.trim(), label: "Principal", is_primary: true }]
          : []),
        ...(prospectPhone.trim()
          ? [{ kind: "phone" as const, value: prospectPhone.trim(), label: "Principal", is_primary: true }]
          : []),
      ];

      const created = await createCustomer({
        display_name: finalName,
        lifecycle_status: "prospect",
        party_type: prospectType === "Entreprise" ? "company" : "individual",
        email: prospectEmail.trim(),
        phone: prospectPhone.trim(),
        contact_points: contactPoints,
        notes: prospectNote.trim(),
        prospect_request_type:
          prospectDomain === "Titan Rental"
            ? "Location Matériel"
            : prospectDomain === "Hahitantsoa"
            ? "Événementiel"
            : "Information",
        prospect_interest_domain: prospectDomain,
        prospect_requested_date: prospectRequestedDate || null,
        prospect_budget: prospectBudget.trim() || undefined,
        representative_name: prospectType === "Entreprise" ? prospectRepName.trim() : "",
      });

      // Mettre à jour le statut du pipeline et la date de relance si nécessaire
      if (prospectFollowUpDate || prospectInitialStatus !== "new") {
        try {
          await transitionProspectStatus(created.id, {
            prospect_status: prospectInitialStatus,
            next_follow_up: prospectFollowUpDate || null,
            reason: prospectNote.trim() ? `Création express: ${prospectNote.trim().slice(0, 100)}` : undefined,
          });
        } catch {
          // Non-bloquant si la transition échoue
        }
      }

      setIsAddingProspect(false);
      resetProspectForm();
      await loadCustomers();

      if (actionAfter === "quote") {
        onNavigate("reservation-new", created.id);
      } else if (actionAfter === "visit") {
        onNavigate("planning");
      } else {
        onNavigate("customer", created.id);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        setCreateError("Vous n'êtes pas autorisé à créer un prospect.");
      } else if (error instanceof ApiError && error.status === 400) {
        setCreateError("Les informations saisies sont invalides. Vérifiez le nom et les coordonnées.");
      } else {
        setCreateError("L'enregistrement du prospect n'a pas pu aboutir. Réessayez.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  // -------------------------------------------------------------
  // GESTION CRÉATION CLIENT OFFICIEL (WIZARD KYC)
  // -------------------------------------------------------------
  const resetClientWizard = () => {
    setWizardStep(1);
    setMaxWizardStep(1);
    setNewType("Particulier");
    setNewStatus("Client");
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setAdditionalContacts([]);
    setContactError(null);
    setNewCivilite("");
    setNewBirthDate("");
    setNewAddress("");
    setNewNotes("");
    setNewIdType("CIN");
    setNewIdNumber("");
    setNewIdIssuePlace("");
    setNewIdIssueDate("");
    setNewIdDuplicataDate("");
    setNewIdDuplicataPlace("");
    setNewNif("");
    setNewStat("");
    setNewRcs("");
    setNewRepName("");
    setNewRepRole("");
    setAttachments([]);
    setLegalAttachments({});
    setAttachmentLabel("");
    setCreateError(null);
  };

  const goNextStep = () => {
    setWizardStep((s) => {
      const next = s + 1;
      setMaxWizardStep((max) => Math.max(max, next));
      return next;
    });
  };
  const goPrevStep = () => setWizardStep((s) => s - 1);

  const handleCreateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName && !newRepName) return;

    const finalName = newType === "Particulier" ? newName : newName || newRepName;
    const contactPoints = [
      ...(newEmail.trim()
        ? [
            {
              id: "email-primary",
              kind: "email" as const,
              value: newEmail.trim(),
              label: "",
              is_primary: !additionalContacts.some((contact) => contact.kind === "email" && contact.is_primary),
            },
          ]
        : []),
      ...(newPhone.trim()
        ? [
            {
              id: "phone-primary",
              kind: "phone" as const,
              value: newPhone.trim(),
              label: "",
              is_primary: !additionalContacts.some((contact) => contact.kind === "phone" && contact.is_primary),
            },
          ]
        : []),
      ...additionalContacts.map((contact) => ({
        ...contact,
        value: contact.value.trim(),
        label: contact.label?.trim() || "",
      })),
    ];
    if (contactPoints.some((contact) => !contact.value)) {
      setContactError("Chaque contact ajouté doit contenir un e-mail ou un numéro de téléphone.");
      return;
    }
    setContactError(null);
    setIsCreating(true);
    setCreateError(null);

    try {
      const created = await createCustomer({
        display_name: finalName.trim(),
        lifecycle_status: "client",
        party_type: newType === "Entreprise" ? "company" : "individual",
        email: newEmail,
        phone: newPhone,
        contact_points: contactPoints.map(({ id: _id, ...contact }) => contact),
        address: newAddress,
        birth_date: newBirthDate || null,
        id_type: newType === "Particulier" ? newIdType : "",
        id_number: newIdNumber,
        id_issue_place: newIdIssuePlace,
        id_issue_date: newIdIssueDate || null,
        id_duplicata_date: newIdDuplicataDate || null,
        id_duplicata_place: newIdDuplicataPlace,
        nif: newNif,
        stat: newStat,
        rcs: newRcs,
        representative_name: newRepName,
        representative_role: newRepRole,
        notes: newNotes,
      });

      const pendingAttachments = [
        ...Object.values(legalAttachments).filter((attachment): attachment is CustomerWizardAttachment =>
          Boolean(attachment)
        ),
        ...attachments,
      ];
      const uploadResults = await Promise.allSettled(
        pendingAttachments.map((attachment) =>
          uploadAttachment(
            attachment.file,
            attachment.category,
            { customerId: created.id },
            undefined,
            attachment.label || attachment.category
          )
        )
      );
      const uploadFailed = uploadResults.some((result) => result.status === "rejected");
      setIsAddingClient(false);
      resetClientWizard();
      if (uploadFailed) {
        setCreateError("Le client a été créé, mais certaines pièces jointes n’ont pas pu être enregistrées.");
      }
      await loadCustomers();
      onNavigate("customer", created.id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        setCreateError("Vous n’êtes pas autorisé à créer un client.");
      } else if (error instanceof ApiError && error.status === 400) {
        setCreateError("Les informations saisies sont invalides. Vérifiez le nom et les coordonnées.");
      } else {
        setCreateError("La création n’a pas pu être enregistrée. Réessayez.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const addContact = (kind: CustomerContactPoint["kind"]) => {
    setAdditionalContacts((contacts) => [
      ...contacts,
      {
        id: crypto.randomUUID(),
        kind,
        value: "",
        label: "",
        is_primary:
          !contacts.some((contact) => contact.kind === kind && contact.is_primary) &&
          (kind === "email" ? !newEmail.trim() : !newPhone.trim()),
      },
    ]);
  };

  const updateAdditionalContact = (id: string, update: Partial<CustomerContactDraft>) => {
    setAdditionalContacts((contacts) =>
      contacts.map((contact) => (contact.id === id ? { ...contact, ...update } : contact))
    );
  };

  const setPrimaryContact = (kind: CustomerContactPoint["kind"], id: string) => {
    setAdditionalContacts((contacts) =>
      contacts.map((contact) =>
        contact.kind === kind ? { ...contact, is_primary: contact.id === id } : contact
      )
    );
  };

  // -------------------------------------------------------------
  // RENDU DU MODAL PROSPECT EXPRESS
  // -------------------------------------------------------------
  const renderProspectExpressModal = () => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-fade-in relative my-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Nouveau Prospect</h3>
                <p className="text-xs text-slate-500">
                  Enregistrement commercial express & qualification de besoin
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsAddingProspect(false);
                resetProspectForm();
              }}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition"
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <form onSubmit={(e) => void handleCreateProspect(e, "detail")} className="space-y-6">
            {/* Type Segmenter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Type de prospect
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProspectType("Particulier")}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-semibold transition ${
                    prospectType === "Particulier"
                      ? "bg-blue-50 border-blue-500 text-blue-800 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-user text-blue-500"></i>
                  <span>Particulier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProspectType("Entreprise")}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-semibold transition ${
                    prospectType === "Entreprise"
                      ? "bg-blue-50 border-blue-500 text-blue-800 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-building text-blue-500"></i>
                  <span>Entreprise / Organisation</span>
                </button>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={prospectType === "Particulier" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {prospectType === "Particulier" ? "Nom complet *" : "Raison sociale *"}
                </label>
                <input
                  type="text"
                  required
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  placeholder={prospectType === "Particulier" ? "Ex: Rakoto Jean" : "Nom de la société / ONG"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {prospectType === "Entreprise" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact / Référent
                  </label>
                  <input
                    type="text"
                    value={prospectRepName}
                    onChange={(e) => setProspectRepName(e.target.value)}
                    placeholder="Ex: M. Rabe (DG)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone principal *
                </label>
                <input
                  type="tel"
                  required
                  value={prospectPhone}
                  onChange={(e) => setProspectPhone(e.target.value)}
                  placeholder="034 00 000 00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="contact@exemple.mg"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Volet d'intérêt & Date souhaitée */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Volet d'intérêt principal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "Hahitantsoa", label: "Hahitantsoa", icon: "fa-sparkles", sub: "Salle & Événement" },
                    { id: "Titan Rental", label: "Titan Rental", icon: "fa-boxes-stacked", sub: "Location matériel" },
                    { id: "Indécis", label: "Indécis / Conseil", icon: "fa-circle-question", sub: "Demande globale" },
                  ].map((dom) => (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => setProspectDomain(dom.id as any)}
                      className={`p-3 rounded-xl border text-left transition ${
                        prospectDomain === dom.id
                          ? "bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20"
                          : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                        <i
                          className={`fa-solid ${dom.icon} ${
                            prospectDomain === dom.id ? "text-indigo-600" : "text-slate-400"
                          }`}
                        ></i>
                        <span>{dom.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{dom.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <AvailabilityDatePicker
                    label="Date souhaitée de l'événement"
                    value={prospectRequestedDate}
                    onChange={(val) => setProspectRequestedDate(val)}
                    allowPast={false}
                    showShortcuts
                    showAvailabilityPreview
                    showHahitantsoaVenueOccupancy={prospectDomain === "Hahitantsoa" || prospectDomain === "Indécis"}
                    domain={prospectDomain === "Titan Rental" ? "titan" : prospectDomain === "Hahitantsoa" ? "hahitantsoa" : "all"}
                    disableIfVenueReserved={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Budget prévisionnel estimé
                  </label>
                  <input
                    type="text"
                    value={prospectBudget}
                    onChange={(e) => setProspectBudget(e.target.value)}
                    placeholder="Ex: 5 000 000 Ar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note sur le besoin / Synthèse de l'échange
                </label>
                <textarea
                  rows={2}
                  value={prospectNote}
                  onChange={(e) => setProspectNote(e.target.value)}
                  placeholder="Type d'événement (mariage, séminaire...), nombre d'invités estimé, matériel recherché..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            {/* Suivi & Relance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Statut initial
                </label>
                <select
                  value={prospectInitialStatus}
                  onChange={(e) => setProspectInitialStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">Nouveau (Premier contact)</option>
                  <option value="contacted">Contacté</option>
                  <option value="qualified">Qualifié (Besoin clair)</option>
                  <option value="to_recall">À relancer</option>
                </select>
              </div>

              <div>
                <AvailabilityDatePicker
                  label="Date de prochaine relance"
                  value={prospectFollowUpDate}
                  onChange={(val) => setProspectFollowUpDate(val)}
                  allowPast
                  showShortcuts
                />
              </div>
            </div>

            {createError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 flex items-center gap-2"
              >
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{createError}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddingProspect(false);
                  resetProspectForm();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
              >
                Annuler
              </button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => void handleCreateProspect(undefined, "quote")}
                  disabled={isCreating || (!prospectName.trim() && !prospectRepName.trim())}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <i className="fa-solid fa-file-invoice"></i>
                  <span>Enregistrer & Devis</span>
                </button>

                <button
                  type="submit"
                  disabled={isCreating || (!prospectName.trim() && !prospectRepName.trim())}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>{isCreating ? "Enregistrement…" : "Enregistrer le prospect"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDU DE L'ASSISTANT CLIENT OFFICIEL (WIZARD KYC)
  // -------------------------------------------------------------
  const renderClientWizard = () => {
    const steps = [1, 2, 3, 4, 5];
    const getStepTitle = (s: number) => {
      if (s === 1) return "Type de client";
      if (s === 2) return "Identité / Coordonnées";
      if (s === 3) return "Informations légales";
      if (s === 4) return "Pièces jointes";
      if (s === 5) return "Résumé";
      return "";
    };

    return (
      <div className="page active max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              setIsAddingClient(false);
              resetClientWizard();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
            aria-label="Retour"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Nouveau Client Officiel</h2>
            <p className="text-sm text-slate-500">
              Assistant KYC et informations contractuelles obligatoires
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4 text-sm scrollbar-hide">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center space-x-2 shrink-0 ${
                  maxWizardStep >= s ? "cursor-pointer hover:opacity-80" : "opacity-50 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (s <= maxWizardStep) setWizardStep(s);
                }}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    wizardStep === s
                      ? "bg-indigo-600 text-white shadow-md"
                      : maxWizardStep >= s
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "border-2 border-slate-300 text-slate-500"
                  } font-bold transition-all`}
                >
                  {wizardStep === s ? s : maxWizardStep >= s ? <i className="fa-solid fa-check"></i> : s}
                </div>
                <span
                  className={`font-semibold ${
                    wizardStep === s
                      ? "text-slate-900"
                      : maxWizardStep >= s
                      ? "text-green-600 hover:text-green-700"
                      : "text-slate-500"
                  } hidden md:inline-block`}
                >
                  {getStepTitle(s)}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 min-w-[10px] md:mx-4 md:min-w-[20px] ${
                    s < maxWizardStep ? "bg-green-500" : "bg-slate-200"
                  } transition-colors`}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          {/* ÉTAPE 1: TYPE */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Sélectionnez le type de client</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${
                    newType === "Particulier"
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300"
                  }`}
                  onClick={() => setNewType("Particulier")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-user text-indigo-600 text-xl"></i>
                    <h4 className="font-bold text-slate-800">Particulier</h4>
                  </div>
                  <p className="text-sm text-slate-600">Personne physique avec CIN ou passeport.</p>
                </div>
                <div
                  className={`border-2 rounded-xl p-6 cursor-pointer transition-colors ${
                    newType === "Entreprise"
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300"
                  }`}
                  onClick={() => setNewType("Entreprise")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-building text-indigo-600 text-xl"></i>
                    <h4 className="font-bold text-slate-800">Entreprise</h4>
                  </div>
                  <p className="text-sm text-slate-600">Société, association, avec NIF/STAT.</p>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: COORDONNÉES */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Identité / Coordonnées</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {newType === "Particulier" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Civilité</label>
                      <select
                        value={newCivilite}
                        onChange={(e) => setNewCivilite(e.target.value as "Monsieur" | "Madame" | "")}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Monsieur">Monsieur (Mr)</option>
                        <option value="Madame">Madame (Mme)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                      <input
                        required
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Rakoto Jean"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Raison sociale</label>
                    <input
                      required
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {newType === "Entreprise" ? "Téléphone Pro" : "Téléphone"}
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 034 00 000 00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {newType === "Entreprise" ? "Email Pro" : "Email"}
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="contact@email.com"
                  />
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Autres contacts</h4>
                      <p className="text-xs text-slate-500">
                        Tous les contacts fournis sont enregistrés et repris dans les documents applicables.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addContact("phone")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-400"
                      >
                        + Téléphone
                      </button>
                      <button
                        type="button"
                        onClick={() => addContact("email")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-400"
                      >
                        + E-mail
                      </button>
                    </div>
                  </div>
                  {additionalContacts.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {additionalContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-center"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            {contact.kind === "email" ? "E-mail" : "Téléphone"}
                          </span>
                          <input
                            aria-label={`${contact.kind === "email" ? "E-mail" : "Téléphone"} supplémentaire`}
                            type={contact.kind === "email" ? "email" : "text"}
                            value={contact.value}
                            onChange={(event) =>
                              updateAdditionalContact(contact.id, { value: event.target.value })
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder={contact.kind === "email" ? "contact@exemple.mg" : "034 00 000 00"}
                          />
                          <input
                            aria-label={`Libellé ${contact.kind === "email" ? "e-mail" : "téléphone"} supplémentaire`}
                            type="text"
                            value={contact.label || ""}
                            onChange={(event) =>
                              updateAdditionalContact(contact.id, { label: event.target.value })
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Ex. responsable logistique"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-pressed={contact.is_primary}
                              onClick={() => setPrimaryContact(contact.kind, contact.id)}
                              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                contact.is_primary
                                  ? "bg-indigo-600 text-white"
                                  : "border border-slate-300 bg-white text-slate-700"
                              }`}
                            >
                              Principal
                            </button>
                            <button
                              type="button"
                              aria-label="Supprimer ce contact"
                              onClick={() =>
                                setAdditionalContacts((contacts) =>
                                  contacts.filter((item) => item.id !== contact.id)
                                )
                              }
                              className="rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-50"
                            >
                              <i className="fa-solid fa-trash" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!newEmail && !newPhone && additionalContacts.length === 0 && (
                    <p className="mt-3 text-xs text-amber-700">
                      Aucun contact renseigné : vous pourrez compléter la fiche ultérieurement.
                    </p>
                  )}
                  {contactError && (
                    <p role="alert" className="mt-3 text-xs text-rose-700">
                      {contactError}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Adresse complète"
                  />
                </div>

                {newType === "Particulier" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date de naissance</label>
                    <input
                      type="date"
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {newType === "Entreprise" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom du représentant</label>
                      <input
                        type="text"
                        value={newRepName}
                        onChange={(e) => setNewRepName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Nom du responsable"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Qualité du représentant</label>
                      <input
                        type="text"
                        value={newRepRole}
                        onChange={(e) => setNewRepRole(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Gérant"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 3: INFORMATIONS LÉGALES */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Informations légales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {newType === "Particulier" && (
                  <>
                    <div className="sm:col-span-2 flex gap-4">
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Type de pièce</label>
                        <select
                          value={newIdType}
                          onChange={(e) => setNewIdType(e.target.value as "CIN" | "Passeport")}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="CIN">CIN</option>
                          <option value="Passeport">Passeport</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Numéro et pièce jointe</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newIdNumber}
                            onChange={(e) => setNewIdNumber(e.target.value)}
                            className="min-w-0 flex-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Numéro de la pièce"
                          />
                          {legalAttachments[newIdType] && (
                            <AttachmentMiniPreview attachment={legalAttachments[newIdType]!} />
                          )}
                          <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                            <i className="fa-solid fa-paperclip" aria-hidden="true"></i> Ajouter
                            <input
                              type="file"
                              className="sr-only"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              aria-label={`Ajouter une pièce jointe pour ${newIdType}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                  setLegalAttachments((current) => ({
                                    ...current,
                                    [newIdType]: {
                                      id: crypto.randomUUID(),
                                      name: file.name,
                                      category: newIdType,
                                      status: "Présent",
                                      file,
                                    },
                                  }));
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Délivré le</label>
                      <input
                        type="date"
                        value={newIdIssueDate}
                        onChange={(e) => setNewIdIssueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Délivré à</label>
                      <input
                        type="text"
                        value={newIdIssuePlace}
                        onChange={(e) => setNewIdIssuePlace(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Lieu de délivrance"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Duplicata (optionnel)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata du (Date)</label>
                          <input
                            type="date"
                            value={newIdDuplicataDate}
                            onChange={(e) => setNewIdDuplicataDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Duplicata à (Lieu)</label>
                          <input
                            type="text"
                            value={newIdDuplicataPlace}
                            onChange={(e) => setNewIdDuplicataPlace(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Lieu du duplicata"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {newType === "Entreprise" && (
                  <>
                    {(["NIF", "STAT", "RCS"] as const).map((category) => {
                      const value = category === "NIF" ? newNif : category === "STAT" ? newStat : newRcs;
                      const setValue =
                        category === "NIF" ? setNewNif : category === "STAT" ? setNewStat : setNewRcs;
                      const attachment = legalAttachments[category];
                      return (
                        <div key={category}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{category}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => setValue(e.target.value)}
                              className="min-w-0 flex-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder={category}
                            />
                            {attachment && <AttachmentMiniPreview attachment={attachment} />}
                            <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                              <i className="fa-solid fa-paperclip" aria-hidden="true"></i> Ajouter
                              <input
                                type="file"
                                className="sr-only"
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                aria-label={`Ajouter une pièce jointe pour ${category}`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file)
                                    setLegalAttachments((current) => ({
                                      ...current,
                                      [category]: {
                                        id: crypto.randomUUID(),
                                        name: file.name,
                                        category,
                                        status: "Présent",
                                        file,
                                      },
                                    }));
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 4: PIÈCES JOINTES */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Pièces jointes complémentaires</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                  <input
                    id="attachmentLabel"
                    value={attachmentLabel}
                    onChange={(e) => setAttachmentLabel(e.target.value)}
                    placeholder="Intitulé de la pièce"
                    className="border border-slate-300 rounded-lg p-2 text-sm"
                  />
                  <select id="attCategory" className="border border-slate-300 rounded-lg p-2 text-sm bg-white">
                    <option value="Justificatif domicile">Justificatif domicile</option>
                    <option value="Logo">Logo</option>
                    <option value="Contrat">Contrat</option>
                    <option value="Autre">Autre</option>
                  </select>
                  <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <i className="fa-solid fa-upload" aria-hidden="true"></i>
                    <span>Téléverser</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const cat =
                          (document.getElementById("attCategory") as HTMLSelectElement)?.value || "Autre";
                        setAttachments((current) => [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            name: file.name,
                            category: cat,
                            label: attachmentLabel.trim(),
                            status: "Présent",
                            file,
                          },
                        ]);
                        setAttachmentLabel("");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-3 text-sm">
                        <div className="flex items-center gap-3">
                          <AttachmentMiniPreview attachment={att} />
                          <div>
                            <div className="font-medium text-slate-800">{att.name}</div>
                            <div className="text-xs text-slate-400">
                              {att.category} {att.label ? `— ${att.label}` : ""}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments((cur) => cur.filter((a) => a.id !== att.id))}
                          className="text-rose-600 hover:text-rose-800 p-1"
                          aria-label="Supprimer la pièce jointe"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 5: RÉSUMÉ */}
          {wizardStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Résumé du client officiel</h3>
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
                  <span>
                    {newPhone || "Non renseigné"} | {newEmail || "Non renseigné"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Pièces jointes</span>
                  <span>
                    {attachments.length + Object.keys(legalAttachments).length} document(s)
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button
              className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm disabled:opacity-30"
              onClick={goPrevStep}
              disabled={wizardStep === 1}
            >
              Retour
            </button>
            {wizardStep < steps.length ? (
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                onClick={goNextStep}
                disabled={!newName && wizardStep === 2}
              >
                Continuer
              </button>
            ) : (
              <button
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                onClick={() => void handleCreateClient()}
                disabled={isCreating}
              >
                {isCreating ? "Enregistrement…" : "Créer le client"}
              </button>
            )}
          </div>
          {createError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {createError}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Si on est dans le wizard complet Client
  if (isAddingClient) {
    return renderClientWizard();
  }

  // -------------------------------------------------------------
  // TABLEAU DE BORD PRINCIPAL CLIENTS & PROSPECTS
  // -------------------------------------------------------------
  return (
    <div className="page active space-y-6">
      {/* Modal Express Prospect */}
      {isAddingProspect && renderProspectExpressModal()}

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clients & Prospects</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Répertoire commercial unifié, qualification des pistes et gestion des dossiers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Rechercher nom, tel, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56 sm:w-64 bg-white shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {canSensitiveWrite ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-2"
                onClick={() => {
                  setCreateError(null);
                  resetProspectForm();
                  setIsAddingProspect(true);
                }}
              >
                <i className="fa-solid fa-bolt"></i>
                <span>Nouveau prospect</span>
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold shadow-2xs transition flex items-center gap-2"
                onClick={() => {
                  setCreateError(null);
                  resetClientWizard();
                  setIsAddingClient(true);
                }}
              >
                <i className="fa-solid fa-user-check text-slate-500"></i>
                <span>Nouveau client</span>
              </button>
            </div>
          ) : (
            <span
              className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs font-medium"
              title="Création réservée aux utilisateurs autorisés."
            >
              Lecture seule
            </span>
          )}
        </div>
      </div>

      {isLoading && <LoadingSpinner size="sm" message="Chargement des fiches clients…" />}
      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between shadow-xs"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-500"></i>
            {loadError}
          </span>
          <button className="underline font-bold" onClick={() => void loadCustomers()}>
            Réessayer
          </button>
        </div>
      )}

      {/* Onglets segmentés avec compteurs en direct */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "Tous", label: "Tous", count: counts.total, icon: "fa-users" },
            { id: "Prospects", label: "Prospects", count: counts.prospects, icon: "fa-user-clock" },
            { id: "Clients", label: "Clients", count: counts.clients, icon: "fa-user-check" },
            { id: "À relancer", label: "À relancer", count: counts.toRecall, icon: "fa-clock-rotate-left" },
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${tab.icon} ${isActive ? "text-blue-400" : "text-slate-400"}`}></i>
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : tab.id === "À relancer" && tab.count > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sous-filtres rapides */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["Particuliers", "Entreprises", "Avec dossier actif"].map((pill) => {
            const isPillActive = filterType === pill;
            return (
              <button
                key={pill}
                type="button"
                onClick={() => setFilterType(isPillActive ? "Tous" : pill)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
                  isPillActive
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-transparent border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {pill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tableau des contacts */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <SortableHeader label="Contact / Nom" sortKey="name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-5 py-3.5" />
                <SortableHeader label="Type" sortKey="type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Catégorie" sortKey="category" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Pipeline Commercial" sortKey="status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Relance & Échéance" sortKey="followUp" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Dossiers liés" sortKey="reservationCount" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={handleSort} className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState
                      message="Aucun résultat ne correspond à votre recherche ou filtre."
                      icon="fa-users"
                    />
                  </td>
                </tr>
              )}
              {sortedClients.map((client) => {
                const isOverdue =
                  client.prospectStatus === "to_recall" &&
                  client.prospectNextFollowUp &&
                  new Date(client.prospectNextFollowUp) < new Date();

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      client.status === "Prospect" ? "bg-blue-50/15" : ""
                    }`}
                  >
                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => onNavigate("customer", client.id)}
                        className="flex items-center gap-3 group text-left w-full focus:outline-none"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl ${client.colorClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}
                        >
                          {client.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-1.5 truncate">
                            <span>{client.name}</span>
                            {client.status === "Prospect" &&
                              client.prospectStatus &&
                              ["qualified", "proforma_sent"].includes(client.prospectStatus) && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-extrabold uppercase tracking-wider">
                                  HOT
                                </span>
                              )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                            {client.phone && (
                              <span>
                                <i className="fa-solid fa-phone text-[10px] mr-1 text-slate-400"></i>
                                {client.phone}
                              </span>
                            )}
                            {client.email && (
                              <span className="truncate">
                                <i className="fa-solid fa-envelope text-[10px] mr-1 text-slate-400"></i>
                                {client.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5">
                      <span className="text-slate-600 font-medium">{client.type}</span>
                    </td>

                    {/* Catégorie */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          client.status === "Prospect"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            client.status === "Prospect" ? "fa-user-clock text-blue-500" : "fa-user-check text-emerald-500"
                          } text-[10px]`}
                        ></i>
                        <span>{client.status}</span>
                      </span>
                    </td>

                    {/* Pipeline */}
                    <td className="px-4 py-3.5">
                      {client.status === "Prospect" && client.prospectStatus ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border w-fit ${getProspectStatusBadgeClass(
                              client.prospectStatus
                            )}`}
                          >
                            {PROSPECT_STATUS_LABELS[client.prospectStatus] || client.prospectStatus}
                          </span>
                          {client.prospectStatusChangedAt && (
                            <span className="text-[10px] text-slate-400">
                              Depuis {new Date(client.prospectStatusChangedAt).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Relance */}
                    <td className="px-4 py-3.5">
                      {client.status === "Prospect" ? (
                        isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                            <span>Dépassée ({new Date(client.prospectNextFollowUp!).toLocaleDateString("fr-FR")})</span>
                          </span>
                        ) : client.prospectNextFollowUp ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <i className="fa-solid fa-clock text-slate-400 text-[10px]"></i>
                            <span>{new Date(client.prospectNextFollowUp).toLocaleDateString("fr-FR")}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Dossiers liés */}
                    <td className="px-4 py-3.5">
                      {client.reservationCount ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          <i className="fa-solid fa-folder-open text-slate-500 text-[10px]"></i>
                          <span>{client.reservationCount} dossier(s)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Aucun dossier</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
