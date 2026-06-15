# Frontend Quality Workflow and Orchestration Guidelines

This document defines the repeatable quality workflow and orchestration rules for Antigravity frontend agents working on the Hahitantsoa/Titan ERP project.

## Quality Workflow Wrapper

All frontend pull requests must use the official frontend quality wrapper script to validate code correctness before committing and pushing:

```bash
scripts/dev/erp-frontend-quality
```

This wrapper runs in a containerized environment and performs:
1. **Dependency Installation:** Safe installation using the project's lockfile (`npm ci`).
2. **Unit Testing:** Executing the Vitest test suite (`npm run test`).
3. **Type Checking:** Checking TypeScript types without emitting code (`tsc --noEmit`).
4. **Production Build:** Compiling the production build using Vite (`vite build`).

The wrapper runs on the WSL/Linux environment inside Docker Compose to ensure consistency and avoid host-level path or environment mismatches.

## Frontend Orchestration Rules

### 1. Codex Backend Ownership
- The backend remains strictly **Codex-owned** when Codex is active.
- Frontend agents must not modify backend application code, tests, migrations, models, views, or serializers.
- Treat `main` as the only stable backend API contract.

### 2. Task Sizing Strategy
- Frontend tasks must be **medium-sized, coherent slices** (e.g., one complete user flow or UX feature per PR).
- Avoid creating trivial/micro-PRs that increase workflow overhead.
- Do not attempt to complete the entire frontend roadmap in a single PR.

### 3. Stop Conditions
Orchestration must stop immediately and report to the supervisor if:
- Quota limits or environment/tool errors occur.
- Frontend tests fail and the cause is not in the edited scope.
- A required backend API contract is missing or ambiguous.
- An active Codex worktree has to be modified.
- Environment variables (`.env`) or secrets are requested/exposed.
- Scope of changes grows beyond 10-12 files or encompasses multiple unrelated user flows.
