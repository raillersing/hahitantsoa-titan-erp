from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import DocumentInstance
from apps.documents.runtime import DocumentRuntimeGenerationError
from apps.documents.selectors import list_document_instances_for_hahitantsoa_event_draft
from apps.documents.services import (
    create_document_instance_from_hahitantsoa_event_draft,
    generate_hahitantsoa_event_draft_document_instance_html,
    get_hahitantsoa_event_draft_document_instance_or_404,
)
from apps.hahitantsoa.models import (
    HahitantsoaEventDraft,
    HahitantsoaEventDraftAmendmentRequest,
    HahitantsoaEventDraftAmendmentRequestLine,
    HahitantsoaEventDraftLine,
    HahitantsoaService,
    HahitantsoaVenue,
)
from apps.hahitantsoa.permissions import IsAuthenticatedHahitantsoaEventDraftBoundary
from apps.hahitantsoa.selectors import list_hahitantsoa_discovery_items
from apps.hahitantsoa.serializers import (
    HahitantsoaDiscoveryItemSerializer,
    HahitantsoaEventDraftAmendmentPreflightSerializer,
    HahitantsoaEventDraftAmendmentRequestAvailabilityPreviewSerializer,
    HahitantsoaEventDraftAmendmentRequestCreateSerializer,
    HahitantsoaEventDraftAmendmentRequestLineCreateSerializer,
    HahitantsoaEventDraftAmendmentRequestLineSerializer,
    HahitantsoaEventDraftAmendmentRequestLineUpdateSerializer,
    HahitantsoaEventDraftAmendmentRequestResultSerializer,
    HahitantsoaEventDraftAmendmentRequestSerializer,
    HahitantsoaEventDraftAmendmentRequestUpdateSerializer,
    HahitantsoaEventDraftAvailabilityPreviewSerializer,
    HahitantsoaEventDraftConfirmationPreflightSerializer,
    HahitantsoaEventDraftConfirmationResultSerializer,
    HahitantsoaEventDraftDocumentInstanceCreateSerializer,
    HahitantsoaEventDraftDocumentInstanceGenerateSerializer,
    HahitantsoaEventDraftDocumentInstanceSerializer,
    HahitantsoaEventDraftSerializer,
    HahitantsoaSharedAvailabilityResponseSerializer,
    ReservationAvailabilityPreviewRequestSerializer,
)
from apps.hahitantsoa.services import (
    assert_hahitantsoa_event_draft_mutable,
    confirm_hahitantsoa_event_draft,
)
from apps.reservations.confirmation import (
    ReservationConfirmationPreflightError,
    ReservationLifecycleError,
    ReservationLifecycleStateError,
)
from apps.reservations.periods import validate_reservation_period


class HahitantsoaDiscoveryItemsAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="HahitantsoaDiscoveryItemsResponse",
            fields={
                "items": HahitantsoaDiscoveryItemSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        items = list_hahitantsoa_discovery_items()
        serialized_items = HahitantsoaDiscoveryItemSerializer(items, many=True).data

        return Response(
            {
                "items": serialized_items,
                "count": len(serialized_items),
            }
        )


class HahitantsoaSharedAvailabilityAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="HahitantsoaSharedAvailabilityResponse",
            fields={
                "items": HahitantsoaSharedAvailabilityResponseSerializer().fields["items"],
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        request_serializer = ReservationAvailabilityPreviewRequestSerializer(
            data=request.query_params
        )
        request_serializer.is_valid(raise_exception=True)

        start_at = request_serializer.validated_data["start_at"]
        end_at = request_serializer.validated_data["end_at"]

        try:
            validate_reservation_period(start_at=start_at, end_at=end_at)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        response_serializer = HahitantsoaSharedAvailabilityResponseSerializer.from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


def active_hahitantsoa_event_drafts():
    return (
        HahitantsoaEventDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=HahitantsoaEventDraftLine.objects.filter(is_deleted=False).select_related(
                    "inventory_item"
                ),
            )
        )
        .order_by("-created_at", "public_reference")
    )


def visible_hahitantsoa_event_drafts(*, user):
    return active_hahitantsoa_event_drafts().filter(created_by=user)


class HahitantsoaEventDraftListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    serializer_class = HahitantsoaEventDraftSerializer

    def get_queryset(self):
        qs = visible_hahitantsoa_event_drafts(user=self.request.user)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        customer = self.request.query_params.get("customer")
        if customer:
            qs = qs.filter(customer=customer)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class HahitantsoaEventDraftAvailabilityPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftAvailabilityPreviewSerializer)
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        response_serializer = HahitantsoaEventDraftAvailabilityPreviewSerializer.from_event_draft(
            event_draft=event_draft
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftConfirmationPreflightAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftConfirmationPreflightSerializer)
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        response_serializer = HahitantsoaEventDraftConfirmationPreflightSerializer.from_event_draft(
            event_draft=event_draft
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftAmendmentPreflightAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftAmendmentPreflightSerializer)
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        response_serializer = HahitantsoaEventDraftAmendmentPreflightSerializer.from_event_draft(
            event_draft=event_draft
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftAmendmentRequestListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    def _get_event_draft(self):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(
            visible_hahitantsoa_event_drafts(user=self.request.user),
            pk=self.kwargs["event_draft_pk"],
        )

    def get_queryset(self):
        event_draft = self._get_event_draft()
        return (
            HahitantsoaEventDraftAmendmentRequest.objects.filter(event_draft=event_draft)
            .select_related("event_draft")
            .prefetch_related("lines__inventory_item")
            .order_by("created_at", "id")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HahitantsoaEventDraftAmendmentRequestCreateSerializer
        return HahitantsoaEventDraftAmendmentRequestSerializer

    @extend_schema(
        responses={
            200: HahitantsoaEventDraftAmendmentRequestSerializer(many=True),
            201: HahitantsoaEventDraftAmendmentRequestResultSerializer,
        }
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=HahitantsoaEventDraftAmendmentRequestCreateSerializer,
        responses={201: HahitantsoaEventDraftAmendmentRequestResultSerializer},
    )
    def post(self, request, *args, **kwargs):
        event_draft = self._get_event_draft()
        serializer = self.get_serializer(
            data=request.data,
            context={
                "event_draft": event_draft,
                "actor": request.user,
            },
        )
        serializer.is_valid(raise_exception=True)

        try:
            amendment_request = serializer.save()
        except PermissionError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ReservationLifecycleStateError as error:
            return Response(
                {
                    "detail": str(error),
                    "code": getattr(error, "code", None),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = serializer.context["result"]
        payload = HahitantsoaEventDraftAmendmentRequestResultSerializer.from_result(result)
        headers = self.get_success_headers(
            HahitantsoaEventDraftAmendmentRequestSerializer(amendment_request).data
        )
        return Response(payload.data, status=status.HTTP_201_CREATED, headers=headers)


class HahitantsoaEventDraftAmendmentRequestRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "put", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return HahitantsoaEventDraftAmendmentRequestUpdateSerializer
        return HahitantsoaEventDraftAmendmentRequestSerializer

    def get_queryset(self):
        return (
            HahitantsoaEventDraftAmendmentRequest.objects.filter(
                event_draft__in=visible_hahitantsoa_event_drafts(user=self.request.user),
                event_draft_id=self.kwargs["event_draft_pk"],
            )
            .select_related("event_draft")
            .prefetch_related("lines__inventory_item")
            .order_by("created_at", "id")
        )

    @extend_schema(
        request=HahitantsoaEventDraftAmendmentRequestUpdateSerializer,
        responses={200: HahitantsoaEventDraftAmendmentRequestSerializer},
    )
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        payload = HahitantsoaEventDraftAmendmentRequestSerializer(serializer.instance)
        return Response(payload.data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class HahitantsoaEventDraftAmendmentRequestLineListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    def _get_amendment_request(self):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(
            HahitantsoaEventDraftAmendmentRequest.objects.filter(
                event_draft__in=visible_hahitantsoa_event_drafts(user=self.request.user),
                event_draft_id=self.kwargs["event_draft_pk"],
            ),
            pk=self.kwargs["amendment_request_pk"],
        )

    def get_queryset(self):
        amendment_request = self._get_amendment_request()
        return (
            HahitantsoaEventDraftAmendmentRequestLine.objects.filter(
                amendment_request=amendment_request,
                is_deleted=False,
            )
            .select_related("inventory_item", "amendment_request")
            .order_by("created_at", "id")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HahitantsoaEventDraftAmendmentRequestLineCreateSerializer
        return HahitantsoaEventDraftAmendmentRequestLineSerializer

    @extend_schema(
        responses={
            200: HahitantsoaEventDraftAmendmentRequestLineSerializer(many=True),
            201: HahitantsoaEventDraftAmendmentRequestLineSerializer,
        }
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=HahitantsoaEventDraftAmendmentRequestLineCreateSerializer,
        responses={201: HahitantsoaEventDraftAmendmentRequestLineSerializer},
    )
    def post(self, request, *args, **kwargs):
        amendment_request = self._get_amendment_request()
        serializer = self.get_serializer(
            data=request.data,
            context={
                "amendment_request": amendment_request,
                "actor": request.user,
            },
        )
        serializer.is_valid(raise_exception=True)
        line = serializer.save()
        payload = HahitantsoaEventDraftAmendmentRequestLineSerializer(line)
        return Response(payload.data, status=status.HTTP_201_CREATED)


class HahitantsoaEventDraftAmendmentRequestAvailabilityPreflightAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftAmendmentRequestAvailabilityPreviewSerializer)
    def get(self, request, event_draft_pk, amendment_request_pk):
        from django.shortcuts import get_object_or_404

        amendment_request = get_object_or_404(
            HahitantsoaEventDraftAmendmentRequest.objects.filter(
                event_draft__in=visible_hahitantsoa_event_drafts(user=request.user),
                event_draft_id=event_draft_pk,
            ).select_related("event_draft"),
            pk=amendment_request_pk,
        )
        serializer_class = HahitantsoaEventDraftAmendmentRequestAvailabilityPreviewSerializer
        response_serializer = serializer_class.from_amendment_request(
            amendment_request=amendment_request
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftAmendmentRequestLineRetrieveUpdateDestroyAPIView(
    generics.RetrieveUpdateDestroyAPIView
):
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    lookup_field = "pk"

    def get_queryset(self):
        return (
            HahitantsoaEventDraftAmendmentRequestLine.objects.filter(
                amendment_request__event_draft__in=visible_hahitantsoa_event_drafts(
                    user=self.request.user
                ),
                amendment_request__event_draft_id=self.kwargs["event_draft_pk"],
                amendment_request_id=self.kwargs["amendment_request_pk"],
                is_deleted=False,
            )
            .select_related("inventory_item", "amendment_request")
            .order_by("created_at", "id")
        )

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return HahitantsoaEventDraftAmendmentRequestLineUpdateSerializer
        return HahitantsoaEventDraftAmendmentRequestLineSerializer

    @extend_schema(
        request=HahitantsoaEventDraftAmendmentRequestLineUpdateSerializer,
        responses={200: HahitantsoaEventDraftAmendmentRequestLineSerializer},
    )
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        payload = HahitantsoaEventDraftAmendmentRequestLineSerializer(serializer.instance)
        return Response(payload.data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])


class HahitantsoaEventDraftConfirmAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(responses=HahitantsoaEventDraftConfirmationResultSerializer)
    def post(self, request, pk):
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)

        try:
            result = confirm_hahitantsoa_event_draft(event_draft=event_draft, actor=request.user)
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

        payload = HahitantsoaEventDraftConfirmationResultSerializer.from_result(result)
        return Response(payload.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftDocumentInstanceListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return HahitantsoaEventDraftDocumentInstanceCreateSerializer
        return HahitantsoaEventDraftDocumentInstanceSerializer

    def get_event_draft(self) -> HahitantsoaEventDraft:
        from django.shortcuts import get_object_or_404

        return get_object_or_404(
            visible_hahitantsoa_event_drafts(user=self.request.user),
            pk=self.kwargs["pk"],
        )

    def get_queryset(self):
        return list_document_instances_for_hahitantsoa_event_draft(
            hahitantsoa_event_draft=self.get_event_draft()
        )

    @extend_schema(
        responses=HahitantsoaEventDraftDocumentInstanceSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=HahitantsoaEventDraftDocumentInstanceCreateSerializer,
        responses={201: HahitantsoaEventDraftDocumentInstanceSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = create_document_instance_from_hahitantsoa_event_draft(
            event_draft=self.get_event_draft(),
            template_key=serializer.validated_data["template_key"],
            actor=request.user,
            notes=serializer.validated_data.get("notes", ""),
            proforma_validity_days=serializer.validated_data.get("proforma_validity_days"),
        )
        return Response(
            HahitantsoaEventDraftDocumentInstanceSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )


class HahitantsoaEventDraftDocumentInstanceRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    serializer_class = HahitantsoaEventDraftDocumentInstanceSerializer
    lookup_field = "id"

    def get_object(self):
        from django.http import Http404
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(
            visible_hahitantsoa_event_drafts(user=self.request.user),
            pk=self.kwargs["pk"],
        )
        try:
            return get_hahitantsoa_event_draft_document_instance_or_404(
                event_draft=event_draft,
                document_instance_id=self.kwargs["id"],
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")


class HahitantsoaEventDraftDocumentInstanceGenerateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    @extend_schema(
        request=None,
        responses={
            200: HahitantsoaEventDraftDocumentInstanceGenerateSerializer,
            400: serializers.Serializer,
        },
    )
    def post(self, request, pk, id):
        from django.http import Http404
        from django.shortcuts import get_object_or_404

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        try:
            instance = generate_hahitantsoa_event_draft_document_instance_html(
                event_draft=event_draft,
                document_instance_id=id,
                actor=request.user,
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")
        except DocumentRuntimeGenerationError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = HahitantsoaEventDraftDocumentInstanceGenerateSerializer(
            {
                "id": instance.id,
                "status": instance.status,
                "content_checksum": instance.content_checksum,
                "storage_path": instance.storage_path,
                "generated_content_size_bytes": instance.generated_content_size_bytes,
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftDocumentInstanceGeneratePdfAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]

    def post(self, request, pk, id):
        from django.http import Http404
        from django.shortcuts import get_object_or_404

        from apps.documents.pdf import DocumentPDFGenerationError
        from apps.documents.serializers import DocumentInstancePDFSerializer
        from apps.documents.services import (
            generate_document_instance_pdf,
            get_hahitantsoa_event_draft_document_instance_or_404,
        )

        event_draft = get_object_or_404(visible_hahitantsoa_event_drafts(user=request.user), pk=pk)
        try:
            instance = get_hahitantsoa_event_draft_document_instance_or_404(
                event_draft=event_draft,
                document_instance_id=id,
            )
            instance = generate_document_instance_pdf(
                document_instance=instance,
                actor=request.user,
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")
        except DocumentPDFGenerationError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DocumentInstancePDFSerializer(
            {
                "id": instance.id,
                "status": instance.status,
                "pdf_storage_path": instance.pdf_storage_path,
                "pdf_generated_at": instance.pdf_generated_at,
                "pdf_content_checksum": instance.pdf_content_checksum,
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class HahitantsoaEventDraftRetrieveUpdateAPIView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "put", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedHahitantsoaEventDraftBoundary]
    serializer_class = HahitantsoaEventDraftSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return visible_hahitantsoa_event_drafts(user=self.request.user)

    def _lifecycle_error_response(self, error: ReservationLifecycleStateError) -> Response:
        return Response(
            {
                "detail": str(error),
                "code": getattr(error, "code", None),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        try:
            assert_hahitantsoa_event_draft_mutable(event_draft=instance)
        except ReservationLifecycleStateError as error:
            return self._lifecycle_error_response(error)

        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @extend_schema(responses={204: None})
    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        try:
            assert_hahitantsoa_event_draft_mutable(event_draft=instance)
        except ReservationLifecycleStateError as error:
            return self._lifecycle_error_response(error)

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @transaction.atomic
    def perform_destroy(self, instance):
        deleted_at = timezone.now()
        instance.lines.filter(is_deleted=False).update(
            is_deleted=True,
            deleted_at=deleted_at,
            updated_by=self.request.user,
            updated_at=deleted_at,
        )
        instance.is_deleted = True
        instance.deleted_at = deleted_at
        instance.updated_by = self.request.user
        instance.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])


class HahitantsoaVenueListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            from apps.hahitantsoa.serializers import HahitantsoaVenueCreateSerializer

            return HahitantsoaVenueCreateSerializer
        from apps.hahitantsoa.serializers import HahitantsoaVenueSerializer

        return HahitantsoaVenueSerializer

    def get_queryset(self):
        return HahitantsoaVenue.objects.all()


class HahitantsoaVenueRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method.lower() == "patch":
            from apps.hahitantsoa.serializers import HahitantsoaVenueCreateSerializer

            return HahitantsoaVenueCreateSerializer
        from apps.hahitantsoa.serializers import HahitantsoaVenueSerializer

        return HahitantsoaVenueSerializer

    def get_queryset(self):
        return HahitantsoaVenue.objects.all()


class HahitantsoaServiceListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            from apps.hahitantsoa.serializers import HahitantsoaServiceCreateSerializer

            return HahitantsoaServiceCreateSerializer
        from apps.hahitantsoa.serializers import HahitantsoaServiceSerializer

        return HahitantsoaServiceSerializer

    def get_queryset(self):
        return HahitantsoaService.objects.all()


class HahitantsoaServiceRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method.lower() == "patch":
            from apps.hahitantsoa.serializers import HahitantsoaServiceCreateSerializer

            return HahitantsoaServiceCreateSerializer
        from apps.hahitantsoa.serializers import HahitantsoaServiceSerializer

        return HahitantsoaServiceSerializer

    def get_queryset(self):
        return HahitantsoaService.objects.all()
