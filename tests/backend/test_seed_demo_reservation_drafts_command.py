import pytest
from django.core.management import call_command

from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def test_seed_demo_reservation_drafts_refuses_when_debug_false(settings, capsys) -> None:
    settings.DEBUG = False

    call_command("seed_demo_reservation_drafts")

    assert ReservationDraft.objects.exists() is False
    assert (
        "Refusing to seed demo reservation drafts when DEBUG is False." in capsys.readouterr().out
    )


def test_seed_demo_reservation_drafts_creates_demo_draft(settings) -> None:
    settings.DEBUG = True

    call_command("seed_demo_reservation_drafts")

    draft = ReservationDraft.objects.get(public_reference="RD-DEMO-TITAN-001")
    assert draft.customer.display_name == "Client demo Titan"
    assert draft.lines.count() >= 1


def test_seed_demo_reservation_drafts_is_idempotent(settings) -> None:
    settings.DEBUG = True

    call_command("seed_demo_reservation_drafts")
    call_command("seed_demo_reservation_drafts")

    assert ReservationDraft.objects.filter(public_reference="RD-DEMO-TITAN-001").count() == 1
    assert ReservationDraftLine.objects.count() >= 1
