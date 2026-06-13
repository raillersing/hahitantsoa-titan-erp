# F132O Autonomous Orchestrator Sprint Plan

## Status
- F131 is complete.
- PR #149 was merged.
- Main baseline is `b8b1ed18e068ddc98508ca06c762e939627d4326`.

## Purpose
- Configure an orchestrated multi-task workflow after F131.
- Allow Antigravity to execute successive tasks under strict authority limits.
- Keep merge and high-risk decisions under supervisor/human control.

## Operating Model
- One implementation PR at a time.
- Parallel work allowed only for inspection/review tasks that do not modify overlapping files.
- Antigravity may execute A3 tasks but not A4 merge tasks yet.
- Supervisor controls merge until further proof.

## Task Queue After F131
- **F132A** — Document artifact storage inspection
- **F132B** — HTML artifact storage backend foundation
- **F133A** — Document access/download API decision
- **F133B** — Private document access API
- **F134A** — Payment/deposit domain inspection
- **F134B** — Payment/deposit backend foundation
- **F135** — Reservation lifecycle controlled exposure
- **F136** — Frontend business chain integration phase 1
- **F137** — Cross-domain RBAC/security hardening

---

## Per-Task Routing

### F132A — Document artifact storage inspection
- **Task Goal**: Inspect the existing filesystem structure, media configurations, and determine storage paths for generated documents.
- **Required Agents**: Codebase Researcher.
- **Recommended Agents**: Research.
- **Authority Level**: A1/A2 (inspection-only).
- **Files Likely Touched**: None (read-only).
- **Explicit Exclusions**: No changes to settings or code.
- **Validation Required**: Diff check, syntax quality.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Any attempt to write code.

### F132B — HTML artifact storage backend foundation
- **Task Goal**: Implement the storage backend for HTML documents.
- **Required Agents**: Backend Developer.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: `backend/apps/documents/runtime.py` and local testing mocks.
- **Explicit Exclusions**: Exclude public download APIs or storage server configurations.
- **Validation Required**: Local test suite execution.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Test failures or unapproved schema migrations.

### F133A — Document access/download API decision
- **Task Goal**: Determine API design, authentication boundary, and URLs for document downloading.
- **Required Agents**: Architect.
- **Recommended Agents**: self.
- **Authority Level**: A1/A2.
- **Files Likely Touched**: None.
- **Explicit Exclusions**: Implementing views, routers, or serializers.
- **Validation Required**: Documentation review.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Any code modification.

### F133B — Private document access API
- **Task Goal**: Expose private API endpoints for downloading documents securely.
- **Required Agents**: Backend Developer.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: `backend/apps/documents/views.py`, `backend/apps/documents/urls.py`.
- **Explicit Exclusions**: Public unauthenticated access.
- **Validation Required**: End-to-end API tests.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: CI failures or security leaks.

### F134A — Payment/deposit domain inspection
- **Task Goal**: Research cashbox models, deposit tracking, and payment processor interfaces.
- **Required Agents**: Researcher.
- **Recommended Agents**: Research.
- **Authority Level**: A1/A2.
- **Files Likely Touched**: None.
- **Explicit Exclusions**: Implementing payment logic.
- **Validation Required**: Read-only validation.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Database schema changes.

### F134B — Payment/deposit backend foundation
- **Task Goal**: Write backend foundation for payment tracking without payment gateway integrations.
- **Required Agents**: Backend Developer.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: `backend/apps/payments/models.py`.
- **Explicit Exclusions**: Stripe, PayPal, or payment gateway SDKs.
- **Validation Required**: Unit tests.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: CI failures.

### F135 — Reservation lifecycle controlled exposure
- **Task Goal**: Transition reservation drafts to confirmed reservations safely.
- **Required Agents**: Backend Developer.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: `backend/apps/reservations/services.py`.
- **Explicit Exclusions**: Automated payment triggering.
- **Validation Required**: Full reservation cycle testing.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Breaking existing reservation flows.

### F136 — Frontend business chain integration phase 1
- **Task Goal**: Wire frontend UI elements to interact with the new document APIs.
- **Required Agents**: Frontend Developer.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: Frontend source files under `frontend/`.
- **Explicit Exclusions**: Modifying backend code.
- **Validation Required**: Frontend build, smoke test.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Build failures.

### F137 — Cross-domain RBAC/security hardening
- **Task Goal**: Ensure secure role-based access controls for reservations, documents, and payments.
- **Required Agents**: Security Specialist.
- **Recommended Agents**: self.
- **Authority Level**: A3.
- **Files Likely Touched**: Middleware and authorization policies.
- **Explicit Exclusions**: Bypassing tenant logic.
- **Validation Required**: RBAC permission tests.
- **Merge Authority**: Supervisor/Human.
- **Stop Conditions**: Failing permission tests.

---

## Failure Policy
- Stop after 3 failed attempts on tests, validation, push, PR, CI, or merge.
- Stop immediately on scope ambiguity.
- Stop immediately on business rule ambiguity.
- Stop immediately on `.env`, secrets, production, or sensitive data.
- Stop immediately if a required agent says no.
- Stop if PR is not `MERGEABLE`.
- Stop if CI main fails after merge.

## Autonomous Execution Limits
Antigravity may not:
- Merge code directly.
- Touch production configurations or secrets.
- Change Docker, compose, CI, or scripts unless the task is explicitly marked as DevOps.
- Open multiple implementation branches touching overlapping modules.
- Decide new business rules.
- Bypass Agent B when required.

## Promotion Rules
- **A0/A1**: Default entry level for successful inspection.
- **A2**: Promoted after successful no-modification report and local understanding.
- **A3**: Promoted for branch/commit/PR lifecycle tasks.
- **A4**: Granted only after multiple successful A3 cycles and explicit human approval.
- **A5**: Never granted (no full-auto merge).

## Rollback/Recovery
- No destructive reset without human approval.
- Save patches before restoring.
- Report dirty state immediately.
- Never force-push to shared branches.
- Do not delete branches unless merge cleanup is explicitly authorized.

## Recommended Next Task
**F132A — Document artifact storage inspection**
- *Authority Level*: A1/A2 inspection-only before implementing F132B.

## A4 Certification Drill
- Antigravity may attempt A4 only on low-risk documentation-only tasks first.
- A4 on backend/runtime/storage/payment/API/lifecycle remains forbidden until explicitly approved by the Human Owner.
- A4 requires exact file-set verification, PR CI success, `MERGEABLE`, main CI success, and cleanup.
- Any failure in validation, PR CI, merge, main CI, branch cleanup, or git state must stop the task.
- After one successful docs-only A4 drill, Antigravity remains limited to A3 for T3/T4 business tasks unless the Human Owner explicitly promotes it.
