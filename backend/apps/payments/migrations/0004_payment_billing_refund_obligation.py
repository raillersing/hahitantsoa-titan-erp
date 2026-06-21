# Generated manually for billing refund obligation execution

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0003_refund_obligation_foundation"),
        ("payments", "0003_remove_payment_payment_requires_reservation_or_source_label_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="billing_refund_obligation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="refund_payments",
                to="billing.billingrefundobligation",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="payment",
            name="payment_refund_requires_obligation",
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        models.Q(("payment_kind", "refund"))
                        & (
                            models.Q(("refund_obligation__isnull", False))
                            | models.Q(("billing_refund_obligation__isnull", False))
                        )
                    )
                    | ~models.Q(("payment_kind", "refund"))
                ),
                name="payment_refund_requires_obligation",
            ),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.CheckConstraint(
                condition=~(
                    models.Q(("refund_obligation__isnull", False))
                    & models.Q(("billing_refund_obligation__isnull", False))
                ),
                name="payment_single_refund_obligation_link",
            ),
        ),
    ]
