from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .models import FinanceBankProfile
from .serializers import (
    FinanceBankProfileCreateSerializer,
    FinanceBankProfileSerializer,
    FinanceBankProfileUpdateSerializer,
)
from .services import configure_finance_bank_profile, create_finance_bank_profile


class FinanceBankProfileListCreateAPIView(generics.ListAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    serializer_class = FinanceBankProfileSerializer

    def get_queryset(self):
        queryset = FinanceBankProfile.objects.select_related("account").all()
        if scope := self.request.query_params.get("business_scope"):
            queryset = queryset.filter(account__business_scope=scope)
        return queryset

    @extend_schema(
        request=FinanceBankProfileCreateSerializer,
        responses={201: FinanceBankProfileSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = FinanceBankProfileCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = create_finance_bank_profile(actor=request.user, **serializer.validated_data)
        return Response(FinanceBankProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class FinanceBankProfileUpdateAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=FinanceBankProfileUpdateSerializer,
        responses={200: FinanceBankProfileSerializer},
    )
    def patch(self, request, id):
        profile = get_object_or_404(FinanceBankProfile.objects.select_related("account"), id=id)
        serializer = FinanceBankProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = configure_finance_bank_profile(
            profile=profile,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(FinanceBankProfileSerializer(updated).data)
