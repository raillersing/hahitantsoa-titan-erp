# GitHub Repository Rules Checklist

## Purpose

This checklist defines the minimum repository-rules and CI-security review points for
Hahitantsoa/Titan ERP.

Use it together with:

- [PR quality gates](pr-quality-gates.md)
- [Secret handling policy](secret-handling-policy.md)

## Branch Protection

Verify on GitHub:

- `main` has branch protection or equivalent repository rules enabled.
- direct pushes to `main` are restricted as far as the repository plan allows.
- required status checks are configured or, if the plan does not allow protection, the
  team treats them as mandatory manual gates.
- human merge control remains in place unless an explicitly approved exception exists.

## Required Checks

The expected required checks are:

- `Backend quality`
- `Frontend quality`

A PR must not be merged unless these checks are green, or a documented human-approved
exception exists.

## Merge Policy

Review whether:

- squash merge is enabled or preferred for task branches;
- merge policy is consistent with the repository history strategy;
- automatic merge is disabled unless explicitly approved for a later governance change.

## GitHub Actions Permissions

Verify:

- top-level workflow `permissions:` are least-privilege;
- job-level permissions do not expand unnecessarily;
- `contents: read` remains the default unless a job truly needs more.

## Event Safety

Verify:

- avoid `pull_request_target` unless there is a specific reviewed need;
- PR workflows do not expose secrets to untrusted code paths;
- untrusted inputs from PR titles, bodies, branch names, artifacts, caches, or matrix
  values are handled cautiously;
- no secrets are injected into jobs that execute contributor-controlled code.

## Action Version Review

Review:

- every `uses:` reference in workflows;
- whether each action is pinned to an acceptable versioning strategy;
- whether updates to major versions are reviewed explicitly.

Pinning exact SHAs may be desirable later, but must be assessed against project
maintenance cost and current workflow maturity.

## Secrets In CI

Verify:

- no `.env` file is referenced in GitHub workflows;
- PR jobs do not receive unnecessary repository secrets;
- logs do not echo secret values;
- any exposed secret requires immediate rotation.

## Post-Merge Main CI

Verify:

- `main` CI is checked after merge, not only PR CI before merge;
- post-merge failures are treated as blocking operational regressions;
- cleanup or follow-up tasks do not start from the assumption that `main` is healthy
  until `main` CI is confirmed green.

## Local Audit Helper

Use:

```sh
scripts/dev/erp-github-repo-rules-audit
```

This helper is non-mutating. It does not change GitHub settings and does not expose
secrets.
