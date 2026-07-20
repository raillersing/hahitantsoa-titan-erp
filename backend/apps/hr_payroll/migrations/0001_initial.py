import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Employee",
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
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "first_name",
                    models.CharField(max_length=150),
                ),
                (
                    "last_name",
                    models.CharField(max_length=150),
                ),
                (
                    "role",
                    models.CharField(
                        help_text="Fonction / rôle de l'employé",
                        max_length=150,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Actif"),
                            ("on_leave", "En congé"),
                            ("inactive", "Inactif"),
                        ],
                        default="active",
                        max_length=20,
                    ),
                ),
                (
                    "assignment",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Affectation / service",
                        max_length=150,
                    ),
                ),
                (
                    "salary",
                    models.DecimalField(
                        decimal_places=2, default=0, max_digits=12
                    ),
                ),
            ],
            options={
                "verbose_name": "Employé",
                "verbose_name_plural": "Employés",
                "ordering": ["last_name", "first_name"],
            },
        ),
        migrations.CreateModel(
            name="PaySlip",
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
                (
                    "period",
                    models.CharField(
                        help_text="Format AAAA-MM, ex. 2026-06",
                        max_length=7,
                    ),
                ),
                (
                    "gross_salary",
                    models.DecimalField(
                        decimal_places=2, default=0, max_digits=12
                    ),
                ),
                (
                    "deductions",
                    models.DecimalField(
                        decimal_places=2, default=0, max_digits=12
                    ),
                ),
                (
                    "net_salary",
                    models.DecimalField(
                        decimal_places=2, default=0, max_digits=12
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Brouillon"),
                            ("validated", "Validé"),
                            ("paid", "Payé"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payslips",
                        to="hr_payroll.employee",
                    ),
                ),
            ],
            options={
                "verbose_name": "Bulletin de paie",
                "verbose_name_plural": "Bulletins de paie",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="AdvanceRequest",
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
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2, max_digits=12
                    ),
                ),
                (
                    "reason",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "En attente"),
                            ("approved", "Approuvée"),
                            ("rejected", "Rejetée"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="advance_requests",
                        to="hr_payroll.employee",
                    ),
                ),
            ],
            options={
                "verbose_name": "Demande d'avance",
                "verbose_name_plural": "Demandes d'avance",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="LeaveRequest",
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
                (
                    "start_date",
                    models.DateField(),
                ),
                (
                    "end_date",
                    models.DateField(),
                ),
                (
                    "reason",
                    models.TextField(blank=True, default=""),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "En attente"),
                            ("approved", "Approuvée"),
                            ("rejected", "Rejetée"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="leave_requests",
                        to="hr_payroll.employee",
                    ),
                ),
            ],
            options={
                "verbose_name": "Demande de congé",
                "verbose_name_plural": "Demandes de congé",
                "ordering": ["-created_at"],
            },
        ),
    ]
