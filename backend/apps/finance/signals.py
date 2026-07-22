from __future__ import annotations

from django.db import OperationalError, ProgrammingError
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .models import FIXED_FINANCIAL_CATEGORY_DEFINITIONS, FinancialCategory


@receiver(post_migrate, dispatch_uid="finance.rehydrate_fixed_financial_categories")
def rehydrate_fixed_financial_categories(*, app_config, using, **kwargs) -> None:
    """Restore only missing fixed categories after a database flush."""
    if app_config.name != "apps.finance":
        return

    categories = FinancialCategory.objects.using(using)
    expected_by_code = {
        code: (label, kind) for code, label, kind in FIXED_FINANCIAL_CATEGORY_DEFINITIONS
    }
    try:
        existing_by_code = {
            code: (label, kind)
            for code, label, kind in categories.values_list("code", "label", "kind")
        }
    except OperationalError, ProgrammingError:
        # The finance table can be absent while migrations are only partially applied.
        return

    if set(existing_by_code) - set(expected_by_code) or any(
        existing_by_code[code] != expected_by_code[code] for code in existing_by_code
    ):
        raise RuntimeError("Fixed financial categories are missing or inconsistent.")

    for code, (label, kind) in expected_by_code.items():
        categories.get_or_create(
            code=code,
            defaults={"label": label, "kind": kind},
        )
