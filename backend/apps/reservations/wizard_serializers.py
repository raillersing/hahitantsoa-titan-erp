"""Explicit versioned recovery contract, separate from official dossier writes."""

import json
from collections.abc import Mapping
from pathlib import Path

from rest_framework import serializers

from apps.customers.models import Customer
from apps.documents.models import UploadedAttachmentCategory
from apps.documents.serializers import (
    ALLOWED_ATTACHMENT_TYPES,
    MAX_UPLOADED_ATTACHMENT_BYTES,
    _attachment_signature_matches,
)
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

STATE_KEYS = frozenset(
    """
routeParam editingDraftContext isEditingClient documentReference issuedProspectProformaId
proformaGenerated proformaValidity deliveryModifiedManually returnModifiedManually
lastCalculatedDelivery lastCalculatedReturn useCustomReference customPublicReference
 depositRecordingKey customerCreationKey path step maxReachedStep clientMode selectedClientId
newClient domain hDetails tDetails selectedMaterials selectedServices deliveryFee payment
clientAttachments dedicatedAttachments paymentAttachments recordedPayments discountValue
 discountIsPercentage discountReason prospectProformaEmission
""".split()
)
MAX_WIZARD_STATE_BYTES = 512 * 1024


def validate_wizard_state(value):
    if not isinstance(value, dict) or set(value) - STATE_KEYS:
        raise serializers.ValidationError(
            "Le contenu de récupération ne correspond pas au schéma de l'assistant."
        )
    try:
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False)
    except ValueError, TypeError, RecursionError:
        raise serializers.ValidationError(
            "Le contenu de récupération doit être un objet JSON valide."
        ) from None
    if len(encoded.encode()) > MAX_WIZARD_STATE_BYTES:
        raise serializers.ValidationError("Le contenu de récupération dépasse 512 Ko.")

    def bounded(node, depth=0):
        if depth > 12:
            raise serializers.ValidationError("Le contenu de récupération est trop imbriqué.")
        if isinstance(node, dict):
            if len(node) > 200 or any(
                not isinstance(key, str)
                or key.casefold() in {"password", "token", "csrf", "file", "__proto__"}
                for key in node
            ):
                raise serializers.ValidationError(
                    "Le contenu de récupération contient un champ interdit."
                )
            for child in node.values():
                bounded(child, depth + 1)
        elif isinstance(node, list):
            if len(node) > 1000:
                raise serializers.ValidationError(
                    "Le contenu de récupération contient trop de lignes."
                )
            for child in node:
                bounded(child, depth + 1)
        elif isinstance(node, str) and (len(node) > 32768 or node.startswith("data:")):
            raise serializers.ValidationError(
                "Téléversez les fichiers séparément des champs de l'assistant."
            )

    bounded(value)
    return value


class WizardWriteSerializer(serializers.Serializer):
    schema_version = serializers.IntegerField(min_value=1, max_value=1, required=False)
    domain = serializers.ChoiceField(
        choices=["titan", "hahitantsoa", ""], allow_null=True, required=False
    )
    step = serializers.IntegerField(min_value=0, max_value=9, required=False)
    state = serializers.JSONField(required=False, validators=[validate_wizard_state])
    status = serializers.ChoiceField(choices=["active", "completed"], required=False)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
        allow_null=True,
        required=False,
    )
    reservation_draft_id = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False), allow_null=True, required=False
    )
    hahitantsoa_event_draft_id = serializers.PrimaryKeyRelatedField(
        queryset=HahitantsoaEventDraft.objects.filter(is_deleted=False),
        allow_null=True,
        required=False,
    )

    def to_internal_value(self, data):
        if isinstance(data, Mapping) and set(data) - set(self.fields):
            raise serializers.ValidationError(
                {"detail": "Champ inconnu dans la sauvegarde de l'assistant."}
            )
        result = super().to_internal_value(data)
        if "domain" in result and result["domain"] is None:
            result["domain"] = ""
        return result


class WizardCreateSerializer(WizardWriteSerializer):
    client_key = serializers.UUIDField()


class WizardUpdateSerializer(WizardWriteSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class WizardFileCreateSerializer(serializers.Serializer):
    client_file_key = serializers.UUIDField()
    expected_version = serializers.IntegerField(min_value=1)
    category = serializers.ChoiceField(choices=UploadedAttachmentCategory.choices)
    label = serializers.CharField(max_length=255, allow_blank=True, default="")
    file = serializers.FileField()

    def validate_file(self, uploaded):
        suffix = Path(uploaded.name).suffix.casefold()
        expected = ALLOWED_ATTACHMENT_TYPES.get(suffix)
        if expected is None or uploaded.content_type != expected:
            raise serializers.ValidationError(
                "Format refusé. Utilisez PDF, JPG, PNG ou WEBP avec un type MIME cohérent."
            )
        if uploaded.size <= 0 or uploaded.size > MAX_UPLOADED_ATTACHMENT_BYTES:
            raise serializers.ValidationError("La pièce jointe doit contenir au maximum 10 Mo.")
        header = uploaded.read(16)
        uploaded.seek(0)
        if not _attachment_signature_matches(suffix, header):
            raise serializers.ValidationError(
                "Le contenu du fichier ne correspond pas à son format."
            )
        return uploaded


class WizardFileDeleteSerializer(serializers.Serializer):
    expected_version = serializers.IntegerField(min_value=1)


class WizardFileReadSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    client_file_key = serializers.UUIDField()
    category = serializers.CharField()
    label = serializers.CharField()
    original_name = serializers.CharField()
    content_type = serializers.CharField()
    size_bytes = serializers.IntegerField()
    sha256 = serializers.CharField()
    download_url = serializers.CharField()


class WizardSessionMetadataSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    client_key = serializers.UUIDField()
    schema_version = serializers.IntegerField()
    version = serializers.IntegerField()
    domain = serializers.ChoiceField(choices=["titan", "hahitantsoa"], allow_null=True)
    step = serializers.IntegerField()
    status = serializers.ChoiceField(choices=["active", "completed"])
    customer_id = serializers.UUIDField(allow_null=True)
    reservation_draft_id = serializers.UUIDField(allow_null=True)
    hahitantsoa_event_draft_id = serializers.UUIDField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class WizardSessionReadSerializer(WizardSessionMetadataSerializer):
    state = serializers.JSONField()
    files = WizardFileReadSerializer(many=True)


class WizardFileMutationSerializer(serializers.Serializer):
    file = WizardFileReadSerializer()
    version = serializers.IntegerField()


class WizardRevisionSerializer(serializers.Serializer):
    version = serializers.IntegerField()
