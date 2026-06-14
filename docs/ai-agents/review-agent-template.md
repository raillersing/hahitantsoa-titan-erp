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

## Required Inputs

- repository path
- branch or PR under review
- approved scope
- relevant diff or files
- review goals
- available evidence such as local checks or CI results

## Review Output Format

- finding severity
- file and evidence
- why it matters
- verdict
- residual risk

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
- reading `.env`
- printing or repeating secrets

## Stop Conditions

- missing or contradictory scope
- no review evidence available
- hidden dependency on `.env` or secrets
- request to mutate while still assigned as review-only
