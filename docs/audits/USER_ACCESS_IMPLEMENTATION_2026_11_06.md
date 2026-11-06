# User-access implementation — 2026-11-06

## Baseline and authorization

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

Logs are local under each task worktree's logs/terminal. Key tasks:
access-integration-checks, access-final-delta-regression,
access-dialog-escape-fix, access-browser-verified, access-ui-legacy-grants-completeness and access-frontend-final-build.
Browser screenshots and JSON are in frontend/reports/access-admin-*.

## Remaining release gates

The original delegated sessions hit provider usage limits. A fresh independent
Codex reviewer subsequently inspected the combined changes and requested three
corrections: whitespace bypass of reserved slugs, missing manager protection,
and a cashbox UI gate still based on legacy role labels. All three were fixed;
reinspection returned APPROVE with no residual blocking finding. The reviewer
performed static review, not execution of the provided tests. A subsequent
expanded backend regression passed163 tests; frontend passed41, with a further
10-test cashbox run proving the negative case after session data loads.
Changes are uncommitted. No push, PR, merge, remote CI or deployment. The combined
working-tree snapshot is not an exact committed-SHA CI result. Review policy,
identity, documents and frontend together; release documents only after identity.

The changed role policy takes effect for existing holders of those named roles;
verify the deployment's actual assignments before activation. No real user roles,
passwords, business data or production sessions were read or changed by this task.

Not claimed: exhaustive penetration test, every application route/export, live
multi-terminal refresh, screen-reader acceptance, or Raspberry Pi deployment.
The existing broader authenticated read/edit scope for shared drafts is retained;
creator-based isolation is not reintroduced. Personal support/import/notification
scopes are unchanged. Physical printer acceptance belongs to the earlier task.

No merge was performed.

Independent review: /root/access_final_review — REQUEST_CHANGES, then APPROVE
following the three documented fixes. Canonical PROTECTED_ROLE_SLUGS is shared
by mutation, assignment and revocation checks. POST/PATCH tests cover reserved
slugs with and without surrounding whitespace and manager definition changes.
Cashbox supervision now consumes only the server capability, with no staff/name
inference. Final review regression logs: access-review-security-regression,
access-review-cashbox-capability-fix and access-cashbox-negative-regression.
