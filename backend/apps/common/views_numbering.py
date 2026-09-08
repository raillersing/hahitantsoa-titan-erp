from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.models import NumberingSequence
from apps.common.sequences import (
    configure_numbering_sequence,
    get_or_create_numbering_sequence,
    peek_next_public_reference,
)
from apps.common.serializers_numbering import (
    NumberingSequenceConfigureSerializer,
    NumberingSequencePreviewSerializer,
    NumberingSequenceSerializer,
)
from apps.identity.permissions import HasReservationSensitiveAccess


class NumberingSequenceListConfigureAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    http_method_names = ["get", "post", "head", "options"]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="brand", type=str, required=False),
            OpenApiParameter(name="year", type=int, required=False),
        ],
        responses={200: NumberingSequenceSerializer(many=True)},
    )
    def get(self, request):
        brand = request.query_params.get("brand")
        year = request.query_params.get("year")
        current_year = int(year) if year and year.isdigit() else timezone.now().year

        # Ensure defaults exist for current year
        for b in ["titan", "hahitantsoa"]:
            get_or_create_numbering_sequence(brand=b, year=current_year)

        qs = NumberingSequence.objects.all()
        if brand:
            qs = qs.filter(brand=brand.lower().strip())
        if year and year.isdigit():
            qs = qs.filter(year=int(year))

        return Response(NumberingSequenceSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    @extend_schema(
        request=NumberingSequenceConfigureSerializer,
        responses={200: NumberingSequenceSerializer},
    )
    def post(self, request):
        serializer = NumberingSequenceConfigureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        seq = configure_numbering_sequence(
            brand=data["brand"],
            year=data["year"],
            next_number=data["next_number"],
            prefix=data.get("prefix"),
            padding=data.get("padding"),
            suffix_template=data.get("suffix_template"),
            actor=request.user,
        )

        return Response(NumberingSequenceSerializer(seq).data, status=status.HTTP_200_OK)


class NumberingSequencePreviewNextAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    http_method_names = ["get", "head", "options"]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="brand", type=str, required=True),
            OpenApiParameter(name="year", type=int, required=False),
        ],
        responses={200: NumberingSequencePreviewSerializer},
    )
    def get(self, request):
        brand = request.query_params.get("brand", "titan").lower().strip()
        year_param = request.query_params.get("year")
        year = int(year_param) if year_param and year_param.isdigit() else timezone.now().year

        seq = get_or_create_numbering_sequence(brand=brand, year=year)
        next_ref = peek_next_public_reference(brand=brand, year=year)

        payload = {
            "brand": seq.brand,
            "year": seq.year,
            "next_reference": next_ref,
            "next_number": seq.next_number,
            "prefix": seq.prefix,
        }
        return Response(NumberingSequencePreviewSerializer(payload).data, status=status.HTTP_200_OK)
