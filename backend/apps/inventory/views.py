from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import InventoryItem
from apps.inventory.serializers import (
    InventoryItemSerializer,
    InventoryStockMovementCreateSerializer,
    InventoryStockMovementSerializer,
)
from apps.inventory.services import (
    InventoryStockMovementError,
    active_inventory_stock_movements,
    create_inventory_stock_movement,
)


def active_inventory_items():
    return InventoryItem.objects.filter(is_active=True, is_deleted=False).order_by("name")


class InventoryItemListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryItemSerializer

    def get_queryset(self):
        return active_inventory_items()


class InventoryItemRetrieveAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryItemSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return active_inventory_items()


class InventoryStockMovementListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return InventoryStockMovementCreateSerializer
        return InventoryStockMovementSerializer

    def get_queryset(self):
        return active_inventory_stock_movements()

    @extend_schema(
        request=InventoryStockMovementCreateSerializer,
        responses={
            201: InventoryStockMovementSerializer,
            400: OpenApiResponse(description="Stock movement validation failed."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            movement = create_inventory_stock_movement(
                actor=request.user,
                **serializer.validated_data,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryStockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryStockMovementRetrieveAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        movement = active_inventory_stock_movements().filter(id=id).first()
        if movement is None:
            raise Http404("Inventory stock movement not found.")

        return Response(InventoryStockMovementSerializer(movement).data)
