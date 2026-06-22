# Generated manually for billing credit note model

import uuid
from decimal import Decimal
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0007_legal_invoice_numbering'),
    ]

    operations = [
        migrations.CreateModel(
            name='BillingCreditNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('issued', 'issued'), ('applied', 'applied'), ('cancelled', 'cancelled')], default='issued', max_length=32)),
                ('issued_at', models.DateTimeField()),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('applied_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('notes', models.TextField(blank=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='credit_notes', to='billing.billinginvoice')),
            ],
            options={
                'verbose_name': 'Billing credit note',
                'verbose_name_plural': 'Billing credit notes',
                'ordering': ['-issued_at', '-created_at', 'id'],
            },
        ),
        migrations.AddConstraint(
            model_name='billingcreditnote',
            constraint=models.CheckConstraint(condition=models.Q(amount__gt=Decimal('0.00')), name='billing_credit_note_amount_positive'),
        ),
        migrations.AddConstraint(
            model_name='billingcreditnote',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        ('status', 'issued'),
                        ('applied_at__isnull', True),
                        ('applied_by__isnull', True),
                    )
                    | models.Q(
                        ('status', 'applied'),
                        ('applied_at__isnull', False),
                        ('applied_by__isnull', False),
                    )
                    | models.Q(
                        ('status', 'cancelled'),
                        ('applied_at__isnull', True),
                        ('applied_by__isnull', True),
                    )
                ),
                name='billing_credit_note_status_markers_consistent',
            ),
        ),
    ]
