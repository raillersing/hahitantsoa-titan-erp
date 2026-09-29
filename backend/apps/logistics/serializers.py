from rest_framework import serializers

from apps.logistics.models import (
    HandoverSignatureStatus,
    LogisticsEvent,
    LogisticsEventItemLine,
    LogisticsEventStatus,
    LogisticsEventType,
    LogisticsOperationKind,
    TitanClosedDay,
)


class TitanClosedDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = TitanClosedDay
        fields = ("id", "date", "label")
        read_only_fields = fields


class LogisticsEventItemLineSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item_kind = serializers.CharField(source="inventory_item.kind", read_only=True)

    class Meta:
        model = LogisticsEventItemLine
        fields = (
            "id",
            "logistics_event",
            "inventory_item",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "logistics_event",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "inventory_item_name",
            "inventory_item_kind",
        )


class LogisticsEventItemLineCreateSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class LogisticsEventSerializer(serializers.ModelSerializer):
    item_lines = LogisticsEventItemLineSerializer(many=True, read_only=True)
    dossier_reference = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    delivery_note_reference = serializers.SerializerMethodField()
    delivery_note_status = serializers.SerializerMethodField()
    domain = serializers.SerializerMethodField()

    class Meta:
        model = LogisticsEvent
        fields = (
            "id",
            "reservation_draft",
            "hahitantsoa_event_draft",
            "dossier_reference",
            "customer_name",
            "delivery_note_reference",
            "delivery_note_status",
            "domain",
            "event_type",
            "operation",
            "status",
            "scheduled_at",
            "executed_at",
            "address",
            "contact_name",
            "contact_phone",
            "notes",
            "signature_required",
            "signature_received",
            "signature_status",
            "signature_exception_reason",
            "signed_document_file",
            "signed_document_hash",
            "signed_by_client_name",
            "signed_by",
            "signed_at",
            "item_lines",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "status",
            "executed_at",
            "signature_received",
            "signature_status",
            "signature_exception_reason",
            "signed_document_file",
            "signed_document_hash",
            "signed_by_client_name",
            "signed_by",
            "signed_at",
            "dossier_reference",
            "customer_name",
            "delivery_note_reference",
            "delivery_note_status",
            "domain",
        )

    def get_dossier_reference(self, obj: LogisticsEvent) -> str:
        if obj.reservation_draft:
            return obj.reservation_draft.public_reference
        if obj.hahitantsoa_event_draft:
            return obj.hahitantsoa_event_draft.public_reference
        return ""

    def get_customer_name(self, obj: LogisticsEvent) -> str:
        if obj.contact_name:
            return obj.contact_name
        if obj.reservation_draft and obj.reservation_draft.customer:
            return obj.reservation_draft.customer.display_name
        if obj.hahitantsoa_event_draft and obj.hahitantsoa_event_draft.customer:
            return obj.hahitantsoa_event_draft.customer.display_name
        return ""

    def get_delivery_note_reference(self, obj: LogisticsEvent) -> str | None:
        draft = obj.reservation_draft or obj.hahitantsoa_event_draft
        if draft:
            doc = (
                draft.document_instances.filter(document_type="delivery_note")
                .order_by("-created_at")
                .first()
            )
            if doc and doc.document_reference:
                return doc.document_reference
        return None

    def get_delivery_note_status(self, obj: LogisticsEvent) -> str | None:
        draft = obj.reservation_draft or obj.hahitantsoa_event_draft
        if draft:
            doc = (
                draft.document_instances.filter(document_type="delivery_note")
                .order_by("-created_at")
                .first()
            )
            if doc:
                return doc.status
        return None

    def get_domain(self, obj: LogisticsEvent) -> str:
        if obj.hahitantsoa_event_draft:
            return "hahitantsoa"
        if obj.reservation_draft:
            return "titan"
        return "general"


class LogisticsEventCreateSerializer(serializers.Serializer):
    reservation_draft = serializers.UUIDField(required=False)
    hahitantsoa_event_draft = serializers.UUIDField(required=False)
    event_type = serializers.ChoiceField(choices=LogisticsEventType.choices)
    operation = serializers.ChoiceField(
        choices=LogisticsOperationKind.choices,
        required=False,
        default=LogisticsOperationKind.OUTBOUND,
    )
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)
    signature_required = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if bool(attrs.get("reservation_draft")) == bool(attrs.get("hahitantsoa_event_draft")):
            raise serializers.ValidationError(
                "Provide exactly one reservation_draft or hahitantsoa_event_draft."
            )
        return attrs


class LogisticsEventUpdateSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)
    signature_required = serializers.BooleanField(required=False)


class LogisticsEventStatusTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=LogisticsEventStatus.choices)
    executed_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class LogisticsEventCompletePassationSerializer(serializers.Serializer):
    signed_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class LogisticsEventSignatureUpdateSerializer(serializers.Serializer):
    signature_status = serializers.ChoiceField(
        choices=HandoverSignatureStatus.choices,
        required=True,
    )
    signed_by_client_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
    signature_exception_reason = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs: dict) -> dict:
        status_value = attrs.get("signature_status")
        if status_value == HandoverSignatureStatus.RECEIVED:
            file_provided = bool(self.context.get("signed_document_file"))
            if not file_provided and not attrs.get("signed_by_client_name"):
                raise serializers.ValidationError(
                    "signed_by_client_name is required when signature_status is "
                    "'received' and no signed_document_file is provided."
                )
        if status_value == HandoverSignatureStatus.EXCEPTION and not attrs.get(
            "signature_exception_reason"
        ):
            raise serializers.ValidationError(
                "signature_exception_reason is required when signature_status is 'exception'."
            )
        return attrs
