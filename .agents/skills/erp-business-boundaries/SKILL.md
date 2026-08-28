---
name: erp-business-boundaries
description: Review the Titan versus Hahitantsoa domain boundary. Use when a task changes catalogue, inventory, reservation, planning, navigation, or API exposure across those domains; do not load for identity or tooling-only work.
---

# ERP Business Boundaries

Load before implementing or reviewing any feature that touches inventory, rental, or event domains.

## What I do

Prevent Titan from exposing Hahitantsoa concepts and vice versa.

## Checklist

- [ ] Titan is pure rental — only `material`, `article`, `material_pack`
- [ ] Titan must never expose `venue`, `local`, `room`, `hall`, `service`, `event_service`, ancillary services, or event services
- [ ] Hahitantsoa covers the complete event domain (distinct from Titan)
- [ ] Hahitantsoa `bare` is space-only and confirmable without inventory lines; articles and packs belong to Hahitantsoa `logistics`
- [ ] Shared inventory rules must not collapse the Hahitantsoa/Titan boundary
- [ ] Titan operational records remain attributable to `ReservationDraft`; Hahitantsoa operational records remain attributable to `HahitantsoaEventDraft`
- [ ] A nullable or indirect Titan relation is not an acceptable substitute for Hahitantsoa return, stock, damage/loss, or closeout ownership
- [ ] Both domains reach their own complete lifecycle: confirmation, outbound stock, linked return, stock reconciliation, financial settlement, and closeout
- [ ] Reservation confirmation requires: signed contract, received deposit, successful availability revalidation, explicit backend authorization, durable attribution, transaction-safe audit, and transactional conflict protection
- [ ] Contract generation is never accepted as signed-contract truth in either domain
- [ ] No cross-domain coupling without explicit ADR or decision record
- [ ] When in doubt, escalate to human for domain clarification

## When to use me

Load at the start of any task that touches inventory, rental, or event features.
For a complete journey audit, load `erp-reservation-lifecycle-audit` after this
boundary check.

## References

- [AGENTS.md](../../../AGENTS.md) — Business Boundaries section (authoritative)
- [docs/ai-agents/backend-agent-template.md](../../../docs/ai-agents/backend-agent-template.md) — Agent D scope guardian role
