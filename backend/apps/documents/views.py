from datetime import UTC
from io import BytesIO

from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    OpenApiTypes,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_event_on_commit
from apps.documents.commercial import CommercialDocumentContextError
from apps.documents.models import DocumentInstance, UploadedAttachment
from apps.documents.pdf import DocumentPDFGenerationError, get_pdf_generator
from apps.documents.registry import (
    get_document_template_definition,
    list_document_template_definitions,
)
from apps.documents.rendering import resolve_document_template_path
from apps.documents.runtime import DocumentRuntimeGenerationError
from apps.documents.selectors import (
    get_document_instance_by_id,
    list_all_document_instances,
    list_document_instances_for_reservation_draft,
)
from apps.documents.serializers import (
    DocumentInstanceCreateSerializer,
    DocumentInstanceGenerateSerializer,
    DocumentInstanceListSerializer,
    DocumentInstancePDFSerializer,
    DocumentInstanceSerializer,
    DocumentTemplateDefinitionSerializer,
    TitanProformaDraftPreviewSerializer,
    UploadedAttachmentSerializer,
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


class UploadedAttachmentListCreateAPIView(APIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = UploadedAttachment.objects.filter(is_deleted=False)
        customer_id = self.request.query_params.get("customer_id")
        reservation_draft_id = self.request.query_params.get("reservation_draft_id")
        event_draft_id = self.request.query_params.get("hahitantsoa_event_draft_id")
        filters = [value for value in (customer_id, reservation_draft_id, event_draft_id) if value]
        if len(filters) != 1:
            return queryset.none()
        if customer_id:
            return queryset.filter(customer_id=customer_id)
        if reservation_draft_id:
            return queryset.filter(reservation_draft_id=reservation_draft_id)
        return queryset.filter(hahitantsoa_event_draft_id=event_draft_id)

    @extend_schema(responses=UploadedAttachmentSerializer(many=True))
    def get(self, request):
        return Response(UploadedAttachmentSerializer(self.get_queryset(), many=True).data)

    @extend_schema(
        request=UploadedAttachmentSerializer,
        responses={201: UploadedAttachmentSerializer},
    )
    def post(self, request):
        serializer = UploadedAttachmentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            attachment = serializer.save()
            record_audit_event_on_commit(
                actor=request.user,
                action="documents.attachment_uploaded",
                target_type="uploaded_attachment",
                target_id=str(attachment.id),
                metadata={
                    "category": attachment.category,
                    "content_type": attachment.content_type,
                    "size_bytes": attachment.size_bytes,
                },
            )
        return Response(
            UploadedAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class UploadedAttachmentDetailAPIView(APIView):
    http_method_names = ["delete", "get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def get_object(self):
        return get_object_or_404(
            UploadedAttachment.objects.filter(is_deleted=False),
            pk=self.kwargs["id"],
        )

    @extend_schema(responses=UploadedAttachmentSerializer)
    def get(self, request, id):
        attachment = self.get_object()
        return Response(UploadedAttachmentSerializer(attachment).data)

    def delete(self, request, id):
        attachment = self.get_object()
        attachment.is_deleted = True
        attachment.deleted_at = timezone.now()
        attachment.updated_by = request.user
        with transaction.atomic():
            attachment.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
            record_audit_event_on_commit(
                actor=request.user,
                action="documents.attachment_deleted",
                target_type="uploaded_attachment",
                target_id=str(attachment.id),
                metadata={"category": attachment.category},
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UploadedAttachmentDownloadAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def get(self, request, id):
        attachment = get_object_or_404(
            UploadedAttachment.objects.filter(is_deleted=False),
            pk=id,
        )
        try:
            attachment.file.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404("Attachment file not found.")
        response = FileResponse(
            attachment.file,
            content_type=attachment.content_type,
        )
        from urllib.parse import quote

        encoded_name = quote(attachment.original_name)
        response["Content-Disposition"] = (
            f"attachment; filename=\"attachment\"; filename*=UTF-8''{encoded_name}"
        )
        return response


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


def _resolve_preview_template_path(template_key: str) -> str | None:
    return resolve_document_template_path(template_key)


def _build_mock_preview_context(template_definition) -> dict:
    """Build a mock context for template preview with realistic demo data."""
    from datetime import datetime

    mock_customer = {
        "customer_id": "DEMO-001",
        "public_reference": "LOC-2026-DEMO",
        "display_name": "ETS Ravinala (Démo)",
        "email": "info@ravinala.mg",
        "phone": "+261 34 12 345 67",
        "address": "Lot 12B, Mahajanga, Madagascar",
        "civilite": "Société",
        "birth_date": None,
        "birth_place": "",
        "id_type": "NIF",
        "id_number": "6003298583",
        "id_issue_date": None,
        "id_issue_place": "Antananarivo",
        "id_duplicata_date": None,
        "id_duplicata_place": "",
        "nif": "6003298583",
        "stat": "77290 11 2019 010 215",
        "rcs": "RCS-ANT-2019-00123",
        "representative_name": "Rakotomalala Jean",
        "representative_role": "Gérant",
    }

    mock_lines = [
        {
            "inventory_item_name": "Chaise chiavari dorée",
            "inventory_item_kind": "material",
            "quantity": 100,
            "notes": "",
        },
        {
            "inventory_item_name": "Table rectangulaire GM",
            "inventory_item_kind": "material",
            "quantity": 15,
            "notes": "Avec nappage",
        },
    ]

    # Context for reservation-based templates (titan)
    reservation_context = {
        "template": {
            "label": template_definition.label,
            "key": template_definition.key,
            "template_path": template_definition.template_path,
            "preview_path": template_definition.preview_path,
        },
        "reservation_draft": {
            "public_reference": "LOC-2026-DEMO",
            "customer": mock_customer,
            "customer_display_name": mock_customer["display_name"],
            "customer_email": mock_customer["email"],
            "customer_phone": mock_customer["phone"],
            "customer_address": mock_customer["address"],
            "customer_civilite": mock_customer["civilite"],
            "customer_id_type": mock_customer["id_type"],
            "customer_id_number": mock_customer["id_number"],
            "customer_nif": mock_customer["nif"],
            "customer_stat": mock_customer["stat"],
            "customer_rcs": mock_customer["rcs"],
            "customer_representative_name": mock_customer["representative_name"],
            "customer_representative_role": mock_customer["representative_role"],
            "start_at": datetime(2026, 9, 1, 10, 0, tzinfo=UTC),
            "end_at": datetime(2026, 9, 1, 20, 0, tzinfo=UTC),
            "notes": "Réservation de démonstration pour prévisualisation.",
            "lines": mock_lines,
        },
    }

    # Context for event-based templates (hahitantsoa)
    event_context = {
        "template": {
            "label": template_definition.label,
            "key": template_definition.key,
        },
        "event_draft": {
            **mock_customer,
            "public_reference": "EVT-2026-DEMO",
            "customer_display_name": mock_customer["display_name"],
            "customer_email": mock_customer["email"],
            "customer_phone": mock_customer["phone"],
            "customer_address": mock_customer["address"],
            "customer_civilite": mock_customer["civilite"],
            "customer_id_type": mock_customer["id_type"],
            "customer_id_number": mock_customer["id_number"],
            "customer_id_issue_place": mock_customer["id_issue_place"],
            "customer_nif": mock_customer["nif"],
            "customer_stat": mock_customer["stat"],
            "customer_rcs": mock_customer["rcs"],
            "customer_representative_name": mock_customer["representative_name"],
            "customer_representative_role": mock_customer["representative_role"],
            "event_name": "Mariage de Rakotomalala & Rasoanaivo",
            "event_type": "Mariage",
            "venue_name": "Domaine Hahitantsoa",
            "location_details": "Lot P93M, Ambohipo Sud, Alasora",
            "service_notes": "Service traiteur inclus, 200 convives",
            "start_at": datetime(2026, 9, 1, 18, 0, tzinfo=UTC),
            "end_at": datetime(2026, 9, 2, 3, 30, tzinfo=UTC),
            "notes": "Événement de démonstration pour prévisualisation.",
            "lines": mock_lines,
        },
    }

    # Payment receipt context
    payment_context = {
        "template": {
            "label": template_definition.label,
            "key": template_definition.key,
        },
        "payment": {
            "id": "DEMO-PAY-001",
            "amount": "500000",
            "currency": "MGA",
            "payment_kind": "deposit",
            "payment_method": "Espèces",
            "payment_status": "confirmed",
            "confirmed_at": datetime(2026, 8, 6, 12, 0, tzinfo=UTC),
            "customer_display_name": mock_customer["display_name"],
            "customer_address": mock_customer["address"],
            "customer_phone": mock_customer["phone"],
            "customer_email": mock_customer["email"],
            "reservation_public_reference": "LOC-2026-DEMO",
            "reservation_draft": reservation_context["reservation_draft"],
            "customer": mock_customer,
        },
    }

    excess_context = {
        "template": {
            "label": template_definition.label,
            "key": template_definition.key,
        },
        "excess_receivable": {
            "excess_receivable_id": "EXC-2026-DEMO",
            "customer_display_name": mock_customer["display_name"],
            "reservation_public_reference": "LOC-2026-DEMO",
            "reservation_status": "confirmed",
            "amount": "160000",
            "deposit_amount": "100000",
        },
    }

    # Select context based on template key or business scope
    key_upper = template_definition.key.upper()
    if "PAYMENT" in key_upper or "RECET" in key_upper or "RECU" in key_upper:
        return payment_context
    elif "DAMAGE_LOSS_EXCESS" in key_upper:
        return excess_context
    elif template_definition.business_scope == "hahitantsoa":
        return event_context
    elif template_definition.business_scope == "titan":
        return reservation_context
    else:
        return reservation_context


def _build_preview_bank(template_definition) -> dict[str, str]:
    """Use the source document's bank identity in non-persistent previews."""

    if template_definition.business_scope == "titan":
        return {
            "name": "BMOI MADAGASCAR",
            "branch": "Antananarivo",
            "account_holder": "ERGON GROUP SARL",
            "account_number": "00004 00009 03319320102 33",
            "rib": "00004 00009 03319320102 33",
            "iban": "",
            "swift_bic": "",
        }
    if template_definition.business_scope == "hahitantsoa":
        return {
            "name": "BMOI MADAGASCAR",
            "branch": "Antananarivo",
            "account_holder": "ERGON GROUP SARL",
            "account_number": "00004 00009 03319320103 30",
            "rib": "00004 00009 03319320103 30",
            "iban": "",
            "swift_bic": "",
        }
    return {
        "name": "BMOI MADAGASCAR",
        "branch": "Antananarivo",
        "account_holder": "ERGON GROUP SARL",
        "account_number": "",
        "rib": "{{rib}}",
        "iban": "{{iban}}",
        "swift_bic": "{{swift_bic}}",
    }


class DocumentTemplatePreviewAPIView(APIView):
    """Render a template with mock data for preview without persisting anything."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: OpenApiResponse(
                description="Rendered HTML preview of the template.",
                response=OpenApiTypes.STR,
            ),
            404: OpenApiResponse(description="Template not found or no HTML template available."),
        }
    )
    def get(self, request, template_key: str):
        from django.http import HttpResponse
        from django.template.loader import render_to_string

        template_definition = get_document_template_definition(template_key)
        if template_definition is None:
            raise Http404("Document template definition not found.")

        # Map template key to the Django template path used for rendering
        template_path = _resolve_preview_template_path(template_key)
        if template_path is None:
            raise Http404(f"No HTML template available for preview of '{template_key}'.")

        mock_context = _build_mock_preview_context(template_definition)
        bank = _build_preview_bank(template_definition)

        html_content = render_to_string(
            template_path,
            {"context": mock_context, "bank": bank},
        )

        return HttpResponse(html_content, content_type="text/html; charset=utf-8")


class DocumentTemplatePreviewPDFAPIView(APIView):
    """Render a non-persistent template preview as a printable PDF."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: OpenApiResponse(description="Printable PDF preview of the template."),
            404: OpenApiResponse(description="Template not found or no HTML template available."),
            503: OpenApiResponse(description="PDF renderer unavailable."),
        }
    )
    def get(self, request, template_key: str):
        from django.template.loader import render_to_string

        template_definition = get_document_template_definition(template_key)
        if template_definition is None:
            raise Http404("Document template definition not found.")

        template_path = _resolve_preview_template_path(template_key)
        if template_path is None:
            raise Http404(f"No HTML template available for preview of '{template_key}'.")

        bank = _build_preview_bank(template_definition)
        html_content = render_to_string(
            template_path,
            {"context": _build_mock_preview_context(template_definition), "bank": bank},
        )

        try:
            pdf_content = get_pdf_generator().generate_pdf(html_content)
        except DocumentPDFGenerationError as error:
            return Response({"detail": str(error), "code": error.code}, status=503)

        response = FileResponse(
            BytesIO(pdf_content),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'inline; filename="{template_key.replace(".", "-")}-preview.pdf"'
        )
        return response


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
                bank_profile=serializer.validated_data.get("bank_profile"),
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


class DocumentTemplateCRUDDestroyAPIView(APIView):
    http_method_names = ["delete", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            204: OpenApiResponse(description="Template deleted."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        }
    )
    def delete(self, request, id):
        from apps.documents.models import DocumentTemplate

        template = DocumentTemplate.objects.filter(pk=id).first()
        if template is None:
            raise Http404("Document template not found.")
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class DocumentInstanceListAPIView(APIView):
    """Globally list document instances with optional filtering."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="document_type",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="business_scope",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="customer_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="date_from",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="date_to",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="ordering",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={
            200: DocumentInstanceListSerializer(many=True),
            403: OpenApiResponse(description="Unauthorized."),
        },
    )
    def get(self, request):
        qs = list_all_document_instances(
            document_type=request.query_params.get("document_type"),
            business_scope=request.query_params.get("business_scope"),
            status=request.query_params.get("status"),
            customer_id=request.query_params.get("customer_id"),
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
            search=request.query_params.get("search"),
            ordering=request.query_params.get("ordering", "-created_at"),
        )
        serializer = DocumentInstanceListSerializer(qs, many=True)
        return Response(serializer.data)