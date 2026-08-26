import React from 'react';
import {
  hahitantsoaDefaultDepositAmount, titanDepositThreshold,
  titanSmallRentalDeposit, titanLargeRentalDepositRate,
  hahitantsoaBreakagePrices,
  hahitantsoaAnnex2PlanPath,
  hahitantsoaAnnex1Rules,
  hahitantsoaAnnex2Zones,
  formatMoneyRaw,
  safeNumber
} from '../constants';

type DocumentType = 'proforma' | 'facture' | 'contrat';

export interface DocumentPreviewProps {
  type?: DocumentType | string;
  domain?: 'titan' | 'hahitantsoa' | string;
  client?: any;
  date?: string;
  refNumber?: string;
  eventDate?: string;
  materials?: any[];
  services?: any[];
  deliveryFee?: string;
  totalAmount?: number;
  discountAmount?: number;
  subTotalAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  hDetails?: any;
  tDetails?: any;
  template?: any;
  blocks?: any[];
  isGuided?: boolean;
  /** Show variable tokens at their rendered positions for template inspection. */
  showVariables?: boolean;
}

function VariableValue({
  token,
  value,
  show,
}: {
  token: string;
  value: React.ReactNode;
  show: boolean;
}) {
  if (!show) return <>{value}</>;
  return (
    <mark
      data-document-variable={token}
      className="rounded bg-amber-100 px-1 text-amber-900 outline outline-1 outline-amber-300"
      title={`Variable ${token}`}
    >
      {`{{${token}}}`}
    </mark>
  );
}

function VariableText({ text, show }: { text: string; show: boolean }) {
  if (!show) return <>{text}</>;
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return <>{parts.map((part, index) => part.startsWith("{{") && part.endsWith("}}") ? (
    <mark key={`${part}-${index}`} data-document-variable={part.slice(2, -2).trim()} className="rounded bg-amber-100 px-1 text-amber-900 outline outline-1 outline-amber-300">{part}</mark>
  ) : part)}</>;
}

function highlightTemplateVariables(html: string) {
  return html.replace(/\{\{\s*[^}]+\s*\}\}/g, token => `<mark class="rounded bg-amber-100 px-1 text-amber-900 outline outline-1 outline-amber-300">${token}</mark>`);
}

function formatClientDate(value: unknown): string {
  if (!value || typeof value !== "string") return "................................";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  type = 'proforma',
  domain = 'titan',
  client,
  date = '',
  refNumber = '',
  eventDate = '',
  materials = [],
  services = [],
  deliveryFee,
  totalAmount = 0,
  discountAmount = 0,
  subTotalAmount = 0,
  paidAmount = 0,
  paymentMethod = 'Non précisé',
  hDetails = {},
  tDetails = {},
  template,
  blocks,
  isGuided,
  showVariables = false,
}) => {
  if (template) {
    const volet = template.volet === 'Hahitantsoa'
      ? 'hahitantsoa'
      : template.volet === 'Titan'
        ? 'titan'
        : 'commun';
    const logoPath = volet === 'titan'
      ? '/brand/titan-rental-logo.png'
      : volet === 'hahitantsoa'
        ? '/brand/hahitantsoa-logo.png'
        : null;
    const emailText = volet === 'titan'
      ? 'titan@ergon.mg'
      : volet === 'hahitantsoa'
        ? 'hahitantsoa@ergon.mg'
        : 'ergon@ergon.mg';
    const phoneText = volet === 'titan'
      ? '+261 34 61 791 42'
      : volet === 'hahitantsoa'
        ? '+261 34 61 791 44'
        : '+261 34 61 791 41';

    return (
      <div className="p-8 bg-white border border-slate-200 rounded-xl h-full shadow-sm text-[12px] font-sans relative overflow-y-auto">
        <div className="flex justify-between items-start mb-8 border-b pb-4">
          <div>
            <img src="/brand/ergon-logo.png" className="h-[60px] object-contain mb-2" alt="Ergon logo" />
            <div className="text-slate-500">ergon@ergon.mg<br/>+261 34 61 791 41</div>
          </div>
          <div className="text-right">
            {logoPath ? (
              <img src={logoPath} className="h-[80px] object-contain mb-2 ml-auto" alt={`${template.volet} logo`} />
            ) : (
              <div className="h-[80px] flex items-center justify-end font-bold text-slate-700">Document commun</div>
            )}
            <div className="text-slate-500">{emailText}<br/>{phoneText}</div>
          </div>
        </div>

        {isGuided && blocks ? (
          <div className="space-y-4">
            {blocks.map((b: any) => {
              if (b.type === "Titre") return <h2 key={b.id} className="text-xl font-bold text-center underline mb-6"><VariableText text={b.text || "TITRE DU DOCUMENT"} show={showVariables} /></h2>;
              if (b.type === "Paragraphe") return <p key={b.id} className="text-justify mb-4"><VariableText text={b.text || "..."} show={showVariables} /></p>;
              if (b.type === "Tableau articles/packs") return (
                <table key={b.id} className="document-generic-items w-full border-collapse border border-slate-300 mb-6">
                  <thead><tr className="bg-slate-100"><th className="border p-2 text-left">Désignation</th><th className="border p-2">Qté</th><th className="border p-2">PU</th><th className="border p-2 text-right">Total</th></tr></thead>
                  <tbody><tr><td className="border p-2">Article / Pack</td><td className="border p-2 text-center">1</td><td className="border p-2 text-center">X Ar</td><td className="border p-2 text-right">X Ar</td></tr></tbody>
                </table>
              );
              return (
                <div key={b.id} className="mb-4">
                  {b.title && <h4 className="font-bold underline mb-2">{b.title}</h4>}
                  <div className="whitespace-pre-wrap"><VariableText text={b.text || `[Bloc ${b.type} vide]`} show={showVariables} /></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: showVariables ? highlightTemplateVariables(template.content || "") : template.content || "" }} />
        )}
      </div>
    );
  }

  const isTitan = domain === 'titan';

  const logoPath = isTitan ? '/brand/titan-rental-logo.png' : '/brand/hahitantsoa-logo.png';
  const ergonLogo = '/brand/ergon-logo.png';
  const emailText = isTitan ? 'titan@ergon.mg' : 'hahitantsoa@ergon.mg';
  const phoneText = isTitan ? '+261 34 61 791 42' : '+261 34 61 791 44';

  const titleText = type === 'proforma' ? 'P R O F O R M A' : type === 'facture' ? 'F A C T U R E' : 'CONTRAT';
  const typeRef = type === 'proforma' ? 'PROFORMA' : type === 'facture' ? 'FACTURE' : 'CONTRAT';

  const safeSubTotal = safeNumber(subTotalAmount, safeNumber(totalAmount, 0));
  const safeDiscount = safeNumber(discountAmount, 0);
  const safeTotal = safeNumber(totalAmount, 0);
  const showBreakageColumn = domain === 'hahitantsoa';
  const hasHahitantsoaLocation = domain === 'hahitantsoa' && (
    safeNumber(hDetails?.venuePrice, 0) > 0 ||
    Boolean(hDetails?.venueName || hDetails?.venue || hDetails?.rentalType)
  );
  const hasCommercialLines = hasHahitantsoaLocation ||
    materials.length > 0 ||
    services.length > 0 ||
    Boolean(deliveryFee) ||
    safeNumber(hDetails?.durationOptionPrice, 0) > 0;

  if (type === 'contrat') {
    if (client?.status === 'Prospect') {
      return (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl h-full flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mb-4">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Contrat indisponible</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Le contrat ne peut être généré qu'après la conversion du prospect en client (paiement d'acompte et informations légales complétées).
          </p>
        </div>
      );
    }

    const ContractPage = ({ pageNumber, children }: { pageNumber: number, children: React.ReactNode }) => (
      <div className="contract-a4-page relative flex flex-col shrink-0 text-[12px] leading-[1.35]">
        <div className="flex-1 relative pt-12 pb-8 px-16 flex flex-col z-10">
          <img src={logoPath} alt="Watermark" className="contract-watermark absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] opacity-[0.08] pointer-events-none -z-10" />

          <div className="flex justify-between items-start mb-10 shrink-0 contract-header font-sans">
            <div className="w-1/2 flex flex-col items-start gap-4">
              <img src={ergonLogo} alt="Ergon logo" className="h-[90px] object-contain mb-2" />
              <div className="text-[14px]">
                <p>ergon@ergon.mg</p>
                <p>+261 34 61 791 41</p>
              </div>
            </div>
            <div className="w-1/2 flex flex-col items-end gap-4">
              <img src={logoPath} alt={`${domain} logo`} className="h-[120px] object-contain mb-2" />
              <div className="text-[14px] text-right">
                <p>{emailText}</p>
                <p>{phoneText}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 contract-body text-justify">
            {children}
          </div>

          <div className="contract-footer shrink-0 mt-8 pt-2 border-t border-black text-center text-[11px] flex justify-between items-end font-sans text-slate-400">
            <div className="text-left">
              <p>Ergon Group SARL</p>
              <p>Lot P93M Ambohipo Sud Alasora Bypass</p>
              <p className="mt-2 font-bold text-slate-500">{emailText}</p>
              <p className="font-bold text-slate-500">+261 34 61 791 41</p>
            </div>
            <div className="text-left">
              <p>NIF: 6003298583</p>
              <p>STAT: 77290 11 2019 010 215</p>
              <p className="mt-2 font-bold text-slate-500">{emailText}</p>
              <p className="font-bold text-slate-500">{phoneText}</p>
            </div>
            <div className="font-bold text-[14px] text-black pb-1">
              {pageNumber}
            </div>
          </div>
        </div>
      </div>
    );

    if (isTitan) {
      return (
        <div className="contract-preview-container">
          <ContractPage pageNumber={1}>
            <h4 className="text-center font-bold text-[18px] mb-8 underline decoration-2 underline-offset-4 font-serif leading-tight">
              CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »
            </h4>

            <p className="mb-4">Entre les soussignés :</p>
            <p className="mb-6"><strong>La société ERGON GROUP</strong>, dont le siège social se situe au Lot P93M Sud Ambohipo Alasora Antananarivo<br/>10301, représentée par RASOAMANANA Narindra en sa qualité de Gérante</p>
            <p className="text-right mb-6">Ci-après dénommée « Le prestataire »</p>
            <p className="text-right font-bold underline mb-8">D'UNE PART,</p>

            {client?.type === 'Entreprise' || client?.type === 'company' || client?.party_type === 'company' || Boolean(client?.nif) || Boolean(client?.stat) || Boolean(client?.rcs) ? (
              <p className="mb-4">La société <strong><VariableValue token="client.name" value={client?.name || 'Client'} show={showVariables} /></strong>, dont le siège social est situé au <VariableValue token="client.address" value={client?.address || '................................'} show={showVariables} /><br/>NIF : <VariableValue token="client.nif" value={client?.nif || '................................'} show={showVariables} /><br/>STAT : <VariableValue token="client.stat" value={client?.stat || '................................'} show={showVariables} /><br/>RCS : <VariableValue token="client.rcs" value={client?.rcs || '................................'} show={showVariables} /><br/>Représentée par <VariableValue token="client.representativeName" value={client?.repFirstName || client?.representative_name || '................................'} show={showVariables} /> en sa qualité de <VariableValue token="client.representativeRole" value={client?.repRole || client?.representative_role || 'Gérant(e)'} show={showVariables} /><br/>Contact : <VariableValue token="client.phone" value={client?.phone || '................................'} show={showVariables} /><br/>Mail : <VariableValue token="client.email" value={client?.email || '................................'} show={showVariables} /></p>
            ) : (
              <p className="mb-4">{client?.civilite ? `${client.civilite} ` : 'Madame/Monsieur '}<strong><VariableValue token="client.name" value={client?.name || '................................'} show={showVariables} /></strong> né(e) le <VariableValue token="client.birthDate" value={client?.birthDate ? new Date(client.birthDate).toLocaleDateString('fr-FR') : '........'} show={showVariables} /> à <VariableValue token="client.birthPlace" value={client?.birthPlace || '........'} show={showVariables} />, titulaire de la <VariableValue token="client.idType" value={client?.idType || 'Carte Nationale d’Identité'} show={showVariables} /> N° <VariableValue token="client.idNumber" value={client?.idNumber || '................................'} show={showVariables} /> délivrée le <VariableValue token="client.idIssueDate" value={client?.idIssueDate ? new Date(client.idIssueDate).toLocaleDateString('fr-FR') : '........'} show={showVariables} /> à <VariableValue token="client.idIssuePlace" value={client?.idIssuePlace || '........'} show={showVariables} />{client?.idDuplicataDate ? <> duplicata du {new Date(client.idDuplicataDate).toLocaleDateString('fr-FR')} à {client.idDuplicataPlace}</> : null} demeurant au <VariableValue token="client.address" value={client?.address || '................................'} show={showVariables} /><br/>Contact : <VariableValue token="client.phone" value={client?.phone || '................................'} show={showVariables} /><br/>Mail : <VariableValue token="client.email" value={client?.email || '................................'} show={showVariables} /></p>
            )}
            <p className="text-right mb-6">Ci-après dénommée « Le client »</p>
            <p className="text-right font-bold underline mb-8">D'AUTRE PART,</p>

            <p className="mb-6">Le Client et le Prestataire étant dénommés ci-après les <strong>« Parties »</strong></p>
            <p className="mb-6 uppercase">IL A ETE CONVENU CE QUI SUIT :</p>

            <h5 className="font-bold underline mb-4">Article 1 : Objet du contrat</h5>
            <p className="mb-4">Le présent contrat est conclu entre les Parties en vue de la location de matériels évènementiels comprenant :</p>
            <ul className="list-none pl-10 mb-4 space-y-2">
              {materials.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Aucune ligne à afficher dans ce document.</p>
              ) : (
                materials.map((m, i) => (
                  <li key={m.id || i}>- {safeNumber(m.quantity, 1)} {m.name || m.designation || "Article"}</li>
                ))
              )}
              <li>- Livraison et récupération</li>
            </ul>
            <p className="mb-4">Ci-après désignés les « Matériels Loués ».</p>
            <p className="mb-12">Le client déclare parfaitement connaitre les Matériels loués pour les avoir examinés en vue des présentes, sans qu’il soit nécessaire d’en faire plus ample désignation et déclare les accepter dans l’état où ils se trouvent tels qu’ils existent.</p>

            <h5 className="font-bold underline mb-4">Article 2 : Destination</h5>
          </ContractPage>

          <ContractPage pageNumber={2}>
            <p className="mb-4">Les matériels loués sont destinés à un usage de : <strong><VariableValue token="event.usage" value={tDetails?.usageType === 'Autre' ? tDetails?.usageTypeOther : (tDetails?.usageType || 'Non précisé')} show={showVariables} /></strong>.<br/>Toute autre activité en sus non mentionnée doit faire l’objet d’une annexe à titre d’avenant conclu entre les parties.</p>
            <h6 className="font-semibold mb-2">Destination et lieu de la location :</h6>
            <ul className="list-disc pl-10 mb-8 space-y-1">
              <li><strong>Nom du lieu :</strong> <VariableValue token="logistics.destinationName" value={tDetails?.destinationName || 'Non renseigné'} show={showVariables} /></li>
              <li><strong>Adresse complète :</strong> <VariableValue token="logistics.destinationAddress" value={tDetails?.destinationAddress || 'Non renseigné'} show={showVariables} /></li>
              <li><strong>Commune / Ville :</strong> <VariableValue token="logistics.destinationCity" value={tDetails?.destinationCity || 'Non renseigné'} show={showVariables} /></li>
              <li><strong>Contact sur place :</strong> {tDetails?.destinationContactName || 'Non renseigné'}</li>
              <li><strong>Téléphone contact :</strong> {tDetails?.destinationContactPhone || 'Non renseigné'}</li>
              {(tDetails?.destinationLat && tDetails?.destinationLng) && (
                <li><strong>Coordonnées GPS :</strong> {tDetails.destinationLat}, {tDetails.destinationLng} (Lien: https://www.google.com/maps/search/?api=1&query={tDetails.destinationLat},{tDetails.destinationLng})</li>
              )}
              {tDetails?.destinationAccessNote && (
                <li><strong>Note d'accès :</strong> {tDetails.destinationAccessNote}</li>
              )}
            </ul>

            <h5 className="font-bold underline mb-4">Article 3 : Durée</h5>
            <p className="mb-4">
              La location est consentie pour la période du <VariableValue token="reservation.startDate" value={tDetails?.startDate || eventDate || 'non renseigné'} show={showVariables} /> à <VariableValue token="reservation.startTime" value={tDetails?.startTime || 'non renseigné'} show={showVariables} /> au <VariableValue token="reservation.endDate" value={tDetails?.endDate || eventDate || 'non renseigné'} show={showVariables} /> à <VariableValue token="reservation.endTime" value={tDetails?.endTime || 'non renseigné'} show={showVariables} />.
            </p>
            <p className="mb-6">
              {tDetails?.movementMode === 'Livraison par Titan' ? (
                <>
                  La livraison des matériels est prévue le {tDetails?.pickupDate || tDetails?.startDate || eventDate || 'non renseigné'} à {tDetails?.deliveryTime || 'non renseigné'}.<br/>
                  La récupération des matériels est prévue le {tDetails?.returnDate || tDetails?.endDate || eventDate || 'non renseigné'} à {tDetails?.returnTime || tDetails?.endTime || 'non renseigné'}.
                </>
              ) : (
                <>
                  Le prélèvement des matériels est prévu le {tDetails?.pickupDate || tDetails?.startDate || eventDate || 'non renseigné'} à {tDetails?.pickupTime || tDetails?.deliveryTime || 'non renseigné'}.<br/>
                  La restitution des matériels est prévue le {tDetails?.returnDate || tDetails?.endDate || eventDate || 'non renseigné'} à {tDetails?.clientReturnTime || tDetails?.returnTime || tDetails?.endTime || 'non renseigné'}.
                </>
              )}
            </p>

            <h5 className="font-bold underline mb-4">Article 4 : Tarifs</h5>
            <p className="mb-4">La présente location est consentie et acceptée moyennant le prix de {formatMoneyRaw(safeTotal)} Ariary TTC.</p>
            <p className="mb-4">Une facture sera établie après la réception de la totalité du règlement. Un reçu sera établi lors de la réception des fonds pour acompte.</p>
            <p className="mb-4">Dans le cas où le client n’aurait pas rendu les Matériels loués aux date et heure indiquées à l’article 3, le Client devra payer la somme supplémentaire de 50% du montant total de la facture par jour de non remise des Matériels Loués.</p>
            <p className="mb-6">Dans le cas où il y a préjudice causé par la rallonge de retour des Matériels loués, le Client est tenu de prendre en charge tous les frais liés au démantèlement avec la somme supplémentaire de 100% pour réparation de dommage.</p>

            <h5 className="font-bold underline mb-4">Article 5 : Modalités de paiement</h5>
            <p className="mb-4">La présente location est consentie et acceptée moyennant le versement d’un acompte de 25 % de la somme totale due. Celui-ci devra être réglé le jour de la réservation des matériels, soit à la signature par le Client du présent contrat.</p>
            <p className="mb-6">Le client s’engage à verser le solde du montant de la location cinq jours avant l’enlèvement des Matériels Loués au plus tard.</p>

            <h5 className="font-bold underline mb-4">Article 6 : Etat des Matériels</h5>
            <p className="mb-4">Un état des Matériels sera établi à l’enlèvement à contrario d’un état dressé à la remise des dits matériels à la fin du contrat.</p>
            <p className="mb-4">Le client est tenu de rester le temps nécessaire pour procéder à l’état des Matériels.</p>
            <p className="mb-6">Chaque article devra être restitué à l’état lors de la prise de possession.</p>

            <h5 className="font-bold underline mb-4">Article 7 : Dépôt de garantie</h5>
            <p className="mb-2">Le client verse au Prestataire à titre de dépôt de garantie :</p>
            <ul className="list-none pl-10 mb-4 space-y-1">
              <li>- 100 000,00 Ariary (Cent mille Ariary) pour les locations de moins de 200 000,00 Ariary (Deux cent mille Ariary)</li>
              <li>- 50% du montant total pour les locations de plus de 200 000,00 Ariary.</li>
            </ul>
            <p className="mb-4">La somme correspondant au dépôt de garantie est versée le jour du règlement de solde du contrat.</p>
            <p className="mb-4">Le montant du dépôt de garantie sera remboursé au Client le jour de la fin de location dans le cas d’un retour sans casse.</p>
            <p className="mb-4">Par ailleurs, en cas de casse il sera alloué au Prestataire cinq jours de délai pour traitement et restitution du dépôt de garantie après déduction de toutes les sommes dont il est destiné à garantir le paiement notamment les casses et préjudices causés par le Client à l’usage des articles de location.</p>
            <p className="mb-6">Si le montant du préjudice est supérieur au montant du dépôt de garantie, le Client s’engage à rembourser les frais supplémentaires sous 8 jours après réception d’une mise en demeure l’informant du montant de la somme due au titre de ces désagréments.</p>
          </ContractPage>

          <ContractPage pageNumber={3}>
            <p className="mb-6">Si le montant du préjudice est supérieur au montant du dépôt de garantie, le Client s’engage à rembourser les frais supplémentaires sous 8 jours après réception d’une mise en demeure l’informant du montant de la somme due au titre de ces désagréments.</p>

            <h5 className="font-bold underline mb-4">Article 8 : Obligations du Prestataire</h5>
            <p className="mb-4">Le Prestataire s’engage à mettre à disposition du Client l’ensemble des éléments mentionnés dans l’article 1 du présent contrat.</p>
            <p className="mb-6">Il s’engage à ne pas faire entrave à la jouissance du Client pendant toute la durée de la location.</p>

            <h5 className="font-bold underline mb-4">Article 9 : Obligations du Client</h5>
            <ul className="list-disc pl-10 mb-6 space-y-2">
              <li>Le Client prendra les Matériels Loués dans l’état où ils se trouvent au moment de l’entrée en jouissance, sans pouvoir exiger du Prestataire toute forme de modifications en sus ;</li>
              <li>Le Client ne pourra faire aucune modification sur les Matériels Loués ;</li>
              <li>Le Client s’engage à utiliser les Matériels Loués en bon père de famille ;</li>
              <li>Le Client s’engage à respecter et à faire respecter par toutes les personnes présentes lors de l’évènement le bon usage en bon père de famille des Matériels Loués ;</li>
              <li>Le Client s’engage à rendre les Matériels loués lavés et séchés.</li>
            </ul>

            <h5 className="font-bold underline mb-4">Article 10 : Annulation</h5>
            <p className="mb-4">Le preneur ne pourrait annuler la location sauf pour cas de force majeure, et ne peut prévaloir un droit à remboursement.</p>
            <p className="mb-4">En cas de force majeur, les deux parties se rapprochent pour évaluer les éventuels remboursements sans engagement de part et d’autres.</p>
            <p className="mb-6">Dans le cas où le Prestataire ne pourrait respecter ses engagements pour cas de force majeure, il se réserve le droit d’annuler la réservation et de rembourser intégralement au Client les sommes qu’il a versées.</p>

            <h5 className="font-bold underline mb-4">Article 11 : Clause résolutoire</h5>
            <p className="mb-6">Il est expressément convenu qu’en cas de paiement par chèque, le règlement ne sera considéré effectif qu’après l’encaissement du chèque. Dans le cas où le chèque serait sans provision, la présente clause sera appliquée et le présent contrat deviendra nul de plein droit.</p>

            <h5 className="font-bold underline mb-4">Article 12 : Transport</h5>
            <p className="mb-16">Un véhicule fourgon est exigé pour le transport des matériels.</p>

            <p className="text-center mb-8">Fait en trois exemplaires originaux</p>
            <p className="text-right mb-12 mr-16">A Antananarivo, le {date}</p>

            <div className="grid grid-cols-2 gap-8 text-center mt-auto">
              <div><p className="mb-16">Le Prestataire,</p></div>
              <div>
                <p className="mb-16">
                  {client?.type === 'Entreprise' || client?.type === 'company' || client?.party_type === 'company' || Boolean(client?.nif) || Boolean(client?.stat) || Boolean(client?.rcs)
                    ? `Pour la société ${client?.name || ''},`
                    : 'Le Client,'}
                </p>
              </div>
            </div>
          </ContractPage>
        </div>
      );
    } else {
      return (
        <div className="contract-preview-container bg-slate-100 p-8 rounded-xl">
          <ContractPage pageNumber={1}>
            <h4 className="text-center font-bold text-[18px] mb-8 underline decoration-2 underline-offset-4 font-serif">
              CONTRAT DE LOCATION « HAHITANTSOA »
            </h4>

            <p className="mb-4">Entre les soussignés :</p>
            <p className="mb-6"><strong>La société ERGON GROUP</strong> dont le siège social se situe au Lot P93M Sud Ambohipo Alasora Antananarivo,<br/>représentée par RASOAMANANA Narindra en sa qualité de Gérante</p>
            <p className="text-right mb-6">Ci-après dénommée « Le prestataire »</p>
            <p className="text-right font-bold underline mb-8">D'UNE PART,</p>

            {client?.type === 'Entreprise' || client?.type === 'company' || client?.party_type === 'company' || Boolean(client?.nif) || Boolean(client?.stat) || Boolean(client?.rcs) ? (
              <p className="mb-4">La société <strong>{client?.name || 'Client'}</strong> domiciliée au {client?.address || '................................'}<br/>NIF : {client?.nif || '................................'}<br/>STAT : {client?.stat || '................................'}<br/>RCS : {client?.rcs || '................................'}<br/>Représentée par {client?.repFirstName || '................................'} en sa qualité de {client?.repRole || '................................'} <br/>Contact : {client?.phone || '................................'}</p>
            ) : (
              <p className="mb-4">Madame/Monsieur <strong>{client.name || '................................'}</strong> né(e) le {formatClientDate(client.birthDate)} à {client.birthPlace || '................................'}, titulaire de la {client.idType || 'Carte Nationale d’Identité/Passeport'} N° {client.idNumber || '................................'} délivrée le {formatClientDate(client.idIssueDate)} à {client.idIssuePlace || '................................'} duplicata du {formatClientDate(client.idDuplicataDate)} à {client.idDuplicataPlace || '................................'} demeurant au {client.address || '................................'}<br/>Contact : {client.phone || '................................'}<br/>{client.additionalPhones?.[0] || '................................'}<br/>Mail : {client.email || '................................'}</p>
            )}
            <p className="text-right mb-6">Ci-après dénommée « Le client »</p>
            <p className="text-right font-bold underline mb-8">D'AUTRE PART,</p>

            <p className="mb-4">Pour le <VariableValue token="event.eventType" value={hDetails?.eventType || '........................'} show={showVariables} /> de : {hDetails?.mariageGroomName && hDetails?.mariageBrideName ? `${hDetails.mariageGroomName} et ${hDetails.mariageBrideName}` : (hDetails?.fiancaillesPerson1 ? `${hDetails.fiancaillesPerson1} et ${hDetails.fiancaillesPerson2}` : '........................................')}</p>
            <p className="mb-6">Le Client et le Prestataire étant dénommés ci-après les <strong>« Parties »</strong></p>
            <p className="mb-6 uppercase">IL A ETE CONVENU CE QUI SUIT :</p>

            <h5 className="font-bold underline mb-4">Article 1 : Objet du contrat</h5>
            <p className="mb-4">Le présent contrat est conclu entre les Parties en vue de la location du domaine Hahitantsoa, un lieu de réception situé au Lot P93M Sud Ambohipo Alasora Antananarivo comprenant :</p>
            <ul className="list-disc pl-10 mb-4 space-y-1">
              <li>Une salle de réception de 600 m2 ;</li>
              <li>Huit toilettes attenantes ;</li>
              <li>Une cuisine équipée de réfrigérateur et congélateur ;</li>
              <li>Un parking intérieur et extérieur sécurisé (50 places) ;</li>
              <li>Un salon avec salle d’eau pour les mariés ;</li>
              <li>Un espace vert.</li>
            </ul>
            <p className="mb-4 pl-10">Ci-après désignés les « Lieux Loués ».</p>
            <p>Le client déclare parfaitement connaitre les Lieux Loués pour les avoir visités et examinés en vue des présentes, sans qu'il soit nécessaire d'en faire plus ample désignation et déclare les accepter dans l'état où ils se trouvent tels qu'ils existent, s'entendent et comportent avec leurs dépendances.</p>
          </ContractPage>

          <ContractPage pageNumber={2}>
            <h5 className="font-bold underline mb-4">Article 2 : Destination</h5>
            <p className="mb-4">Le lieu de réception loué est destiné à accueillir les évènements suivants : {hDetails?.eventType === 'Autre' ? hDetails?.eventTypeOther : (hDetails?.eventType || 'mariages, anniversaires, réceptions privées, séminaires')}.<br/>Toute autre activité en sus non mentionnée doit faire l’objet d’une annexe à titre d’avenant conclu entre les parties.</p>
            {hDetails?.eventType === 'Mariage' && (
              <p className="mb-4 text-sm font-semibold text-slate-800 bg-slate-50 p-2 border border-slate-200 rounded">
                Personnes concernées : {hDetails.mariageGroomName || '................'} et {hDetails.mariageBrideName || '................'}
                {hDetails.mariageReferentName && <><br/>Référent : {hDetails.mariageReferentName}</>}
              </p>
            )}
            {hDetails?.eventType === 'Fiançailles' && (
              <p className="mb-4 text-sm font-semibold text-slate-800 bg-slate-50 p-2 border border-slate-200 rounded">
                Personnes concernées : {hDetails.fiancaillesPerson1 || '................'} et {hDetails.fiancaillesPerson2 || '................'}
              </p>
            )}
            {hDetails?.eventType === 'Baptême' && (
              <p className="mb-4 text-sm font-semibold text-slate-800 bg-slate-50 p-2 border border-slate-200 rounded">
                Enfant : {hDetails.baptemeChildName || '................'} <br/>
                Parent/Tuteur : {hDetails.baptemeParentName || '................'}<br/>
                {hDetails.baptemeDate && <>Date de baptême : {new Date(hDetails.baptemeDate).toLocaleDateString('fr-FR')}</>}
              </p>
            )}
            {hDetails?.otherReferentName && hDetails.eventType !== 'Mariage' && hDetails.eventType !== 'Fiançailles' && hDetails.eventType !== 'Baptême' && (
              <p className="mb-4 text-sm font-semibold text-slate-800 bg-slate-50 p-2 border border-slate-200 rounded">
                Référent(s) : {hDetails.otherReferentName}
              </p>
            )}

            <h5 className="font-bold underline mb-4">Article 3 : Durée</h5>
            <p className="mb-4">La présente location est consentie et acceptée du <VariableValue token="reservation.startDate" value={hDetails?.startDate || eventDate} show={showVariables} /> à <VariableValue token="reservation.startTime" value={hDetails?.startTime || '.................'} show={showVariables} /> heures au <VariableValue token="reservation.endDate" value={hDetails?.endDate || eventDate} show={showVariables} /> à <VariableValue token="reservation.endTime" value={hDetails?.endTime || '......03H30............'} show={showVariables} /> heures.<br/>Les intervenants du client peuvent accéder aux locaux (veuillez rayer les mentions inutiles) :</p>
            <ul className="list-disc pl-10 mb-4 space-y-1">
              <li><strong>la veille à 15 heures 30 si aucune réception n’a lieu sur les lieux, à 23 heures 30 dans le cas contraire ;</strong></li>
              <li><span className="line-through">le jour-J à 07 heures.</span></li>
            </ul>
            <p className="mb-6">L’heure de fin comprend les heures de démantèlement et reprise des Lieux Loués par le Prestataire.<br/>Toute rallonge sur les heures convenues fera l’objet de facturation en sus suivant la grille du prestataire.</p>

            <h5 className="font-bold underline mb-4">Article 4 : Tarifs</h5>
            <p className="mb-4">La présente location est consentie et acceptée moyennant le prix de {formatMoneyRaw(safeTotal)} Ariary TTC.</p>
            <div className="pl-10 mb-4 flex flex-col gap-2">
              <div className="flex"><span className="w-48">N° Proforma :</span><span><VariableValue token="dossier.ref" value={refNumber} show={showVariables} /></span></div>
              <div className="flex"><span className="w-48">Nombre de convives :</span><span>{hDetails?.guests || '200'}</span></div>
              <div className="flex"><span className="w-48">Type de location :</span><span>
                {hDetails?.rentalType === 'Location nue' ? '☒' : '☐'} Location nue<br/>
                {hDetails?.rentalType === 'Location + logistique' ? '☒' : '☐'} Location + logistique
              </span></div>
              <div className="flex mt-2"><span className="w-48">Durée :</span><span>
                {hDetails?.durationOption === 'Fête de jour : Sortie J-J à 20:00' ? '☒' : '☐'} Fête de jour : Sortie J-J à 20:00<br/>
                {hDetails?.durationOption === 'Utilisation de nuit Option 1 : Arrêt de fête 21:00 / Sortie J-J à 22:30' ? '☒' : '☐'} Utilisation de nuit Option 1 : Arrêt de fête 21:00 / Sortie J-J à 22:30<br/>
                {hDetails?.durationOption === 'Utilisation de nuit Option 2 : Arrêt de fête 00:00 / Sortie J+1 à 03:30' ? '☒' : '☐'} Utilisation de nuit Option 2 : Arrêt de fête 00:00 / Sortie J+1 à 03:30
              </span></div>
            </div>
            <p className="mb-4">Une facture sera établie après la réception de la totalité du règlement. Un reçu sera établi lors de la réception des fonds pour acompte.<br/>Dans le cas où le client n’aurait pas quitté les Lieux Loués aux date et heure indiquées à l’article 3, le Client devra payer la somme supplémentaire de 50 000,00 Ariary TTC par tranche de 30 minutes mais selon les besoins du prestataire, il se réserve le droit de sortir tous les intervenants et leurs matériels en dehors de l’enceinte et décline toute responsabilité en cas de perte ou de détérioration.</p>

            <h5 className="font-bold underline mb-4">Article 5 : Modalités de paiement</h5>
            <p className="mb-2">La présente location est consentie et acceptée moyennant le versement d’un acompte de :</p>
            <ul className="list-disc pl-10 mb-4 space-y-1">
              <li>1 000 000,00 Ariary dans le cas d’une location nue ;</li>
              <li>1 500 000,00 Ariary dans le cas d’une location nue avec logistique.</li>
            </ul>
            <p className="mb-2">Celui-ci devra être réglé le jour de la réservation de la salle, soit à la signature par le Client du présent contrat. Le client s’engage à verser le solde du montant de la location en deux tranches :</p>
            <ul className="list-disc pl-10 mb-6 space-y-1">
              <li>La première tranche (50%) 1 mois avant l’évènement au plus tard ;</li>
              <li>La deuxième tranche (50%) 10 jours avant l’évènement au plus tard.</li>
            </ul>

            <h5 className="font-bold underline mb-4">Article 6 : Remise des clés – Etat des lieux</h5>
            <p className="mb-4">Un état des lieux d’entrée sera établi lors de la prise de possession des Lieux Loués et un état des lieux de sortie sera dressé lors de la remise des clés ou à la fin du contrat. Le client est tenu de rester le temps nécessaire pour procéder à l’état des lieux. Les lieux loués devront être restitués conformément à l’état des lieux d’entrée.</p>

            <h5 className="font-bold underline mb-4">Article 7 : Dépôt de garantie</h5>
          </ContractPage>

          <ContractPage pageNumber={3}>
            <p className="mb-4">Le client verse au Prestataire à titre de dépôt de garantie, une somme de {formatMoneyRaw(hahitantsoaDefaultDepositAmount)} Ariary.<br/>La somme correspondant au dépôt de garantie est versée le jour du règlement du solde.<br/>Le montant du dépôt de garantie sera remboursé au Client le jour de la fin de location dans le cas d’un retour sans casse.</p>
            <p className="mb-4">Par ailleurs, dans le cas de constatation de casse le montant du dépôt de garantie sera remboursé au Client dans les cinq jours suivant la fin de la location après déduction de toutes les sommes dont il est destiné à garantir le paiement notamment les désordres que le Client aurait causé aux locaux, aux matériels ou aux espaces verts ainsi que le nettoyage supplémentaire.</p>
            <p className="mb-6">Si le montant du préjudice est supérieur au montant du dépôt de garantie, le Client s’engage à rembourser les frais supplémentaires sous 8 jours après réception d’une mise en demeure l’informant du montant de la somme due au titre de ces désordres.</p>

            <h5 className="font-bold underline mb-4">Article 8 : Obligations du Prestataire</h5>
            <p className="mb-6">Le Prestataire s’engage à mettre à disposition du Client l’ensemble des éléments mentionnés dans l’article 1 du présent contrat.<br/>Il s’engage à ne pas faire entrave à la jouissance du Client pendant toute la durée de la location.</p>

            <h5 className="font-bold underline mb-4">Article 9 : Obligations du Client</h5>
            <ul className="list-disc pl-10 mb-6 space-y-2">
              <li>Le Client prendra les Lieux Loués dans l’état où ils se trouvent au moment de l’entrée en jouissance, sans pouvoir exiger du Prestataire aucun aménagement, aucune réparation, aucuns travaux de remise en état tels qu’ils résultent de l’état des lieux contradictoirement dressé entre les parties.</li>
              <li>Le Client ne pourra faire aucune modification dans les Lieux Loués.</li>
              <li>Le Client s’engage à utiliser les Lieux Loués en bon père de famille.</li>
              <li>Le Client s’engage à respecter et à faire respecter par toutes les personnes présentes dans la salle durant la location, le présent contrat et le règlement intérieur des Lieux Loués ainsi que toutes les consignes de sécurité, d’interdiction de fumer à l’intérieur du local et de bonne utilisation du matériel. A défaut, le Client restera responsable.</li>
              <li>Le Client s’engage à rendre les Lieux Loués vidés de leurs contenus.<br/>Dans le cas où le Client fait appel aux services d’un traiteur, il s’assure que ce dernier laisse également les Lieux Loués dans l’état initial, c’est-à-dire locaux débarrassés et rangés, cuisine rangée et poubelles enlevées par ses soins.</li>
              <li>Le Client octroie un droit de diffusion des vidéos et photographies lors de l’évènement pour usage Marketing sans porter atteinte à la personnalité tant des invités que du Client.</li>
            </ul>

            <h5 className="font-bold underline mb-4">Article 10 : Annulation</h5>
            <p className="mb-4">Le Client ne pourrait annuler la location sauf pour cas de force majeure, et ne peut prévaloir un droit à remboursement.<br/>En cas de force majeur, les deux parties se rapprochent pour évaluer les éventuels remboursements sans engagement de part et d’autres.<br/>Dans le cas où le Prestataire ne pourrait respecter ses engagements pour cas de force majeure, il se réserve le droit d’annuler la réservation et de rembourser intégralement au Client les sommes qu’il a versées.</p>

            <h5 className="font-bold underline mb-4">Article 11 : Conditions d’annulation, de report et de remboursement</h5>
            <p className="mb-4">La réservation de la salle est ferme et définitive à compter de la signature du présent contrat et/ou du règlement convenu. Aucun report de la date de réservation ne pourra être demandé ou accordé, quelle qu’en soit la raison, sauf accord écrit et exceptionnel du Prestataire.<br/>En cas d’annulation par le Client, aucun remboursement des sommes versées ne pourra être exigé, celles-ci restant définitivement acquises au Prestataire à titre d’indemnité d’immobilisation de la salle.<br/>Le Client reconnaît expressément avoir pris connaissance et accepté ces conditions lors de la réservation.</p>

            <h5 className="font-bold underline mb-4">Article 12 : Sécurité incendie</h5>
            <p className="mb-6">Le Client déclare avoir pris connaissance de la règlementation incendie relative aux Lieux Loués et notamment du plan d’évacuation <strong>(Cf Annexe).</strong></p>

            <h5 className="font-bold underline mb-4">Article 13 : Assurances</h5>
          </ContractPage>

          <ContractPage pageNumber={4}>
            <p className="mb-4">Le Client fera parvenir au Prestataire un justificatif de domicile (Facture d’abonnement électricité/eau).<br/>Dans le cas où il y a des dégâts en plus sur les Lieux Loués, le Client s’engage à procéder aux réparations de ces derniers.</p>

            <h5 className="font-bold underline mb-4">Article 14 : Responsabilité</h5>
            <p className="mb-4">Le prestataire décline toute responsabilité d’un éventuel accident survenu lors des festivités et ne peut être tenu responsable des vols et dégradations sur les biens du Client ou de ses convives.<br/>Il ne pourra pas non plus être tenu responsable des dommages causés aux véhicules ou au matériel situés sur le parking.<br/>Le Client est tenu d’assurer la sécurité des objets valeureux de ses convives. Le Prestataire décline toute responsabilité sur des objets valeureux non déclarés.</p>

            <h5 className="font-bold underline mb-4">Article 15 : Clause résolutoire</h5>
            <p className="mb-4">Il est expressément convenu qu’en cas de paiement par chèque, le règlement ne sera considéré effectif qu’après l’encaissement du chèque. Dans le cas où le chèque serait sans provision, la présente clause sera appliquée et le présent contrat deviendra nul de plein droit.<br/>A défaut de production par le Client d’une attestation couvrant sa responsabilité civile dans les délais prévus à l’article 13, il sera également fait application de la présente clause. Le présent contrat sera nul.</p>

            <h5 className="font-bold underline mb-4">Article 16 : Annexes</h5>
            <p className="mb-2">Sont annexés au présent contrat :</p>
            <ul className="list-disc pl-10 mb-16 space-y-1">
              <li>Règlement intérieur</li>
              <li>Plan de masse et évacuation incendie</li>
              <li>Proforma</li>
              <li>Liste des intervenants non autorisés</li>
            </ul>

            <p className="text-center mb-8">Fait en trois exemplaires originaux</p>
            <p className="text-right mb-12 mr-16">A Antananarivo, le {date}</p>

            <div className="grid grid-cols-2 gap-8 text-center mt-auto">
              <div><p className="mb-16">Le Prestataire,</p></div>
              <div><p className="mb-16">Le Client,</p></div>
            </div>
          </ContractPage>

          <ContractPage pageNumber={5}>
            <h4 className="text-center font-bold text-[18px] mb-6 underline decoration-2 underline-offset-4">Annexe 1 : REGLEMENT INTERIEUR</h4>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              {hahitantsoaAnnex1Rules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </ContractPage>

          <ContractPage pageNumber={6}>
            <h4 className="text-center font-bold text-[18px] mb-6 underline decoration-2 underline-offset-4">Annexe 2 : Plan de masse et évacuation incendie</h4>
            <div className="w-full flex items-center justify-center mb-6">
              <img src={hahitantsoaAnnex2PlanPath} alt="Plan de masse et évacuation incendie" className="max-w-full max-h-[600px] object-contain border border-slate-200 shadow-sm rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {hahitantsoaAnnex2Zones.map((zone, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="font-semibold text-slate-800">{zone.label}</div>
                  <div className="text-slate-600">{zone.description}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600 italic">En cas de divergence, le plan approuvé par le prestataire et affiché sur place fait foi.</p>
          </ContractPage>

          <ContractPage pageNumber={7}>
            <h4 className="text-center font-bold text-[18px] mb-6 underline decoration-2 underline-offset-4">Annexe 3 : Prix de casse</h4>
            {(() => {
              const uniqueMaterials = Array.from(new Set(materials.map(m => m.name || m.designation).filter(Boolean)))
                .map(name => materials.find(m => (m.name || m.designation) === name)!);

              const rows = uniqueMaterials.map(m => {
                    const itemName = m.name || m.designation || "Article";
                    const bp = hahitantsoaBreakagePrices.find(p => p.item.toLowerCase() === itemName.toLowerCase());
                    const unit = bp ? bp.price : 0;
                    const qty = safeNumber(m.quantity, 1);
                    return { name: itemName, qty, unitPrice: unit, total: unit * qty, source: bp ? 'catalogue' : 'constat' };
                  });

              if (rows.length === 0) {
                return (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                    Aucun matériel n’étant inclus dans cette commande, aucune grille de casse matériel ne s’applique. Les éventuelles dégradations des locaux, espaces verts ou équipements mis à disposition seront évaluées selon les dégâts constatés et facturées selon le coût réel des réparations ou du remplacement.
                  </div>
                );
              }

              return (
                <>
                  <table className="w-full text-sm mb-4 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-left">
                        <th className="py-2">Article</th>
                        <th className="py-2 text-center">Qté commandée</th>
                        <th className="py-2 text-right">Prix de casse / u</th>
                        <th className="py-2 text-right">Total potentiel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-2">{row.name} {row.source === 'constat' && <span className="text-xs text-slate-500">(à évaluer selon constat)</span>}</td>
                          <td className="py-2 text-center">{row.qty || "—"}</td>
                          <td className="py-2 text-right">{row.unitPrice ? `Ar ${formatMoneyRaw(row.unitPrice)}` : "—"}</td>
                          <td className="py-2 text-right">{row.total ? `Ar ${formatMoneyRaw(row.total)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-sm italic text-slate-600">Note : le local ou les matériels qui ne figurent pas dans la liste des commandes peuvent également faire l’objet de casse, réparation ou remplacement selon constat.</p>
                </>
              );
            })()}
          </ContractPage>

          <ContractPage pageNumber={8}>
            <h4 className="text-center font-bold text-[18px] mb-6 underline decoration-2 underline-offset-4">Annexe 4 : Liste des intervenants non autorisés</h4>
            {[].length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 text-center">
                Aucun intervenant non autorisé enregistré.
              </div>
            ) : (
              <div className="flex justify-center">
                <ul className="space-y-3 list-disc pl-5 w-full max-w-md">
                  {[].map((intervenant: any, idx) => (
                    <li key={idx} className="text-base font-medium">{intervenant.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-6 text-sm text-slate-600 italic text-center">Cette liste est consultée par le prestataire et le client lors de la passation d’entrée et de sortie.</p>
          </ContractPage>
        </div>
      );
    }
  }

  return (
    <div className={`doc-preview commercial-proforma-preview commercial-proforma-${domain} flex bg-white text-black relative overflow-hidden`} style={{ minHeight: '800px' }}>
      <div className="doc-sidebar proforma-sidebar w-[22%] bg-[#efefef] flex flex-col justify-between py-12 px-6 border-none">
        <div>
          <img src={logoPath} alt={`${domain} logo`} className="proforma-brand h-auto object-contain" />
        </div>
        <div className="proforma-side-bottom text-[10px] text-black space-y-4">
          <div>
            <p className="font-bold">BANK</p>
            <p><VariableValue token="company.bankName" value="BMOI MADAGASCAR" show={showVariables} /></p>
          </div>
          <div>
            <p className="font-bold">RIB</p>
            <p><VariableValue token="company.bankRib" value={isTitan ? "00004 00009 03319320102 33" : "00004 00009 03319320103 30"} show={showVariables} /></p>
          </div>
          <div className="mt-8">
            <p>Ergon Group SARL</p>
            <p>Lot P93M Ambohipo sud</p>
            <p>By-pass</p>
            <p>+261 34 61 791 41</p>
          </div>
          <div className="mt-4">
            <p>NIF : 6003298583</p>
            <p>STAT : 77290 11 2019 0 10215</p>
          </div>
        </div>
        <div>
          <img src={ergonLogo} alt="Ergon logo" className="proforma-ergon h-auto" />
        </div>
      </div>

      <div className="doc-body proforma-main flex-1 py-12 px-10 relative flex flex-col">
        <img src={logoPath} alt="Watermark" className="commercial-proforma-watermark proforma-watermark absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="proforma-header text-center mb-12">
          <p className="proforma-ref text-sm font-bold mb-1">{typeRef} N°: <VariableValue token="dossier.ref" value={refNumber} show={showVariables} /></p>
          <h2 className="proforma-title text-4xl font-bold tracking-[0.3em] text-black mb-2 whitespace-nowrap">{titleText}</h2>
          <p className="proforma-date text-sm">DATE <VariableValue token="document.date" value={date} show={showVariables} /></p>
        </div>

        <div className="proforma-identity mb-10 text-sm grid grid-cols-[150px_1fr] gap-y-3">
          <p className="font-bold tracking-widest">N O M :</p>
          <p><VariableValue token="client.name" value={client?.name} show={showVariables} /></p>
          <p className="font-bold tracking-widest">C O N T A C T :</p>
          <p><VariableValue token="client.phone" value={client?.phone} show={showVariables} /> {client?.email ? `/ ${client.email}` : '/'}</p>
          <p className="font-bold tracking-widest">E V E N E M E N T d u :</p>
          <p><VariableValue token="event.date" value={eventDate} show={showVariables} /></p>
        </div>

        {type === 'proforma' && client?.status === 'Prospect' && (
          <div className="mb-6 p-3 bg-amber-50 text-amber-800 text-xs border border-amber-200 rounded">
            <strong>Note importante :</strong> Ce document est une proforma émise à titre informatif. Elle ne vaut pas confirmation de réservation et ne vous confère pas le statut de client. La réservation ne sera ferme et définitive qu'après réception de l'acompte et signature du contrat.
          </div>
        )}

        <div className="mb-auto">
          <table className={`proforma-items w-full text-xs doc-table-borderless ${isTitan ? 'commercial-proforma-titan-table' : 'commercial-proforma-hahitantsoa-table'}`}>
            <thead>
              <tr className="border-none">
                <th className="text-left font-bold tracking-widest pb-4 w-12">Q T E</th>
                <th className="text-left font-bold tracking-widest pb-4">D E S I G N A T I O N</th>
                <th className="text-right font-bold tracking-widest pb-4 w-24">P. U.</th>
                <th className="text-right font-bold tracking-widest pb-4 w-28">M O N T A N T</th>
                {showBreakageColumn && <th className="text-right font-bold tracking-widest pb-4 w-24">P. C A S S E</th>}
              </tr>
            </thead>
            <tbody>
              {hasHahitantsoaLocation && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Location local</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.venuePrice)}</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.venuePrice)}</td>
                  {showBreakageColumn && <td className="text-right py-1.5">0,00</td>}
                </tr>
              )}
              {domain === 'hahitantsoa' && hDetails?.rentalType === 'Location + logistique' && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Frais logistique</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.logisticsPrice)}</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.logisticsPrice)}</td>
                  {showBreakageColumn && <td className="text-right py-1.5">0,00</td>}
                </tr>
              )}
              {!hasCommercialLines && (
                <tr className="commercial-proforma-empty-row border-none align-top">
                  <td className="py-4">&nbsp;</td>
                  <td className="py-4">&nbsp;</td>
                  <td className="py-4">&nbsp;</td>
                  <td className="py-4">&nbsp;</td>
                  {showBreakageColumn && <td className="py-4">&nbsp;</td>}
                </tr>
              )}
              {materials.map(m => {
                const mQty = safeNumber(m.quantity, 1);
                const mPrice = safeNumber(m.price, 0);
                const mTotal = mQty * mPrice;
                const mBreakage = mPrice * 5;
                return (
                  <tr key={m.id || m.name || Math.random()} className="border-none align-top">
                    <td className="text-left py-1.5">{mQty.toString().padStart(3, '0')}</td>
                    <td className="py-1.5">{m.name || m.designation || 'Article'}</td>
                    <td className="text-right py-1.5">{formatMoneyRaw(mPrice)}</td>
                    <td className="text-right py-1.5">{formatMoneyRaw(mTotal)}</td>
                    {showBreakageColumn && <td className="text-right py-1.5">{formatMoneyRaw(mBreakage)}</td>}
                  </tr>
                );
              })}
              {services.map(s => {
                const sPrice = safeNumber(s.price, 0);
                return (
                  <tr key={s.id || s.name || Math.random()} className="border-none align-top">
                    <td className="text-left py-1.5">001</td>
                    <td className="py-1.5">{s.name || 'Service'}</td>
                    <td className="text-right py-1.5">{formatMoneyRaw(sPrice)}</td>
                    <td className="text-right py-1.5">{formatMoneyRaw(sPrice)}</td>
                    {showBreakageColumn && <td className="text-right py-1.5">0,00</td>}
                  </tr>
                );
              })}
              {deliveryFee && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Frais de livraison</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(parseInt(deliveryFee, 10))}</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(parseInt(deliveryFee, 10))}</td>
                  {showBreakageColumn && <td className="text-right py-1.5">0,00</td>}
                </tr>
              )}
              {safeNumber(hDetails?.durationOptionPrice, 0) > 0 && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Tarif option horaire : {hDetails?.durationOption}</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.durationOptionPrice)}</td>
                  <td className="text-right py-1.5">{formatMoneyRaw(hDetails?.durationOptionPrice)}</td>
                  {showBreakageColumn && <td className="text-right py-1.5">0,00</td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="proforma-totals flex justify-end mb-2 mt-8 text-sm">
          <div className="w-[300px] grid grid-cols-[1fr_150px] gap-2">
            <div className="text-left tracking-widest">T O T A L</div>
            <div className="text-right"><VariableValue token="finance.subTotalAmount" value={formatMoneyRaw(safeSubTotal)} show={showVariables} /></div>

            <div className="text-left tracking-widest">R E M I S E</div>
            <div className="text-right">- <VariableValue token="finance.discountAmount" value={formatMoneyRaw(safeDiscount)} show={showVariables} /></div>
          </div>
        </div>

        <div className="commercial-proforma-total-header flex bg-[#efefef] p-3 text-sm font-bold items-center justify-between mx-[-2.5rem] px-[2.5rem] mb-2">
          <div className="tracking-widest">T O T A L A P A Y E R</div>
          <div className=""><VariableValue token="finance.totalAmount" value={formatMoneyRaw(safeTotal)} show={showVariables} /> Ar</div>
        </div>

        <div className="commercial-proforma-amount-words flex justify-between text-xs mb-8">
          <div className="w-1/2">
            Arrêtée la présente {type === 'facture' ? 'facture' : 'facture proforma'}<br/>à la somme de
          </div>
          <div className="w-1/2 text-center pt-2">
            <VariableValue token="finance.totalAmount" value={formatMoneyRaw(safeTotal)} show={showVariables} /> Ar
          </div>
        </div>

        <div className="flex justify-between text-sm mt-auto text-center px-8">
          <div className="w-1/2">Le responsable</div>
          <div className="w-1/2">Le Client</div>
        </div>

        <div className="proforma-footer-email absolute bottom-6 text-xs font-bold">
          {emailText}
        </div>
        <div className="proforma-footer-phone absolute bottom-6 text-xs font-bold">
          {phoneText}
        </div>
      </div>
    </div>
  );
};
