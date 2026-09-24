from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import Payment, PaymentStatus
from apps.reservations.models import ReservationDraft


@override_settings(DEBUG=True)
class SeedCompleteDemoTests(TestCase):
    def test_seed_complete_demo_creates_realistic_confirmed_lifecycle_and_receipts(self) -> None:
        out = StringIO()
        call_command("seed_complete_demo", stdout=out)

        # 1. Hahitantsoa event1 is confirmed with explicit confirmed_at and confirmed_by
        event1 = HahitantsoaEventDraft.objects.get(public_reference="HAH-2026-0001")
        self.assertEqual(event1.status, "confirmed")
        self.assertIsNotNone(event1.confirmed_at)
        self.assertIsNotNone(event1.confirmed_by)
        self.assertEqual(event1.confirmed_by.username, "gerant")

        # 2. Titan rd3 and rd4 are confirmed with explicit confirmed_at and confirmed_by
        rd3 = ReservationDraft.objects.get(public_reference="LOC-2026-0003")
        self.assertEqual(rd3.status, "confirmed")
        self.assertIsNotNone(rd3.confirmed_at)
        self.assertIsNotNone(rd3.confirmed_by)
        self.assertEqual(rd3.confirmed_by.username, "gerant")

        rd4 = ReservationDraft.objects.get(public_reference="LOC-2026-0004")
        self.assertEqual(rd4.status, "confirmed")
        self.assertIsNotNone(rd4.confirmed_at)
        self.assertIsNotNone(rd4.confirmed_by)
        self.assertEqual(rd4.confirmed_by.username, "gerant")
        self.assertGreater(rd4.end_at, rd4.start_at)

        # 3. Payments pay1 and pay2 are confirmed, attributed, and linked to receipts
        pay1 = Payment.objects.get(reservation_draft=rd3, payment_kind="deposit")
        self.assertEqual(pay1.payment_status, PaymentStatus.CONFIRMED)
        self.assertIsNotNone(pay1.paid_at)
        self.assertIsNotNone(pay1.confirmed_at)
        self.assertIsNotNone(pay1.confirmed_by)
        self.assertEqual(pay1.confirmed_by.username, "gerant")
        self.assertIsNotNone(pay1.receipt_document)
        self.assertEqual(pay1.receipt_document.status, DocumentInstanceStatus.GENERATED)

        pay2 = Payment.objects.get(hahitantsoa_event_draft=event1, payment_kind="deposit")
        self.assertEqual(pay2.payment_status, PaymentStatus.CONFIRMED)
        self.assertIsNotNone(pay2.paid_at)
        self.assertIsNotNone(pay2.confirmed_at)
        self.assertIsNotNone(pay2.confirmed_by)
        self.assertEqual(pay2.confirmed_by.username, "gerant")
        self.assertIsNotNone(pay2.receipt_document)
        self.assertEqual(pay2.receipt_document.status, DocumentInstanceStatus.GENERATED)

        # 4. Receipts exist in DocumentInstance with valid scope and status
        rec_rd3 = DocumentInstance.objects.get(template_key="RECU-PAIEMENT", reservation_draft=rd3)
        self.assertEqual(rec_rd3.status, DocumentInstanceStatus.GENERATED)
        self.assertEqual(rec_rd3.business_scope, "titan")

        rec_event1 = DocumentInstance.objects.get(
            template_key="RECU-PAIEMENT",
            hahitantsoa_event_draft=event1,
        )
        self.assertEqual(rec_event1.status, DocumentInstanceStatus.GENERATED)
        self.assertEqual(rec_event1.business_scope, "hahitantsoa")

        # 5. Idempotent re-run succeeds without violation
        out_rerun = StringIO()
        call_command("seed_complete_demo", stdout=out_rerun)
        self.assertIn("SEED COMPLET TERMINÉ", out_rerun.getvalue())
