from dataclasses import asdict

from rest_framework import serializers

from apps.documents.commercial import CommercialDocumentContext
from apps.documents.registry import DocumentTemplateDefinition


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

    def to_representation(self, instance: DocumentTemplateDefinition):
        if isinstance(instance, dict):
            return super().to_representation(instance)
        return super().to_representation(asdict(instance))


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

    @classmethod
    def from_commercial_document_context(
        cls,
        *,
        context: CommercialDocumentContext,
    ):
        return cls(
            {
                "document_type": context.template.document_type,
                "business_scope": context.template.business_scope,
                "template_key": context.template.key,
                "template": {
                    "key": context.template.key,
                    "business_scope": context.template.business_scope,
                    "document_type": context.template.document_type,
                    "label": context.template.label,
                    "version": context.template.version,
                    "status": context.template.status,
                    "source_kind": context.template.source_kind,
                    "source_reference": context.template.source_reference,
                    "template_path": context.template.template_path,
                    "preview_path": context.template.preview_path,
                    "validated_by_client": context.template.validated_by_client,
                    "notes": context.template.notes,
                },
                "reservation_draft": {
                    "id": context.reservation_draft.reservation_draft_id,
                    "public_reference": context.reservation_draft.public_reference,
                    "status": context.reservation_draft.status,
                    "customer_id": context.reservation_draft.customer.customer_id,
                    "customer_display_name": context.reservation_draft.customer.display_name,
                    "start_at": context.reservation_draft.start_at,
                    "end_at": context.reservation_draft.end_at,
                    "notes": context.reservation_draft.notes,
                    "lines": [
                        {
                            "id": line.reservation_draft_line_id,
                            "inventory_item_id": line.inventory_item_id,
                            "inventory_item_name": line.inventory_item_name,
                            "inventory_item_kind": line.inventory_item_kind,
                            "quantity": line.quantity,
                            "notes": line.notes,
                        }
                        for line in context.reservation_draft.lines
                    ],
                    "created_at": context.reservation_draft.created_at,
                    "updated_at": context.reservation_draft.updated_at,
                },
                "scope_flags": {
                    "pdf_runtime_generated": context.runtime_scope_flags.pdf_runtime_generated,
                    "reservation_confirmed": False,
                    "inventory_blocked": context.runtime_scope_flags.inventory_blocked,
                    "payment_created": context.runtime_scope_flags.payment_created,
                    "invoice_created": context.runtime_scope_flags.invoice_created,
                    "contract_created": context.runtime_scope_flags.contract_created,
                },
            }
        )
