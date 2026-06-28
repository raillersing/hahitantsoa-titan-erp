import React from 'react';
import { 
  hahitantsoaDefaultDepositAmount, titanDepositThreshold, 
  titanSmallRentalDeposit, titanLargeRentalDepositRate,
  hahitantsoaBreakagePrices, hahitantsoaBlockedIntervenants,
  hahitantsoaMockPackages
} from './mockData';

type DocumentType = 'proforma' | 'facture' | 'contrat';

interface DocumentProps {
  type: DocumentType;
  domain: 'titan' | 'hahitantsoa';
  client: any;
  date: string;
  refNumber: string;
  eventDate?: string;
  materials?: any[];
  services?: any[];
  deliveryFee?: string;
  totalAmount: number;
  discountAmount?: number;
  subTotalAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  hDetails?: any;
  tDetails?: any;
}

export const DocumentPreview: React.FC<DocumentProps> = ({
  type,
  domain,
  client,
  date,
  refNumber,
  eventDate,
  materials = [],
  services = [],
  deliveryFee,
  totalAmount,
  discountAmount = 0,
  subTotalAmount = totalAmount,
  paidAmount = 0,
  paymentMethod = 'Non précisé',
  hDetails = {},
  tDetails = {}
}) => {
  const isTitan = domain === 'titan';
  
  const logoPath = isTitan ? '/brand/titan-rental-logo.png' : '/brand/hahitantsoa-logo.png';
  const ergonLogo = '/brand/ergon-logo.png';
  const emailText = isTitan ? 'titan@ergon.mg' : 'hahitantsoa@ergon.mg';
  const phoneText = isTitan ? '+261 34 61 791 42' : '+261 34 61 791 44';

  const titleText = type === 'proforma' ? 'P R O F O R M A' : type === 'facture' ? 'F A C T U R E' : 'CONTRAT';
  const typeRef = type === 'proforma' ? 'PROFORMA' : type === 'facture' ? 'FACTURE' : 'CONTRAT';

  const remaining = Math.max(0, totalAmount - paidAmount);

  if (type === 'contrat') {
    const ContractPage = ({ pageNumber, children }: { pageNumber: number, children: React.ReactNode }) => (
      <div className="contract-a4-page relative flex flex-col shrink-0 text-[14px] leading-snug">
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
            
            {client?.type === 'Particulier' ? (
              <p className="mb-4">Monsieur/Madame <strong>{client.name}</strong> domicilié(e) au {client.address || '................................'}<br/>Titulaire de la CIN / Passeport N° {client.idNumber || '................................'} délivré(e) le {client.idIssueDate ? new Date(client.idIssueDate).toLocaleDateString('fr-FR') : '................................'} à {client.idIssuePlace || '................................'}</p>
            ) : (
              <p className="mb-4">La société <strong>{client?.name || 'Client'}</strong> domiciliée au {client?.address || '................................'}<br/>NIF : {client?.nif || '................................'}<br/>STAT : {client?.stat || '................................'}<br/>RCS : {client?.rcs || '................................'}<br/>Représentée par {client?.repFirstName || '................................'} en sa qualité de {client?.repRole || '................................'} </p>
            )}
            <p className="text-right mb-6">Ci-après dénommée « Le client »</p>
            <p className="text-right font-bold underline mb-8">D'AUTRE PART,</p>
            
            <p className="mb-6">Le Client et le Prestataire étant dénommés ci-après les <strong>« Parties »</strong></p>
            <p className="mb-6 uppercase">IL A ETE CONVENU CE QUI SUIT :</p>
            
            <h5 className="font-bold underline mb-4">Article 1 : Objet du contrat</h5>
            <p className="mb-4">Le présent contrat est conclu entre les Parties en vue de la location de matériels évènementiels comprenant :</p>
            <ul className="list-none pl-10 mb-4 space-y-2">
              {materials.map((m, i) => (
                <li key={i}>- {m.quantity} {m.designation}</li>
              ))}
              <li>- Livraison et récupération</li>
            </ul>
            <p className="mb-4">Ci-après désignés les « Matériels Loués ».</p>
            <p className="mb-12">Le client déclare parfaitement connaitre les Matériels loués pour les avoir examinés en vue des présentes, sans qu’il soit nécessaire d’en faire plus ample désignation et déclare les accepter dans l’état où ils se trouvent tels qu’ils existent.</p>

            <h5 className="font-bold underline mb-4">Article 2 : Destination</h5>
          </ContractPage>

          <ContractPage pageNumber={2}>
            <p className="mb-4">Les matériels loués sont destinés à usage dans le cadre des évènements suivants : {tDetails?.usageType === 'Autre' ? tDetails?.usageTypeOther : (tDetails?.usageType || 'mariages, anniversaires, réceptions privées, séminaires')}.<br/>Toute autre activité en sus non mentionné doit faire l’objet d’une annexe à titre d’avenant conclu entre les parties.</p>
            <p className="mb-8">Le lieu de destination : {tDetails?.destination || '.............................'} à {tDetails?.address || '.............................'} <br/> Contact sur place : {tDetails?.contactName || '.............................'} ({tDetails?.contactPhone || '.............................'})</p>
            
            <h5 className="font-bold underline mb-4">Article 3 : Durée</h5>
            <p className="mb-4">La présente location est consentie et acceptée du {tDetails?.startDate || eventDate} à {tDetails?.startTime || '......'} heures au {tDetails?.endDate || eventDate} à {tDetails?.endTime || '......'} heures.</p>
            <p className="mb-6">Il sera alors convenu un prélèvement des matériels du {tDetails?.pickupDate || eventDate} à {tDetails?.pickupTime || '........'} heures, pour une restitution au {tDetails?.returnDate || eventDate} à {tDetails?.returnTime || '.........'} heures.</p>
            
            <h5 className="font-bold underline mb-4">Article 4 : Tarifs</h5>
            <p className="mb-4">La présente location est consentie et acceptée moyennant le prix de {totalAmount.toLocaleString('fr-FR')} Ariary TTC.</p>
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
              <div><p className="mb-16">Le Client,</p></div>
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
            
            {client?.type === 'Particulier' ? (
              <p className="mb-4">Monsieur/Madame <strong>{client.name}</strong> domicilié(e) au {client.address || '................................'}<br/>Titulaire de la CIN / Passeport N° {client.idNumber || '................................'} délivré(e) le {client.idIssueDate ? new Date(client.idIssueDate).toLocaleDateString('fr-FR') : '................................'} à {client.idIssuePlace || '................................'}<br/>Contact : {client.phone || '................................'}</p>
            ) : (
              <p className="mb-4">La société <strong>{client?.name || 'Client'}</strong> domiciliée au {client?.address || '................................'}<br/>NIF : {client?.nif || '................................'}<br/>STAT : {client?.stat || '................................'}<br/>RCS : {client?.rcs || '................................'}<br/>Représentée par {client?.repFirstName || '................................'} en sa qualité de {client?.repRole || '................................'} <br/>Contact : {client?.phone || '................................'}</p>
            )}
            <p className="text-right mb-6">Ci-après dénommée « Le client »</p>
            <p className="text-right font-bold underline mb-8">D'AUTRE PART,</p>
            
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
            <p className="mb-4">La présente location est consentie et acceptée du {hDetails?.startDate || eventDate} à {hDetails?.startTime || '.................'} heures au {hDetails?.endDate || eventDate} à {hDetails?.endTime || '......03H30............'} heures.<br/>Les intervenants du client peuvent accéder aux locaux (veuillez rayer les mentions inutiles) :</p>
            <ul className="list-disc pl-10 mb-4 space-y-1">
              <li><strong>la veille à 15 heures 30 si aucune réception n’a lieu sur les lieux, à 23 heures 30 dans le cas contraire ;</strong></li>
              <li><span className="line-through">le jour-J à 07 heures.</span></li>
            </ul>
            <p className="mb-6">L’heure de fin comprend les heures de démantèlement et reprise des Lieux Loués par le Prestataire.<br/>Toute rallonge sur les heures convenues feront l’objet de facturation en sus suivant la grille du prestataire.</p>
            
            <h5 className="font-bold underline mb-4">Article 4 : Tarifs</h5>
            <p className="mb-4">La présente location est consentie et acceptée moyennant le prix de {totalAmount.toLocaleString('fr-FR')} Ariary TTC.</p>
            <div className="pl-10 mb-4 flex flex-col gap-2">
              <div className="flex"><span className="w-48">N° Proforma :</span><span>{refNumber}</span></div>
              <div className="flex"><span className="w-48">Nombre de convives :</span><span>{hDetails?.guests || '200'}</span></div>
              <div className="flex"><span className="w-48">Type de location :</span><span>
                {hDetails?.rentalType === 'Location nue' ? '☒' : '☐'} Location nue<br/>
                {hDetails?.rentalType === 'Location nue + logistique' ? '☒' : '☐'} Location nue + logistique<br/>
                {hDetails?.rentalType === 'Location avec package' ? '☒' : '☐'} Location avec package
                {hDetails?.rentalType === 'Location avec package' && hDetails?.packageId && (
                  <span className="font-semibold text-indigo-700 ml-2">({hahitantsoaMockPackages.find(p => p.id === hDetails.packageId)?.name})</span>
                )}
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
            <p className="mb-4">Un état des lieux d’entrée sera établi lors de la prise de possession des Lieux Loués et un des lieux de sortie sera dressé lors de la remise des clés ou à la fin du contrat. Le client est tenu de rester le temps nécessaire pour procéder à l’état des lieux. Les lieux loués devront être restitués conformément à l’état des lieux d’entrée.</p>
            
            <h5 className="font-bold underline mb-4">Article 7 : Dépôt de garantie</h5>
          </ContractPage>

          <ContractPage pageNumber={3}>
            <p className="mb-4">Le client verse au Prestataire à titre de dépôt de garantie, une somme de {hahitantsoaDefaultDepositAmount.toLocaleString('fr-FR')} Ariary.<br/>La somme correspondant au dépôt de garantie est versée le jour du règlement du solde.<br/>Le montant du dépôt de garantie sera remboursé au Client le jour de la fin de location dans le cas d’un retour sans casse.</p>
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
            
            <h5 className="font-bold underline mb-4">Article 11 : Sécurité incendie</h5>
            <p className="mb-6">Le Client déclare avoir pris connaissance de la règlementation incendie relative aux Lieux Loués et notamment du plan d’évacuation <strong>(Cf Annexe).</strong></p>
            
            <h5 className="font-bold underline mb-4">Article 12 : Assurances</h5>
          </ContractPage>

          <ContractPage pageNumber={4}>
            <p className="mb-4">Le Client fera parvenir au Prestataire un justificatif de domicile (Facture d’abonnement électricité/eau).<br/>Dans le cas où il y a des dégâts en plus sur les Lieux Loués, le Client s’engage à procéder aux réparations de ces derniers.</p>
            
            <h5 className="font-bold underline mb-4">Article 13 : Responsabilité</h5>
            <p className="mb-4">Le prestataire décline toute responsabilité d’un éventuel accident survenu lors des festivités et ne peut être tenu responsable des vols et dégradations sur les biens du Client ou de ses convives.<br/>Il ne pourra pas non plus être tenu responsable des dommages causés aux véhicules ou au matériel situés sur le parking.<br/>Le Client est tenu d’assurer la sécurité des objets valeureux de ses convives. Le Prestataire décline toute responsabilité sur des objets valeureux non déclarés.</p>
            
            <h5 className="font-bold underline mb-4">Article 14 : Clause résolutoire</h5>
            <p className="mb-4">Il est expressément convenu qu’en cas de paiement par chèque, le règlement ne sera considéré effectif qu’après l’encaissement du chèque. Dans le cas où le chèque serait sans provision, la présente clause sera appliquée et le présent contrat deviendra nul de plein droit.<br/>A défaut de production par le Client d’une attestation couvrant sa responsabilité civile dans les délais prévus à l’article 13, il sera également fait application de la présente clause. Le présent contrat sera nul.</p>
            
            <h5 className="font-bold underline mb-4">Article 15 : Annexes</h5>
            <p className="mb-2">Sont annexés au présent contrat :</p>
            <ul className="list-disc pl-10 mb-16 space-y-1">
              <li>Plan de masse et évacuation incendie</li>
              <li>Règlement intérieur</li>
              <li>Prix de casse</li>
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
            <h4 className="text-center font-bold text-[18px] mb-12 underline decoration-2 underline-offset-4">Annexe 1 : REGLEMENT INTERIEUR</h4>
            <ul className="list-disc pl-8 space-y-2">
              <li>Interdiction de fumer à l’intérieur des locaux (chapiteau et bâtiments) ;</li>
              <li>Puissance d’appareils en cuisine limitée à 6 000 W (hors congélateur et réfrigérateur) ;</li>
              <li>Interdiction de toucher aux plantes du jardin (surtout pour les décorateurs);</li>
              <li>Interdiction de s’asseoir, s’appuyer sur les pierres décoratives ;</li>
              <li>Mise en place de tout support suspendu assurée par notre équipe (sur devis) / à confirmer au plus tard 10 jours avant l’événement ;</li>
              <li>Accès au salon restreint (mariés et ses proches à présenter aux responsables avant l’événement) ;</li>
              <li>Nourriture interdite au salon (sauf boissons) ;</li>
              <li>Le salon peut être utilisé comme loge artistes ;</li>
              <li>Aucun intervenant ne pourra accéder sur site avant la passation avec le représentant du Client (En cas de retard, pour une passation à 15h30, le client devra payer les indemnités de nos agents si la passation dure au-delà de 17h00) ;</li>
              <li>Accès sur site des intervenants règlementé par le port de badge mis à la disposition du Client ;</li>
              <li>Badges à retourner par le Client lors de la passation de sortie ;</li>
              <li>Les matériels sont loués propres ; ils devront être rendus de même. Dans le cas contraire, le nettoyage sera facturé selon notre tarif en vigueur.</li>
              <li>Les poubelles doivent être enlevées par les soins des intervenants (Pour le traiteur : déchets et restes de nourriture ; pour les décorateurs : fleurs, autocollant sur piste, etc…)</li>
              <li>Pour raison de sécurité, lors des préparatifs, fermeture du portail :
                <ul className="list-[circle] pl-8 mt-2 space-y-2">
                  <li>à 23h00 (si entrée des prestataires à 15h30) ;</li>
                  <li>à 01h00 (si entrée des prestataires à 23h30).</li>
                </ul>
              </li>
              <li>Réouverture du portail à 04h30 ;</li>
              <li>Pour les intervenants qui restent sur place, respecter le silence lors des préparatifs en soirée ;</li>
              <li>Pour les feux d’artifice, le client est prié de se charger de l’autorisation et de nous remettre une copie ainsi qu’à la commune et au commissariat d’Alasora.</li>
            </ul>
          </ContractPage>

          <ContractPage pageNumber={6}>
            <h4 className="text-center font-bold text-[18px] mb-12 underline decoration-2 underline-offset-4">Annexe 2 : Plan de masse et évacuation incendie</h4>
            <div className="w-full flex items-center justify-center">
              <img src="/brand/Plan de masse évacuation incendie.png" alt="Plan de masse et évacuation incendie" className="max-w-full max-h-[800px] object-contain border border-slate-200 shadow-sm" />
            </div>
          </ContractPage>

          <ContractPage pageNumber={7}>
            <h4 className="text-center font-bold text-[18px] mb-8 underline decoration-2 underline-offset-4">Annexe 3 : Prix de casse</h4>
            <ul className="space-y-2">
              {(() => {
                if (materials.length === 0) {
                  return hahitantsoaBreakagePrices.map((bp, idx) => (
                    <li key={idx} className="mb-2">{bp.item} : Ar {bp.price.toLocaleString('fr-FR')}/u ;</li>
                  ));
                }

                // Remove duplicate items just in case (same material added multiple times?)
                const uniqueMaterials = Array.from(new Set(materials.map(m => m.name)))
                  .map(name => materials.find(m => m.name === name)!);

                return uniqueMaterials.map((m, idx) => {
                  const found = hahitantsoaBreakagePrices.find(bp => bp.item.toLowerCase() === m.name.toLowerCase());
                  return (
                    <li key={idx} className="mb-2">
                      {m.name} : {found ? `Ar ${found.price.toLocaleString('fr-FR')}/u` : 'à évaluer selon constat'} ;
                    </li>
                  );
                });
              })()}
            </ul>
            <p className="mt-8 text-sm italic">Note : Le local ou les matériels qui ne figurent pas dans la liste des commandes peuvent également faire l’objet de casse, réparation ou remplacement selon constat.</p>
          </ContractPage>

          <ContractPage pageNumber={8}>
            <h4 className="text-center font-bold text-[18px] mb-8 underline decoration-2 underline-offset-4">Annexe 4 : Liste des intervenants non autorisés</h4>
            <div className="flex justify-center">
              <ul className="space-y-3 list-disc pl-5 w-full max-w-md">
                {hahitantsoaBlockedIntervenants.filter(i => i.active !== false).map((intervenant, idx) => (
                  <li key={idx} className="text-base font-medium">{intervenant.name}</li>
                ))}
              </ul>
            </div>
          </ContractPage>
        </div>
      );
    }
  }

  return (
    <div className="doc-preview flex bg-white text-black font-sans relative overflow-hidden" style={{ minHeight: '800px' }}>
      <div className="doc-sidebar w-[22%] bg-[#efefef] flex flex-col justify-between py-12 px-6 border-none">
        <div>
          <img src={logoPath} alt={`${domain} logo`} className="w-full h-auto object-contain" />
        </div>
        <div className="text-[10px] text-black space-y-4">
          <div>
            <p className="font-bold">BANK</p>
            <p>BMOI MADAGASCAR</p>
          </div>
          <div>
            <p className="font-bold">RIB</p>
            <p>00004 00009 03319320103 30</p>
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
          <img src={ergonLogo} alt="Ergon logo" className="w-12 h-auto" />
        </div>
      </div>
      
      <div className="doc-body flex-1 py-12 px-10 relative flex flex-col">
        <img src={logoPath} alt="Watermark" className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[80%] opacity-[0.03] pointer-events-none" />
        
        <div className="text-right mb-12">
          <p className="text-sm font-bold mb-1">{typeRef} N°: {refNumber}</p>
          <h2 className="text-4xl font-bold tracking-[0.3em] text-black mb-2 whitespace-nowrap">{titleText}</h2>
          <p className="text-sm">DATE {date}</p>
        </div>
        
        <div className="mb-10 text-sm grid grid-cols-[150px_1fr] gap-y-3">
          <p className="font-bold tracking-widest">N O M :</p>
          <p>{client?.name}</p>
          <p className="font-bold tracking-widest">C O N T A C T :</p>
          <p>{client?.phone} {client?.email ? `/ ${client.email}` : '/'}</p>
          <p className="font-bold tracking-widest">E V E N E M E N T d u :</p>
          <p>{eventDate}</p>
        </div>
        
        <div className="mb-auto">
          <table className="w-full text-xs doc-table-borderless">
            <thead>
              <tr className="border-none">
                <th className="text-left font-bold tracking-widest pb-4 w-12">Q T E</th>
                <th className="text-left font-bold tracking-widest pb-4">D E S I G N A T I O N</th>
                <th className="text-right font-bold tracking-widest pb-4 w-24">P. U.</th>
                <th className="text-right font-bold tracking-widest pb-4 w-28">M O N T A N T</th>
                <th className="text-right font-bold tracking-widest pb-4 w-24">P. C A S S E</th>
              </tr>
            </thead>
            <tbody>
              {domain === 'hahitantsoa' && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Location local</td>
                  <td className="text-right py-1.5">{(hDetails?.venuePrice || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{(hDetails?.venuePrice || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">0,00</td>
                </tr>
              )}
              {domain === 'hahitantsoa' && hDetails?.rentalType === 'Location nue + logistique' && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Frais logistique</td>
                  <td className="text-right py-1.5">{(hDetails?.logisticsPrice || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{(hDetails?.logisticsPrice || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">0,00</td>
                </tr>
              )}
              {materials.map(m => (
                <tr key={m.id} className="border-none align-top">
                  <td className="text-left py-1.5">{m.quantity.toString().padStart(3, '0')}</td>
                  <td className="py-1.5">{m.name}</td>
                  <td className="text-right py-1.5">{m.price.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{(m.price * m.quantity).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{(m.price * 5).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              {services.map(s => (
                <tr key={s.id} className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">{s.name}</td>
                  <td className="text-right py-1.5">{s.price.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{s.price.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">0,00</td>
                </tr>
              ))}
              {deliveryFee && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Frais de livraison</td>
                  <td className="text-right py-1.5">{parseInt(deliveryFee, 10).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{parseInt(deliveryFee, 10).toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">0,00</td>
                </tr>
              )}
              {hDetails?.durationOptionPrice > 0 && (
                <tr className="border-none align-top">
                  <td className="text-left py-1.5">001</td>
                  <td className="py-1.5">Tarif option horaire : {hDetails?.durationOption}</td>
                  <td className="text-right py-1.5">{hDetails.durationOptionPrice.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">{hDetails.durationOptionPrice.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</td>
                  <td className="text-right py-1.5">0,00</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-2 mt-8 text-sm">
          <div className="w-[300px] grid grid-cols-[1fr_150px] gap-2">
            <div className="text-left tracking-widest">S O U S  -  T O T A L</div>
            <div className="text-right">{subTotalAmount.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</div>
            
            <div className="text-left tracking-widest">R E M I S e</div>
            <div className="text-right">- {discountAmount.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</div>
          </div>
        </div>
        
        <div className="flex bg-[#efefef] p-3 text-sm font-bold items-center justify-between mx-[-2.5rem] px-[2.5rem] mb-2">
          <div className="tracking-widest">T O T A L A P A Y E R</div>
          <div className="">{totalAmount.toLocaleString('fr-FR', {minimumFractionDigits: 2})} Ar</div>
        </div>
        
        <div className="flex justify-between text-xs mb-8">
          <div className="w-1/2">
            Arrêtée la présente {type === 'facture' ? 'facture' : 'facture proforma'}<br/>à la somme de
          </div>
          <div className="w-1/2 text-center pt-2">
            Mock : cent mille Ariary
          </div>
        </div>

        <div className="flex justify-between text-sm mt-auto text-center px-8">
          <div className="w-1/2">Le responsable</div>
          <div className="w-1/2">Le Client</div>
        </div>
        
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-bold">
          {emailText}
        </div>
        <div className="absolute bottom-6 right-10 text-xs font-bold">
          {phoneText}
        </div>
      </div>
    </div>
  );
};
