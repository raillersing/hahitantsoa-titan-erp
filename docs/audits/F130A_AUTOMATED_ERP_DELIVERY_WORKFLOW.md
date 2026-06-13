# F130A - Automated ERP delivery workflow

## 1. Status

- Workflow adopted for upcoming ERP tasks.
- Documentation-only task.
- No runtime behavior changed.

## 2. Context

After F129S, the project now has a validated automated delivery workflow built
around a canonical backend quality gate and a dedicated `backend-test` service.

The validated backend quality gate is:

- `bash scripts/ci/backend-quality`

The canonical containerized execution path is:

- `docker compose --profile test run --rm backend-test`

This workflow allows Codex to execute a controlled task end-to-end when the
scope is clear, validations stay green, and no blocked condition appears.

F130A documents the automated execution workflow. Governance, role separation,
decision authority, and roadmap-update responsibility are documented in
[`F130B_MULTI_AGENT_DELIVERY_GOVERNANCE.md`](F130B_MULTI_AGENT_DELIVERY_GOVERNANCE.md).

## 3. General principle

Codex may execute a task through:

- local implementation;
- local validation;
- commit;
- push;
- PR creation;
- PR CI wait;
- merge;
- post-merge `main` validation;
- local cleanup.

Human intervention is required only after 3 consecutive failures for:

- repetitive format issues;
- lint issues;
- targeted test failures with clear mechanical causes;
- temporary push issues;
- run waiting/retry issues;
- pull/sync issues.

Human intervention is required immediately for:

- doubtful scope;
- unexpected files;
- `.env` or secret exposure risk;
- Git conflict;
- non-mergeable PR;
- CI failure that is not clearly understood;
- unexpected migration;
- business or architecture decision drift.

## 4. Backend quality gate

Canonical local backend quality command:

```sh
bash scripts/ci/backend-quality
```

Canonical containerized backend quality command:

```sh
docker compose --profile test run --rm backend-test
```

The backend quality script runs:

- `python -m ruff format --check backend tests`
- `python -m ruff check backend tests`
- `python backend/manage.py makemigrations --check --dry-run`
- `python -m pytest`

This command set is the default backend gate for automated delivery unless a
task explicitly approves a narrower validation path.

## 5. CI waiting rules

Never treat `queued`, `pending`, or `in_progress` as either success or failure.

Wait for an explicit final result before continuing.

Observed timing guidance:

- backend quality often takes about 1m40 to 1m55;
- frontend quality often takes about 20 to 25 seconds.

These timings are practical expectations only. They are not success signals.

## 6. Standard GitHub CLI commands

Standard PR and Actions monitoring commands:

```sh
gh pr checks "$PR_NUMBER" --watch --fail-fast --interval 10
gh run watch "$RUN_ID" --exit-status
gh run view "$RUN_ID" --log-failed
gh pr merge "$PR_NUMBER" --merge --delete-branch
```

These commands must still be used with judgment:

- do not merge on partial or unclear CI state;
- do not continue when a red CI signal is unexplained;
- do not force merge around unresolved scope or safety concerns.

## 7. Three-failure policy

The 3-failure policy is allowed only for repetitive mechanical problems such as:

- formatting;
- lint;
- targeted test execution;
- temporary push issues;
- run waiting;
- pull/sync mechanics.

The 3-failure policy is not allowed for:

- business-rule risks;
- security risks;
- doubtful scope;
- unexplained CI failures;
- unexpected migrations;
- conflicts;
- non-mergeable PRs.

If one of those blocked conditions appears, stop immediately and report the
state clearly.

## 8. Mandatory post-merge flow

After merge, the workflow must still complete:

1. sync `main`;
2. wait for `main` CI on the merged HEAD;
3. check `git status --short`;
4. prune/cleanup the feature branch;
5. produce a final execution summary.

Post-merge validation is part of the task completion workflow. A merged PR is
not considered fully complete until `main` has been revalidated and cleanup is
finished.

## 9. Operating rules going forward

- one PR equals one business boundary;
- documentation may travel with an implementation PR only when directly tied to
  that implementation;
- broad roadmap/workflow documentation stays separate;
- all important commands must be logged with
  `scripts/dev/erp-logged-run`;
- never modify `.env` or secrets;
- run local validation before PR creation;
- require green GitHub Actions PR CI before merge;
- merge manually through the approved workflow only after green CI;
- always validate `main` and clean up after merge.

## 10. Explicit exclusions

F130A does not:

- change backend runtime code;
- change frontend runtime code;
- create models or migrations;
- add serializers, views, routers, endpoints, or OpenAPI paths;
- change Dockerfiles or Compose definitions;
- change GitHub Actions workflows;
- change CI scripts;
- change `.env` or secrets;
- use OpenClaw.
