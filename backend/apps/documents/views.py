from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, OpenApiTypes, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.commercial import CommercialDocumentContextError
from apps.documents.models import DocumentInstance
from apps.documents.pdf import DocumentPDFGenerationError
from apps.documents.registry import (
    get_document_template_definition,
    list_document_template_definitions,
)
from apps.documents.runtime import DocumentRuntimeGenerationError
from apps.documents.selectors import (
    get_document_instance_by_id,
    list_document_instances_for_reservation_draft,
)
from apps.documents.serializers import (
    DocumentInstanceCreateSerializer,
    DocumentInstanceGenerateSerializer,
    DocumentInstancePDFSerializer,
    DocumentInstanceSerializer,
    DocumentTemplateDefinitionSerializer,
    TitanProformaDraftPreviewSerializer,
)
from apps.documents.services import (
    ProformaActionError,
    create_document_instance_from_reservation_draft,
    generate_document_instance_pdf,
    generate_reservation_draft_document_instance_html,
    get_reservation_draft_document_instance_or_404,
    get_titan_proforma_draft_preview_payload_service,
    prepare_contract_from_proforma,
    void_proforma,
)
from apps.identity.permissions import HasReservationSensitiveAccess
from apps.reservations.models import ReservationDraft


def runtime_document_scope_flags() -> dict[str, bool]:
    return {
        "pdf_runtime_generated": False,
        "reservation_confirmed": False,
        "inventory_blocked": False,
        "payment_created": False,
        "invoice_created": False,
        "contract_created": False,
    }


class DocumentTemplateRegistryAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="DocumentTemplateRegistryResponse",
            fields={
                "items": DocumentTemplateDefinitionSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        templates = list_document_template_definitions()
        serialized_templates = DocumentTemplateDefinitionSerializer(
            templates,
            many=True,
        ).data

        return Response(
            {
                "items": serialized_templates,
                "count": len(serialized_templates),
            }
        )


class DocumentTemplateDefinitionAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DocumentTemplateDefinitionSerializer)
    def get(self, request, template_key: str):
        template_definition = get_document_template_definition(template_key)
        if template_definition is None:
            raise Http404("Document template definition not found.")

        serializer = DocumentTemplateDefinitionSerializer(template_definition)
        return Response(serializer.data)


class TitanProformaDraftPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=TitanProformaDraftPreviewSerializer)
    def get(self, request, reservation_draft_id):
        try:
            payload = get_titan_proforma_draft_preview_payload_service(
                reservation_draft_id=reservation_draft_id,
            )
        except ReservationDraft.DoesNotExist:
            raise Http404("Reservation draft not found.")

        serializer = TitanProformaDraftPreviewSerializer(payload)
        return Response(serializer.data)


class DocumentInstancePrivateArtifactAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: OpenApiResponse(
                description="Raw stored HTML content of the document artifact.",
                response=OpenApiTypes.STR,
            )
        }
    )
    def get(self, request, id):
        from django.core.files.storage import default_storage
        from django.http import HttpResponse

        from apps.documents.models import DocumentInstanceStatus
        from apps.documents.selectors import get_document_instance_by_id

        instance = get_document_instance_by_id(document_instance_id=id)
        if instance is None:
            raise Http404("Document instance not found.")

        if instance.status != DocumentInstanceStatus.GENERATED:
            raise Http404("Document instance is not generated.")

        if not instance.storage_path:
            raise Http404("Artifact storage path is empty.")

        if not default_storage.exists(instance.storage_path):
            raise Http404("Artifact file does not exist.")

        try:
            with default_storage.open(instance.storage_path, "rb") as f:
                content = f.read()
        except Exception:
            raise Http404("Failed to read artifact from storage.")

        from apps.audit.services import record_audit_event_on_commit

        record_audit_event_on_commit(
            actor=request.user,
            action="document.artifact_accessed",
            target_type="document_instance",
            target_id=str(instance.id),
            metadata={
                "template_key": instance.template_key,
                "content_checksum": instance.content_checksum,
                "generated_content_size_bytes": instance.generated_content_size_bytes,
            },
        )

        return HttpResponse(content, content_type="text/html; charset=utf-8")


def active_reservation_drafts_for_document_runtime():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


class ReservationDraftDocumentInstanceListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return DocumentInstanceCreateSerializer
        return DocumentInstanceSerializer

    def get_reservation_draft(self) -> ReservationDraft:
        return get_object_or_404(
            active_reservation_drafts_for_document_runtime(),
            pk=self.kwargs["reservation_draft_id"],
        )

    def get_queryset(self):
        reservation_draft = self.get_reservation_draft()
        return list_document_instances_for_reservation_draft(reservation_draft=reservation_draft)

    @extend_schema(
        responses=DocumentInstanceSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=DocumentInstanceCreateSerializer,
        responses={201: DocumentInstanceSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation_draft = self.get_reservation_draft()

        try:
            instance = create_document_instance_from_reservation_draft(
                reservation_draft=reservation_draft,
                template_key=serializer.validated_data["template_key"],
                actor=request.user,
                notes=serializer.validated_data.get("notes", ""),
                proforma_validity_days=serializer.validated_data.get("proforma_validity_days"),
            )
        except CommercialDocumentContextError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = DocumentInstanceSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def get_permissions(self):
        if self.request.method.lower() == "post":
            return [HasReservationSensitiveAccess()]
        return [permission() for permission in self.permission_classes]


class ReservationDraftDocumentInstanceRetrieveAPIView(RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentInstanceSerializer
    lookup_field = "id"

    def get_object(self):
        reservation_draft = get_object_or_404(
            active_reservation_drafts_for_document_runtime(),
            pk=self.kwargs["reservation_draft_id"],
        )
        try:
            return get_reservation_draft_document_instance_or_404(
                reservation_draft=reservation_draft,
                document_instance_id=self.kwargs["id"],
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")


class ReservationDraftDocumentInstanceGenerateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=None,
        responses={
            200: DocumentInstanceGenerateSerializer,
            400: OpenApiResponse(description="Document instance is not in a generatable state."),
        },
    )
    def post(self, request, reservation_draft_id, id):
        reservation_draft = get_object_or_404(
            active_reservation_drafts_for_document_runtime(),
            pk=reservation_draft_id,
        )
        try:
            instance = generate_reservation_draft_document_instance_html(
                reservation_draft=reservation_draft,
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

        serializer = DocumentInstanceGenerateSerializer(
            {
                "id": instance.id,
                "status": instance.status,
                "content_checksum": instance.content_checksum,
                "storage_path": instance.storage_path,
                "generated_content_size_bytes": instance.generated_content_size_bytes,
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class ReservationDraftDocumentInstancePDFGenerateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=None,
        responses={
            200: DocumentInstancePDFSerializer,
            400: OpenApiResponse(description="Document instance is not ready for PDF generation."),
        },
    )
    def post(self, request, reservation_draft_id, id):
        reservation_draft = get_object_or_404(
            active_reservation_drafts_for_document_runtime(),
            pk=reservation_draft_id,
        )
        try:
            instance = get_reservation_draft_document_instance_or_404(
                reservation_draft=reservation_draft,
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
                "issued_at": instance.issued_at,
                "valid_until": instance.valid_until,
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class DocumentInstancePDFRetrieveAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: OpenApiTypes.BINARY,
            404: OpenApiResponse(description="PDF artifact not found."),
        },
    )
    def get(self, request, id):
        from django.core.files.storage import default_storage
        from django.http import FileResponse
        from django.http import Http404 as DjangoHttp404

        instance = get_document_instance_by_id(document_instance_id=id)
        if instance is None or not instance.pdf_storage_path:
            raise DjangoHttp404("PDF artifact not found.")

        if not default_storage.exists(instance.pdf_storage_path):
            raise DjangoHttp404("PDF artifact file missing.")

        pdf_file = default_storage.open(instance.pdf_storage_path)
        response = FileResponse(pdf_file, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{instance.template_key}-{id}.pdf"'
        return response


class DocumentTemplateCRUDListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from apps.documents.serializers import DocumentTemplateCRUDSerializer

        return DocumentTemplateCRUDSerializer

    def get_queryset(self):
        from apps.documents.models import DocumentTemplate

        return DocumentTemplate.objects.all()


class DocumentTemplateVersionListCreateAPIView(ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        from apps.documents.serializers import DocumentTemplateVersionSerializer

        return DocumentTemplateVersionSerializer

    def get_queryset(self):
        from apps.documents.models import DocumentTemplateVersion

        qs = DocumentTemplateVersion.objects.all()
        template_id = self.request.query_params.get("template")
        if template_id:
            qs = qs.filter(template_id=template_id)
        return qs


class DocumentTemplateVersionActivateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from django.shortcuts import get_object_or_404

        from apps.documents.models import DocumentTemplateVersion

        version = get_object_or_404(DocumentTemplateVersion, pk=id)
        # Deactivate all other versions of the same template
        DocumentTemplateVersion.objects.filter(template=version.template).exclude(
            pk=version.pk
        ).update(status="archived")
        version.status = "active"
        version.save(update_fields=["status", "updated_at"])
        from apps.documents.serializers import DocumentTemplateVersionSerializer

        return Response(DocumentTemplateVersionSerializer(version).data)


class DocumentInstanceConvertToContractAPIView(APIView):
    """Convert a proforma into a contract document instance."""

    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: DocumentInstanceSerializer,
            201: DocumentInstanceSerializer,
            400: OpenApiResponse(
                description="Document is not a proforma, is expired, or already voided."
            ),
        }
    )
    def post(self, request, id):
        try:
            contract, created = prepare_contract_from_proforma(
                document_instance_id=id,
                actor=request.user,
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")
        except ProformaActionError as error:
            return Response(
                {"detail": str(error), "code": error.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            DocumentInstanceSerializer(contract).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DocumentInstanceVoidAPIView(APIView):
    """Void a proforma document instance."""

    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: DocumentInstanceSerializer,
            400: OpenApiResponse(description="Document is not a proforma or is already voided."),
        }
    )
    def post(self, request, id):
        try:
            instance = void_proforma(
                document_instance_id=id,
                actor=request.user,
                reason=request.data.get("reason", ""),
            )
        except DocumentInstance.DoesNotExist:
            raise Http404("Document instance not found.")
        except ProformaActionError as error:
            return Response(
                {"detail": str(error), "code": error.code}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(DocumentInstanceSerializer(instance).data, status=status.HTTP_200_OK)
