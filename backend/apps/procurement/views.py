from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import PurchaseOrder, QuickExpense
from .serializers import (
    PurchaseOrderCreateSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderUpdateSerializer,
    QuickExpenseCreateSerializer,
    QuickExpenseSerializer,
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

    @extend_schema(
        request=PurchaseOrderCreateSerializer,
        responses={201: PurchaseOrderSerializer, 400: OpenApiResponse(description="Invalid payload.")},
    )
    def post(self, request, *args, **kwargs):
        serializer = PurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = PurchaseOrder.objects.create(
            **serializer.validated_data,
            created_by=request.user,
            updated_by=request.user,
        )
        return Response(PurchaseOrderSerializer(purchase_order).data, status=status.HTTP_201_CREATED)


class PurchaseOrderRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return PurchaseOrder.objects.all()


class QuickExpenseListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = QuickExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = QuickExpense.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    @extend_schema(
        request=QuickExpenseCreateSerializer,
        responses={201: QuickExpenseSerializer, 400: OpenApiResponse(description="Invalid payload.")},
    )
    def post(self, request, *args, **kwargs):
        serializer = QuickExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = QuickExpense.objects.create(
            **serializer.validated_data,
            recorded_by=request.user,
        )
        return Response(QuickExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class QuickExpenseRetrieveDestroyAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = QuickExpenseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return QuickExpense.objects.all()
