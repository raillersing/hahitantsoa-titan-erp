from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.customers.models import (
    Customer,
    CustomerContactKind,
    CustomerContactPoint,
    CustomerLifecycleStatus,
    CustomerPartyType,
    DesiredDateWaitlistEntry,
)


class CustomerContactPointSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(choices=CustomerContactKind.choices)

    class Meta:
        model = CustomerContactPoint
        fields = ("id", "kind", "value", "label", "is_primary")
        read_only_fields = ("id",)

    def validate_value(self, value: str) -> str:
        return value.strip()

    def validate(self, attrs):
        if attrs["kind"] == CustomerContactKind.EMAIL:
            from django.core.validators import validate_email

            try:
                validate_email(attrs["value"])
            except DjangoValidationError as error:
                raise serializers.ValidationError(
                    {"value": "A valid email address is required."}
                ) from error
        return attrs


class CustomerSerializer(serializers.ModelSerializer):
    lifecycle_status = serializers.ChoiceField(
        choices=CustomerLifecycleStatus.choices,
        required=False,
    )
    party_type = serializers.ChoiceField(
        choices=CustomerPartyType.choices,
        required=False,
    )
    current_dossier_count = serializers.IntegerField(read_only=True, default=0)
    closed_dossier_count = serializers.IntegerField(read_only=True, default=0)
    draft_dossier_count = serializers.IntegerField(read_only=True, default=0)
    cancelled_dossier_count = serializers.IntegerField(read_only=True, default=0)
    reservation_count = serializers.SerializerMethodField()
    event_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()
    contact_points = CustomerContactPointSerializer(many=True, required=False)
    idempotency_key = serializers.CharField(
        max_length=128, required=False, allow_blank=True, write_only=True
    )

    def get_reservation_count(self, obj):
        return getattr(obj, "reservation_count", 0)

    def get_event_count(self, obj):
        return getattr(obj, "event_count", 0)

    def get_document_count(self, obj):
        return getattr(obj, "document_count", 0)

    def get_last_activity_at(self, obj):
        values = (
            getattr(obj, "last_reservation_at", None),
            getattr(obj, "last_event_at", None),
            getattr(obj, "last_document_at", None),
        )
        return max((value for value in values if value is not None), default=None)

    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:
            fields["lifecycle_status"].read_only = True
            fields["party_type"].read_only = True
        return fields

    class Meta:
        model = Customer
        fields = (
            "id",
            "public_reference",
            "display_name",
            "lifecycle_status",
            "party_type",
            "email",
            "phone",
            "contact_points",
            "address",
            "civilite",
            "birth_date",
            "birth_place",
            "id_type",
            "id_number",
            "id_issue_date",
            "id_issue_place",
            "id_duplicata_date",
            "id_duplicata_place",
            "nif",
            "stat",
            "rcs",
            "representative_name",
            "representative_role",
            "notes",
            "idempotency_key",
            "is_active",
            "prospect_request_type",
            "prospect_interest_domain",
            "prospect_requested_date",
            "prospect_budget",
            "prospect_next_follow_up",
            "prospect_status",
            "prospect_status_changed_at",
            "prospect_status_reason",
            "prospect_follow_up_owner",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
            "current_dossier_count",
            "closed_dossier_count",
            "draft_dossier_count",
            "cancelled_dossier_count",
            "reservation_count",
            "event_count",
            "document_count",
            "last_activity_at",
        )
        read_only_fields = (
            "id",
            "public_reference",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
        )

    def validate(self, attrs):
        if self.instance is not None and "idempotency_key" in attrs:
            raise serializers.ValidationError(
                {"idempotency_key": "La clé de création est immuable."}
            )
        contact_points = attrs.get("contact_points")
        if contact_points is None:
            return attrs

        seen_values = set()
        primary_by_kind = set()
        for contact in contact_points:
            kind = contact["kind"]
            value = contact["value"]
            key = (kind, value.casefold() if kind == CustomerContactKind.EMAIL else value)
            if key in seen_values:
                raise serializers.ValidationError(
                    {"contact_points": "Each contact value can be entered only once per type."}
                )
            seen_values.add(key)
            if contact.get("is_primary", False):
                if kind in primary_by_kind:
                    raise serializers.ValidationError(
                        {"contact_points": "Only one primary contact is allowed per type."}
                    )
                primary_by_kind.add(kind)
        return attrs

    def create(self, validated_data):
        from apps.customers.services import create_customer_idempotently

        values = dict(validated_data)
        actor = values.pop("created_by", None)
        values.pop("updated_by", None)
        key = values.pop("idempotency_key", "")
        return create_customer_idempotently(values=values, actor=actor, idempotency_key=key)[0]

    def update(self, instance, validated_data):
        from apps.customers.services import update_customer_record

        return update_customer_record(customer=instance, values=validated_data)


class DesiredDateWaitlistEntrySerializer(serializers.ModelSerializer):
    customer_id = serializers.UUIDField(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        source="responsible",
        queryset=get_user_model().objects.filter(is_active=True, is_staff=True),
    )
    preferred_dates = serializers.ListField(
        child=serializers.DateField(),
        min_length=1,
        max_length=3,
        required=False,
        allow_empty=True,
        write_only=True,
    )
    displayed_preferred_dates = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DesiredDateWaitlistEntry
        fields = (
            "id",
            "customer_id",
            "business_scope",
            "preferred_dates",
            "displayed_preferred_dates",
            "flexible_start",
            "flexible_end",
            "interest_kind",
            "quantity",
            "responsible_id",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def get_displayed_preferred_dates(self, obj) -> list[str]:
        return [
            value.isoformat()
            for value in (obj.preferred_date_1, obj.preferred_date_2, obj.preferred_date_3)
            if value is not None
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["preferred_dates"] = representation.pop("displayed_preferred_dates")
        return representation

    def validate(self, attrs):
        preferred_dates = attrs.pop("preferred_dates", [])
        for index in range(3):
            attrs[f"preferred_date_{index + 1}"] = (
                preferred_dates[index] if index < len(preferred_dates) else None
            )
        candidate = DesiredDateWaitlistEntry(**attrs)
        try:
            candidate.clean()
        except DjangoValidationError as error:
            messages = error.error_dict if hasattr(error, "error_dict") else error.messages
            raise serializers.ValidationError(messages) from error
        return attrs


class CommercialTimelineEventSerializer(serializers.Serializer):
    date = serializers.CharField(read_only=True)
    type = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    metadata = serializers.DictField(read_only=True)
