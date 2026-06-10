# Codex task templates

This directory contains reusable templates for the Codex-only supervised autonomous ERP workflow documented in F89.

Templates:

- task-spec-template.md
- implementation-prompt-template.md
- review-prompt-template.md
- fixer-prompt-template.md
- pr-report-template.md

Purpose:

- reduce repetitive manual prompting
- keep Codex tasks scoped
- make reviews easier
- preserve the no-auto-merge rule
- preserve the no-.env and no-secrets rules

Operating rule:

Codex may create branches, commits, pushes, and pull requests only when explicitly authorized by a task specification. Codex must not merge pull requests.
