from rest_framework import serializers

from apps.customers.models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id",
            "display_name",
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
