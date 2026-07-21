"""
seed_complete_demo.py — Peuple la base avec des données complètes pour tester tout le workflow.

Inclut :
- Clients + prospects
- Inventaire (matériels, articles)
- Templates de documents (proforma, contrat, facture)


- Événements Hahitantsoa (avec proforma → contrat)
- Locations Titan (avec proforma → contrat)
- Facturation + paiements
- Logistique (sorties + retours)
- Caisse (sessions + mouvements)

Usage:
  docker compose exec backend python manage.py seed_complete_demo
  python manage.py seed_complete_demo  (si DEBUG=True)
"""

from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from datetime import timedelta


class Command(BaseCommand):
    help = "Seed complète : clients, inventaire, documents, réservations, facturation, logistique, caisse."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            self.stdout.write(self.style.WARNING("Refusé : DEBUG=False."))
            return

        User = get_user_model()
        now = timezone.now()

        # ── 1. Utilisateurs ──────────────────────────────────────────────
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={"is_staff": True, "is_superuser": True, "first_name": "Admin", "last_name": "ERP"},
        )
        admin.set_password("admin")
        admin.save()

        gérant, _ = User.objects.get_or_create(
            username="gerant",
            defaults={"is_staff": True, "first_name": "Jean", "last_name": "Rasoa"},
        )
        gérant.set_password("gerant123")
        gérant.save()

        accueil, _ = User.objects.get_or_create(
            username="accueil",
            defaults={"is_staff": True, "first_name": "Léa", "last_name": "Rasoamanana"},
        )
        accueil.set_password("accueil123")
        accueil.save()

        self.stdout.write(self.style.SUCCESS("✓ 3 utilisateurs créés"))

        # ── 2. Clients & prospects ────────────────────────────────────────
        from apps.customers.models import Customer

        clients_data = [
            {"display_name": "Rakoto Ando", "lifecycle_status": "client", "party_type": "individual",
             "email": "ando.rakoto@email.mg", "phone": "+261 34 12 345 67", "address": "Lot 12B, Analakely"},
            {"display_name": "Rasoa Nomena", "lifecycle_status": "client", "party_type": "company",
             "email": "rasoa.nomena@entreprise.mg", "phone": "+261 33 98 765 43", "address": "Zone industrielle, Andohatopena"},
            {"display_name": "Société TechMada", "lifecycle_status": "client", "party_type": "company",
             "email": "contact@techmada.mg", "phone": "+261 20 22 334 45", "address": "Antananarivo 101"},
            {"display_name": "Mme Rasoanirina", "lifecycle_status": "client", "party_type": "individual",
             "email": "rasoanirina@gmail.com", "phone": "+261 34 55 667 78", "address": "Antsirabe"},
            {"display_name": "SARL Moraingy Events", "lifecycle_status": "client", "party_type": "company",
             "email": "contact@moraingy.mg", "phone": "+261 32 11 223 34", "address": "Toamasina"},
            {"display_name": "Rakotomalala Fidy", "lifecycle_status": "prospect", "party_type": "individual",
             "email": "fidy.rakotomalala@email.mg", "phone": "+261 34 77 889 90", "address": "Fianarantsoa"},
            {"display_name": "ETS Ravinala", "lifecycle_status": "prospect", "party_type": "company",
             "email": "info@ravinala.mg", "phone": "+261 20 44 556 67", "address": "Mahajanga"},
        ]

        customers = {}
        for cd in clients_data:
            c, _ = Customer.objects.update_or_create(
                display_name=cd["display_name"],
                defaults=cd,
            )
            customers[cd["display_name"]] = c

        self.stdout.write(self.style.SUCCESS(f"✓ {len(clients_data)} clients/prospects créés"))

        # ── 3. Inventaire ────────────────────────────────────────────────
        from apps.inventory.models import InventoryItem

        items_data = [
            ("Chaise Napoléon transparente", "material", "Chaise pliable transparente pour événements"),
            ("Table rectangulaire 8 places", "material", "Table rectangulaire blanche 180cm"),
            ("Tente 5x5m", "material", "Tente structurée blanche 25m²"),
            ("Sono complète + Micro", "material", "Système sonore 2000W avec 2 micros"),
            ("Chaise chiavari dorée", "material", "Chaise élégante dorée pour mariages"),
            ("Lumières d'ambiance LED", "material", "Pack 10 spots LED RGB"),
            ("Nappe blanche 3m", "article", "Nappe blanche satinée 300x300cm"),
            ("Couvert argenté", "article", "Couvert en métal argenté"),
            ("Serviette blanche", "article", "Serviette blanche en tissu 50x50cm"),
            ("Badge intervenant", "article", "Badge plastifié avec lanyard"),
        ]

        items = {}
        for name, kind, desc in items_data:
            item, _ = InventoryItem.objects.update_or_create(
                name=name,
                defaults={"kind": kind, "description": desc},
            )
            items[name] = item

        self.stdout.write(self.style.SUCCESS(f"✓ {len(items_data)} articles inventaire créés"))

        # ── 4. Templates de documents ─────────────────────────────────────
        from apps.documents.models import DocumentTemplate, DocumentTemplateVersion

        templates_data = [
            ("PROFORMA-HAH", "Proforma Hahitantsoa", "hahitantsoa", "proforma"),
            ("PROFORMA-TITAN", "Proforma Titan", "titan", "proforma"),
            ("CONTRAT-HAH", "Contrat Hahitantsoa", "hahitantsoa", "contrat"),
            ("CONTRAT-TITAN", "Contrat Titan", "titan", "contrat"),
            ("FACTURE-HAH", "Facture Hahitantsoa", "hahitantsoa", "facture"),
            ("FACTURE-TITAN", "Facture Titan", "titan", "facture"),
            ("RECU-PAIEMENT", "Reçu de paiement", "shared", "recu"),
        ]

        templates = {}
        for code, name, scope, doc_type in templates_data:
            tmpl, _ = DocumentTemplate.objects.update_or_create(
                code=code,
                defaults={"name": name, "business_scope": scope, "document_type": doc_type, "status": "active"},
            )
            DocumentTemplateVersion.objects.get_or_create(
                template=tmpl,
                version="1.0",
                defaults={"status": "active", "body_html": f"<h1>{name}</h1><p>Contenu du template {name}</p>"},
            )
            templates[code] = tmpl

        self.stdout.write(self.style.SUCCESS(f"✓ {len(templates_data)} templates documents créés"))

        # ── 5. Événements Hahitantsoa ─────────────────────────────────────
        from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
        from apps.hahitantsoa.models import HahitantsoaVenue, HahitantsoaService

        # Venues
        venues_data = [
            ("Domaine Ambohimanga", "Espace principal avec jardin et salle de réception"),
            ("Salon VIP", "Espace privatif pour mariés et proches"),
        ]
        venues = {}
        for name, note in venues_data:
            v, _ = HahitantsoaVenue.objects.update_or_create(name=name, defaults={"note": note, "capacity": 200, "type": "Domaine"})
            venues[name] = v

        # Services
        services_data = [
            ("Traiteur", "Service de restauration sur place"),
            ("Décoration", "Décoration florale et événementielle"),
        ]
        services = {}
        for name, desc in services_data:
            s, _ = HahitantsoaService.objects.update_or_create(name=name, defaults={"desc": desc, "price": Decimal("500000")})
            services[name] = s

        # Événements
        event1, _ = HahitantsoaEventDraft.objects.update_or_create(
            public_reference="HAH-2026-0001",
            defaults={
                "customer": customers["Rakoto Ando"],
                "status": "confirmed",
                "event_name": "Mariage Rakoto & Fidy",
                "venue_name": "Domaine Ambohimanga",
                "start_at": now + timedelta(days=14),
                "end_at": now + timedelta(days=14, hours=12),
                "notes": "Mariage Rakoto & Fidy. Confirmed with contract.",
                "contract_signed_at": now - timedelta(days=5),
                "contract_signed_by": gérant,
                "required_deposit_received_at": now - timedelta(days=3),
                "required_deposit_received_by": accueil,
            },
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event1, inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 150, "notes": "Chaises pour le mariage"},
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event1, inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 15, "notes": "Tables pour le mariage"},
        )

        event2, _ = HahitantsoaEventDraft.objects.update_or_create(
            public_reference="HAH-2026-0002",
            defaults={
                "customer": customers["Rasoa Nomena"],
                "status": "draft",
                "event_name": "Séminaire TechMada",
                "venue_name": "Salon VIP",
                "start_at": now + timedelta(days=30),
                "end_at": now + timedelta(days=30, hours=8),
                "notes": "Séminaire TechMada. En attente de confirmation.",
            },
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event2, inventory_item=items["Chaise chiavari dorée"],
            defaults={"quantity": 80, "notes": "Chaises pour le séminaire"},
        )

        self.stdout.write(self.style.SUCCESS("✓ 2 événements Hahitantsoa créés"))

        # ── 6. Locations Titan ────────────────────────────────────────────
        from apps.reservations.models import ReservationDraft, ReservationDraftLine

        # RD-001 : Prospect → proforma envoyé
        rd1, _ = ReservationDraft.objects.update_or_create(
            public_reference="LOC-2026-0001",
            defaults={
                "customer": customers["Rakotomalala Fidy"],
                "status": "draft",
                "start_at": now + timedelta(days=7),
                "end_at": now + timedelta(days=7, hours=8),
                "notes": "Prospect a demandé un proforma pour location chaises.",
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd1, inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 100},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd1, inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 10},
        )

        # RD-002 : Contrat signé, en attente acompte
        rd2, _ = ReservationDraft.objects.update_or_create(
            public_reference="LOC-2026-0002",
            defaults={
                "customer": customers["SARL Moraingy Events"],
                "status": "draft",
                "start_at": now + timedelta(days=10),
                "end_at": now + timedelta(days=10, hours=12),
                "notes": "Location materiel conference. Contrat signé.",
                "contract_signed_at": now - timedelta(days=2),
                "contract_signed_by": gérant,
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd2, inventory_item=items["Sono complète + Micro"],
            defaults={"quantity": 2},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd2, inventory_item=items["Chaise chiavari dorée"],
            defaults={"quantity": 50},
        )

        # RD-003 : Confirmé (contrat + acompte)
        rd3, _ = ReservationDraft.objects.update_or_create(
            public_reference="LOC-2026-0003",
            defaults={
                "customer": customers["Société TechMada"],
                "status": "confirmed",
                "start_at": now + timedelta(days=5),
                "end_at": now + timedelta(days=5, hours=6),
                "notes": "Location complète confirmée. Tout est en ordre.",
                "contract_signed_at": now - timedelta(days=7),
                "contract_signed_by": gérant,
                "required_deposit_received_at": now - timedelta(days=5),
                "required_deposit_received_by": accueil,
                "confirmed_at": now - timedelta(days=4),
                "confirmed_by": None,
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd3, inventory_item=items["Tente 5x5m"],
            defaults={"quantity": 2},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd3, inventory_item=items["Lumières d'ambiance LED"],
            defaults={"quantity": 4},
        )

        # RD-004 : Passé (événement terminé)
        rd4, _ = ReservationDraft.objects.update_or_create(
            public_reference="LOC-2026-0004",
            defaults={
                "customer": customers["Mme Rasoanirina"],
                "status": "confirmed",
                "start_at": now - timedelta(days=3),
                "end_at": now - timedelta(days=3, hours=-4),
                "notes": "Événement terminé. Retour en cours.",
                "contract_signed_at": now - timedelta(days=10),
                "contract_signed_by": gérant,
                "required_deposit_received_at": now - timedelta(days=8),
                "required_deposit_received_by": accueil,
                "confirmed_at": now - timedelta(days=7),
                "confirmed_by": None,
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd4, inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 200},
        )

        self.stdout.write(self.style.SUCCESS("✓ 4 locations Titan créées"))

        # ── 7. Documents (proforma, contrat, facture) ─────────────────────
        from apps.documents.models import DocumentInstance

        # Proforma pour RD-001 (prospect)
        DocumentInstance.objects.update_or_create(
            template_key="PROFORMA-TITAN",
            reservation_draft=rd1,
            defaults={
                "customer": customers["Rakotomalala Fidy"],
                "template_version": "1.0",
                "template_label": "Proforma Titan",
                "business_scope": "titan",
                "status": "issued",
                "prepared_at": now - timedelta(days=1),
            },
        )

        # Contrat pour RD-002
        DocumentInstance.objects.update_or_create(
            template_key="CONTRAT-TITAN",
            reservation_draft=rd2,
            defaults={
                "customer": customers["SARL Moraingy Events"],
                "template_version": "1.0",
                "template_label": "Contrat Titan",
                "business_scope": "titan",
                "status": "issued",
                "prepared_at": now - timedelta(days=2),
            },
        )

        # Facture pour RD-003
        doc_facture, _ = DocumentInstance.objects.update_or_create(
            template_key="FACTURE-TITAN",
            reservation_draft=rd3,
            defaults={
                "customer": customers["Société TechMada"],
                "template_version": "1.0",
                "template_label": "Facture Titan",
                "business_scope": "titan",
                "status": "issued",
                "prepared_at": now - timedelta(days=5),
            },
        )

        # Proforma Hahitantsoa pour event1
        DocumentInstance.objects.update_or_create(
            template_key="PROFORMA-HAH",
            hahitantsoa_event_draft=event1,
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Proforma Hahitantsoa",
                "business_scope": "hahitantsoa",
                "status": "issued",
                "prepared_at": now - timedelta(days=10),
            },
        )

        self.stdout.write(self.style.SUCCESS("✓ 4 documents créés (2 proformas, 1 contrat, 1 facture)"))

        # ── 8. Facturation ────────────────────────────────────────────────
        from apps.billing.models import BillingInvoice

        inv1, _ = BillingInvoice.objects.update_or_create(
            number="FAC-2026-0001",
            defaults={
                "reservation_draft": rd3,
                "source_kind": "reservation",
                "invoice_status": "open",
                "amount": Decimal("3500000"),
                "issued_at": now - timedelta(days=5),
                "notes": "Facture location Titan - Société TechMada",
            },
        )

        inv2, _ = BillingInvoice.objects.update_or_create(
            number="FAC-2026-0002",
            defaults={
                "reservation_draft": rd4,
                "source_kind": "reservation",
                "invoice_status": "open",
                "amount": Decimal("3500000"),
                "issued_at": now - timedelta(days=8),
                "notes": "Facture événement - Mariage Rakoto",
            },
        )

        self.stdout.write(self.style.SUCCESS("✓ 2 factures créées"))

        # ── 9. Paiements ─────────────────────────────────────────────────
        from apps.payments.models import Payment

        pay1, _ = Payment.objects.update_or_create(
            reservation_draft=rd3,
            payment_kind="deposit",
            defaults={
                "payment_method": "mvola",
                "payment_status": "pending",
                "amount": Decimal("1000000"),
                "paid_at": now - timedelta(days=5),
                "confirmed_at": None,
                "confirmed_by": None,
                "external_reference": "MVOLA-2026-0042",
                "source_label": "Acompte location TechMada",
            },
        )

        pay2, _ = Payment.objects.update_or_create(
            hahitantsoa_event_draft=event1,
            payment_kind="deposit",
            defaults={
                "payment_method": "virement",
                "payment_status": "pending",
                "amount": Decimal("1500000"),
                "paid_at": now - timedelta(days=3),
                "confirmed_at": None,
                "confirmed_by": None,
                "external_reference": "VIR-2026-0018",
                "source_label": "Acompte mariage Rakoto",
            },
        )

        self.stdout.write(self.style.SUCCESS("✓ 2 paiements créés"))

        # ── 10. Logistique ────────────────────────────────────────────────
        from apps.logistics.models import LogisticsEvent, LogisticsEventItemLine

        # Sortie pour RD-003
        evt1, _ = LogisticsEvent.objects.update_or_create(
            reservation_draft=rd3,
            event_type="outbound_delivery",
            defaults={
                "status": "completed",
                "scheduled_at": now + timedelta(days=4),
                "notes": "Livraison matériel TechMada",
            },
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt1, inventory_item=items["Tente 5x5m"],
            defaults={"quantity": 2},
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt1, inventory_item=items["Lumières d'ambiance LED"],
            defaults={"quantity": 4},
        )

        # Retour pour RD-004
        evt2, _ = LogisticsEvent.objects.update_or_create(
            reservation_draft=rd4,
            event_type="return",
            defaults={
                "status": "planned",
                "scheduled_at": now + timedelta(hours=2),
                "notes": "Retour matériel Rasoanirina",
            },
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt2, inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 200},
        )

        self.stdout.write(self.style.SUCCESS("✓ 2 événements logistique créés"))

        # ── 11. Caisse ───────────────────────────────────────────────────
        from apps.cashbox.models import CashboxSession, CashboxMovement

        session, _ = CashboxSession.objects.update_or_create(
            operator=gérant,
            opened_at=now.replace(hour=8, minute=0, second=0, microsecond=0),
            defaults={
                "opened_by": gérant,
                "closed_at": None,
            },
        )

        CashboxMovement.objects.get_or_create(
            session=session,
            direction="inbound",
            amount=Decimal("1000000"),
            defaults={"moved_at": now, "moved_by": gérant},
        )
        CashboxMovement.objects.get_or_create(
            session=session,
            direction="inbound",
            amount=Decimal("1500000"),
            defaults={"moved_at": now, "moved_by": gérant},
        )

        self.stdout.write(self.style.SUCCESS("✓ 1 session caisse + 2 mouvements créés"))

        # ── Résumé ────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("═" * 60))
        self.stdout.write(self.style.SUCCESS("SEED COMPLET TERMINÉ"))
        self.stdout.write(self.style.SUCCESS("═" * 60))
        self.stdout.write(f"  Utilisateurs  : admin/admin, gerant/gerant123, accueil/accueil123")
        self.stdout.write(f"  Clients       : {Customer.objects.count()}")
        self.stdout.write(f"  Inventaire    : {InventoryItem.objects.count()} articles")
        self.stdout.write(f"  Templates     : {DocumentTemplate.objects.count()} templates")
        self.stdout.write(f"  Événements HAH: {HahitantsoaEventDraft.objects.count()}")
        self.stdout.write(f"  Locations TITAN: {ReservationDraft.objects.count()}")
        self.stdout.write(f"  Documents     : {DocumentInstance.objects.count()}")
        self.stdout.write(f"  Factures      : {BillingInvoice.objects.count()}")
        self.stdout.write(f"  Paiements     : {Payment.objects.count()}")
        self.stdout.write(f"  Logistique    : {LogisticsEvent.objects.count()} événements")
        self.stdout.write(f"  Caisse        : {CashboxSession.objects.count()} sessions")
        self.stdout.write(self.style.SUCCESS("═" * 60))
