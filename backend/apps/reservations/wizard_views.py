from urllib.parse import quote

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reservations.models import ReservationWizardFile, ReservationWizardSession
from apps.reservations.wizard import (
    add_wizard_file,
    create_wizard_session,
    delete_wizard_file,
    update_wizard_session,
)
from apps.reservations.wizard_serializers import (
    WizardCreateSerializer,
    WizardDischargeCreateSerializer,
    WizardDraftCreateSerializer,
    WizardFileCreateSerializer,
    WizardFileDeleteSerializer,
    WizardFileMutationSerializer,
    WizardFilePromoteSerializer,
    WizardProformaUpdateSerializer,
    WizardRevisionSerializer,
    WizardSessionMetadataSerializer,
    WizardSessionReadSerializer,
    WizardUpdateSerializer,
)


class IsActiveWizardUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_active


def wizard_file_data(file):
    return {
        "id": str(file.pk),
        "client_file_key": str(file.client_file_key),
        "category": file.category,
        "label": file.label,
        "original_name": file.original_name,
        "content_type": file.content_type,
        "size_bytes": file.size_bytes,
        "sha256": file.sha256,
        "download_url": (
            f"/api/v1/reservations/wizard-sessions/{file.session_id}/files/{file.pk}/download/"
        ),
    }


def wizard_session_data(session, *, include_state=True):
    data = {
        "id": str(session.pk),
        "client_key": str(session.client_key),
        "schema_version": session.schema_version,
        "version": session.version,
        "domain": session.domain or None,
        "step": session.step,
        "status": session.status,
        "customer_id": str(session.customer_id) if session.customer_id else None,
        "reservation_draft_id": str(session.reservation_draft_id)
        if session.reservation_draft_id
        else None,
        "hahitantsoa_event_draft_id": str(session.hahitantsoa_event_draft_id)
        if session.hahitantsoa_event_draft_id
        else None,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }
    if include_state:
        data["state"] = session.state
        data["files"] = [wizard_file_data(file) for file in session.files.filter(is_deleted=False)]
    return data


class WizardPrivateAPIView(APIView):
    permission_classes = [IsActiveWizardUser]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

    def get_session(self, session_id):
        return get_object_or_404(
            ReservationWizardSession.objects.filter(owner=self.request.user), pk=session_id
        )


class ReservationWizardSessionListCreateAPIView(WizardPrivateAPIView):
    http_method_names = ["get", "post", "head", "options"]

    @extend_schema(responses=WizardSessionMetadataSerializer(many=True))
    def get(self, request):
        sessions = ReservationWizardSession.objects.filter(
            owner=request.user, status="active"
        ).defer("state")[:100]
        return Response([wizard_session_data(session, include_state=False) for session in sessions])

    @extend_schema(
        request=WizardCreateSerializer,
        responses={200: WizardSessionReadSerializer, 201: WizardSessionReadSerializer},
    )
    def post(self, request):
        serializer = WizardCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session, created = create_wizard_session(
            actor=request.user, values=serializer.validated_data
        )
        return Response(
            wizard_session_data(session),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ReservationWizardSessionDetailAPIView(WizardPrivateAPIView):
    http_method_names = ["get", "put", "head", "options"]

    @extend_schema(responses=WizardSessionReadSerializer)
    def get(self, request, session_id):
        return Response(wizard_session_data(self.get_session(session_id)))

    @extend_schema(request=WizardUpdateSerializer, responses=WizardSessionReadSerializer)
    def put(self, request, session_id):
        self.get_session(session_id)
        serializer = WizardUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        session = update_wizard_session(
            actor=request.user,
            session_id=session_id,
            expected_version=values.pop("expected_version"),
            values=values,
        )
        return Response(wizard_session_data(session))


class ReservationWizardFileCreateAPIView(WizardPrivateAPIView):
    http_method_names = ["post", "options"]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=WizardFileCreateSerializer,
        responses={200: WizardFileMutationSerializer, 201: WizardFileMutationSerializer},
    )
    def post(self, request, session_id):
        self.get_session(session_id)
        serializer = WizardFileCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file, version, created = add_wizard_file(
            actor=request.user, session_id=session_id, values=serializer.validated_data
        )
        return Response(
            {"file": wizard_file_data(file), "version": version},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ReservationWizardFileDetailAPIView(WizardPrivateAPIView):
    http_method_names = ["delete", "options"]

    @extend_schema(request=WizardFileDeleteSerializer, responses=WizardRevisionSerializer)
    def delete(self, request, session_id, file_id):
        self.get_session(session_id)
        serializer = WizardFileDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = delete_wizard_file(
            actor=request.user, session_id=session_id, file_id=file_id, **serializer.validated_data
        )
        return Response({"version": version})


class ReservationWizardFileDownloadAPIView(WizardPrivateAPIView):
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request, session_id, file_id):
        session = self.get_session(session_id)
        file = get_object_or_404(
            ReservationWizardFile.objects.filter(session=session, is_deleted=False), pk=file_id
        )
        try:
            file.file.open("rb")
        except FileNotFoundError, ValueError:
            raise Http404("Cette pièce jointe n'est pas disponible.") from None
        response = FileResponse(file.file, content_type=file.content_type)
        response["Content-Disposition"] = (
            f"attachment; filename=\"attachment\"; filename*=UTF-8''{quote(file.original_name)}"
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ReservationWizardDraftCreateAPIView(WizardPrivateAPIView):
    http_method_names = ["post", "options"]

    @extend_schema(request=WizardDraftCreateSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, session_id):
        from apps.reservations.wizard_business import create_session_draft, draft_response

        self.get_session(session_id)
        serializer = WizardDraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session, draft, created = create_session_draft(
            actor=request.user, session_id=session_id, **serializer.validated_data
        )
        return Response(draft_response(session, draft), status=201 if created else 200)


class ReservationWizardFilePromoteAPIView(WizardPrivateAPIView):
    http_method_names = ["post", "options"]

    @extend_schema(request=WizardFilePromoteSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, session_id, file_id):
        from apps.documents.serializers import UploadedAttachmentSerializer
        from apps.reservations.wizard_business import promote_session_file

        self.get_session(session_id)
        serializer = WizardFilePromoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment, version, created = promote_session_file(
            actor=request.user, session_id=session_id, file_id=file_id, **serializer.validated_data
        )
        return Response(
            {"attachment": UploadedAttachmentSerializer(attachment).data, "version": version},
            status=201 if created else 200,
        )


class ReservationWizardDischargeCreateAPIView(WizardPrivateAPIView):
    http_method_names = ["post", "options"]

    @extend_schema(request=WizardDischargeCreateSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, session_id):
        from apps.hahitantsoa.serializers import HahitantsoaEventDraftDocumentInstanceSerializer
        from apps.reservations.wizard_business import create_session_discharge

        self.get_session(session_id)
        serializer = WizardDischargeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document, version, created = create_session_discharge(
            actor=request.user, session_id=session_id, **serializer.validated_data
        )
        return Response(
            {
                "document": HahitantsoaEventDraftDocumentInstanceSerializer(document).data,
                "version": version,
            },
            status=201 if created else 200,
        )


class ReservationWizardProformaUpdateAPIView(WizardPrivateAPIView):
    http_method_names = ["post", "options"]

    @extend_schema(request=WizardProformaUpdateSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, session_id):
        from apps.documents.serializers import DocumentInstanceSerializer
        from apps.reservations.wizard_business import update_session_proforma

        self.get_session(session_id)
        serializer = WizardProformaUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document, version = update_session_proforma(
            actor=request.user, session_id=session_id, **serializer.validated_data
        )
        return Response({"document": DocumentInstanceSerializer(document).data, "version": version})
