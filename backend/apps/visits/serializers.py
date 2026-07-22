from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.customers.models import Customer
from apps.visits.models import VisitAppointment


class VisitAppointmentSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
    )
    customer_display_name = serializers.CharField(source="customer.display_name", read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        source="responsible",
        queryset=get_user_model().objects.filter(is_active=True, is_staff=True),
    )
    responsible_username = serializers.CharField(source="responsible.username", read_only=True)

    class Meta:
        model = VisitAppointment
        fields = (
            "id",
            "customer_id",
            "customer_display_name",
            "reason",
            "scheduled_at",
            "responsible_id",
            "responsible_username",
            "location",
            "notes",
            "status",
            "reminder_at",
            "reminder_sent_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "customer_display_name",
            "responsible_username",
            "status",
            "reminder_sent_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        )
