"""
Signaux Documents : signal auto prospect_status=proforma_sent
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(
    post_save,
    sender="documents.DocumentInstance",
    dispatch_uid="documents.proforma_auto_pipeline_update",
)
def auto_update_prospect_status_on_proforma(sender, instance, created, **kwargs):
    """
    Quand un DocumentInstance de type 'proforma' est cree pour un prospect,
    mettre automatiquement prospect_status a 'proforma_sent'.
    """
    if not created:
        return
    if instance.document_type != "proforma":
        return
    if not instance.customer_id:
        return

    from apps.customers.models import Customer
    from apps.customers.services import transition_prospect_status

    try:
        customer = Customer.objects.get(pk=instance.customer_id)
    except Customer.DoesNotExist:
        return

    # Ne met a jour que si c'est un prospect et qu'il n'est pas deja a proforma_sent
    if (
        customer.lifecycle_status == "prospect"
        and customer.prospect_status not in ("proforma_sent", "converted")
    ):
        transition_prospect_status(
            customer=customer,
            target_status="proforma_sent",
            actor=None,
            reason="Proforma genere automatiquement",
        )
