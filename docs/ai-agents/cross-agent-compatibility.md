# Cross-Agent Compatibility

## Purpose

This document defines the operational parity layer across Codex, Antigravity, and
OpenCode for this repository.

## Core Rules

- Canonical truth remains the committed repo docs and scripts.
- All agents must receive an assigned profile from
  [agent-profiles.md](agent-profiles.md).
- Every executable agent starts with `bash scripts/dev/erp-agent-task-start` inside
  `scripts/dev/erp-logged-run`.
- Plan-only agents must propose the same baseline and wait.
- Live baseline wins over stale static docs.
- `.env`, secrets, `/tmp` script workflows, and unauthorized permission repair remain
  forbidden.

## Codex

- Codex is the primary bounded mutating agent.
- Codex may use repo-scoped skills under [../../.agents/skills](../../.agents/skills).
- Codex skills accelerate repetitive workflows only; they do not replace the canonical
  repo docs or scripts.

## OpenCode

- OpenCode should follow [../../AGENTS.md](../../AGENTS.md),
  [agent-profiles.md](agent-profiles.md),
  [prompt-contracts/agent-prompt-procedure.md](prompt-contracts/agent-prompt-procedure.md),
  and [tooling/opencode-workflow.md](tooling/opencode-workflow.md).
- OpenCode Web launched from WSL is treated as native WSL/bash and must not use
  `wsl.exe`, `wsl -d`, or PowerShell-to-WSL bridges unless explicitly authorized.
- OpenCode Desktop Windows remains plan-only until promoted by explicit profile and
  acceptance-test evidence.
- Codex skills may be read as reference runbooks, but OpenCode must not assume they are
  auto-loaded.

## Antigravity

- Antigravity should follow [../../AGENTS.md](../../AGENTS.md),
  [agent-profiles.md](agent-profiles.md),
  [review-agent-template.md](review-agent-template.md), and
  [tooling/antigravity-workflow.md](tooling/antigravity-workflow.md).
- Antigravity treats Codex skills as reference runbooks, not native skills, unless that
  behavior is later proven and accepted.
- Antigravity remains review/docs-only by default and may be promoted only through an
  explicit profile plus acceptance-test evidence.

## Promotion Gates

A non-Codex agent is not mutation-capable by default. Promotion requires all of:

- an explicit assigned profile that allows mutation;
- a bounded task prompt with approved scope;
- acceptance-test evidence from
  [cross-agent-acceptance-tests.md](cross-agent-acceptance-tests.md);
- unchanged secret, baseline, and CI gate discipline.
