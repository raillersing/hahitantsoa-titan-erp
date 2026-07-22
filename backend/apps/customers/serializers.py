from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.customers.models import (
    Customer,
    CustomerLifecycleStatus,
    CustomerPartyType,
    DesiredDateWaitlistEntry,
)


class CustomerSerializer(serializers.ModelSerializer):
    lifecycle_status = serializers.ChoiceField(
        choices=CustomerLifecycleStatus.choices,
        required=False,
    )
    party_type = serializers.ChoiceField(
        choices=CustomerPartyType.choices,
        required=False,
    )
    reservation_count = serializers.SerializerMethodField()
    event_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()

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
            "display_name",
            "lifecycle_status",
            "party_type",
            "email",
            "phone",
            "address",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
            "reservation_count",
            "event_count",
            "document_count",
            "last_activity_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
        )


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
