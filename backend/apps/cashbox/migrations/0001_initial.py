import uuid
from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("billing", "0004_refund_obligation_execution_fields"),
        ("payments", "0004_payment_billing_refund_obligation"),
    ]

    operations = [
        migrations.CreateModel(
            name="CashboxSession",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("opened_at", models.DateTimeField()),
                ("closed_at", models.DateTimeField(blank=True, null=True)),
                ("opening_note", models.TextField(blank=True)),
                ("closing_note", models.TextField(blank=True)),
                (
                    "closed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "opened_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "operator",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cashbox_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Cashbox session",
                "verbose_name_plural": "Cashbox sessions",
                "ordering": ["-opened_at", "-created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="CashboxMovement",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("direction", models.CharField(choices=[("cash_in", "cash_in"), ("cash_out", "cash_out")], max_length=32)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("moved_at", models.DateTimeField()),
                ("note", models.TextField(blank=True)),
                (
                    "billing_invoice",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cashbox_movements",
                        to="billing.billinginvoice",
                    ),
                ),
                (
                    "billing_refund_obligation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cashbox_movements",
                        to="billing.billingrefundobligation",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "moved_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "payment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cashbox_movements",
                        to="payments.payment",
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movements",
                        to="cashbox.cashboxsession",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Cashbox movement",
                "verbose_name_plural": "Cashbox movements",
                "ordering": ["-moved_at", "-created_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="cashboxsession",
            constraint=models.CheckConstraint(
                condition=(
                    (models.Q(("closed_at__isnull", True)) & models.Q(("closed_by__isnull", True)))
                    | (models.Q(("closed_at__isnull", False)) & models.Q(("closed_by__isnull", False)))
                ),
                name="cashbox_session_closed_markers_consistent",
            ),
        ),
        migrations.AddConstraint(
            model_name="cashboxsession",
            constraint=models.UniqueConstraint(
                condition=models.Q(("closed_at__isnull", True)),
                fields=("operator",),
                name="cashbox_single_open_session_per_operator",
            ),
        ),
        migrations.AddConstraint(
            model_name="cashboxmovement",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", Decimal("0.00"))),
                name="cashbox_movement_amount_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="cashboxmovement",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("billing_invoice__isnull", True),
                        ("billing_refund_obligation__isnull", True),
                        ("payment__isnull", False),
                    ),
                    models.Q(
                        ("billing_invoice__isnull", False),
                        ("billing_refund_obligation__isnull", True),
                        ("payment__isnull", True),
                    ),
                    models.Q(
                        ("billing_invoice__isnull", True),
                        ("billing_refund_obligation__isnull", False),
                        ("payment__isnull", True),
                    ),
                    models.Q(
                        ("billing_invoice__isnull", True),
                        ("billing_refund_obligation__isnull", True),
                        ("payment__isnull", True),
                    ),
                    _connector="OR",
                ),
                name="cashbox_movement_single_financial_reference",
            ),
        ),
    ]
