---
name: business-boundaries
description: Titan vs Hahitantsoa domain rules for ERP agents. Use when implementing or reviewing any feature to ensure the correct domain boundary is respected.
---

# Business Boundaries

Load before implementing or reviewing any feature that touches inventory, rental, or event domains.

## What I do

Prevent Titan from exposing Hahitantsoa concepts and vice versa.

## Checklist

- [ ] Titan is pure rental — only `material`, `article`, `material_pack`
- [ ] Titan must never expose `venue`, `local`, `room`, `hall`, `service`, `event_service`, ancillary services, or event services
- [ ] Hahitantsoa covers the complete event domain (distinct from Titan)
- [ ] Shared inventory rules must not collapse the Hahitantsoa/Titan boundary
- [ ] Reservation confirmation requires: signed contract, received deposit, successful availability revalidation, explicit backend authorization, durable attribution, transaction-safe audit, and transactional conflict protection
- [ ] No cross-domain coupling without explicit ADR or decision record
- [ ] When in doubt, escalate to human for domain clarification

## When to use me

Load at the start of any task that touches inventory, rental, or event features.

## References

- [AGENTS.md](../../../AGENTS.md) — Business Boundaries section (authoritative)
- [docs/ai-agents/backend-agent-template.md](../../../docs/ai-agents/backend-agent-template.md) — Agent D scope guardian role
