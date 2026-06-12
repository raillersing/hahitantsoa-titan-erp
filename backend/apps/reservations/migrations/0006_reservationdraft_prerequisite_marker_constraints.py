# Generated manually for F122 to enforce durable prerequisite marker completeness.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reservations", "0005_reservationdraft_cancellation_state"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="reservationdraft",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(("contract_signed_at__isnull", True))
                        & models.Q(("contract_signed_by__isnull", True))
                    )
                    | (
                        models.Q(("contract_signed_at__isnull", False))
                        & models.Q(("contract_signed_by__isnull", False))
                    )
                ),
                name="reservation_draft_contract_signed_marker_complete",
            ),
        ),
        migrations.AddConstraint(
            model_name="reservationdraft",
            constraint=models.CheckConstraint(
                condition=(
                    (
                        models.Q(("required_deposit_received_at__isnull", True))
                        & models.Q(("required_deposit_received_by__isnull", True))
                    )
                    | (
                        models.Q(("required_deposit_received_at__isnull", False))
                        & models.Q(("required_deposit_received_by__isnull", False))
                    )
                ),
                name="reservation_draft_required_deposit_received_marker_complete",
            ),
        ),
    ]
