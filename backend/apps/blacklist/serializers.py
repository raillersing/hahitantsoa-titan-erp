from rest_framework import serializers

from apps.blacklist.models import BlacklistedIntervenant


class BlacklistedIntervenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlacklistedIntervenant
        fields = [
            "id",
            "name",
            "note",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
