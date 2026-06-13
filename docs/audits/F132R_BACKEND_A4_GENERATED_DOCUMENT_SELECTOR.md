# Audit Document: F132R — Backend A4 Certification Drill: generated document read-only selector

* **Status**: Completed
* **Purpose**: Add a safe, read-only selector to retrieve only `DocumentInstance` records with `generated` status for a specific `ReservationDraft`.
* **Exact selector added**:
```python
def list_generated_document_instances_for_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
) -> QuerySet[DocumentInstance]:
    return list_document_instances_for_reservation_draft(
        reservation_draft=reservation_draft,
    ).filter(status=DocumentInstanceStatus.GENERATED)
```
* **Scope exclusions**:
  * No database state mutations.
  * No record creation.
  * No runtime generation calls.
  * No storage interaction.
  * No migrations, models modifications, views, serializers, or URLs.
* **A4 certification result**: Success
* **Validation evidence summary**: Focused validation tests ran and passed successfully. Full backend-test suite passes successfully.
* **Next recommended task**: `F132S — Backend A4 light migration drill`
