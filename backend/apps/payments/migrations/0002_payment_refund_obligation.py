# Generated manually for caution refund execution bundle

import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='refund_obligation',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='refund_payments',
                to='inventory.inventorycautionrefundobligation',
            ),
        ),
        migrations.AlterField(
            model_name='payment',
            name='payment_kind',
            field=models.CharField(
                max_length=32,
                choices=[
                    ('deposit', 'deposit'),
                    ('balance', 'balance'),
                    ('caution', 'caution'),
                    ('owner_injection', 'owner_injection'),
                    ('investor_injection', 'investor_injection'),
                    ('date_reservation', 'date_reservation'),
                    ('refund', 'refund'),
                    ('other', 'other'),
                ],
            ),
        ),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ('payment_kind', 'refund'),
                        ('refund_obligation__isnull', False),
                    ),
                    models.Q(
                        ('payment_kind', 'refund'),
                        _negated=True,
                    ),
                    _connector='OR',
                ),
                name='payment_refund_requires_obligation',
            ),
        ),
    ]
