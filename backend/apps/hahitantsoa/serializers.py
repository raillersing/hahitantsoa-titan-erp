from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.customers.models import Customer
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftAmendmentRequest,
    HahitantsoaEventDraftAmendmentRequestLine,
    HahitantsoaEventDraftLine,
)
from apps.hahitantsoa.scope import assert_hahitantsoa_shared_inventory_item_kind
from apps.hahitantsoa.services import (
    HahitantsoaEventDraftAmendmentPreflight,
    HahitantsoaEventDraftAmendmentRequestAvailabilityPreview,
    HahitantsoaEventDraftAmendmentRequestResult,
    HahitantsoaEventDraftAvailabilityPreview,
    HahitantsoaEventDraftConfirmationPreflight,
    HahitantsoaEventDraftConfirmationResult,
    HahitantsoaSharedAvailabilityItemPreview,
    create_hahitantsoa_event_draft_amendment_request,
    get_hahitantsoa_event_draft_amendment_preflight,
    get_hahitantsoa_event_draft_amendment_request_availability_preview,
    get_hahitantsoa_event_draft_availability_preview,
    get_hahitantsoa_event_draft_confirmation_preflight,
    get_hahitantsoa_shared_availability_item_previews,
)
from apps.inventory.models import InventoryItem
from apps.reservations.periods import validate_reservation_period
from apps.reservations.serializers import ReservationAvailabilityPreviewRequestSerializer


class HahitantsoaDiscoveryItemSerializer(serializers.Serializer):
    concept = serializers.CharField()
    label = serializers.CharField()


class HahitantsoaSharedAvailabilityItemPreviewSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_description = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    status = serializers.CharField()

    @classmethod
    def from_preview(cls, preview: HahitantsoaSharedAvailabilityItemPreview):
        return cls(
            {
                "inventory_item_id": preview.inventory_item.id,
                "inventory_item_name": preview.inventory_item.name,
                "inventory_item_description": preview.inventory_item.description,
                "inventory_item_kind": preview.inventory_item.kind,
                "start_at": preview.period.start_at,
                "end_at": preview.period.end_at,
                "status": preview.status,
            }
        )

    @classmethod
    def many_from_period(cls, *, start_at, end_at):
        previews = get_hahitantsoa_shared_availability_item_previews(
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            [
                {
                    "inventory_item_id": preview.inventory_item.id,
                    "inventory_item_name": preview.inventory_item.name,
                    "inventory_item_description": preview.inventory_item.description,
                    "inventory_item_kind": preview.inventory_item.kind,
                    "start_at": preview.period.start_at,
                    "end_at": preview.period.end_at,
                    "status": preview.status,
                }
                for preview in previews
            ],
            many=True,
        )


class HahitantsoaSharedAvailabilityResponseSerializer(serializers.Serializer):
    items = HahitantsoaSharedAvailabilityItemPreviewSerializer(many=True)
    count = serializers.IntegerField()

    @classmethod
    def from_period(cls, *, start_at, end_at):
        item_serializer = HahitantsoaSharedAvailabilityItemPreviewSerializer.many_from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            {
                "items": item_serializer.data,
                "count": len(item_serializer.data),
            }
        )


class HahitantsoaEventDraftAvailabilityLinePreviewSerializer(serializers.Serializer):
    event_draft_line_id = serializers.UUIDField()
    quantity = serializers.IntegerField()
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    status = serializers.CharField()
    conflict_count = serializers.IntegerField()


class HahitantsoaEventDraftAvailabilityPreviewSerializer(serializers.Serializer):
    event_draft_id = serializers.UUIDField()
    public_reference = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    line_count = serializers.IntegerField()
    available_line_count = serializers.IntegerField()
    unavailable_line_count = serializers.IntegerField()
    lines = HahitantsoaEventDraftAvailabilityLinePreviewSerializer(many=True)

    @classmethod
    def from_preview(cls, preview: HahitantsoaEventDraftAvailabilityPreview):
        return cls(
            {
                "event_draft_id": preview.event_draft_id,
                "public_reference": preview.public_reference,
                "start_at": preview.start_at,
                "end_at": preview.end_at,
                "line_count": preview.line_count,
                "available_line_count": preview.available_line_count,
                "unavailable_line_count": preview.unavailable_line_count,
                "lines": [
                    {
                        "event_draft_line_id": line.event_draft_line_id,
                        "quantity": line.quantity,
                        "inventory_item_id": line.inventory_item_id,
                        "inventory_item_name": line.inventory_item_name,
                        "inventory_item_kind": line.inventory_item_kind,
                        "status": line.status,
                        "conflict_count": line.conflict_count,
                    }
                    for line in preview.lines
                ],
            }
        )

    @classmethod
    def from_event_draft(cls, *, event_draft: HahitantsoaEventDraft):
        return cls.from_preview(
            get_hahitantsoa_event_draft_availability_preview(event_draft=event_draft)
        )


class HahitantsoaEventDraftConfirmationPreflightSerializer(serializers.Serializer):
    event_draft_id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    can_confirm = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    active_line_count = serializers.IntegerField()
    unavailable_line_count = serializers.IntegerField()

    @classmethod
    def from_preflight(cls, preflight: HahitantsoaEventDraftConfirmationPreflight):
        return cls(
            {
                "event_draft_id": preflight.event_draft_id,
                "public_reference": preflight.public_reference,
                "status": preflight.status,
                "can_confirm": preflight.can_confirm,
                "blockers": list(preflight.blockers),
                "active_line_count": preflight.active_line_count,
                "unavailable_line_count": preflight.unavailable_line_count,
            }
        )

    @classmethod
    def from_event_draft(cls, *, event_draft: HahitantsoaEventDraft):
        return cls.from_preflight(
            get_hahitantsoa_event_draft_confirmation_preflight(event_draft=event_draft)
        )


class HahitantsoaEventDraftAmendmentPreflightSerializer(serializers.Serializer):
    event_draft_id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    can_amend = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    active_line_count = serializers.IntegerField()

    @classmethod
    def from_preflight(cls, preflight: HahitantsoaEventDraftAmendmentPreflight):
        return cls(
            {
                "event_draft_id": preflight.event_draft_id,
                "public_reference": preflight.public_reference,
                "status": preflight.status,
                "can_amend": preflight.can_amend,
                "blockers": list(preflight.blockers),
                "active_line_count": preflight.active_line_count,
            }
        )

    @classmethod
    def from_event_draft(cls, *, event_draft: HahitantsoaEventDraft):
        return cls.from_preflight(
            get_hahitantsoa_event_draft_amendment_preflight(event_draft=event_draft)
        )


class HahitantsoaEventDraftAmendmentRequestAvailabilityLinePreviewSerializer(
    serializers.Serializer
):
    amendment_request_line_id = serializers.UUIDField()
    quantity = serializers.IntegerField()
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    status = serializers.CharField()
    conflict_count = serializers.IntegerField()


class HahitantsoaEventDraftAmendmentRequestAvailabilityPreviewSerializer(serializers.Serializer):
    amendment_request_id = serializers.UUIDField()
    event_draft_id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    line_count = serializers.IntegerField()
    available_line_count = serializers.IntegerField()
    unavailable_line_count = serializers.IntegerField()
    lines = HahitantsoaEventDraftAmendmentRequestAvailabilityLinePreviewSerializer(many=True)

    @classmethod
    def from_preflight(cls, preflight: HahitantsoaEventDraftAmendmentRequestAvailabilityPreview):
        return cls(
            {
                "amendment_request_id": preflight.amendment_request_id,
                "event_draft_id": preflight.event_draft_id,
                "public_reference": preflight.public_reference,
                "status": preflight.status,
                "start_at": preflight.start_at,
                "end_at": preflight.end_at,
                "line_count": preflight.line_count,
                "available_line_count": preflight.available_line_count,
                "unavailable_line_count": preflight.unavailable_line_count,
                "lines": [
                    {
                        "amendment_request_line_id": line.amendment_request_line_id,
                        "quantity": line.quantity,
                        "inventory_item_id": line.inventory_item_id,
                        "inventory_item_name": line.inventory_item_name,
                        "inventory_item_kind": line.inventory_item_kind,
                        "status": line.status,
                        "conflict_count": line.conflict_count,
                    }
                    for line in preflight.lines
                ],
            }
        )

    @classmethod
    def from_amendment_request(cls, *, amendment_request: HahitantsoaEventDraftAmendmentRequest):
        return cls.from_preflight(
            get_hahitantsoa_event_draft_amendment_request_availability_preview(
                amendment_request=amendment_request
            )
        )


class HahitantsoaEventDraftAmendmentRequestSerializer(serializers.ModelSerializer):
    event_draft_id = serializers.UUIDField(source="event_draft.id", read_only=True)
    lines = serializers.SerializerMethodField()

    def get_lines(self, amendment_request: HahitantsoaEventDraftAmendmentRequest):
        lines = amendment_request.lines.filter(is_deleted=False).select_related("inventory_item")
        return HahitantsoaEventDraftAmendmentRequestLineSerializer(lines, many=True).data

    class Meta:
        model = HahitantsoaEventDraftAmendmentRequest
        fields = (
            "id",
            "event_draft_id",
            "status",
            "reason",
            "notes",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "event_draft_id",
            "status",
            "lines",
            "created_at",
            "updated_at",
        )


class HahitantsoaEventDraftAmendmentRequestLineSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.UUIDField(source="inventory_item.id", read_only=True)
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item_kind = serializers.CharField(source="inventory_item.kind", read_only=True)

    class Meta:
        model = HahitantsoaEventDraftAmendmentRequestLine
        fields = (
            "id",
            "inventory_item_id",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "notes",
        )
        read_only_fields = fields


class HahitantsoaEventDraftAmendmentRequestLineCreateSerializer(serializers.Serializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_inventory_item_id(self, inventory_item: InventoryItem) -> InventoryItem:
        try:
            assert_hahitantsoa_shared_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not allowed for Hahitantsoa amendment request lines."
            ) from error

        if not inventory_item.is_active or inventory_item.is_deleted:
            raise serializers.ValidationError("Inventory item must be active.")

        return inventory_item

    def create(self, validated_data):
        amendment_request = self.context["amendment_request"]
        actor = self.context["actor"]
        inventory_item = validated_data["inventory_item"]

        with transaction.atomic():
            existing_line = (
                HahitantsoaEventDraftAmendmentRequestLine.objects.select_for_update()
                .filter(
                    amendment_request=amendment_request,
                    inventory_item=inventory_item,
                )
                .first()
            )

            if existing_line is not None:
                existing_line.quantity = validated_data["quantity"]
                existing_line.notes = validated_data.get("notes", "")
                existing_line.is_deleted = False
                existing_line.deleted_at = None
                existing_line.updated_by = actor
                existing_line.full_clean()
                existing_line.save()
                return existing_line

            line = HahitantsoaEventDraftAmendmentRequestLine(
                amendment_request=amendment_request,
                inventory_item=inventory_item,
                quantity=validated_data["quantity"],
                notes=validated_data.get("notes", ""),
                created_by=actor,
                updated_by=actor,
            )
            line.full_clean()
            line.save()
            return line


class HahitantsoaEventDraftAmendmentRequestLineUpdateSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
        required=False,
    )

    class Meta:
        model = HahitantsoaEventDraftAmendmentRequestLine
        fields = (
            "inventory_item_id",
            "quantity",
            "notes",
        )

    def validate_inventory_item_id(self, inventory_item: InventoryItem) -> InventoryItem:
        try:
            assert_hahitantsoa_shared_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not allowed for Hahitantsoa amendment request lines."
            ) from error

        if not inventory_item.is_active or inventory_item.is_deleted:
            raise serializers.ValidationError("Inventory item must be active.")

        return inventory_item

    def update(self, instance, validated_data):
        for field in ("inventory_item", "quantity", "notes"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        instance.full_clean()
        instance.save()
        return instance


class HahitantsoaEventDraftAmendmentRequestCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        event_draft = self.context["event_draft"]
        actor = self.context["actor"]
        result = create_hahitantsoa_event_draft_amendment_request(
            event_draft=event_draft,
            actor=actor,
            reason=validated_data.get("reason", ""),
            notes=validated_data.get("notes", ""),
        )
        self.context["result"] = result
        return result.amendment_request


class HahitantsoaEventDraftAmendmentRequestUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HahitantsoaEventDraftAmendmentRequest
        fields = ("reason", "notes")


class HahitantsoaEventDraftAmendmentRequestResultSerializer(serializers.Serializer):
    amendment_request = HahitantsoaEventDraftAmendmentRequestSerializer()

    @classmethod
    def from_result(cls, result: HahitantsoaEventDraftAmendmentRequestResult):
        return cls(
            {
                "amendment_request": result.amendment_request,
            }
        )


class HahitantsoaEventDraftLineSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item_kind = serializers.CharField(source="inventory_item.kind", read_only=True)

    class Meta:
        model = HahitantsoaEventDraftLine
        fields = (
            "id",
            "inventory_item_id",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "notes",
        )
        read_only_fields = ("id", "inventory_item_name", "inventory_item_kind")

    def validate_inventory_item_id(self, inventory_item: InventoryItem) -> InventoryItem:
        try:
            assert_hahitantsoa_shared_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not allowed for Hahitantsoa shared event drafts."
            ) from error

        if not inventory_item.is_active or inventory_item.is_deleted:
            raise serializers.ValidationError("Inventory item must be active.")

        return inventory_item

    def validate_quantity(self, quantity: int) -> int:
        if quantity < 1:
            raise serializers.ValidationError("Quantity must be greater than zero.")

        return quantity


class HahitantsoaEventDraftSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
    )
    customer_display_name = serializers.CharField(source="customer.display_name", read_only=True)
    lines = HahitantsoaEventDraftLineSerializer(many=True)

    class Meta:
        model = HahitantsoaEventDraft
        fields = (
            "id",
            "public_reference",
            "status",
            "customer_id",
            "customer_display_name",
            "event_name",
            "venue_name",
            "location_details",
            "service_notes",
            "start_at",
            "end_at",
            "notes",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_reference",
            "status",
            "customer_display_name",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        start_at = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end_at = attrs.get("end_at", getattr(self.instance, "end_at", None))
        try:
            validate_reservation_period(start_at=start_at, end_at=end_at)
        except ValueError as error:
            raise serializers.ValidationError({"detail": str(error)}) from error

        should_validate_lines = self.instance is None or "lines" in attrs
        if should_validate_lines:
            lines = attrs.get("lines") or []
            if not lines:
                raise serializers.ValidationError({"lines": "At least one line is required."})

            inventory_item_ids = [line["inventory_item"].id for line in lines]
            if len(inventory_item_ids) != len(set(inventory_item_ids)):
                raise serializers.ValidationError(
                    {"lines": "Each inventory item can appear only once per event draft."}
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        event_draft = HahitantsoaEventDraft(**validated_data)
        event_draft.full_clean()
        event_draft.save()

        for line_data in lines_data:
            line = HahitantsoaEventDraftLine(
                event_draft=event_draft,
                created_by=event_draft.created_by,
                **line_data,
            )
            line.full_clean()
            line.save()

        return event_draft

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["lines"] = HahitantsoaEventDraftLineSerializer(
            instance.lines.filter(is_deleted=False).select_related("inventory_item"),
            many=True,
        ).data
        return representation

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()
        instance.save()

        if lines_data is not None:
            event_draft_lines = HahitantsoaEventDraftLine.objects.filter(event_draft=instance)
            acting_user = instance.updated_by
            updated_at = timezone.now()
            requested_item_ids = {str(line_data["inventory_item"].id) for line_data in lines_data}
            event_draft_lines.filter(is_deleted=False).exclude(
                inventory_item_id__in=requested_item_ids
            ).update(
                is_deleted=True,
                deleted_at=updated_at,
                updated_by=acting_user,
                updated_at=updated_at,
            )

            existing_lines_by_item_id = {
                str(line.inventory_item_id): line
                for line in event_draft_lines.select_related("inventory_item").order_by(
                    "created_at", "id"
                )
            }
            for line_data in lines_data:
                inventory_item = line_data["inventory_item"]
                line = existing_lines_by_item_id.get(str(inventory_item.id))

                if line is None:
                    line = HahitantsoaEventDraftLine(
                        event_draft=instance,
                        created_by=acting_user,
                        updated_by=acting_user,
                        **line_data,
                    )
                    line.full_clean()
                    line.save()
                else:
                    line.quantity = line_data["quantity"]
                    line.notes = line_data.get("notes", "")
                    line.is_deleted = False
                    line.deleted_at = None
                    line.updated_by = acting_user
                    line.full_clean(validate_unique=False, validate_constraints=False)
                    line.save(
                        update_fields=[
                            "quantity",
                            "notes",
                            "is_deleted",
                            "deleted_at",
                            "updated_by",
                            "updated_at",
                        ]
                    )

        return instance


class HahitantsoaEventDraftConfirmationResultSerializer(serializers.Serializer):
    status = serializers.CharField()
    public_reference = serializers.CharField()
    blocked_item_count = serializers.IntegerField()
    event_draft = HahitantsoaEventDraftSerializer()

    @classmethod
    def from_result(cls, result: HahitantsoaEventDraftConfirmationResult):
        return cls(
            {
                "status": "confirmed",
                "public_reference": result.event_draft.public_reference,
                "blocked_item_count": result.blocked_item_count,
                "event_draft": result.event_draft,
            }
        )


__all__ = [
    "HahitantsoaDiscoveryItemSerializer",
    "HahitantsoaEventDraftAmendmentRequestCreateSerializer",
    "HahitantsoaEventDraftAmendmentRequestAvailabilityPreviewSerializer",
    "HahitantsoaEventDraftAmendmentRequestLineSerializer",
    "HahitantsoaEventDraftAmendmentRequestLineCreateSerializer",
    "HahitantsoaEventDraftAmendmentRequestLineUpdateSerializer",
    "HahitantsoaEventDraftAmendmentRequestResultSerializer",
    "HahitantsoaEventDraftAmendmentRequestSerializer",
    "HahitantsoaEventDraftAmendmentRequestUpdateSerializer",
    "HahitantsoaSharedAvailabilityItemPreviewSerializer",
    "HahitantsoaSharedAvailabilityResponseSerializer",
    "HahitantsoaEventDraftAvailabilityLinePreviewSerializer",
    "HahitantsoaEventDraftAvailabilityPreviewSerializer",
    "HahitantsoaEventDraftAmendmentPreflightSerializer",
    "HahitantsoaEventDraftConfirmationPreflightSerializer",
    "HahitantsoaEventDraftConfirmationResultSerializer",
    "HahitantsoaEventDraftLineSerializer",
    "HahitantsoaEventDraftSerializer",
    "ReservationAvailabilityPreviewRequestSerializer",
]
