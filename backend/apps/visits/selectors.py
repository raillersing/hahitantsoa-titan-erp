from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q, QuerySet

from apps.identity.authorization import (
    ELIGIBLE_VISIT_RESPONSIBLE_ROLE_SLUGS,
    is_eligible_visit_responsible_actor,
)
from apps.identity.models import UserRoleAssignment


def get_eligible_visit_responsibles() -> QuerySet:
    """Return active users who are eligible to be assigned as a visit responsible.

    Per Decision D04:
    - Active users holding role: owner_manager, manager, reservation_sensitive_operator
    - Or technical administrators (is_staff=True or is_superuser=True)
    - Inactive users are excluded.
    """
    User = get_user_model()
    assigned_user_ids = UserRoleAssignment.objects.filter(
        role__slug__in=ELIGIBLE_VISIT_RESPONSIBLE_ROLE_SLUGS,
        role__is_active=True,
        is_active=True,
        user__is_active=True,
    ).values_list("user_id", flat=True)

    return (
        User.objects.filter(
            Q(id__in=assigned_user_ids)
            | Q(groups__name="reservation_sensitive_operator")
            | Q(is_staff=True)
            | Q(is_superuser=True),
            is_active=True,
        )
        .distinct()
        .order_by("username")
    )


def is_eligible_visit_responsible(*, user: object | None) -> bool:
    """Check if a given user is eligible to be assigned as a visit responsible."""
    return is_eligible_visit_responsible_actor(actor=user)
