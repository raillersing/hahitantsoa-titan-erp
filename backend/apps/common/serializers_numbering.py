from rest_framework import serializers

from apps.common.sequences import peek_next_public_reference
from apps.documents.models import (
    NumberingSequence,
    NumberingSequenceBrand,
    NumberingSequenceType,
)


class NumberingSequenceSerializer(serializers.ModelSerializer):
    preview_next = serializers.SerializerMethodField()

    class Meta:
        model = NumberingSequence
        fields = (
            "id",
            "brand",
            "sequence_type",
            "year",
            "prefix",
            "next_number",
            "padding",
            "suffix_template",
            "preview_next",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "preview_next", "created_at", "updated_at")

    def get_preview_next(self, obj: NumberingSequence) -> str:
        try:
            return peek_next_public_reference(
                brand=obj.brand,
                sequence_type=obj.sequence_type,
                year=obj.year,
            )
        except Exception:
            return obj.format_reference(obj.next_number)


class NumberingSequenceConfigureSerializer(serializers.Serializer):
    brand = serializers.ChoiceField(choices=NumberingSequenceBrand.choices)
    sequence_type = serializers.ChoiceField(
        choices=NumberingSequenceType.choices,
        required=False,
        default=NumberingSequenceType.PROFORMA,
    )
    year = serializers.IntegerField(min_value=2020, max_value=2100)
    next_number = serializers.IntegerField(min_value=1)
    prefix = serializers.CharField(max_length=16, required=False, allow_blank=True)
    padding = serializers.IntegerField(min_value=1, max_value=8, required=False)
    suffix_template = serializers.CharField(max_length=32, required=False)


class NumberingSequencePreviewSerializer(serializers.Serializer):
    brand = serializers.CharField()
    sequence_type = serializers.CharField(required=False, default=NumberingSequenceType.PROFORMA)
    year = serializers.IntegerField()
    next_reference = serializers.CharField()
    next_number = serializers.IntegerField()
    prefix = serializers.CharField()
