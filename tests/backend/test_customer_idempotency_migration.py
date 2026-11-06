import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.mark.parametrize("duplicate_history", [False, True])
def test_scoped_creation_migration_preserves_history_or_stops_for_review(
    django_user_model, duplicate_history
):
    actor = django_user_model.objects.create_user(username="migration-actor")
    before = ("customers", "0011_customer_idempotency_key")
    after = ("customers", "0012_customer_scoped_idempotency")
    executor = MigrationExecutor(connection)
    executor.migrate([before])
    old_customer = executor.loader.project_state([before]).apps.get_model("customers", "Customer")
    first = old_customer.objects.create(
        display_name="Preserved",
        created_by_id=actor.pk,
        idempotency_key="historical",
        is_deleted=True,
    )
    duplicate = None
    try:
        if duplicate_history:
            duplicate = old_customer.objects.create(
                display_name="Separate",
                created_by_id=actor.pk,
                idempotency_key="historical",
                is_deleted=True,
            )
            with pytest.raises(RuntimeError, match="require review"):
                MigrationExecutor(connection).migrate([after])
            assert old_customer.objects.filter(pk__in=[first.pk, duplicate.pk]).count() == 2
            old_customer.objects.filter(pk=duplicate.pk).delete()
        MigrationExecutor(connection).migrate([after])
        preserved = Customer.objects.get(pk=first.pk)
        assert preserved.display_name == "Preserved"
        assert preserved.idempotency_key == "historical"
        assert preserved.idempotency_actor_id == actor.pk
        assert preserved.idempotency_fingerprint == ""
        assert preserved.is_deleted
    finally:
        if duplicate is not None:
            old_customer.objects.filter(pk=duplicate.pk).delete()
        MigrationExecutor(connection).migrate([after])
