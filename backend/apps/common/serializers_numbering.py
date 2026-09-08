from rest_framework import serializers

from apps.common.sequences import peek_next_public_reference
from apps.documents.models import NumberingSequence, NumberingSequenceBrand


class NumberingSequenceSerializer(serializers.ModelSerializer):
    preview_next = serializers.SerializerMethodField()

    class Meta:
        model = NumberingSequence
        fields = (
            "id",
            "brand",
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
            return peek_next_public_reference(brand=obj.brand, year=obj.year)
        except Exception:
            return obj.format_reference(obj.next_number)


class NumberingSequenceConfigureSerializer(serializers.Serializer):
    brand = serializers.ChoiceField(choices=NumberingSequenceBrand.choices)
    year = serializers.IntegerField(min_value=2020, max_value=2100)
    next_number = serializers.IntegerField(min_value=1)
    prefix = serializers.CharField(max_length=16, required=False, allow_blank=True)
    padding = serializers.IntegerField(min_value=1, max_value=8, required=False)
    suffix_template = serializers.CharField(max_length=32, required=False)


class NumberingSequencePreviewSerializer(serializers.Serializer):
    brand = serializers.CharField()
    year = serializers.IntegerField()
    next_reference = serializers.CharField()
    next_number = serializers.IntegerField()
    prefix = serializers.CharField()
