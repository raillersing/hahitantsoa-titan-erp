from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_id = serializers.ReadOnlyField()

    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "actor_id",
            "action",
            "target_type",
            "target_id",
            "metadata",
            "created_at",
        )
        read_only_fields = fields
