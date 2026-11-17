from __future__ import annotations

import json
import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient
from tests.backend.test_documents_access_lot_a2 import _create_doc_instance

from apps.billing.models import (
    BillingInvoice,
    BillingInvoiceSourceKind,
    BillingInvoiceStatus,
)
from apps.customers.models import Customer
from apps.documents.models import (
    DocumentInstanceStatus,
    UploadedAttachment,
    UploadedAttachmentCategory,
)
from apps.hahitantsoa.services import get_hahitantsoa_commercial_terms
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

User = get_user_model()
pytestmark = pytest.mark.django_db


# -----------------------------------------------------------------------------
# Fixtures & Helpers
# -----------------------------------------------------------------------------


def _create_user_with_role(
    username: str,
    role_slug: str | None,
    *,
    is_staff: bool = False,
    is_active: bool = True,
) -> User:
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="test-password-123",
        is_staff=is_staff,
        is_active=is_active,
    )
    if role_slug:
        role, _ = ApplicationRole.objects.get_or_create(
            slug=role_slug,
            defaults={"name": role_slug.replace("_", " ").title(), "is_active": True},
        )
        UserRoleAssignment.objects.create(
            user=user,
            role=role,
            is_active=True,
        )
    return user


def _client_for(user: User | None = None) -> APIClient:
    client = APIClient()
    if user is not None:
        client.force_authenticate(user=user)
    return client


def _create_test_customer(creator: User) -> Customer:
    return Customer.objects.create(
        display_name=f"Client Recette {uuid.uuid4().hex[:6]}",
        phone="+261340000001",
        email=f"client-{uuid.uuid4().hex[:6]}@example.com",
        created_by=creator,
        updated_by=creator,
    )


def _create_test_draft(
    creator: User,
    customer: Customer,
    *,
    contract_signed: bool = False,
) -> ReservationDraft:
    now = timezone.now()
    start_at = now + timezone.timedelta(days=30)
    end_at = start_at + timezone.timedelta(hours=8)
    return ReservationDraft.objects.create(
        customer=customer,
        created_by=creator,
        updated_by=creator,
        start_at=start_at,
        end_at=end_at,
        contract_signed_at=now if contract_signed else None,
        contract_signed_by=creator if contract_signed else None,
    )


def _create_test_invoice(creator: User, draft: ReservationDraft) -> BillingInvoice:
    return BillingInvoice.objects.create(
        reservation_draft=draft,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("500000.00"),
        issued_at=timezone.now(),
        number=f"INV-RECETTE-{uuid.uuid4().hex[:8].upper()}",
        created_by=creator,
        updated_by=creator,
    )


# -----------------------------------------------------------------------------
# 1. Validation des Sessions, Capacités et Catégories de Rapports
# -----------------------------------------------------------------------------


def test_recette_session_and_capabilities_for_all_personas():
    """Vérifie la réponse de GET /api/v1/auth/session/ pour chaque rôle métier réel."""
    accountant = _create_user_with_role("recette_comptable", "accountant")
    commercial = _create_user_with_role("recette_commercial", "reservation_sensitive_operator")
    owner_mgr = _create_user_with_role("recette_gerant", "owner_manager", is_staff=False)
    storekeeper = _create_user_with_role("recette_magasinier", "storekeeper")
    delivery_driver = _create_user_with_role("recette_livreur", "delivery_driver")
    tech_admin = _create_user_with_role("recette_admin_tech", None, is_staff=True)

    # 1. Comptable
    resp = _client_for(accountant).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["capabilities"]["canManageFinance"] is True
    assert user_data["capabilities"]["canSensitiveWrite"] is False
    assert user_data["capabilities"]["canManageIdentity"] is False
    assert user_data["capabilities"]["canOperateLogistics"] is False
    assert sorted(user_data["reportCategories"]) == ["payments", "sales_billing"]

    # 2. Commercial
    resp = _client_for(commercial).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["capabilities"]["canSensitiveWrite"] is True
    assert user_data["capabilities"]["canManageFinance"] is False
    assert user_data["capabilities"]["canManageIdentity"] is False
    assert user_data["capabilities"]["canOperateLogistics"] is True
    assert sorted(user_data["reportCategories"]) == [
        "documents",
        "inventory",
        "logistics",
        "payments",
        "prospects",
        "reservations",
        "sales_billing",
    ]

    # 3. Gérant Métier (owner_manager, non staff)
    resp = _client_for(owner_mgr).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["is_staff"] is False
    assert user_data["capabilities"]["canManageIdentity"] is True
    assert user_data["capabilities"]["canSensitiveWrite"] is True
    assert user_data["capabilities"]["canManageFinance"] is True
    assert user_data["capabilities"]["canOperateCashbox"] is True
    assert user_data["capabilities"]["canSuperviseCashbox"] is True
    assert user_data["capabilities"]["canManageInventory"] is True
    assert user_data["capabilities"]["canOperateLogistics"] is True
    assert user_data["capabilities"]["canOverrideLogistics"] is True
    assert sorted(user_data["reportCategories"]) == [
        "documents",
        "inventory",
        "logistics",
        "payments",
        "prospects",
        "reservations",
        "sales_billing",
    ]

    # 4. Magasinier
    resp = _client_for(storekeeper).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["capabilities"]["canManageInventory"] is True
    assert user_data["capabilities"]["canOperateLogistics"] is True
    assert user_data["capabilities"]["canManageFinance"] is False
    assert user_data["capabilities"]["canSensitiveWrite"] is False
    assert user_data["capabilities"]["canManageIdentity"] is False
    assert user_data["reportCategories"] == ["inventory"]

    # 5. Livreur (catalogue existant: delivery_driver sans capacité logistique par défaut)
    resp = _client_for(delivery_driver).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["capabilities"]["canOperateLogistics"] is False
    assert user_data["capabilities"]["canManageInventory"] is False
    assert user_data["capabilities"]["canManageFinance"] is False
    assert user_data["capabilities"]["canSensitiveWrite"] is False
    assert user_data["reportCategories"] == []

    # 6. Admin Technique (is_staff=True)
    resp = _client_for(tech_admin).get("/api/v1/auth/session/")
    assert resp.status_code == 200
    user_data = resp.data["user"]
    assert user_data["is_staff"] is True
    assert user_data["capabilities"]["canManageIdentity"] is True
    assert user_data["capabilities"]["canSensitiveWrite"] is True


# -----------------------------------------------------------------------------
# 2. Ouverture d'un Dossier Créé par un Collègue & Cloisonnement Documentaire
# -----------------------------------------------------------------------------


def test_recette_shared_dossier_colleague_access_and_document_partitioning():
    """Un commercial A crée un dossier avec documents financiers et pièces d'identité privées.

    - Commercial B peut consulter le dossier et toutes les pièces.
    - Le comptable peut consulter le dossier et les factures, mais reçoit 403
      sur la pièce d'identité.
    - Le magasinier et le livreur reçoivent 403 sur les factures et sur les pièces d'identité.
    """
    commercial_a = _create_user_with_role("recette_comm_a", "reservation_sensitive_operator")
    commercial_b = _create_user_with_role("recette_comm_b", "reservation_sensitive_operator")
    accountant = _create_user_with_role("recette_compta_dossier", "accountant")
    storekeeper = _create_user_with_role("recette_mag_dossier", "storekeeper")
    delivery_driver = _create_user_with_role("recette_liv_dossier", "delivery_driver")

    # Commercial A crée le dossier
    customer = _create_test_customer(commercial_a)
    draft = _create_test_draft(commercial_a, customer, contract_signed=True)

    # 1. Création d'une facture financière
    invoice_doc = _create_doc_instance(
        reservation_draft=draft,
        customer=customer,
        prepared_by=commercial_a,
        document_type="invoice",
        status=DocumentInstanceStatus.GENERATED,
    )

    # 2. Création d'une pièce d'identité privée (UploadedAttachment)
    id_card_attachment = UploadedAttachment.objects.create(
        customer=customer,
        reservation_draft=draft,
        category=UploadedAttachmentCategory.CIN,
        file=ContentFile(b"%PDF-1.4 cin private attachment", name="cin_client.pdf"),
        original_name="cin_recto_verso.pdf",
        content_type="application/pdf",
        size_bytes=31,
        sha256="0" * 64,
        created_by=commercial_a,
    )

    # A. Commercial B (collègue du créateur)
    client_comm_b = _client_for(commercial_b)
    # Consultation du dossier collègue
    resp_draft = client_comm_b.get(f"/api/v1/reservations/drafts/{draft.id}/")
    assert resp_draft.status_code == 200
    # Téléchargement facture
    assert (
        client_comm_b.get(f"/api/v1/documents/instances/{invoice_doc.id}/artifact/").status_code
        == 200
    )
    # Téléchargement pièce d'identité
    assert (
        client_comm_b.get(
            f"/api/v1/documents/attachments/{id_card_attachment.id}/download/"
        ).status_code
        == 200
    )

    # B. Comptable
    client_acct = _client_for(accountant)
    # Métadonnées du dossier partagé accessibles
    assert client_acct.get(f"/api/v1/reservations/drafts/{draft.id}/").status_code == 200
    # Téléchargement facture financière autorisée
    assert (
        client_acct.get(f"/api/v1/documents/instances/{invoice_doc.id}/artifact/").status_code
        == 200
    )
    # Téléchargement pièce d'identité strictement REFUSÉ (D05)
    resp_acct_id = client_acct.get(
        f"/api/v1/documents/attachments/{id_card_attachment.id}/download/"
    )
    assert resp_acct_id.status_code == 403

    # C. Magasinier
    client_store = _client_for(storekeeper)
    # Facture financière refusée
    assert (
        client_store.get(f"/api/v1/documents/instances/{invoice_doc.id}/artifact/").status_code
        == 403
    )
    # Pièce d'identité refusée
    assert (
        client_store.get(
            f"/api/v1/documents/attachments/{id_card_attachment.id}/download/"
        ).status_code
        == 403
    )

    # D. Livreur
    client_driver = _client_for(delivery_driver)
    # Facture financière refusée
    assert (
        client_driver.get(f"/api/v1/documents/instances/{invoice_doc.id}/artifact/").status_code
        == 403
    )
    # Pièce d'identité refusée
    assert (
        client_driver.get(
            f"/api/v1/documents/attachments/{id_card_attachment.id}/download/"
        ).status_code
        == 403
    )


# -----------------------------------------------------------------------------
# 3. Actions Autorisées, Refus Directs & Absence d'Écriture après Refus
# -----------------------------------------------------------------------------


def test_recette_accountant_operations_and_strict_d01_reserves():
    """Vérifie les droits financiers du comptable et l'absence totale d'écriture en cas de refus."""
    commercial = _create_user_with_role("recette_comm_d01", "reservation_sensitive_operator")
    accountant = _create_user_with_role("recette_compta_d01", "accountant")
    customer = _create_test_customer(commercial)
    client_acct = _client_for(accountant)

    # 1. Action autorisée : Création de profil bancaire (/api/v1/finance/banks/)
    bank_resp = client_acct.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-ACCT-RECETTE-01",
            "account_label": "Compte Principal Recette",
            "bank_name": "BOA Madagascar",
            "branch": "Analakely",
            "account_holder": "Titan SARL",
            "rib": "000010000200003",
            "is_default_for_documents": True,
        },
        format="json",
    )
    assert bank_resp.status_code == 201

    # 2. Refus : Paiement sur contrat non signé (INV-SEQ-01)
    draft_unsigned = _create_test_draft(commercial, customer, contract_signed=False)
    initial_payment_count = Payment.objects.count()

    pay_unsigned_resp = client_acct.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft_unsigned.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "100000.00",
        },
        format="json",
    )
    assert pay_unsigned_resp.status_code == 400
    assert "contract_signature_required_before_payment" in pay_unsigned_resp.data.get("code", "")
    # Absence d'écriture
    assert Payment.objects.count() == initial_payment_count

    # 3. Refus D01 : Le comptable ne peut pas signer le contrat
    sign_resp = client_acct.post(
        f"/api/v1/reservations/drafts/{draft_unsigned.id}/contract-signed/",
        format="json",
    )
    assert sign_resp.status_code == 403
    draft_unsigned.refresh_from_db()
    assert draft_unsigned.contract_signed_at is None

    # 4. Refus D01 : Le comptable ne peut pas confirmer la réservation
    draft_signed = _create_test_draft(commercial, customer, contract_signed=True)
    confirm_res_resp = client_acct.post(
        f"/api/v1/reservations/drafts/{draft_signed.id}/confirm/",
        format="json",
    )
    assert confirm_res_resp.status_code == 403

    # 5. Refus D01 : Avoirs, annulations de paiement, remboursements
    invoice = _create_test_invoice(commercial, draft_signed)
    credit_resp = client_acct.post(
        f"/api/v1/billing/invoices/{invoice.id}/credit-notes/",
        {"reason": "Demande avoir", "lines": []},
        format="json",
    )
    assert credit_resp.status_code == 403

    cancel_pay_resp = client_acct.post(
        f"/api/v1/payments/{uuid.uuid4()}/cancel/",
        {"reason": "tentative annulation"},
        format="json",
    )
    assert cancel_pay_resp.status_code == 403

    # 6. Action autorisée : Enregistrement de paiement sur contrat signé
    pay_signed_resp = client_acct.post(
        "/api/v1/payments/",
        {
            "reservation_draft": str(draft_signed.id),
            "payment_kind": PaymentKind.DEPOSIT,
            "payment_method": PaymentMethod.BANK_TRANSFER,
            "amount": "360000.00",
        },
        format="json",
    )
    assert pay_signed_resp.status_code == 201
    payment_id = pay_signed_resp.data["id"]

    # 7. Confirmation de paiement avec écriture journal : requiert canSensitiveWrite
    # Le commercial confirme le paiement
    client_comm = _client_for(commercial)
    conf_pay_resp = client_comm.post(
        f"/api/v1/payments/{payment_id}/confirm/",
        {"paid_at": timezone.now().isoformat(), "external_reference": "VIR-RECETTE-CONF"},
        format="json",
    )
    assert conf_pay_resp.status_code == 200
    assert conf_pay_resp.data["payment_status"] == PaymentStatus.CONFIRMED


def test_recette_commercial_bank_access_and_manager_settings(django_capture_on_commit_callbacks):
    """Vérifie :

    - Commercial : accès bancaire conservé (canSensitiveWrite OU canManageFinance),
      signatures, mais refus réglages.
    - Gérant Métier : autorité sur les réglages commerciaux D02 sans être is_staff.
    - Magasinier & Livreur : refus sur banque et opérations non autorisées.
    """
    commercial = _create_user_with_role("recette_comm_banks", "reservation_sensitive_operator")
    owner_mgr = _create_user_with_role("recette_gerant_set", "owner_manager", is_staff=False)
    storekeeper = _create_user_with_role("recette_mag_banks", "storekeeper")
    delivery_driver = _create_user_with_role("recette_liv_banks", "delivery_driver")

    # A. Commercial : accès bancaire conservé
    client_comm = _client_for(commercial)
    bank_list_resp = client_comm.get("/api/v1/finance/banks/")
    assert bank_list_resp.status_code == 200

    bank_create_resp = client_comm.post(
        "/api/v1/finance/banks/",
        {
            "business_scope": "titan",
            "account_code": "BANK-ACCT-RECETTE-02",
            "account_label": "Compte Commercial Historique",
            "bank_name": "BNI Madagascar",
            "branch": "Tanjombato",
            "account_holder": "Titan SARL",
            "rib": "000010000200004",
            "is_default_for_documents": False,
        },
        format="json",
    )
    assert bank_create_resp.status_code == 201

    # Commercial : refus réglages commerciaux globaux (D02)
    terms = get_hahitantsoa_commercial_terms()
    initial_validity = terms.contract_validity_days

    patch_terms_comm = client_comm.patch(
        "/api/v1/hahitantsoa/commercial-terms/",
        {"contract_validity_days": 45},
        format="json",
    )
    assert patch_terms_comm.status_code == 403
    terms.refresh_from_db()
    # Absence d'écriture
    assert terms.contract_validity_days == initial_validity

    # B. Gérant Métier : autorisé sur réglages commerciaux globaux (D02) sans is_staff
    client_mgr = _client_for(owner_mgr)
    with django_capture_on_commit_callbacks(execute=True):
        patch_terms_mgr = client_mgr.patch(
            "/api/v1/hahitantsoa/commercial-terms/",
            {"contract_validity_days": 28},
            format="json",
        )
    assert patch_terms_mgr.status_code == 200
    terms.refresh_from_db()
    assert terms.contract_validity_days == 28

    # C. Magasinier : accès inventaire autorisé, banque refusée
    client_store = _client_for(storekeeper)
    loc_resp = client_store.post(
        "/api/v1/inventory/storage-locations/",
        {"name": "Hangar Principal Recette", "is_active": True},
        format="json",
    )
    assert loc_resp.status_code == 201
    assert client_store.get("/api/v1/finance/banks/").status_code == 403

    # D. Livreur : opérations de stockage et banque refusées
    client_driver = _client_for(delivery_driver)
    assert (
        client_driver.post(
            "/api/v1/inventory/storage-locations/",
            {"name": "Hangar Illégal", "is_active": True},
            format="json",
        ).status_code
        == 403
    )
    assert client_driver.get("/api/v1/finance/banks/").status_code == 403


# -----------------------------------------------------------------------------
# 4. Révocation en Base de Données, Sécurité Persistante & Changement de Compte
# -----------------------------------------------------------------------------


def test_recette_user_deactivation_role_revocation_and_account_switching():
    """Vérifie :

    - Qu'un utilisateur désactivé en base (is_active=False) est immédiatement rejeté (401/403).
    - Que le retrait du rôle en base (UserRoleAssignment supprimé) révoque immédiatement les droits.
    - Que l'authentification avec un autre compte habilité rétablit l'accès sans effet de bord.
    """
    accountant = _create_user_with_role("recette_acct_revocation", "accountant")
    client = _client_for(accountant)

    # 1. Accès bancaire initialement valide
    assert client.get("/api/v1/finance/banks/").status_code == 200

    # 2. Révocation : Désactivation du compte en base de données
    accountant.is_active = False
    accountant.save(update_fields=["is_active"])

    # Le même client réinterroge l'API : rejet immédiat car l'authentification/session
    # vérifie is_active
    resp_inactive = client.get("/api/v1/finance/banks/")
    assert resp_inactive.status_code in (401, 403)

    # 3. Réactivation du compte mais suppression de l'assignation de rôle en base
    accountant.is_active = True
    accountant.save(update_fields=["is_active"])
    UserRoleAssignment.objects.filter(user=accountant).delete()

    # Le compte est actif mais n'a plus de rôle financier : 403
    resp_no_role = client.get("/api/v1/finance/banks/")
    assert resp_no_role.status_code == 403

    # 4. Changement de compte : connexion d'un commercial habilité
    commercial = _create_user_with_role("recette_comm_switch", "reservation_sensitive_operator")
    client.force_authenticate(user=commercial)

    resp_switched = client.get("/api/v1/finance/banks/")
    assert resp_switched.status_code == 200


def test_recette_real_session_lifecycle_suspension_revocation_and_switching():
    """Vérification ciblée avec authentification réelle par session HTTP (cookies, CSRF) :

    1. Connexion réelle via POST /api/v1/auth/login/ (obtention sessionid + rotation CSRF).
    2. Requête API bancaire autorisée via session HTTP réelle (cookies de session).
    3. Suspension du compte (is_active=False) en base -> rejet immédiat (401/403).
    4. Réactivation mais révocation du rôle en base -> rejet immédiat (403).
    5. Déconnexion réelle via POST /api/v1/auth/logout/ (invalidation de la session).
    6. Reconnexion avec un compte commercial réel -> la requête suivante est autorisée.
    """
    accountant = _create_user_with_role("recette_session_acct", "accountant")
    _create_user_with_role("recette_session_comm", "reservation_sensitive_operator")

    client = Client(enforce_csrf_checks=True)

    # 1. Bootstrap session anonyme et obtention cookie CSRF
    resp_init = client.get("/api/v1/auth/session/")
    assert resp_init.status_code == 200
    assert resp_init.json()["authenticated"] is False
    csrf_token = client.cookies["csrftoken"].value

    # 2. Connexion réelle via POST /api/v1/auth/login/
    login_resp = client.post(
        "/api/v1/auth/login/",
        data=json.dumps({"username": "recette_session_acct", "password": "test-password-123"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["authenticated"] is True
    assert login_resp.json()["user"]["capabilities"]["canManageFinance"] is True
    assert "sessionid" in client.cookies
    csrf_token = client.cookies["csrftoken"].value

    # 3. Requête API bancaire autorisée via la session HTTP réelle
    bank_resp = client.get("/api/v1/finance/banks/")
    assert bank_resp.status_code == 200

    # 4. Suspension du compte en base (is_active=False)
    accountant.is_active = False
    accountant.save(update_fields=["is_active"])

    # La requête suivante avec le même cookie de session est immédiatement refusée
    bank_resp_suspended = client.get("/api/v1/finance/banks/")
    assert bank_resp_suspended.status_code in (401, 403)

    # 5. Réactivation mais révocation du rôle en base de données
    accountant.is_active = True
    accountant.save(update_fields=["is_active"])
    UserRoleAssignment.objects.filter(user=accountant).delete()

    # Le compte est réactivé mais sans rôle : refus 403 immédiat
    bank_resp_revoked = client.get("/api/v1/finance/banks/")
    assert bank_resp_revoked.status_code == 403

    # 6. Déconnexion réelle via POST /api/v1/auth/logout/
    logout_resp = client.post(
        "/api/v1/auth/logout/",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert logout_resp.status_code == 204
    # Après déconnexion, la requête bancaire est non authentifiée (401/403)
    assert client.get("/api/v1/finance/banks/").status_code in (401, 403)

    # 7. Connexion avec un autre compte (Commercial)
    csrf_token = client.cookies["csrftoken"].value
    login_comm_resp = client.post(
        "/api/v1/auth/login/",
        data=json.dumps({"username": "recette_session_comm", "password": "test-password-123"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert login_comm_resp.status_code == 200
    assert login_comm_resp.json()["authenticated"] is True
    assert login_comm_resp.json()["user"]["capabilities"]["canSensitiveWrite"] is True

    # Le compte commercial accède aux banques via sa nouvelle session
    bank_resp_comm = client.get("/api/v1/finance/banks/")
    assert bank_resp_comm.status_code == 200
