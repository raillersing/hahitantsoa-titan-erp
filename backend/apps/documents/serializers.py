import hashlib
from dataclasses import asdict
from pathlib import Path

from django.utils.text import get_valid_filename
from rest_framework import serializers

from apps.customers.models import Customer
from apps.documents.models import (
    DocumentInstance,
    DocumentTemplate,
    DocumentTemplateVersion,
    UploadedAttachment,
    UploadedAttachmentCategory,
)
from apps.documents.registry import (
    DocumentTemplateDefinition,
    get_document_template_workflow_usage,
)
from apps.documents.services import (
    get_document_instance_contract_warnings,
    get_supported_reservation_draft_document_template_keys,
)
from apps.finance.models import FinanceBankProfile
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft


class DocumentTemplateDefinitionSerializer(serializers.Serializer):
    key = serializers.CharField()
    business_scope = serializers.CharField()
    document_type = serializers.CharField()
    label = serializers.CharField()
    version = serializers.CharField()
    status = serializers.CharField()
    source_kind = serializers.CharField()
    source_reference = serializers.CharField()
    template_path = serializers.CharField()
    preview_path = serializers.CharField()
    validated_by_client = serializers.BooleanField()
    notes = serializers.CharField()
    workflow_usage = serializers.ListField(child=serializers.CharField())

    def to_representation(self, instance: DocumentTemplateDefinition):
        if isinstance(instance, dict):
            return super().to_representation(instance)
        representation = asdict(instance)
        representation["workflow_usage"] = list(get_document_template_workflow_usage(instance.key))
        return super().to_representation(representation)


class RuntimeDocumentScopeFlagsSerializer(serializers.Serializer):
    pdf_runtime_generated = serializers.BooleanField()
    reservation_confirmed = serializers.BooleanField()
    inventory_blocked = serializers.BooleanField()
    payment_created = serializers.BooleanField()
    invoice_created = serializers.BooleanField()
    contract_created = serializers.BooleanField()


class TitanProformaDraftPreviewLineSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    quantity = serializers.IntegerField()
    notes = serializers.CharField()


class TitanProformaDraftPreviewReservationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    customer_id = serializers.UUIDField()
    customer_display_name = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    notes = serializers.CharField()
    lines = TitanProformaDraftPreviewLineSerializer(many=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class TitanProformaDraftPreviewSerializer(serializers.Serializer):
    document_type = serializers.CharField()
    business_scope = serializers.CharField()
    template_key = serializers.CharField()
    template = DocumentTemplateDefinitionSerializer()
    reservation_draft = TitanProformaDraftPreviewReservationSerializer()
    scope_flags = RuntimeDocumentScopeFlagsSerializer()


class DocumentInstanceSerializer(serializers.ModelSerializer):
    contract_warnings = serializers.SerializerMethodField()

    def get_contract_warnings(self, instance: DocumentInstance) -> list[dict[str, str]]:
        return get_document_instance_contract_warnings(document_instance=instance)

    class Meta:
        model = DocumentInstance
        fields = (
            "id",
            "reservation_draft",
            "hahitantsoa_event_draft",
            "customer",
            "template_key",
            "template_version",
            "template_label",
            "business_scope",
            "document_type",
            "template_status",
            "template_source_kind",
            "template_source_reference",
            "template_path",
            "template_preview_path",
            "template_validated_by_client",
            "template_notes",
            "reservation_public_reference",
            "reservation_status",
            "customer_display_name",
            "customer_party_type",
            "customer_email",
            "customer_phone",
            "customer_contact_points_snapshot",
            "customer_address",
            "customer_civilite",
            "customer_birth_date",
            "customer_birth_place",
            "customer_id_type",
            "customer_id_number",
            "customer_id_issue_date",
            "customer_id_issue_place",
            "customer_id_duplicata_date",
            "customer_id_duplicata_place",
            "customer_nif",
            "customer_stat",
            "customer_rcs",
            "customer_representative_name",
            "customer_representative_role",
            "bank_profile",
            "bank_name",
            "bank_branch",
            "bank_account_holder",
            "bank_account_number",
            "bank_rib",
            "bank_iban",
            "bank_swift_bic",
            "status",
            "prepared_at",
            "prepared_by",
            "voided_at",
            "voided_by",
            "void_reason",
            "content_checksum",
            "storage_path",
            "generated_content_size_bytes",
            "pdf_storage_path",
            "pdf_generated_at",
            "pdf_content_checksum",
            "proforma_validity_days",
            "document_date",
            "issued_at",
            "valid_until",
            "notes",
            "amendment_sequence",
            "amendment_source_document_id",
            "contract_warnings",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DocumentInstanceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the hub list view."""

    reservation_draft_id = serializers.UUIDField(read_only=True)
    hahitantsoa_event_draft_id = serializers.UUIDField(read_only=True)
    customer_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = DocumentInstance
        fields = (
            "id",
            "document_type",
            "business_scope",
            "template_key",
            "template_label",
            "reservation_public_reference",
            "reservation_status",
            "customer_display_name",
            "customer_email",
            "customer_phone",
            "status",
            "created_at",
            "updated_at",
            "reservation_draft_id",
            "hahitantsoa_event_draft_id",
            "customer_id",
        )
        read_only_fields = fields


MAX_UPLOADED_ATTACHMENT_BYTES = 10 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _attachment_signature_matches(suffix: str, header: bytes) -> bool:
    if suffix == ".pdf":
        return header.startswith(b"%PDF-")
    if suffix in {".jpg", ".jpeg"}:
        return header.startswith(b"\xff\xd8\xff")
    if suffix == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if suffix == ".webp":
        return header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    return False


class UploadedAttachmentSerializer(serializers.ModelSerializer):
    customer_reference = serializers.CharField(source="customer.public_reference", read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
        required=False,
        allow_null=True,
    )
    reservation_draft_id = serializers.PrimaryKeyRelatedField(
        source="reservation_draft",
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    hahitantsoa_event_draft_id = serializers.PrimaryKeyRelatedField(
        source="hahitantsoa_event_draft",
        queryset=HahitantsoaEventDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    file = serializers.FileField(write_only=True)

    class Meta:
        model = UploadedAttachment
        fields = (
            "id",
            "customer_id",
            "customer_reference",
            "reservation_draft_id",
            "hahitantsoa_event_draft_id",
            "category",
            "label",
            "file",
            "original_name",
            "content_type",
            "size_bytes",
            "sha256",
            "created_at",
        )
        read_only_fields = (
            "id",
            "original_name",
            "content_type",
            "size_bytes",
            "sha256",
            "created_at",
        )

    def validate(self, attrs):
        customer = attrs.get("customer")
        reservation_draft = attrs.get("reservation_draft")
        event_draft = attrs.get("hahitantsoa_event_draft")
        uploaded_file = attrs.get("file")

        if not customer and not reservation_draft and not event_draft:
            raise serializers.ValidationError(
                "Rattachez la pièce jointe à un client ou à une réservation."
            )
        if reservation_draft and event_draft:
            raise serializers.ValidationError(
                "Une pièce jointe ne peut être rattachée qu'à un seul volet."
            )
        if reservation_draft and customer and reservation_draft.customer_id != customer.id:
            raise serializers.ValidationError(
                {"customer_id": "Le client ne correspond pas à la réservation."}
            )
        if event_draft and customer and event_draft.customer_id != customer.id:
            raise serializers.ValidationError(
                {"customer_id": "Le client ne correspond pas à l'événement."}
            )

        category = attrs.get("category")
        payment_categories = {
            UploadedAttachmentCategory.PAYMENT_PROOF,
            UploadedAttachmentCategory.PAYMENT_RECEIPT,
            UploadedAttachmentCategory.PAYMENT_MOBILE,
            UploadedAttachmentCategory.PAYMENT_CHEQUE,
            UploadedAttachmentCategory.PAYMENT_TRANSFER,
            UploadedAttachmentCategory.PAYMENT_CARD,
        }
        if category in payment_categories and not (reservation_draft or event_draft):
            raise serializers.ValidationError(
                {"category": "Une preuve de paiement doit être liée à une réservation."}
            )

        if uploaded_file is None:
            raise serializers.ValidationError({"file": "Le fichier est obligatoire."})
        suffix = Path(uploaded_file.name).suffix.casefold()
        expected_type = ALLOWED_ATTACHMENT_TYPES.get(suffix)
        if expected_type is None:
            raise serializers.ValidationError(
                {"file": "Format refusé. Utilisez PDF, JPG, PNG ou WEBP."}
            )
        if uploaded_file.size > MAX_UPLOADED_ATTACHMENT_BYTES:
            raise serializers.ValidationError(
                {"file": "La pièce jointe ne doit pas dépasser 10 Mo."}
            )
        if uploaded_file.content_type != expected_type:
            raise serializers.ValidationError(
                {"file": "Le type MIME du fichier ne correspond pas à son extension."}
            )
        header = uploaded_file.read(16)
        uploaded_file.seek(0)
        if not _attachment_signature_matches(suffix, header):
            raise serializers.ValidationError({"file": "Le contenu du fichier est invalide."})
        return attrs

    def create(self, validated_data):
        uploaded_file = validated_data.pop("file")
        digest = hashlib.sha256()
        for chunk in uploaded_file.chunks():
            digest.update(chunk)
        uploaded_file.seek(0)
        safe_name = get_valid_filename(Path(uploaded_file.name).name)[:255] or "attachment"
        return UploadedAttachment.objects.create(
            file=uploaded_file,
            original_name=safe_name,
            content_type=uploaded_file.content_type,
            size_bytes=uploaded_file.size,
            sha256=digest.hexdigest(),
            created_by=self.context["request"].user,
            updated_by=self.context["request"].user,
            **validated_data,
        )


class DocumentInstanceCreateSerializer(serializers.Serializer):
    template_key = serializers.ChoiceField(
        choices=tuple(get_supported_reservation_draft_document_template_keys())
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    document_date = serializers.DateField(required=False, allow_null=True)
    proforma_validity_days = serializers.IntegerField(required=False, min_value=1, max_value=365)
    bank_profile = serializers.PrimaryKeyRelatedField(
        queryset=FinanceBankProfile.objects.select_related("account"),
        required=False,
        allow_null=True,
    )


class DocumentInstanceGenerateSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    content_checksum = serializers.CharField()
    storage_path = serializers.CharField()
    generated_content_size_bytes = serializers.IntegerField()


class DocumentInstancePDFSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.CharField()
    pdf_storage_path = serializers.CharField()
    pdf_generated_at = serializers.DateTimeField()
    pdf_content_checksum = serializers.CharField()
    issued_at = serializers.DateTimeField(required=False, allow_null=True)
    valid_until = serializers.DateTimeField(required=False, allow_null=True)


class DocumentTemplateCRUDSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplate
        fields = (
            "id",
            "code",
            "name",
            "description",
            "family",
            "business_scope",
            "document_type",
            "status",
        )
        read_only_fields = ("id",)


class DocumentTemplateVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplateVersion
        fields = (
            "id",
            "template",
            "version",
            "status",
            "body_html",
            "header_html",
            "footer_html",
            "css",
            "variables_schema",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
