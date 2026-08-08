from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .models import FinanceBankProfile
from .serializers import (
    FinanceBankProfileCreateSerializer,
    FinanceBankProfileSerializer,
    FinanceBankProfileUpdateSerializer,
)
from .services import (
    configure_finance_bank_profile,
    create_finance_bank_profile,
    create_finance_bank_profile_with_account,
)


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
        data = dict(serializer.validated_data)
        account = data.pop("account", None)
        try:
            if account is not None:
                profile = create_finance_bank_profile(
                    account=account,
                    actor=request.user,
                    **data,
                )
            else:
                profile = create_finance_bank_profile_with_account(
                    actor=request.user,
                    business_scope=data.pop("business_scope"),
                    account_code=data.pop("account_code"),
                    account_label=data.pop("account_label"),
                    **data,
                )
        except (DjangoValidationError, ValueError) as error:
            detail = (
                getattr(error, "message_dict", None)
                or getattr(error, "messages", None)
                or str(error)
            )
            raise serializers.ValidationError(detail) from error
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
        try:
            updated = configure_finance_bank_profile(
                profile=profile,
                actor=request.user,
                **serializer.validated_data,
            )
        except (DjangoValidationError, ValueError) as error:
            detail = (
                getattr(error, "message_dict", None)
                or getattr(error, "messages", None)
                or str(error)
            )
            raise serializers.ValidationError(detail) from error
        return Response(FinanceBankProfileSerializer(updated).data)
