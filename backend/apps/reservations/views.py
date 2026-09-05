from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess, HasSuperAdminAccess
from apps.inventory.models import InventoryItem
from apps.reservations.amendments import (
    ReservationAmendmentError,
    create_reservation_draft_amendment,
)
from apps.reservations.models import ReservationDraft
from apps.reservations.periods import validate_reservation_period
from apps.reservations.permissions import (
    IsAuthenticatedReservationDraftBoundary,
    IsAuthenticatedReservationReadBoundary,
)
from apps.reservations.serializers import (
    LifecycleSummarySerializer,
    ReservationAvailabilityPreviewRequestSerializer,
    ReservationAvailabilitySummarySerializer,
    ReservationAvailableItemPreviewSerializer,
    ReservationDraftAmendmentCreateSerializer,
    ReservationDraftAmendmentSerializer,
    ReservationDraftSerializer,
    ReservationItemAvailabilityPreviewSerializer,
)


class ReservationDraftAmendmentListCreateAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    http_method_names = ["get", "post", "head", "options"]

    def get(self, request, pk):
        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        return Response(ReservationDraftAmendmentSerializer(draft.amendments.all(), many=True).data)

    @extend_schema(request=ReservationDraftAmendmentCreateSerializer)
    def post(self, request, pk):
        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        serializer = ReservationDraftAmendmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = create_reservation_draft_amendment(
                reservation_draft=draft,
                actor=request.user,
                **serializer.validated_data,
            )
        except ReservationAmendmentError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            ReservationDraftAmendmentSerializer(result.amendment).data,
            status=status.HTTP_201_CREATED,
        )


def validated_period_or_error_response(request):
    request_serializer = ReservationAvailabilityPreviewRequestSerializer(data=request.query_params)
    request_serializer.is_valid(raise_exception=True)

    start_at = request_serializer.validated_data["start_at"]
    end_at = request_serializer.validated_data["end_at"]

    try:
        validate_reservation_period(start_at=start_at, end_at=end_at)
    except ValueError as error:
        return None, Response(
            {"detail": str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return (start_at, end_at), None


class ReservationAvailabilitySummaryAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        start_at, end_at = period
        response_serializer = ReservationAvailabilitySummarySerializer.from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ReservationAvailableItemPreviewsAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        start_at, end_at = period
        response_serializer = ReservationAvailableItemPreviewSerializer.many_from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ReservationItemAvailabilityPreviewAPIView(APIView):
    permission_classes = [IsAuthenticatedReservationReadBoundary]

    def get(self, request, inventory_item_id):
        period, error_response = validated_period_or_error_response(request)
        if error_response is not None:
            return error_response

        inventory_item = InventoryItem.objects.filter(
            id=inventory_item_id,
            is_active=True,
            is_deleted=False,
        ).first()
        if inventory_item is None:
            return Response(
                {"detail": "Inventory item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        start_at, end_at = period
        response_serializer = ReservationItemAvailabilityPreviewSerializer.from_period(
            inventory_item=inventory_item,
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


def active_reservation_drafts():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


class ReservationDraftListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedReservationDraftBoundary]
    serializer_class = ReservationDraftSerializer

    def get_queryset(self):
        qs = active_reservation_drafts()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        customer_id = self.request.query_params.get("customer_id")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        start_after = self.request.query_params.get("start_after")
        if start_after:
            qs = qs.filter(start_at__gte=start_after)
        start_before = self.request.query_params.get("start_before")
        if start_before:
            qs = qs.filter(start_at__lte=start_before)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(public_reference__icontains=search) | Q(customer__display_name__icontains=search)
            )
        return qs


class ReservationDraftRetrieveAPIView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "put", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedReservationDraftBoundary]
    serializer_class = ReservationDraftSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return active_reservation_drafts()


class ReservationDraftConfirmAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.confirmation import (
            ReservationConfirmationPreflightError,
            ReservationLifecycleError,
            ReservationLifecycleStateError,
            confirm_reservation_draft,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)

        try:
            result = confirm_reservation_draft(reservation_draft=draft, actor=request.user)
        except PermissionError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ReservationConfirmationPreflightError as error:
            return Response(
                {
                    "detail": str(error),
                    "code": error.code,
                    "blockers": error.blockers,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except (ReservationLifecycleStateError, ReservationLifecycleError) as error:
            return Response(
                {
                    "detail": str(error),
                    "code": getattr(error, "code", None),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        confirmed_draft = result.reservation_draft
        payload = {
            "status": "confirmed",
            "public_reference": confirmed_draft.public_reference,
            "blocked_item_count": result.blocked_item_count,
            "reservation_draft": ReservationDraftSerializer(confirmed_draft).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftCancelAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.confirmation import (
            ReservationLifecycleError,
            ReservationLifecycleStateError,
            cancel_confirmed_reservation_draft,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)

        try:
            result = cancel_confirmed_reservation_draft(reservation_draft=draft, actor=request.user)
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except (ReservationLifecycleStateError, ReservationLifecycleError) as error:
            return Response(
                {"detail": str(error), "code": getattr(error, "code", None)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cancelled_draft = result.reservation_draft
        payload = {
            "status": "cancelled",
            "public_reference": cancelled_draft.public_reference,
            "released_block_count": result.released_block_count,
            "reservation_draft": ReservationDraftSerializer(cancelled_draft).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftSoftDeleteAPIView(APIView):
    permission_classes = [HasSuperAdminAccess]
    http_method_names = ["post", "head", "options"]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.confirmation import (
            ReservationLifecycleStateError,
            soft_delete_reservation_draft,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        try:
            deleted_draft = soft_delete_reservation_draft(
                reservation_draft=draft,
                actor=request.user,
            )
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except ReservationLifecycleStateError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": "deleted",
                "public_reference": deleted_draft.public_reference,
            },
            status=status.HTTP_200_OK,
        )


class ReservationDraftMarkContractSignedAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.confirmation import (
            ReservationLifecycleError,
            ReservationLifecycleStateError,
            mark_reservation_draft_contract_signed,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)

        try:
            marked_draft = mark_reservation_draft_contract_signed(
                reservation_draft=draft,
                actor=request.user,
            )
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except (ReservationLifecycleStateError, ReservationLifecycleError) as error:
            return Response(
                {"detail": str(error), "code": getattr(error, "code", None)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = {
            "status": marked_draft.status,
            "public_reference": marked_draft.public_reference,
            "reservation_draft": ReservationDraftSerializer(marked_draft).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftMarkRequiredDepositReceivedAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.confirmation import (
            ReservationLifecycleError,
            ReservationLifecycleStateError,
            mark_reservation_draft_required_deposit_received,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)

        try:
            marked_draft = mark_reservation_draft_required_deposit_received(
                reservation_draft=draft,
                actor=request.user,
                auto_confirm=True,
            )
        except PermissionError as error:
            return Response({"detail": str(error)}, status=status.HTTP_403_FORBIDDEN)
        except (ReservationLifecycleStateError, ReservationLifecycleError) as error:
            return Response(
                {"detail": str(error), "code": getattr(error, "code", None)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = {
            "status": marked_draft.status,
            "public_reference": marked_draft.public_reference,
            "reservation_draft": ReservationDraftSerializer(marked_draft).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftCloseoutSummaryAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.closeout import get_closeout_summary

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        summary = get_closeout_summary(reservation_draft_id=str(draft.id))

        if summary is None:
            return Response(
                {"detail": "Reservation draft not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        import dataclasses

        payload = dataclasses.asdict(summary)
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftLifecycleAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses=LifecycleSummarySerializer)
    def get(self, request, pk):
        from dataclasses import asdict

        from apps.reservations.lifecycle import get_reservation_lifecycle_summary

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        return Response(
            LifecycleSummarySerializer(
                asdict(get_reservation_lifecycle_summary(reservation_draft=draft))
            ).data
        )


class ReservationDraftCloseoutExecuteAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Closeout executed successfully."),
            400: OpenApiResponse(description="Reservation draft is not ready for closeout."),
            404: OpenApiResponse(description="Reservation draft not found."),
        },
    )
    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        from apps.reservations.closeout import (
            CloseoutValidationError,
            closeout_reservation_draft,
        )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)

        try:
            summary = closeout_reservation_draft(
                reservation_draft=draft,
                actor=request.user,
                idempotency_key=request.headers.get("Idempotency-Key", ""),
            )
        except CloseoutValidationError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=(
                    status.HTTP_409_CONFLICT
                    if error.code == "closeout_idempotency_key_mismatch"
                    else status.HTTP_400_BAD_REQUEST
                ),
            )

        import dataclasses

        payload = dataclasses.asdict(summary)
        return Response(payload, status=status.HTTP_200_OK)


class ReservationDraftDocumentPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedReservationDraftBoundary]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="template_key",
                type=str,
                location=OpenApiParameter.QUERY,
                required=True,
            )
        ],
        responses={200: str, 400: serializers.Serializer},
    )
    def get(self, request, pk):
        template_key = request.query_params.get("template_key", "")
        from apps.documents.runtime import (
            TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS,
            DocumentRuntimeGenerationError,
            preview_reservation_draft_document_html,
        )

        if template_key not in TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS:
            return Response(
                {
                    "detail": "template_key is not available for Titan draft preview.",
                    "code": "titan_document_preview_template_not_supported",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        draft = get_object_or_404(active_reservation_drafts(), pk=pk)
        try:
            html_content = preview_reservation_draft_document_html(
                reservation_draft=draft,
                template_key=template_key,
            )
        except DocumentRuntimeGenerationError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return HttpResponse(html_content, content_type="text/html; charset=utf-8")
