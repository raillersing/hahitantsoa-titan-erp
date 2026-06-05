from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from apps.reservations.services import ReservationAvailabilitySummary


class ReservationAvailabilitySummaryQuerySerializer(serializers.Serializer):
    start_at = serializers.DateTimeField(required=True)
    end_at = serializers.DateTimeField(required=True)

    def validate(self, attrs):
        self._validate_raw_timezone("start_at")
        self._validate_raw_timezone("end_at")

        for field_name in ("start_at", "end_at"):
            value = attrs[field_name]
            if not timezone.is_aware(value):
                raise serializers.ValidationError(
                    {field_name: "Reservation period datetime must be timezone-aware."}
                )

        return attrs

    def _validate_raw_timezone(self, field_name: str) -> None:
        raw_value = self.initial_data.get(field_name)
        if not isinstance(raw_value, str):
            return

        parsed_value = parse_datetime(raw_value)
        if parsed_value is not None and timezone.is_naive(parsed_value):
            raise serializers.ValidationError(
                {field_name: "Reservation period datetime must be timezone-aware."}
            )


class ReservationAvailabilitySummarySerializer(serializers.Serializer):
    start_at = serializers.DateTimeField(source="period.start_at")
    end_at = serializers.DateTimeField(source="period.end_at")
    available_item_count = serializers.IntegerField()
    available_preview_count = serializers.IntegerField()
    available_item_kinds = serializers.ListField(child=serializers.CharField())

    def to_representation(self, instance: ReservationAvailabilitySummary):
        data = super().to_representation(instance)
        data["available_item_kinds"] = list(instance.available_item_kinds)
        return data
