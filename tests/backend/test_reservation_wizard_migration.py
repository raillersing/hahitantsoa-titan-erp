import uuid

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db(transaction=True)
BEFORE = ("reservations", "0013_reservationdraft_required_deposit_amount")
AFTER = ("reservations", "0014_reservationwizardsession_reservationwizardfile_and_more")


def test_recovery_migration_additive_and_reverse_refuses_saved_work(django_user_model):
    actor = django_user_model.objects.create_user(username="wizard-migration")
    customer = Customer.objects.create(display_name="Historical customer preserved")
    head = MigrationExecutor(connection).loader.graph.leaf_nodes()
    session = None
    historical_session = None
    try:
        MigrationExecutor(connection).migrate([BEFORE])
        assert Customer.objects.get(pk=customer.pk).display_name == "Historical customer preserved"
        assert "reservations_reservationwizardsession" not in connection.introspection.table_names()
        executor = MigrationExecutor(connection)
        executor.migrate([AFTER])
        historical_session = executor.loader.project_state([AFTER]).apps.get_model(
            "reservations", "ReservationWizardSession"
        )
        session = historical_session.objects.create(
            owner_id=actor.pk,
            client_key=uuid.uuid4(),
            state={"step": 2},
            creation_fingerprint="0" * 64,
        )
        with pytest.raises(RuntimeError, match="sessions de récupération"):
            MigrationExecutor(connection).migrate([BEFORE])
        assert historical_session.objects.get(pk=session.pk).state == {"step": 2}
        assert Customer.objects.filter(pk=customer.pk).exists()
    finally:
        if session is not None:
            historical_session.objects.filter(pk=session.pk).delete()
        MigrationExecutor(connection).migrate(head)
    assert not MigrationExecutor(connection).migration_plan(head)
