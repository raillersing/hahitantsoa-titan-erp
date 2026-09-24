from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.identity.permissions import HasManagementOrFinanceAccess

from .models import PurchaseOrder, QuickExpense
from .serializers import (
    PurchaseOrderCreateSerializer,
    PurchaseOrderSerializer,
    QuickExpenseCreateSerializer,
    QuickExpenseSerializer,
)
from .services import (
    create_purchase_order,
    create_quick_expense,
    delete_purchase_order,
    delete_quick_expense,
    update_purchase_order,
)


class PurchaseOrderListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PurchaseOrder.objects.all()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasManagementOrFinanceAccess()]
        return super().get_permissions()

    @extend_schema(
        request=PurchaseOrderCreateSerializer,
        responses={
            201: PurchaseOrderSerializer,
            400: OpenApiResponse(description="Invalid payload."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = PurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = create_purchase_order(
            actor=request.user,
            validated_data=serializer.validated_data,
        )
        return Response(
            PurchaseOrderSerializer(purchase_order).data, status=status.HTTP_201_CREATED
        )


class PurchaseOrderRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return PurchaseOrder.objects.all()

    def get_permissions(self):
        if self.request.method.lower() in {"patch", "put", "delete"}:
            return [HasManagementOrFinanceAccess()]
        return super().get_permissions()

    def perform_update(self, serializer):
        update_purchase_order(
            actor=self.request.user,
            instance=self.get_object(),
            validated_data=serializer.validated_data,
        )

    def perform_destroy(self, instance):
        delete_purchase_order(
            actor=self.request.user,
            instance=instance,
        )


class QuickExpenseListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = QuickExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = QuickExpense.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasManagementOrFinanceAccess()]
        return super().get_permissions()

    @extend_schema(
        request=QuickExpenseCreateSerializer,
        responses={
            201: QuickExpenseSerializer,
            400: OpenApiResponse(description="Invalid payload."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = QuickExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_quick_expense(
            actor=request.user,
            validated_data=serializer.validated_data,
        )
        return Response(QuickExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class QuickExpenseRetrieveDestroyAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = QuickExpenseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return QuickExpense.objects.all()

    def get_permissions(self):
        if self.request.method.lower() == "delete":
            return [HasManagementOrFinanceAccess()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        delete_quick_expense(
            actor=self.request.user,
            instance=instance,
        )
