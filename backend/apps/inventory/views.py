from django.core.exceptions import ValidationError
from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.serializers import DocumentInstanceSerializer
from apps.inventory.models import (
    InventoryDamageLossExcessReceivable,
    InventoryItem,
)
from apps.inventory.serializers import (
    InventoryDamageLossSettlementCreateSerializer,
    InventoryDamageLossSettlementExecutionCreateSerializer,
    InventoryDamageLossSettlementExecutionSerializer,
    InventoryDamageLossSettlementSerializer,
    InventoryItemSerializer,
    InventoryReturnOperationCreateSerializer,
    InventoryReturnOperationSerializer,
    InventoryStockMovementCreateSerializer,
    InventoryStockMovementSerializer,
)
from apps.inventory.services import (
    InventoryStockMovementError,
    active_inventory_damage_loss_settlement_executions,
    active_inventory_damage_loss_settlements,
    active_inventory_return_operations,
    active_inventory_stock_movements,
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    create_inventory_stock_movement,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)


def active_inventory_items():
    return InventoryItem.objects.filter(is_active=True, is_deleted=False).order_by("name")


class InventoryItemListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryItemSerializer

    def get_queryset(self):
        qs = active_inventory_items()
        name_param = self.request.query_params.get("name")
        if name_param:
            qs = qs.filter(name__icontains=name_param)
        kind_param = self.request.query_params.get("kind")
        if kind_param:
            qs = qs.filter(kind=kind_param)
        description_param = self.request.query_params.get("description")
        if description_param:
            qs = qs.filter(description__icontains=description_param)
        return qs


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
        qs = active_inventory_stock_movements()
        movement_type = self.request.query_params.get("movement_type")
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        direction = self.request.query_params.get("direction")
        if direction:
            qs = qs.filter(direction=direction)
        inventory_item = self.request.query_params.get("inventory_item")
        if inventory_item:
            qs = qs.filter(inventory_item=inventory_item)
        reservation_draft = self.request.query_params.get("reservation_draft")
        if reservation_draft:
            qs = qs.filter(reservation_draft=reservation_draft)
        return_operation = self.request.query_params.get("return_operation")
        if return_operation:
            qs = qs.filter(return_operation=return_operation)
        return qs

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


class InventoryReturnOperationListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return InventoryReturnOperationCreateSerializer
        return InventoryReturnOperationSerializer

    def get_queryset(self):
        qs = active_inventory_return_operations()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        reservation_draft = self.request.query_params.get("reservation_draft")
        if reservation_draft:
            qs = qs.filter(reservation_draft=reservation_draft)
        return qs

    @extend_schema(
        request=InventoryReturnOperationCreateSerializer,
        responses={
            201: InventoryReturnOperationSerializer,
            400: OpenApiResponse(description="Return operation validation failed."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return_operation = create_inventory_return_operation(
                actor=request.user,
                **serializer.validated_data,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryReturnOperationSerializer(return_operation).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryReturnOperationRetrieveAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        return_operation = active_inventory_return_operations().filter(id=id).first()
        if return_operation is None:
            raise Http404("Inventory return operation not found.")

        return Response(InventoryReturnOperationSerializer(return_operation).data)


class InventoryReturnOperationValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: InventoryReturnOperationSerializer,
            400: OpenApiResponse(description="Return operation validation failed."),
        },
    )
    def post(self, request, id):
        return_operation = active_inventory_return_operations().filter(id=id).first()
        if return_operation is None:
            raise Http404("Inventory return operation not found.")

        try:
            result = validate_inventory_return_operation(
                return_operation=return_operation,
                actor=request.user,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryReturnOperationSerializer(result.return_operation).data,
            status=status.HTTP_200_OK,
        )


class InventoryDamageLossSettlementListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return InventoryDamageLossSettlementCreateSerializer
        return InventoryDamageLossSettlementSerializer

    def get_queryset(self):
        return active_inventory_damage_loss_settlements()

    @extend_schema(
        request=InventoryDamageLossSettlementCreateSerializer,
        responses={
            201: InventoryDamageLossSettlementSerializer,
            400: OpenApiResponse(description="Damage/loss settlement validation failed."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            settlement = create_inventory_damage_loss_settlement(
                actor=request.user,
                **serializer.validated_data,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryDamageLossSettlementSerializer(settlement).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryDamageLossSettlementRetrieveAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        settlement = active_inventory_damage_loss_settlements().filter(id=id).first()
        if settlement is None:
            raise Http404("Inventory damage/loss settlement not found.")

        return Response(InventoryDamageLossSettlementSerializer(settlement).data)


class InventoryDamageLossSettlementValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: InventoryDamageLossSettlementSerializer,
            400: OpenApiResponse(description="Damage/loss settlement validation failed."),
        },
    )
    def post(self, request, id):
        settlement = active_inventory_damage_loss_settlements().filter(id=id).first()
        if settlement is None:
            raise Http404("Inventory damage/loss settlement not found.")

        try:
            result = validate_inventory_damage_loss_settlement(
                settlement=settlement,
                actor=request.user,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryDamageLossSettlementSerializer(result.settlement).data,
            status=status.HTTP_200_OK,
        )


class InventoryDamageLossSettlementExecutionListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return InventoryDamageLossSettlementExecutionCreateSerializer
        return InventoryDamageLossSettlementExecutionSerializer

    def get_queryset(self):
        return active_inventory_damage_loss_settlement_executions()

    @extend_schema(
        request=InventoryDamageLossSettlementExecutionCreateSerializer,
        responses={
            201: InventoryDamageLossSettlementExecutionSerializer,
            400: OpenApiResponse(description="Damage/loss settlement execution validation failed."),
        },
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            execution = create_inventory_damage_loss_settlement_execution(
                actor=request.user,
                **serializer.validated_data,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryDamageLossSettlementExecutionSerializer(execution).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryDamageLossSettlementExecutionRetrieveAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        execution = active_inventory_damage_loss_settlement_executions().filter(id=id).first()
        if execution is None:
            raise Http404("Inventory damage/loss settlement execution not found.")

        return Response(InventoryDamageLossSettlementExecutionSerializer(execution).data)


class InventoryDamageLossSettlementExecutionExecuteAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: InventoryDamageLossSettlementExecutionSerializer,
            400: OpenApiResponse(description="Damage/loss settlement execution failed."),
        },
    )
    def post(self, request, id):
        execution = active_inventory_damage_loss_settlement_executions().filter(id=id).first()
        if execution is None:
            raise Http404("Inventory damage/loss settlement execution not found.")

        try:
            result = execute_inventory_damage_loss_settlement_execution(
                execution=execution,
                actor=request.user,
            )
        except InventoryStockMovementError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            InventoryDamageLossSettlementExecutionSerializer(result.execution).data,
            status=status.HTTP_200_OK,
        )


class InventoryExcessReceivableGenerateInvoiceAPIView(APIView):
    http_method_names = ["post"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(
                response=DocumentInstanceSerializer,
                description="Excess receivable invoice document generated successfully.",
            ),
            400: OpenApiResponse(description="Invalid excess receivable state or missing data."),
            404: OpenApiResponse(description="Excess receivable not found."),
            500: OpenApiResponse(description="Internal server error during invoice generation."),
        },
    )
    def post(self, request, id):
        from apps.billing.services import (
            BillingLifecycleError,
            issue_billing_invoice_for_excess_receivable,
        )

        try:
            excess_receivable = InventoryDamageLossExcessReceivable.objects.get(id=id)
        except InventoryDamageLossExcessReceivable.DoesNotExist:
            raise Http404("Excess receivable not found.")

        try:
            invoice = issue_billing_invoice_for_excess_receivable(
                excess_receivable=excess_receivable,
                actor=request.user,
            )
            document_instance = invoice.document_instance
        except BillingLifecycleError as e:
            return Response(
                {"detail": str(e), "code": e.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValidationError as e:
            return Response(
                {"detail": str(e), "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"detail": str(e), "code": "internal_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DocumentInstanceSerializer(document_instance)
        return Response(serializer.data, status=status.HTTP_200_OK)
