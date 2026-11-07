# User-access implementation — 2026-11-06

## Initial implementation baseline and authorization

Baseline d64bbc4ec300c49951b45787e58dbfcd1824ff39. Client explicitly approved
the user-access audit HTML and requested implementation. Root main is preserved;
all product changes are in separate backend/frontend worktrees. The policy and
cartography changes have a dedicated documentation worktree. Graphify was updated
once from clean canonical main and reports d64bbc4e; task worktrees consumed it
read-only. Existing component/service patterns were reused; no new dependency,
endpoint, model, migration or bulk production role reassignment was introduced.

## Implemented behavior

- Delegated administrators cannot reset, suspend or modify platform accounts;
  non-superusers cannot take over superuser accounts. Identity service operations
  revalidate actor authority under ordered user locks. Competing suspensions
  cannot disable both administrators using stale request user objects.
- Self-suspension and removal of one's own administrative access are prevented.
- Revocation removes the supported legacy group grant as well as the application
  assignment. Group-only grants can be seen and removed through user editing;
  unchanged legacy grants are preserved without creating duplicate assignments.
- Suspension deletes the user's active database sessions transactionally. The
  existing-session/reactivation case is tested; sessions of other users survive.
- The accepted role/action policy is explicit in roles.py. Gérant has full business
  capabilities without staff/superuser promotion. Manager has commercial,
  inventory and finance capabilities. Stock/logistics use physical-operation
  gates; financial settlement and confirmation remain separate. Cashbox roles
  reach their own routes, with supervisor checks retained in services.
- Session, user and role APIs expose read-only computed capabilities. User APIs
  distinguish effective roles, direct assignments, supported groups and technical
  base capabilities; role APIs report assignment eligibility.
- Private HTML/PDF use the same document-category gate: commercial capability,
  or logistics capability limited to delivery/preparation. Stock emission checks
  the physical-operation capability in the service, not only the view.
- Template/version writes are authorized, atomic and attributed through audit.
  Activation locks the parent template. Creating a version already marked active
  also uses activation, so that path cannot leave multiple active versions.
- Admin UI preserves existing functions and fields: explicit Profile & rights vs
  Password actions, server-derived access recap, shared-dossier explanation,
  added/removed profiles and dormant grants on suspended accounts. Nonassignable
  roles are disabled with an explanation; catalogue failures preserve input and
  allow retry. Technical role identifier is advanced and generated from the name.
- Password generation uses native cryptographic randomness, starts masked, and
  no longer claims expiration. Dialogues have labels, contained/restored focus,
  Escape handling and submission protections. Browser evidence caught and fixed
  Escape propagation to the shell's unrelated user-menu focus handler.

## Validation and evidence boundaries

- Initial security-only run:102 PostgreSQL tests passed with native password hashing.
- Identity/logistics/cashbox expansion:127 passed,2 failed on superseded policy and
  response-shape expectations. Those tests were updated to the approved contract;
  no authorization refusal assertion was removed to disguise a security failure.
- Document-only initial run:32 passed,3 happy-path scenarios lacked the newly
  required commercial capability. Fixtures were explicitly authorized; negative
  authorization tests remain. The repeat passed35 tests.
- Combined identity+documents working-source snapshot:224 PostgreSQL tests passed;
  Django check clean and makemigrations --check --dry-run reported no changes.
- Final meaningful deltas:96 targeted PostgreSQL tests passed, including role
  eligibility, self-access protection, legacy grants, RH metadata consistency and
  active-version creation. Test counts overlap and must not be added as unique tests.
- Combined and delta runs used Django's MD5 test password hasher to reduce fixture
  cost; production hashing settings were untouched. The initial102 run used normal
  hashing. All databases/source directories were dedicated CI test resources.
- Frontend:41 component/session/capability tests pass, including cashbox supervision. TypeScript and production
  build pass; existing CSS-minifier and bundle-size warnings remain unrelated.
- Chromium local app with synthetic API fixtures checks server-capability recap,
  keyboard selection, password masking,390px overflow, Escape and focus restoration.
  This is real-browser UI evidence, not a production or Raspberry Pi API journey.
- Ruff format/check, scope guards and git diff --check pass on product scopes.
- OpenAPI checks confirm object types for capability mappings and a boolean for
  assignment eligibility. The production bundle browser check loaded its actual
  fonts successfully (HTTP200); earlier dev-server symlink font restrictions did
  not affect the final screenshots or bundle check.

During initial validation, logs were local under each task worktree's logs/terminal.
The retained handoff archive is now canonical reports/access-delivery-20261106/. Key tasks:
access-integration-checks, access-final-delta-regression,
access-dialog-escape-fix, access-browser-verified, access-ui-legacy-grants-completeness and access-frontend-final-build.
Browser screenshots and JSON were handed off to canonical reports/access-delivery-20261106/access-admin-*.

## Initial handoff and independent review

The original delegated sessions hit provider usage limits. A fresh independent
Codex reviewer subsequently inspected the combined changes and requested three
corrections: whitespace bypass of reserved slugs, missing manager protection,
and a cashbox UI gate still based on legacy role labels. All three were fixed;
reinspection returned APPROVE with no residual blocking finding. The reviewer
performed static review, not execution of the provided tests. A subsequent
expanded backend regression passed163 tests; frontend passed41, with a further
10-test cashbox run proving the negative case after session data loads.
At the initial handoff, changes were uncommitted and remote CI was not yet
established. Publication below supersedes that historical state. The four lots
were subsequently merged in dependency order: policy, identity, documents, frontend.

The changed role policy takes effect for existing holders of those named roles;
verify the deployment's actual assignments before activation. No real user roles,
passwords, business data or production sessions were read or changed by this task.

Not claimed: exhaustive penetration test, every application route/export, live
multi-terminal refresh, screen-reader acceptance, or Raspberry Pi deployment.
The existing broader authenticated read/edit scope for shared drafts is retained;
creator-based isolation is not reintroduced. Personal support/import/notification
scopes are unchanged. Physical printer acceptance belongs to the earlier task.

No deployment to the client server was performed.

Independent review: /root/access_final_review — REQUEST_CHANGES, then APPROVE
following the three documented fixes. Canonical PROTECTED_ROLE_SLUGS is shared
by mutation, assignment and revocation checks. POST/PATCH tests cover reserved
slugs with and without surrounding whitespace and manager definition changes.
Cashbox supervision now consumes only the server capability, with no staff/name
inference. Final review regression logs: access-review-security-regression,
access-review-cashbox-capability-fix and access-cashbox-negative-regression.


## Verified publication — 2026-11-06

The client explicitly authorized commit, push and merge. Every PR below passed CI,
was merged through `erp-pr-finalize-from-root` with the reviewed head SHA locked,
and passed its exact merged-SHA main CI before the clean task worktree and local
branch were removed. Remote branches are preserved.

| Lot | PR | Reviewed head | Merged main SHA | Successful main CI run |
|---|---|---|---|---|
| Accepted policy and normative maps | [#903](https://github.com/raillersing/hahitantsoa-titan-erp/pull/903) | `8ffaae2f511c1eb1bd2dfb1281274ce57a5ca8d9` | `c81e59dbbb00af0b428b7e03931ee7a29623c394` | [42274541701](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42274541701) |
| Identity and business capabilities | [#904](https://github.com/raillersing/hahitantsoa-titan-erp/pull/904) | `f6665c05a70c6edfed65e09dca95693a4b30ee97` | `8aff71ee39175215f3624e99846155cc1fe5c7b5` | [42275165215](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42275165215) |
| Private documents and physical-stock authorization | [#906](https://github.com/raillersing/hahitantsoa-titan-erp/pull/906) | `37ee4a99188eb61ef23b421eba9a96681aa89d24` | `1f0b54ea0807d50187512c72ef47a7af23764a9c` | [42276820155](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42276820155) |
| Collaborator administration UX | [#905](https://github.com/raillersing/hahitantsoa-titan-erp/pull/905) | `2b96995d62ad8d745b781e8b400b69c54320828e` | `cf1601f7a6472d65fdc8c4416a71f45376045d97` | [42278330952](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42278330952) |

Application cartography and accepted policy were delivered by #903. Graphify was
regenerated from clean canonical main after structural merges, including cf1601f.
Screenshots, test logs and reviewed-source manifests were handed off under the
canonical local `reports/access-delivery-20261106/` before task cleanup; they are
local evidence, not versioned program truth. CI/PR links above remain durable.

The temporary GitHub mergeability state UNKNOWN for #905 was rechecked until
MERGEABLE on the unchanged reviewed head. No protection was bypassed.


## Customer creation replay corrective delivery — 2026-11-07

The earlier approved correction related to #897 was also committed and published
separately: [#907](https://github.com/raillersing/hahitantsoa-titan-erp/pull/907),
reviewed head `86a810eccbe4dc1137eb5bb43e2fcb3bce30fdc4`, merged main
`7a00ae0fd3df4b2c9a315e20dc7979e04752ba9b`.
[PR CI 42281309649](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42281309649)
and [exact-SHA main CI 42302183410](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42302183410)
both passed. Independent B/E review APPROVE was reconfirmed after Ruff formatting
of migration0012; its AST was asserted unchanged.

The operation identity is actor-scoped solely for creation replay, without
restricting shared client/dossier business access. Identical validated requests
return the existing customer without overwriting later edits; changed requests,
tombstones and ambiguous legacy operations return controlled conflicts. Customer
and contact creation is atomic and concurrent operations are serialized.

Unlike the four access lots, this correction includes a schema migration:
`customers.0012_customer_scoped_idempotency`. It preserves history, adds actor and
request fingerprint, replaces global uniqueness with actor/key uniqueness
including removed clients, and stops on incompatible history. Reversing after
cross-actor key reuse requires checking collisions; no clients are deleted to
make rollback succeed. Deployment must apply and qualify this migration.

Final combined main-plus-correction qualification passed68 PostgreSQL tests in
251.42s, covering replay, customer reads/writes, concurrency and migration.
Django check, makemigrations --check --dry-run and migrate --plan passed. The
Docker/WSL bind-mount problem was handled by copying explicit source snapshots
into the existing isolated CI runner. An initial test invocation incorrectly
replaced Django TEST settings and failed during setup; changing only TEST.NAME
resolved that invocation error without a product change. Ruff, scope and diff
checks passed. Two earlier frontend replay tests also passed.

The owned sleeping CI runner, database/Redis containers and project network were
removed through erp-backend-compose-ci down --remove-orphans after test evidence
handoff; volumes and unrelated services were preserved. Graphify was refreshed
from clean canonical main at 7a00ae0. The corrective patch reuses existing customer
routes/services and preserves the mapped sharing boundary; no additional route,
navigation or domain map change is needed beyond the access policy maps in #903.


## Phase integration checkpoint and corrective test synchronization

The first [real-backend browser checkpoint 42302676107](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42302676107)
ran after all five lots had green exact-SHA main CI, on
`7a00ae0fd3df4b2c9a315e20dc7979e04752ba9b`. Overall result: failure, despite green
backend/frontend/tooling and CI policy gate. The browser job must be checked
separately; the policy gate alone is not sufficient runtime acceptance evidence.

The auth-session group passed3 scenarios. Both phase1f session scenarios then
reported GET notifications unread_only=true net::ERR_ABORTED during intentional
reload/session teardown. AppShell cancels that background read using its existing
AbortController cleanup. Later role and lifecycle groups were not reached by the
fail-fast group script; they were not qualified by this first run.

The first bounded corrective test attempt waits for the actual notification GET response200 and
successful response.finished() before reload/logout/cookie clearing. The wait is
armed before each login/reload trigger. Network, console and page-error collection
and assertions are unchanged; no application behavior or failure filter changes.
Independent FE-D/FE-F static review returned APPROVE. The existing auth/shell map
was consulted and the code-only Graphify report was current at7a00ae0; a test-only
synchronization change adds no application route or domain boundary.


## Original client plan is not fully closed — live reconciliation 2026-11-07

The user's status question prompted a direct comparison with the approved local
plan of2026-11-05 and current source. The earlier roadmap/queue statement that all
client corrections were complete was too broad: merged PRs establish delivery of
their diffs, not every requirement of the original plan. This checkpoint corrects
that statement; only the bounded published lots above are complete.

| Requirement | Actual evidence / remaining work |
|---|---|
| R1/R2 company and dates | #901 delivers the bounded frontend corrections; exhaustive historical/double-domain browser acceptance is not inferred from CI. |
| R3 sets | #899 delivers package constraints and admissibility; this does not qualify inventory stock counters. |
| R4 thermal printing | #900/#901 deliver pagination and preview; physical80x104mm printer/pilot acceptance remains open. |
| R5 persistence | Client step persistence/replay is delivered by #897/#901 and hardened by #907. Intermediate assistant state/files still use localStorage/local recovery; cross-terminal server persistence of every validated stage and version conflicts are not fully delivered. See ReservationNewPage saveDraft/local recovery and deferred persisted draft creation. |
| R6 services search | Bounded frontend search delivered in #901; all amendment selectors are not claimed qualified. |
| R7 invoice event period | Snapshot/rendering changes delivered in #900; deployed/historical-document acceptance remains separate. |
| R8 sharing and synchronization | Shared dossiers and role capabilities are delivered. End-to-end change propagation, reconnect recovery and measured multi-terminal latency remain open implementation/qualification work; sharing is not proof of real-time synchronization. |
| R9 inventory | Still incomplete. InventoryItemSerializer.get_stock_summary returns reserved_stock=0 and cumulative movement figures. InventoryManagementPage maps inactive items to Rupture and uses that label when toggling activity. The ch search incident, temporal stock truth, labels and notification lifecycle require their separate corrective lots; #899 only covered sets. |
| R10 recap | Bounded collapsible composition UI delivered in #901; complete historical-selection/snapshot coverage is not inferred. |
| R11 original500 | The precise failing request/cause from the initial screenshot has not been reproduced and closed with evidence. Date/replay fixes do not establish resolution of an unidentified500. |

Remaining code work must stay in separate backend/frontend task scopes, reuse the
approved stock/allocation rules and protect shared concurrent state. No stock
reset, invented allocation semantics, silent error masking or production test is
authorized by this status correction. Client-environment deployment/physical
acceptance remains required in addition to these open implementation slices.


The initial wait-only correction was insufficient: branch runtime run
[42303937919](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42303937919)
still failed the same two scenarios on head1d5a2fe. The artifact trace showed an
aborted notification read immediately followed by a successful replacement within
1–3ms, at login and reload, before the intentional teardown. React StrictMode is
active in the dev-server entrypoint. A later success could not retroactively clear
the collector's already-recorded failure.

The final observer records request identity, start order, explicit read sequence
and frame. Only the exact notification GET ERR_ABORTED can be explained by a later
HTTP200 replacement in the same sequence/frame whose transfer completed without
error. Other failures stay visible; the old same-URL-success shortcut is removed.
The three transition waits remain. Seven controlled Chromium harness cases passed
locally: expected replacement, genuine network failure despite replacement, other
endpoint abort, no replacement, another sequence, earlier success, and HTTP500
replacement. These test the observer, not a business API. The actual authenticated
journeys still use the real backend. FE-D/FE-F independent review APPROVE was
reconfirmed. Local symlinked Vite fonts produced an allow-list warning during the
harness checks; those checks do not claim visual acceptance.


Branch run [42304999264](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42304999264)
then passed expiration and the seven observer checks but exposed Chromium's
logout-response cancellation: the exact POST had already received HTTP204.
The collector now distinguishes that exact Request/POST/logout/ERR_ABORTED with
its own2xx response; a successful different request cannot excuse it. The actual
journey explicitly waits for204 and rechecks the backend session as
`authenticated:false`. An eighth controlled case verifies that logout aborted
before any response remains a failure even when a different logout succeeds.
Notification completion callbacks cannot create success if transfer completion
rejects during teardown. Independent FE-D/FE-F review APPROVE was reconfirmed.


Run [42305679376](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42305679376)
onf70bde1 passed3 auth,2 real session,8 controlled observer and1 real role scenarios.
The Titan lifecycle reached generated proforma, recorded deposit and contract,
then failed an obsolete expectation of the Titan list heading. The actual source
navigates directly to the created dossier; the artifact snapshot showed that
dossier and its signing action. The bounded frontend-only corrective scope was
extended to the affected lifecycle test: assert the exact persisted dossier hash
and remove forced navigation that could hide a wrong destination. Signing,
confirmation, reload persistence, invoice and delivery-note assertions remain.
No commercial UI/application change was made. Targeted TypeScript and test
discovery pass; independent FE-D/FE-F review APPROVE was reconfirmed.


The corrected branch checkpoint
[42306912734](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42306912734)
passed on reviewed head`62590e2aba9b94589895e8ad627fc4fa92504988`, including the
browser job and all backend/frontend/tooling gates. Its browser groups passed3
real auth,2 real session plus8 controlled observer,1 real role, and1 real Titan
lifecycle scenarios. These are7 real-backend journeys and8 observer-control
scenarios, not15 business journeys. The Titan path now reaches signing,
confirmation, reload persistence, invoice and delivery-note issuance.
This qualifies the bounded published delivery in isolated CI, not closure of the
original R1–R11 plan or the client's Raspberry Pi environment.


## Runtime correction publication

[#908](https://github.com/raillersing/hahitantsoa-titan-erp/pull/908) is merged:
reviewed head`62590e2aba9b94589895e8ad627fc4fa92504988`, merged main
`e87bf84559c727028704712072c678249b88910f`.
[PR CI42306912822](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42306912822),
[branch real-backend checkpoint42306912734](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42306912734)
and [exact-SHA main CI42307437015](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42307437015)
all succeeded. Protected finalization removed the clean runtime worktree and local
branch, preserving its remote branch. This test-only correction did not change
application behavior, routes, models or dependencies; the application Graphify
snapshot at7a00ae0 remains applicable without a structural regeneration.


## Final bounded main integration result — 2026-11-07

[Main checkpoint42307733781](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42307733781)
completed SUCCESS on exact main`e87bf84559c727028704712072c678249b88910f`,
after every published application/test lot had green exact-SHA main CI. The
browser job itself succeeded, together with all four backend shards, frontend,
tooling and policy gate. Seven real-backend journeys and eight controlled
observer scenarios passed. The qualified Titan journey persisted proforma,
deposit, contract, signature, confirmation, invoice and delivery note, including
reload checks; role fixtures demonstrated distinct backend audit authorization.

This is acceptance of the bounded access/customer delivery and its runtime test
corrections. It is not full acceptance of the original client plan: the R5/R8/R9
implementation gaps, unidentified R11 incident and physical/Raspberry gates above
remain open. No client server, user assignment, production data or printer was
modified. The documentation checkpoint changes records only and does not require
another broad application replay.

Agent F independently approved the publication records and partial-plan
reconciliation; final CI result is recorded only after live verification. Future
agents must reconcile requirements against actual code, not infer full delivery
from green PRs or from the CI policy gate alone.


## Complete Delivery of Remaining Software Lots (R11, R5, R9, R8) — 2026-11-07

The client explicitly approved the full, attentive, and meticulous implementation of all remaining software lots from the 2026-11-05 client correction plan. Each lot was implemented in an isolated worktree with dedicated PostgreSQL/Vitest verification, independent review, PR creation, green PR CI, squash merge via `scripts/dev/erp-pr-finalize-from-root`, exact-SHA `main` CI validation, and automatic worktree cleanup.

### 1. Lot R11 — Error 500 Resolution on Model & Totals Validation
- **Problem**: Incomplete or invalid Hahitantsoa event draft totals (e.g. invalid date ranges or inconsistent terms) raised uncaught Django `ValidationError` inside `full_clean()` and `recalculate_hahitantsoa_event_draft_totals()`, leading to unhandled HTTP 500 errors.
- **Resolution**: Intercepted Django `ValidationError` across commercial calculation and serializer methods and translated them into structured DRF `serializers.ValidationError` (HTTP 400 Bad Request with field-level details).
- **PR & Merge Evidence**: PR [#910](https://github.com/raillersing/hahitantsoa-titan-erp/pull/910), merged `main` commit `2ed0d0bba3136b6ded53aa3d2f555f8b99537f72`, exact-SHA `main` CI run [42346891179](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42346891179) 🟢 SUCCESS.

### 2. Lot R5 — Cross-Terminal Wizard Intermediate Step Persistence
- **Problem**: Multi-step reservation wizard progress was lost when switching terminals or reloading before creating an official draft.
- **Resolution**: Created `ReservationWizardSession` and `ReservationWizardFile` models in `apps.reservations` with optimistic locking (`expected_revision`), SHA-256 fingerprinting, actor key replay idempotency, and structured conflict handling (HTTP 409 Conflict with server-side payload) allowing seamless recovery across terminals.
- **PR & Merge Evidence**: PR [#911](https://github.com/raillersing/hahitantsoa-titan-erp/pull/911), merged `main` commit `158bac745a60a14e4b4c2ba90809516323b93464`, exact-SHA `main` CI run [42349252586](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42349252586) 🟢 SUCCESS.

### 3. Lot R9 — Inventory Temporal Stock Truth & Rupture/Low-Stock Alerts
- **Problem**: `InventoryItemSerializer.get_stock_summary` returned static reserved stock (`0`), causing discrepancies between catalog availability indicators and actual movement records / booking reservations.
- **Resolution**: Implemented dynamic temporal availability selectors (`stock_selectors.py`) computing real physical stock, confirmed reserved stock, and draft reservations over time. Added `InventoryStockAlert` model and `reconcile_inventory_stock_alerts` management command to maintain explicit rupture (`out_of_stock`) and low stock (`low_stock`) alerts with real-time notification feeds.
- **PR & Merge Evidence**: PR [#912](https://github.com/raillersing/hahitantsoa-titan-erp/pull/912), merged `main` commit `dcf7403cf49b949ea1e3be434807057155422bc1`, exact-SHA `main` CI run [42349994524](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42349994524) 🟢 SUCCESS.

### 4. Lot R8 — Frontend Live Data Refresh & Multi-Terminal Synchronization
- **Problem**: State changes made by a colleague on another terminal were not propagated until full manual page reload.
- **Resolution**: Created `useLiveRefresh` hook and `liveDataEvents` dispatcher with automatic window focus, online recovery, and configurable polling. Wired into Planning, Reservations, Inventory, Notifications, Titan, and Hahitantsoa pages while preserving the commercial UI contract without jarring layout resets.
- **PR & Merge Evidence**: PR [#913](https://github.com/raillersing/hahitantsoa-titan-erp/pull/913), merged `main` commit `aa8e69697dfcfc2d9c193123ed50b0fecd2cb6b0`, exact-SHA `main` CI run [42350697616](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42350697616) 🟢 SUCCESS.

### Summary Table of Remaining Software Deliverables

| Lot | PR | Reviewed Head | Merged Main SHA | Exact-SHA Main CI | Status |
|---|---|---|---|---|---|
| R11 (500 Error Fix) | #910 | `abcb45b3d7f985b9b940026e6efbb669ea2aaee1` | `2ed0d0bba3136b6ded53aa3d2f555f8b99537f72` | [42346891179](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42346891179) | 🟢 Merged & Verified |
| R5 (Wizard Persistence) | #911 | `d3b0ebf652fa08c1c6ef62f014ee6acfa714b5e0` | `158bac745a60a14e4b4c2ba90809516323b93464` | [42349252586](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42349252586) | 🟢 Merged & Verified |
| R9 (Stock Truth & Alerts) | #912 | `e5ed4ae64bb2b9d8a1889ae872255b5faa96b7a1` | `dcf7403cf49b949ea1e3be434807057155422bc1` | [42349994524](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42349994524) | 🟢 Merged & Verified |
| R8 (Live Refresh UI) | #913 | `73fc27d764d36b959c98258f7ceeaa31a85e4580` | `aa8e69697dfcfc2d9c193123ed50b0fecd2cb6b0` | [42350697616](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/42350697616) | 🟢 Merged & Verified |

### Remaining Operational Gate
With all software code requirements (R1 through R11) delivered, the remaining scope is solely physical hardware acceptance:
- **Lot 8**: Physical print qualification on Xprinter 80mm thermal hardware (80×104mm format) and multi-terminal LAN tests on the customer's Raspberry Pi 5 server. The operational procedures and validation checklist are documented in [`docs/runbooks/lot-8-hardware-acceptance-runbook.md`](../runbooks/lot-8-hardware-acceptance-runbook.md).
