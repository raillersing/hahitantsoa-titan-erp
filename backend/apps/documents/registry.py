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
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/bl/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/bl/v1/preview.pdf",
        validated_by_client=True,
        notes="Source reference is documented. Runtime PDF generation is not implemented in F98.",
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.contract_amendment.v1",
        business_scope="hahitantsoa",
        document_type="contract_amendment",
        label="Avenant de contrat Hahitantsoa",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/avenant/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/avenant/v1/preview.pdf",
        validated_by_client=True,
        notes="Source reference is documented. Runtime PDF generation is not implemented in F98.",
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.contract.v1",
        business_scope="hahitantsoa",
        document_type="contract",
        label="Contrat Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/contrat/v1/template.html",
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
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/facture/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/facture/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="hahitantsoa.proforma.v1",
        business_scope="hahitantsoa",
        document_type="proforma",
        label="Proforma Hahitantsoa",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/proforma/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/proforma/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
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
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/hahitantsoa/decharge_responsabilite/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/hahitantsoa/decharge_responsabilite/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="titan.delivery_note.v1",
        business_scope="titan",
        document_type="delivery_note",
        label="Bon de livraison Titan",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/titan/bl/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/titan/bl/v1/preview.pdf",
        validated_by_client=True,
        notes="Source reference is documented. Runtime PDF generation is not implemented in F98.",
    ),
    DocumentTemplateDefinition(
        key="titan.proforma.v1",
        business_scope="titan",
        document_type="proforma",
        label="Proforma Titan",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/titan/proforma/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/titan/proforma/v1/preview.pdf",
        validated_by_client=True,
        notes="Source reference is documented. Runtime PDF generation is not implemented in F98.",
    ),
    DocumentTemplateDefinition(
        key="titan.invoice.v1",
        business_scope="titan",
        document_type="invoice",
        label="Facture Titan",
        version="v1",
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/titan/facture/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/titan/facture/v1/preview.pdf",
        validated_by_client=True,
        notes="Source reference is documented. Runtime PDF generation is not implemented in F98.",
    ),
    DocumentTemplateDefinition(
        key="titan.material_amendment.v1",
        business_scope="titan",
        document_type="material_amendment",
        label="Avenant materiel Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/titan/avenant_materiel/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/titan/avenant_materiel/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
    ),
    DocumentTemplateDefinition(
        key="titan.material_contract.v1",
        business_scope="titan",
        document_type="material_contract",
        label="Contrat materiel Titan",
        version="v1",
        status="generated_draft_template",
        source_kind="generated_from_brand_style",
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/titan/contrat_materiel/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/titan/contrat_materiel/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
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
        template_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/template.html",
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
        template_path="backend/apps/documents/templates_documents/shared/recu_remboursement/v1/template.html",
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
        template_path="backend/apps/documents/templates_documents/shared/bon_retour/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_retour/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
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
        template_path="backend/apps/documents/templates_documents/shared/bon_sortie_interne/v1/template.html",
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
        source_reference="docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/bon_commande_fournisseur/v1/template.html",
        preview_path="backend/apps/documents/templates_documents/shared/bon_commande_fournisseur/v1/preview.pdf",
        validated_by_client=False,
        notes=DRAFT_PLACEHOLDER_NOTE,
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
        template_path="backend/apps/documents/templates_documents/shared/facture_casse_remise_etat/v1/template.html",
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
        status="validated_source_template",
        source_kind="source_pdf",
        source_reference="docs/references/source/templates/Template_Facture_Excess_Perte_Dommage_v1.pdf",
        template_path="backend/apps/documents/templates_documents/shared/damage_loss_excess_invoice/v1/template.html",
        preview_path="docs/references/source/templates/Template_Facture_Excess_Perte_Dommage_v1.pdf",
        validated_by_client=True,
        notes="Validated source template for damage/loss excess invoice documents.",
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
