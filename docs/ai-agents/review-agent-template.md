# Review Agent Template

## Purpose

This template defines the standard non-mutating workflow for review-only agents.

## Default Mode

Review-only means non-mutating by default.

Unless the task explicitly says otherwise, a review agent must:

- inspect code, diffs, tests, docs, and CI evidence;
- report findings;
- avoid file edits;
- avoid commits, pushes, and merges.

Review-only review is mandatory before Level 2 autonomy on backend or frontend mutation
tasks.

## Required Inputs

- assigned agent profile
- repository path
- branch or PR under review
- approved scope
- relevant diff or files
- review goals
- available evidence such as local checks or CI results

Executable review profiles run the integrated task-start baseline first. Plan-only
profiles propose it and wait. Live baseline wins over stale static docs.

The reviewer must check:

- scope
- tests
- business rules
- security
- secrets handling
- migrations when relevant
- documentation accuracy

## Review Output Format

- finding severity
- file and evidence
- why it matters
- verdict
- protocol audit details:
  - Functional verdict: APPROVED, APPROVED WITH RESERVATIONS, or REJECTED
  - Protocol verdict: PASS, PASS WITH PROTOCOL RESERVATIONS, or FAIL
  - Commands executed: List of all terminal commands run during the session
  - Whether all commands used erp-logged-run: Yes, No, or N/A (no commands run)
  - Files modified: List of files mutated or None
  - Secrets/.env touched: Yes (explain) or No
  - Final classification: PASS, PASS WITH PROTOCOL RESERVATIONS, or FAIL
- residual risk
- deliverable location: chat or approved repository file
- applicable bridge doc for non-Codex review agents

A private-only report outside the repository must not be the sole deliverable.

If no findings exist, say so explicitly and note any remaining evidence gaps.

## Allowed Actions

- read files in approved scope
- inspect diffs
- inspect CI evidence
- run non-mutating local checks when authorized

## Forbidden Actions

- editing files
- staging changes
- committing
- pushing
- merging
- deleting branches
- reading `.env`
- printing or repeating secrets

## Stop Conditions

- missing or contradictory scope
- no review evidence available
- hidden dependency on `.env` or secrets
- request to mutate while still assigned as review-only
