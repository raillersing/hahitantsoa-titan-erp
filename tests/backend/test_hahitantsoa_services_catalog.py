from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.hahitantsoa.models import (
    HahitantsoaCommercialTerms,
    HahitantsoaService,
    HahitantsoaServiceCategory,
    HahitantsoaServicePricingType,
)

User = get_user_model()


class AuthenticatedUser:
    is_authenticated = True
    is_active = True
    pk = 1
    id = 1


@pytest.fixture
def auth_client():
    client = APIClient()
    client.force_authenticate(user=AuthenticatedUser())
    return client


@pytest.fixture
def staff_client(db):
    user = User.objects.create_user(username="staff_catalog", password="p", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_hahitantsoa_services_official_2026_seeded() -> None:
    # Verify that all 27 official 2026 services are available in the database
    services = HahitantsoaService.objects.filter(active=True)
    assert services.count() >= 27

    # 1. Drapery
    drapery_services = services.filter(category=HahitantsoaServiceCategory.DRAPERY)
    assert drapery_services.count() == 6
    names = {s.name for s in drapery_services}
    assert "Voilage centré" in names
    assert "Voilage cascade" in names
    assert "Voile d’ombrage" in names
    voilage_centre = drapery_services.get(name="Voilage centré")
    assert voilage_centre.price == Decimal("1250000.00")
    assert voilage_centre.pricing_type == HahitantsoaServicePricingType.FLAT_FEE

    # 2. Starry sky
    starry_services = services.filter(category=HahitantsoaServiceCategory.STARRY_SKY)
    assert starry_services.count() == 11
    guinguette_lin = starry_services.get(name="Guinguette linéaire")
    assert guinguette_lin.price == Decimal("100000.00")
    assert guinguette_lin.pricing_type == HahitantsoaServicePricingType.PER_LINE
    assert guinguette_lin.unit_label == "ligne"

    # 3. Scenography
    sceno_services = services.filter(category=HahitantsoaServiceCategory.SCENOGRAPHY)
    assert sceno_services.count() == 1
    piste_led = sceno_services.get(name="Piste lumineuse LED")
    assert piste_led.price == Decimal("1500000.00")

    # 4. Special effects
    fx_services = services.filter(category=HahitantsoaServiceCategory.SPECIAL_EFFECTS)
    assert fx_services.count() == 3
    pack_fx = fx_services.get(name="Pack Effets spéciaux standard")
    assert pack_fx.price == Decimal("700000.00")

    # 5. Technical facility
    tech_services = services.filter(category=HahitantsoaServiceCategory.TECHNICAL_FACILITY)
    assert tech_services.count() == 6
    groupe = tech_services.get(name="Groupe électrogène 30 kVA")
    assert groupe.price == Decimal("100000.00")


@pytest.mark.django_db
def test_hahitantsoa_services_api_filtering_by_category(auth_client) -> None:
    # 1. Filter drapery
    res_drapery = auth_client.get("/api/v1/hahitantsoa/services/?category=drapery")
    assert res_drapery.status_code == 200
    data_drapery = res_drapery.json()
    assert len(data_drapery) == 6
    for item in data_drapery:
        assert item["category"] == "drapery"
        assert item["category_display"] == "Draperie & Voilage"
        assert "pricing_type_display" in item

    # 2. Filter starry sky
    res_starry = auth_client.get("/api/v1/hahitantsoa/services/?category=starry_sky")
    assert res_starry.status_code == 200
    data_starry = res_starry.json()
    assert len(data_starry) == 11
    for item in data_starry:
        assert item["category"] == "starry_sky"
        assert item["category_display"] == "Ciel étoilé"


@pytest.mark.django_db
def test_hahitantsoa_commercial_terms_extended_fields(auth_client) -> None:
    terms, _ = HahitantsoaCommercialTerms.objects.get_or_create(key="default")
    assert terms.night_option_1_amount == Decimal("300000.00")
    assert terms.night_option_2_amount == Decimal("500000.00")
    assert terms.night_security_amount == Decimal("120000.00")
    assert terms.caution_amount == Decimal("500000.00")

    # Verify API serialization
    response = auth_client.get("/api/v1/hahitantsoa/commercial-terms/")
    assert response.status_code == 200
    payload = response.json()
    assert Decimal(str(payload["night_option_1_amount"])) == Decimal("300000.00")
    assert Decimal(str(payload["night_option_2_amount"])) == Decimal("500000.00")
    assert Decimal(str(payload["night_security_amount"])) == Decimal("120000.00")
    assert Decimal(str(payload["caution_amount"])) == Decimal("500000.00")


@pytest.mark.django_db
def test_hahitantsoa_service_accepts_data_url_image(staff_client) -> None:
    # A base64 data URL generated from a local file exceeds 512 characters
    data_url = "data:image/jpeg;base64," + ("A" * 2000)
    payload = {
        "name": "Service avec photo locale",
        "category": "drapery",
        "pricing_type": "flat_fee",
        "price": "850000.00",
        "image_url": data_url,
        "features": ["Test photo locale", "HD"],
    }
    response = staff_client.post("/api/v1/hahitantsoa/services/", payload, format="json")
    assert response.status_code == 201
    created_id = response.json()["id"]

    # Verify retrieval
    srv = HahitantsoaService.objects.get(id=created_id)
    assert srv.image_url == data_url
