import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.finance.models import FinanceAccount, FinanceAccountKind, FinanceBankProfile

pytestmark = pytest.mark.django_db


def authenticated_client() -> APIClient:
    user = get_user_model().objects.create_superuser(
        username="bank-api-manager",
        password="unused-test-password",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_create_bank_profile_and_account_atomically() -> None:
    client = authenticated_client()

    response = client.post(
        reverse("finance-bank-list"),
        {
            "business_scope": "titan",
            "account_code": "BANK-TITAN-01",
            "account_label": "Compte bancaire Titan principal",
            "bank_name": "Banque Exemple",
            "branch": "Antananarivo",
            "account_holder": "Titan",
            "rib": "RIB-001",
            "is_default_for_documents": True,
        },
        format="json",
    )

    assert response.status_code == 201
    account = FinanceAccount.objects.get(code="BANK-TITAN-01")
    assert account.kind == FinanceAccountKind.BANK
    assert account.business_scope == "titan"
    profile = FinanceBankProfile.objects.get(account=account)
    assert profile.is_default_for_documents
    assert response.data["account_id"] == str(account.id)


def test_create_bank_profile_rejects_incomplete_or_ambiguous_payload() -> None:
    client = authenticated_client()

    incomplete = client.post(
        reverse("finance-bank-list"),
        {
            "bank_name": "Banque Exemple",
            "account_holder": "Titan",
            "rib": "RIB-001",
        },
        format="json",
    )
    assert incomplete.status_code == 400
    assert FinanceAccount.objects.count() == 0

    missing_identifier = client.post(
        reverse("finance-bank-list"),
        {
            "business_scope": "titan",
            "account_code": "BANK-TITAN-01",
            "account_label": "Compte bancaire Titan",
            "bank_name": "Banque Exemple",
            "account_holder": "Titan",
        },
        format="json",
    )
    assert missing_identifier.status_code == 400
    assert FinanceAccount.objects.count() == 0


def test_bank_list_can_be_filtered_by_business_scope() -> None:
    client = authenticated_client()
    for scope in ("titan", "hahitantsoa"):
        response = client.post(
            reverse("finance-bank-list"),
            {
                "business_scope": scope,
                "account_code": f"BANK-{scope.upper()}",
                "account_label": f"Compte {scope}",
                "bank_name": f"Banque {scope}",
                "account_holder": scope.title(),
                "rib": f"RIB-{scope}",
            },
            format="json",
        )
        assert response.status_code == 201

    response = client.get(reverse("finance-bank-list"), {"business_scope": "titan"})

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["business_scope"] == "titan"


def test_bank_api_returns_validation_errors_instead_of_server_errors() -> None:
    client = authenticated_client()
    payload = {
        "business_scope": "titan",
        "account_code": "BANK-TITAN-01",
        "account_label": "Compte Titan",
        "bank_name": "Banque Titan",
        "account_holder": "Titan",
        "rib": "RIB-001",
    }
    assert client.post(reverse("finance-bank-list"), payload, format="json").status_code == 201

    duplicate = client.post(reverse("finance-bank-list"), payload, format="json")

    assert duplicate.status_code == 400
