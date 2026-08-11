from dataclasses import dataclass
from typing import Literal

BusinessScope = Literal["hahitantsoa", "titan", "shared"]
TemplateStatus = Literal["validated_source_template", "generated_draft_template"]
TemplateSourceKind = Literal["source_pdf", "generated_from_brand_style"]

DRAFT_PLACEHOLDER_NOTE = (
    "Draft placeholder only. Template content and PDF generation are out of scope for F98."
)


@dataclass(frozen=True)
class DocumentTemplateDefinition:
    key: str
    business_scope: BusinessScope
    document_type: str
    label: str
    version: str
    status: TemplateStatus
    source_kind: TemplateSourceKind
    source_reference: str
    template_path: str
    preview_path: str
    validated_by_client: bool
    notes: str


DOCUMENT_TEMPLATE_REGISTRY: tuple[DocumentTemplateDefinition, ...] = (
    DocumentTemplateDefinition(
        key="hahitantsoa.delivery_note.v1",
        business_scope="hahitantsoa",
        document_type="delivery_note",
        label="Bon de livraison Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Hahitantsoa/Bon de livraison/20240530 BL HAHITANTSOA 018-24 RAHARIJAONA RASETAMANANA Solofonantenaina.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_delivery_note.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/bl/v1/preview.pdf",
        validated_by_client=False,
        notes="Replicate the A4 Hahitantsoa delivery-note layout from the nested Windows source before client validation. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.contract_amendment.v1",
        business_scope="hahitantsoa",
        document_type="contract_amendment",
        label="Avenant de contrat Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Hahitantsoa/Avenant/20240418 Avenant de contrat du 05 OCTOBRE   2024 RAVAOHARIMANANA Miora Nandrianina.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_contract_amendment.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/avenant/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 Hahitantsoa amendment replica. The blank source controls geometry; filled sources control party, date, amount and option content. PDF is generated at runtime. Client visual validation remains pending.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.contract.v1",
        business_scope="hahitantsoa",
        document_type="contract",
        label="Contrat Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/templates/Hahitantsoa/Contrat/20240124 CONTRAT DE LOCATION HAHITANTSOA DU 26 JANVIER 2024 PWC.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_contract.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/contrat/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.invoice.v1",
        business_scope="hahitantsoa",
        document_type="invoice",
        label="Facture Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Hahitantsoa/Facture/2024130 FACTURE HAHITANTSOA 093-24 RANJAVASON Nihantra Fanomezana.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_invoice.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/facture/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 Hahitantsoa invoice; preserve its source geometry and validate the variable mapping. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.proforma.v1",
        business_scope="hahitantsoa",
        document_type="proforma",
        label="Proforma Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/Hahitantsoa/Proforma/20240109 PROFORMA HAHITANTSOA 003-24 ANDRIAMAMPIANINA Ranto.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_proforma.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/proforma/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 Hahitantsoa proforma; protected workflow renderer remains unchanged. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.house_rules.v1",
        business_scope="hahitantsoa",
        document_type="house_rules",
        label="Reglement interieur Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/reglement_interieur/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/reglement_interieur/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.liability_release.v1",
        business_scope="hahitantsoa",
        document_type="liability_release",
        label="Decharge de responsabilite Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Hahitantsoa/Décharge de responsabilité civila_v1.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/hahitantsoa_liability_release.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/decharge_responsabilite/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 liability release replica; document remains separate from the protected contract renderer. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="titan.delivery_note.v1",
        business_scope="titan",
        document_type="delivery_note",
        label="Bon de livraison Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Template_BL_Titan_vierge_style_fidele_v1.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/titan_delivery_note.html",
        preview_path="backend/apps/documents/templates_documents/titan/bl/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 Titan delivery-note replica; client visual validation remains pending. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="titan.proforma.v1",
        business_scope="titan",
        document_type="proforma",
        label="Proforma Titan",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/Titan/Proforma/20240206 PROFORMA TITAN 002-24 CALISTA.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/titan_proforma.html",
        preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        validated_by_client=True,
        notes="Source-backed A4 Titan proforma; protected workflow renderer remains unchanged.",
    ),
    DocumentTemplateDefinition(
        key="titan.invoice.v1",
        business_scope="titan",
        document_type="invoice",
        label="Facture Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Template_FACTURE_Titan_vierge_style_fidele_v1.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/titan_invoice.html",
        preview_path="backend/apps/documents/templates_documents/titan/facture/v1/preview.pdf",
        validated_by_client=False,
        notes="Source-backed A4 Titan invoice replica; client visual validation remains pending. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="titan.material_amendment.v1",
        business_scope="titan",
        document_type="material_amendment",
        label="Avenant materiel Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/Avenant de contrat titan 2023 V2.docx",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/titan_material_amendment.html",
        preview_path="backend/apps/documents/templates_documents/titan/avenant_materiel/v1/preview.pdf",
        validated_by_client=False,
        notes="Draft HTML reconstructed from the nested Titan amendment DOCX; exact visual validation remains pending. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="titan.material_contract.v1",
        business_scope="titan",
        document_type="material_contract",
        label="Contrat materiel Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/Titan/Contrat/20240615 CONTRAT DE LOCATION TITAN RENTAL 15 JUIN 2024.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/titan_material_contract.html",
        preview_path="backend/apps/documents/templates_documents/titan/contrat_materiel/v1/preview.pdf",
        validated_by_client=False,
        notes="Draft HTML reconstructed from the nested Titan contract PDF; exact visual validation remains pending. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="shared.payment_receipt.v1",
        business_scope="shared",
        document_type="payment_receipt",
        label="Recu de paiement",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates/documents/shared_payment_receipt.html",
        preview_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="shared.payment_refund_receipt.v1",
        business_scope="shared",
        document_type="payment_refund_receipt",
        label="Recu de remboursement",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates/documents/shared_payment_refund_receipt.html",
        preview_path="backend/apps/documents/templates_documents/shared/recu_remboursement/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="shared.return_note.v1",
        business_scope="shared",
        document_type="return_note",
        label="Bon de retour",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates/documents/shared_return_note.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_retour/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="shared.preparation_sheet.v1",
        business_scope="shared",
        document_type="preparation_sheet",
        label="Bon de préparation interne",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/templates/checking passation.docx",
        template_path="backend/apps/documents/templates/documents/preparation_sheet.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_preparation/v1/preview.pdf",
        validated_by_client=False,
        notes=(
            "Document interne staff : articles et quantités uniquement, sans prix ni données "
            "financières. Runtime PDF generation is not implemented in F98."
        ),
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.preparation_sheet.v1",
        business_scope="hahitantsoa",
        document_type="preparation_sheet",
        label="Checking de passation Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/templates/checking passation.docx",
        template_path="backend/apps/documents/templates/documents/hahitantsoa_preparation_sheet.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/checking_passation/v1/preview.pdf",
        validated_by_client=False,
        notes=(
            "Source-backed A4 checking de passation replicated from checking passation.docx; "
            "aucun prix ni donnée financière. PDF is generated at runtime."
        ),
    ),
    DocumentTemplateDefinition(
        key="shared.internal_release_note.v1",
        business_scope="shared",
        document_type="internal_release_note",
        label="Bon de sortie interne",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates/documents/shared_internal_release_note.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_sortie_interne/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="shared.supplier_purchase_order.v1",
        business_scope="shared",
        document_type="supplier_purchase_order",
        label="Bon de commande fournisseur",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="/mnt/c/Users/raillersing/Documents/Ergon Projects/Modele Facture/20221128 BON DE COMMANDE 002-22.pdf",  # noqa: E501
        template_path="backend/apps/documents/templates/documents/shared_supplier_purchase_order.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_commande_fournisseur/v1/preview.pdf",
        validated_by_client=False,
        notes="Draft HTML reconstructed from the nested supplier purchase-order PDF; exact visual validation remains pending. PDF is generated at runtime.",  # noqa: E501
    ),
    DocumentTemplateDefinition(
        key="shared.breakage_repair_invoice.v1",
        label="Facture casse et remise en etat",
        business_scope="shared",
        document_type="breakage_repair_invoice",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf",
        template_path="backend/apps/documents/templates/documents/shared_breakage_repair_invoice.html",
        preview_path="docs/references/source/templates/Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf",
        validated_by_client=True,
        notes="Validated source template for breakage and repair invoice documents.",
    ),
    DocumentTemplateDefinition(
        key="shared.damage_loss_excess_invoice.v1",
        label="Facture d'excédent de perte et de dommage",
        business_scope="shared",
        document_type="damage_loss_excess_invoice",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates/documents/shared_damage_loss_excess_invoice.html",
        preview_path="backend/apps/documents/templates_documents/shared/damage_loss_excess_invoice/v1/preview.pdf",
        validated_by_client=False,
        notes=(
            "Draft placeholder only. Built from available casse/loss references; exact original "
            "excess-loss source is not present."
        ),
    ),
)


def list_document_template_definitions() -> tuple[DocumentTemplateDefinition, ...]:
    return DOCUMENT_TEMPLATE_REGISTRY


def get_document_template_definition(template_key: str) -> DocumentTemplateDefinition | None:
    return next(
        (
            template_definition
            for template_definition in DOCUMENT_TEMPLATE_REGISTRY
            if template_definition.key == template_key
        ),
        None,
    )
