from rest_framework import serializers

from apps.customers.models import Customer, CustomerLifecycleStatus, CustomerPartyType


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
