---
name: erp-api-contracts
description: Coordinate an approved API contract across backend and frontend boundaries. Use for cross-boundary design or mismatch arbitration; use the backend or frontend specialist for a one-sided implementation review.
---

## What I do

Ensure backend-frontend API contracts are explicitly confirmed before implementation, and that cross-boundary changes follow the approved protocol.

## Coordination Checklist

- [ ] Record the approved path, method, request, response, errors, authentication, and permissions once
- [ ] Assign backend details to `erp-backend-api-contracts`
- [ ] Assign frontend consumption details to `erp-frontend-api-contracts`
- [ ] Resolve mismatches before either side invents a compatibility layer
- [ ] Keep the cross-boundary decision in the task or API contract evidence

## Cross-Boundary Protocol

- Frontend agents may mutate backend only when the task explicitly authorizes the minimum required cross-boundary change for a confirmed API contract mismatch
- Backend agents must not assume frontend consumption patterns — document the expected response shape
- API contract mismatches found during review must be escalated before proceeding

## Source

- [Frontend Agent Template — Agent FE-E](../../../docs/ai-agents/frontend-agent-template.md#agent-fe-e---api-contract-integration-reviewer)
- [PR Quality Gates — Frontend gates](../../../docs/ai-agents/pr-quality-gates.md#frontend-gates)
- [AGENTS.md — Business boundaries](../../../AGENTS.md#business-boundaries)
