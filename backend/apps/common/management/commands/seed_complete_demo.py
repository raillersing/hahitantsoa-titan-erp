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

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = (
        "Seed complète : clients, inventaire, documents, "
        "réservations, facturation, logistique, caisse."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            self.stdout.write(self.style.WARNING("Refusé : DEBUG=False."))
            return

        User = get_user_model()
        now = timezone.now()

        # ── 1. Utilisateurs ──────────────────────────────────────────────
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "is_staff": True,
                "is_superuser": True,
                "first_name": "Admin",
                "last_name": "ERP",
            },
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
            {
                "display_name": "Rakoto Ando",
                "lifecycle_status": "client",
                "party_type": "individual",
                "email": "ando.rakoto@email.mg",
                "phone": "+261 34 12 345 67",
                "address": "Lot 12B, Analakely",
            },
            {
                "display_name": "Rasoa Nomena",
                "lifecycle_status": "client",
                "party_type": "company",
                "email": "rasoa.nomena@entreprise.mg",
                "phone": "+261 33 98 765 43",
                "address": "Zone industrielle, Andohatopena",
            },
            {
                "display_name": "Société TechMada",
                "lifecycle_status": "client",
                "party_type": "company",
                "email": "contact@techmada.mg",
                "phone": "+261 20 22 334 45",
                "address": "Antananarivo 101",
            },
            {
                "display_name": "Mme Rasoanirina",
                "lifecycle_status": "client",
                "party_type": "individual",
                "email": "rasoanirina@gmail.com",
                "phone": "+261 34 55 667 78",
                "address": "Antsirabe",
            },
            {
                "display_name": "SARL Moraingy Events",
                "lifecycle_status": "client",
                "party_type": "company",
                "email": "contact@moraingy.mg",
                "phone": "+261 32 11 223 34",
                "address": "Toamasina",
            },
            {
                "display_name": "Rakotomalala Fidy",
                "lifecycle_status": "prospect",
                "prospect_status": "proforma_sent",
                "party_type": "individual",
                "email": "fidy.rakotomalala@email.mg",
                "phone": "+261 34 77 889 90",
                "address": "Fianarantsoa",
            },
            {
                "display_name": "ETS Ravinala",
                "lifecycle_status": "prospect",
                "party_type": "company",
                "email": "info@ravinala.mg",
                "phone": "+261 20 44 556 67",
                "address": "Mahajanga",
            },
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
            (
                "Chaise Napoléon transparente",
                "material",
                "Chaise pliable transparente pour événements",
                Decimal("5000"),
                Decimal("35000"),
            ),
            (
                "Table rectangulaire 8 places",
                "material",
                "Table rectangulaire blanche 180cm",
                Decimal("25000"),
                Decimal("85000"),
            ),
            (
                "Tente 5x5m",
                "material",
                "Tente structurée blanche 25m²",
                Decimal("150000"),
                Decimal("600000"),
            ),
            (
                "Sono complète + Micro",
                "material",
                "Système sonore 2000W avec 2 micros",
                Decimal("200000"),
                Decimal("1200000"),
            ),
            (
                "Chaise chiavari dorée",
                "material",
                "Chaise élégante dorée pour mariages",
                Decimal("6000"),
                Decimal("40000"),
            ),
            (
                "Lumières d'ambiance LED",
                "material",
                "Pack 10 spots LED RGB",
                Decimal("50000"),
                Decimal("250000"),
            ),
            (
                "Nappe blanche 3m",
                "article",
                "Nappe blanche satinée 300x300cm",
                Decimal("10000"),
                Decimal("45000"),
            ),
            (
                "Couvert argenté",
                "article",
                "Couvert en métal argenté",
                Decimal("1500"),
                Decimal("8000"),
            ),
            (
                "Serviette blanche",
                "article",
                "Serviette blanche en tissu 50x50cm",
                Decimal("800"),
                Decimal("5000"),
            ),
            (
                "Badge intervenant",
                "article",
                "Badge plastifié avec lanyard",
                Decimal("2000"),
                Decimal("5000"),
            ),
        ]

        items = {}
        for name, kind, desc, rental_p, breakage_p in items_data:
            item, _ = InventoryItem.objects.update_or_create(
                name=name,
                defaults={
                    "kind": kind,
                    "description": desc,
                    "rental_price": rental_p,
                    "breakage_price": breakage_p,
                },
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
                defaults={
                    "name": name,
                    "business_scope": scope,
                    "document_type": doc_type,
                    "status": "active",
                },
            )
            DocumentTemplateVersion.objects.get_or_create(
                template=tmpl,
                version="1.0",
                defaults={
                    "status": "active",
                    "body_html": f"<h1>{name}</h1><p>Contenu du template {name}</p>",
                },
            )
            templates[code] = tmpl

        self.stdout.write(self.style.SUCCESS(f"✓ {len(templates_data)} templates documents créés"))

        # ── 5. Événements Hahitantsoa ─────────────────────────────────────
        from apps.hahitantsoa.models import (
            HahitantsoaEventDraft,
            HahitantsoaEventDraftLine,
            HahitantsoaService,
            HahitantsoaVenue,
        )

        # Cleanup non-canonical legacy demo drafts if any
        HahitantsoaEventDraft.objects.filter(
            public_reference__in=["HAH-2026-0001", "HAH-2026-0002"]
        ).delete()

        # Venues
        venues_data = [
            ("Domaine Ambohimanga", "Espace principal avec jardin et salle de réception"),
            ("Salon VIP", "Espace privatif pour mariés et proches"),
        ]
        venues = {}
        for name, note in venues_data:
            v, _ = HahitantsoaVenue.objects.update_or_create(
                name=name, defaults={"note": note, "capacity": 200, "type": "Domaine"}
            )
            venues[name] = v

        # Services
        HahitantsoaService.objects.filter(name__icontains="traiteur").delete()
        HahitantsoaService.objects.filter(name__icontains="restauration").delete()
        services_data = [
            ("Scénographie & Lumière", "Mise en lumière architecturale et ambiance tamisée"),
            ("Décoration", "Décoration florale et événementielle"),
        ]
        services = {}
        for name, desc in services_data:
            s, _ = HahitantsoaService.objects.update_or_create(
                name=name, defaults={"desc": desc, "price": Decimal("500000")}
            )
            services[name] = s

        # Événements
        event1, _ = HahitantsoaEventDraft.objects.update_or_create(
            public_reference="H-001/2026",
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
                "confirmed_at": now - timedelta(days=3),
                "confirmed_by": gérant,
            },
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event1,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 150, "notes": "Chaises pour le mariage"},
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event1,
            inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 15, "notes": "Tables pour le mariage"},
        )

        event2, _ = HahitantsoaEventDraft.objects.update_or_create(
            public_reference="H-002/2026",
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
            event_draft=event2,
            inventory_item=items["Chaise chiavari dorée"],
            defaults={"quantity": 80, "notes": "Chaises pour le séminaire"},
        )
        HahitantsoaEventDraftLine.objects.get_or_create(
            event_draft=event2,
            inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 10, "notes": "Tables rectangulaires de conférence"},
        )

        self.stdout.write(self.style.SUCCESS("✓ 2 événements Hahitantsoa créés"))

        # ── 6. Locations Titan ────────────────────────────────────────────
        from apps.reservations.models import ReservationDraft, ReservationDraftLine

        # Cleanup non-canonical legacy demo drafts if any
        ReservationDraft.objects.filter(
            public_reference__in=[
                "LOC-2026-0001",
                "LOC-2026-0002",
                "LOC-2026-0003",
                "LOC-2026-0004",
            ]
        ).delete()

        # RD-001 : Prospect → proforma envoyé
        rd1, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-001/2026",
            defaults={
                "customer": customers["Rakotomalala Fidy"],
                "status": "draft",
                "start_at": now + timedelta(days=7),
                "end_at": now + timedelta(days=7, hours=8),
                "notes": "Prospect a demandé un proforma pour location chaises.",
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd1,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 100},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd1,
            inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 10},
        )

        # RD-002 : Contrat signé, en attente acompte
        rd2, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-002/2026",
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
            reservation_draft=rd2,
            inventory_item=items["Sono complète + Micro"],
            defaults={"quantity": 2},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd2,
            inventory_item=items["Chaise chiavari dorée"],
            defaults={"quantity": 50},
        )

        # RD-003 : Confirmé (contrat + acompte)
        rd3, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-003/2026",
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
                "confirmed_by": gérant,
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd3,
            inventory_item=items["Tente 5x5m"],
            defaults={"quantity": 2},
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd3,
            inventory_item=items["Lumières d'ambiance LED"],
            defaults={"quantity": 4},
        )

        # RD-004 : Passé (événement terminé)
        rd4, _ = ReservationDraft.objects.update_or_create(
            public_reference="T-004/2026",
            defaults={
                "customer": customers["Mme Rasoanirina"],
                "status": "confirmed",
                "start_at": now - timedelta(days=3),
                "end_at": now - timedelta(days=2, hours=20),
                "notes": "Événement terminé. Retour en cours.",
                "contract_signed_at": now - timedelta(days=10),
                "contract_signed_by": gérant,
                "required_deposit_received_at": now - timedelta(days=8),
                "required_deposit_received_by": accueil,
                "confirmed_at": now - timedelta(days=7),
                "confirmed_by": gérant,
            },
        )
        ReservationDraftLine.objects.get_or_create(
            reservation_draft=rd4,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 200},
        )

        self.stdout.write(self.style.SUCCESS("✓ 4 locations Titan créées"))

        # ── 7. Documents (proforma, contrat, facture) ─────────────────────
        from apps.documents.models import DocumentInstance

        # Cleanup non-canonical legacy demo documents if any
        DocumentInstance.objects.filter(
            document_reference__in=[
                "HAH-2026-0002-PF",
                "BL-HAH-2026-0001",
                "REC-DEP-HAH-0001",
                "REC-CAUT-HAH-0001",
                "LOC-2026-0001-PF",
                "BL-TIT-2026-0004",
                "REC-CAUT-LOC-0004",
            ]
        ).delete()

        # Proforma pour RD-001 (prospect - v1 initiale)
        DocumentInstance.objects.update_or_create(
            template_key="titan.proforma.v1",
            reservation_draft=rd1,
            template_version="1.0",
            defaults={
                "customer": customers["Rakotomalala Fidy"],
                "template_label": "Proforma Titan (v1)",
                "business_scope": "titan",
                "document_type": "proforma",
                "document_reference": "T-001/2026-PF",
                "status": "issued",
                "prepared_at": now - timedelta(days=6),
                "valid_until": now + timedelta(days=24),
                "template_notes": "Devis initial prospect chaises Napoléon",
            },
        )
        # Proforma pour RD-001 (prospect - v2 révisée pour test Lot 6)
        DocumentInstance.objects.update_or_create(
            template_key="titan.proforma.v1",
            reservation_draft=rd1,
            template_version="2.0",
            defaults={
                "customer": customers["Rakotomalala Fidy"],
                "template_label": "Proforma Titan (v2 - Révisé)",
                "business_scope": "titan",
                "document_type": "proforma",
                "document_reference": "T-001/2026-PF",
                "status": "issued",
                "prepared_at": now - timedelta(days=1),
                "valid_until": now + timedelta(days=29),
                "template_notes": "Révision quantité chaises et tables",
            },
        )

        # Contrat pour RD-002
        DocumentInstance.objects.update_or_create(
            template_key="titan.material_contract.v1",
            reservation_draft=rd2,
            defaults={
                "customer": customers["SARL Moraingy Events"],
                "template_version": "1.0",
                "template_label": "Contrat Titan",
                "business_scope": "titan",
                "document_type": "contract",
                "document_reference": "T-002/2026-CT",
                "status": "issued",
                "prepared_at": now - timedelta(days=2),
            },
        )

        # Contrat pour RD-003
        DocumentInstance.objects.update_or_create(
            template_key="titan.material_contract.v1",
            reservation_draft=rd3,
            defaults={
                "customer": customers["Société TechMada"],
                "template_version": "1.0",
                "template_label": "Contrat Titan",
                "business_scope": "titan",
                "document_type": "contract",
                "document_reference": "T-003/2026-CT",
                "status": "issued",
                "prepared_at": now - timedelta(days=7),
            },
        )

        # Facture pour RD-003
        doc_facture, _ = DocumentInstance.objects.update_or_create(
            template_key="titan.invoice.v1",
            reservation_draft=rd3,
            defaults={
                "customer": customers["Société TechMada"],
                "template_version": "1.0",
                "template_label": "Facture Titan",
                "business_scope": "titan",
                "document_type": "invoice",
                "document_reference": "T-003/2026-FA",
                "status": "issued",
                "prepared_at": now - timedelta(days=5),
            },
        )

        # Bon de livraison pour RD-003
        DocumentInstance.objects.update_or_create(
            template_key="titan.delivery_note.v1",
            reservation_draft=rd3,
            defaults={
                "customer": customers["Société TechMada"],
                "template_version": "1.0",
                "template_label": "Bon de Sortie / Livraison Titan",
                "business_scope": "titan",
                "document_type": "delivery_note",
                "document_reference": "T-003/2026-BL",
                "status": "issued",
                "prepared_at": now - timedelta(days=4),
            },
        )

        # Reçu pour RD-003
        rec_rd3, _ = DocumentInstance.objects.update_or_create(
            template_key="RECU-PAIEMENT",
            reservation_draft=rd3,
            document_reference="T-003/2026-REC-01",
            defaults={
                "customer": customers["Société TechMada"],
                "template_version": "1.0",
                "template_label": "Reçu de paiement",
                "business_scope": "titan",
                "document_type": "recu",
                "status": "generated",
                "prepared_at": now - timedelta(days=5),
            },
        )

        # Proforma Hahitantsoa pour event1
        DocumentInstance.objects.update_or_create(
            template_key="hahitantsoa.proforma.v1",
            hahitantsoa_event_draft=event1,
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Proforma Hahitantsoa",
                "business_scope": "hahitantsoa",
                "document_type": "proforma",
                "document_reference": "H-001/2026-PF",
                "status": "issued",
                "prepared_at": now - timedelta(days=10),
                "valid_until": now + timedelta(days=30),
            },
        )

        # Contrat Hahitantsoa pour event1
        DocumentInstance.objects.update_or_create(
            template_key="hahitantsoa.contract.v1",
            hahitantsoa_event_draft=event1,
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Contrat Hahitantsoa",
                "business_scope": "hahitantsoa",
                "document_type": "contract",
                "document_reference": "H-001/2026-CT",
                "status": "issued",
                "prepared_at": now - timedelta(days=5),
            },
        )

        # Proformas successifs pour event2 (Séminaire TechMada - pour test Lot 6)
        DocumentInstance.objects.update_or_create(
            template_key="hahitantsoa.proforma.v1",
            hahitantsoa_event_draft=event2,
            template_version="1.0",
            defaults={
                "customer": customers["Rasoa Nomena"],
                "template_label": "Proforma Hahitantsoa (v1)",
                "business_scope": "hahitantsoa",
                "document_type": "proforma",
                "document_reference": "H-002/2026-PF",
                "status": "issued",
                "prepared_at": now - timedelta(days=5),
                "valid_until": now + timedelta(days=25),
                "template_notes": "Version initiale du devis séminaire",
            },
        )
        DocumentInstance.objects.update_or_create(
            template_key="hahitantsoa.proforma.v1",
            hahitantsoa_event_draft=event2,
            template_version="2.0",
            defaults={
                "customer": customers["Rasoa Nomena"],
                "template_label": "Proforma Hahitantsoa (v2 - Révisé)",
                "business_scope": "hahitantsoa",
                "document_type": "proforma",
                "document_reference": "H-002/2026-PF",
                "status": "issued",
                "prepared_at": now - timedelta(days=2),
                "valid_until": now + timedelta(days=28),
                "template_notes": "Ajustement du nombre de tables et chaises",
            },
        )

        # Reçu acompte pour event1
        rec_event1, _ = DocumentInstance.objects.update_or_create(
            template_key="RECU-PAIEMENT",
            hahitantsoa_event_draft=event1,
            document_reference="H-001/2026-REC-01",
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Reçu d'acompte Hahitantsoa",
                "business_scope": "hahitantsoa",
                "document_type": "recu",
                "status": "generated",
                "prepared_at": now - timedelta(days=3),
            },
        )

        # Reçu caution et Bon de livraison pour event1 (pour test Lot 5)
        rec_caut_event1, _ = DocumentInstance.objects.update_or_create(
            template_key="RECU-PAIEMENT",
            hahitantsoa_event_draft=event1,
            document_reference="H-001/2026-REC-02",
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Reçu de versement de caution",
                "business_scope": "hahitantsoa",
                "document_type": "recu",
                "status": "generated",
                "prepared_at": now - timedelta(days=2),
            },
        )
        DocumentInstance.objects.update_or_create(
            template_key="hahitantsoa.delivery_note.v1",
            hahitantsoa_event_draft=event1,
            defaults={
                "customer": customers["Rakoto Ando"],
                "template_version": "1.0",
                "template_label": "Bon de Livraison Hahitantsoa",
                "business_scope": "hahitantsoa",
                "document_type": "bon_livraison",
                "document_reference": "H-001/2026-BL",
                "status": "issued",
                "prepared_at": now - timedelta(days=1),
            },
        )

        # Contrat pour RD-004
        DocumentInstance.objects.update_or_create(
            template_key="titan.material_contract.v1",
            reservation_draft=rd4,
            defaults={
                "customer": customers["Mme Rasoanirina"],
                "template_version": "1.0",
                "template_label": "Contrat Titan",
                "business_scope": "titan",
                "document_type": "contract",
                "document_reference": "T-004/2026-CT",
                "status": "issued",
                "prepared_at": now - timedelta(days=10),
            },
        )

        # Reçu caution et Bon de sortie pour RD-004 (Titan - pour test Lot 5)
        rec_caut_rd4, _ = DocumentInstance.objects.update_or_create(
            template_key="RECU-PAIEMENT",
            reservation_draft=rd4,
            document_reference="T-004/2026-REC-01",
            defaults={
                "customer": customers["Mme Rasoanirina"],
                "template_version": "1.0",
                "template_label": "Reçu de versement de caution Titan",
                "business_scope": "titan",
                "document_type": "recu",
                "status": "generated",
                "prepared_at": now - timedelta(days=5),
            },
        )
        DocumentInstance.objects.update_or_create(
            template_key="titan.delivery_note.v1",
            reservation_draft=rd4,
            defaults={
                "customer": customers["Mme Rasoanirina"],
                "template_version": "1.0",
                "template_label": "Bon de Sortie / Livraison Titan",
                "business_scope": "titan",
                "document_type": "bon_livraison",
                "document_reference": "T-004/2026-BL",
                "status": "issued",
                "prepared_at": now - timedelta(days=3),
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "✓ 11 documents créés (proformas révisés, contrats, factures, reçus, BL)"
            )
        )

        # ── 8. Facturation ────────────────────────────────────────────────
        from apps.billing.models import BillingInvoice

        # Cleanup non-canonical legacy invoices
        BillingInvoice.objects.filter(number__in=["FAC-2026-0001", "FAC-2026-0002"]).delete()

        inv1, _ = BillingInvoice.objects.update_or_create(
            number="T-003/2026-FA",
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
            number="T-004/2026-FA",
            defaults={
                "reservation_draft": rd4,
                "source_kind": "reservation",
                "invoice_status": "open",
                "amount": Decimal("3500000"),
                "issued_at": now - timedelta(days=8),
                "notes": "Facture location Titan - Mme Rasoanirina",
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
                "payment_status": "confirmed",
                "amount": Decimal("1000000"),
                "paid_at": now - timedelta(days=5),
                "confirmed_at": now - timedelta(days=5),
                "confirmed_by": gérant,
                "external_reference": "MVOLA-T003-2026",
                "source_label": "Acompte location TechMada",
                "receipt_document": rec_rd3,
            },
        )

        pay2, _ = Payment.objects.update_or_create(
            hahitantsoa_event_draft=event1,
            payment_kind="deposit",
            defaults={
                "payment_method": "virement",
                "payment_status": "confirmed",
                "amount": Decimal("1500000"),
                "paid_at": now - timedelta(days=3),
                "confirmed_at": now - timedelta(days=3),
                "confirmed_by": gérant,
                "external_reference": "VIR-H001-2026",
                "source_label": "Acompte mariage Rakoto",
                "receipt_document": rec_event1,
            },
        )

        # Caution contractuelle event1 (500 000 Ar - Lot 5)
        Payment.objects.update_or_create(
            hahitantsoa_event_draft=event1,
            payment_kind="caution",
            defaults={
                "payment_method": "cash",
                "payment_status": "confirmed",
                "amount": Decimal("500000"),
                "paid_at": now - timedelta(days=2),
                "confirmed_at": now - timedelta(days=2),
                "confirmed_by": gérant,
                "external_reference": "CAUTION-H001-2026",
                "source_label": "Caution contractuelle Hahitantsoa",
                "receipt_document": rec_caut_event1,
            },
        )

        # Caution contractuelle rd4 (300 000 Ar - Lot 5)
        Payment.objects.update_or_create(
            reservation_draft=rd4,
            payment_kind="caution",
            defaults={
                "payment_method": "cash",
                "payment_status": "confirmed",
                "amount": Decimal("300000"),
                "paid_at": now - timedelta(days=5),
                "confirmed_at": now - timedelta(days=5),
                "confirmed_by": gérant,
                "external_reference": "CAUTION-T004-2026",
                "source_label": "Caution contractuelle Titan",
                "receipt_document": rec_caut_rd4,
            },
        )

        self.stdout.write(self.style.SUCCESS("✓ 4 paiements créés (acomptes et cautions)"))

        # ── 10. Logistique ────────────────────────────────────────────────
        from apps.logistics.models import LogisticsEvent, LogisticsEventItemLine

        # Sortie pour event1 (Mariage Rakoto - terminée pour test retour Lot 5)
        evt_h1, _ = LogisticsEvent.objects.update_or_create(
            hahitantsoa_event_draft=event1,
            event_type="outbound_delivery",
            defaults={
                "status": "completed",
                "scheduled_at": now - timedelta(days=1),
                "notes": "Livraison matériel effectuée sur site Domaine Ambohimanga.",
            },
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt_h1,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 150},
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt_h1,
            inventory_item=items["Table rectangulaire 8 places"],
            defaults={"quantity": 15},
        )

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
            logistics_event=evt1,
            inventory_item=items["Tente 5x5m"],
            defaults={"quantity": 2},
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt1,
            inventory_item=items["Lumières d'ambiance LED"],
            defaults={"quantity": 4},
        )

        # Sortie pour RD-004 (Livraison terminée pour test retour Lot 5)
        evt_rd4, _ = LogisticsEvent.objects.update_or_create(
            reservation_draft=rd4,
            event_type="outbound_delivery",
            defaults={
                "status": "completed",
                "scheduled_at": now - timedelta(days=3),
                "notes": "Livraison matériel effectuée pour Mme Rasoanirina.",
            },
        )
        LogisticsEventItemLine.objects.get_or_create(
            logistics_event=evt_rd4,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 200},
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
            logistics_event=evt2,
            inventory_item=items["Chaise Napoléon transparente"],
            defaults={"quantity": 200},
        )

        self.stdout.write(self.style.SUCCESS("✓ 3 événements logistique créés"))

        # ── 10b. Stock inventaire ──────────────────────────────────────────
        from apps.inventory.models import InventoryStockMovement

        stock_data = [
            ("Chaise Napoléon transparente", 200),
            ("Table rectangulaire 8 places", 30),
            ("Tente 5x5m", 8),
            ("Sono complète + Micro", 5),
            ("Chaise chiavari dorée", 250),
            ("Lumières d'ambiance LED", 15),
            ("Nappe blanche 3m", 50),
            ("Couvert argenté", 300),
            ("Serviette blanche", 500),
            ("Badge intervenant", 200),
        ]

        for item_name, qty in stock_data:
            item = items[item_name]
            InventoryStockMovement.objects.get_or_create(
                inventory_item=item,
                movement_type="adjustment_in",
                direction="inbound",
                quantity=qty,
                source_label="Stock initial",
                defaults={"notes": "Stock initial"},
            )

        self.stdout.write(self.style.SUCCESS(f"✓ {len(stock_data)} mouvements de stock créés"))

        # ── 11. Caisse ───────────────────────────────────────────────────
        from apps.cashbox.models import CashboxMovement, CashboxSession

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

        # ── 12. Séquences de numérotation ─────────────────────────────────
        from apps.documents.models import (
            NumberingSequence,
            NumberingSequenceBrand,
            NumberingSequenceType,
        )

        NumberingSequence.objects.update_or_create(
            brand=NumberingSequenceBrand.TITAN,
            sequence_type=NumberingSequenceType.PROFORMA,
            year=now.year,
            defaults={
                "prefix": "T-",
                "next_number": 5,
                "padding": 3,
                "suffix_template": "/{year}",
            },
        )
        NumberingSequence.objects.update_or_create(
            brand=NumberingSequenceBrand.HAHITANTSOA,
            sequence_type=NumberingSequenceType.PROFORMA,
            year=now.year,
            defaults={
                "prefix": "H-",
                "next_number": 3,
                "padding": 3,
                "suffix_template": "/{year}",
            },
        )

        # ── Résumé ────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("═" * 60))
        self.stdout.write(self.style.SUCCESS("SEED COMPLET TERMINÉ"))
        self.stdout.write(self.style.SUCCESS("═" * 60))
        self.stdout.write("  Utilisateurs  : admin/admin, gerant/gerant123, accueil/accueil123")
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
