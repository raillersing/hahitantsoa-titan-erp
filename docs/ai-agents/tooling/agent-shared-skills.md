# Agent Shared Skills Guide

This document describes the shared agent skills under [`.agents/skills/`](../../.agents/skills) and how to use them across agents (Codex, Claude Code, OpenCode).

## Overview

Shared skills provide load-on-demand checklists and procedures for repetitive agent tasks. They are model-agnostic and agent-agnostic — any agent that supports the `skill` tool can use them.

## Available Skills

### Backend Agent Skills

| Skill | Purpose |
|-------|---------|
| [`backend-quality-gates`](../../.agents/skills/backend-quality-gates/SKILL.md) | Pre-commit quality verification for backend PRs |
| [`backend-agent-roles`](../../.agents/skills/backend-agent-roles/SKILL.md) | Role-specific checklists for backend agents A–F |
| [`backend-ci-workflow`](../../.agents/skills/backend-ci-workflow/SKILL.md) | CI wait, merge, and post-merge validation |

### Cross-Agent Skills

| Skill | Purpose |
|-------|---------|
| [`worktree-discipline`](../../.agents/skills/worktree-discipline/SKILL.md) | One-agent-one-worktree rules |
| [`secret-handling`](../../.agents/skills/secret-handling/SKILL.md) | Never-read-.env and log hygiene rules |
| [`business-boundaries`](../../.agents/skills/business-boundaries/SKILL.md) | Titan vs Hahitantsoa domain rules |
| [`post-merge-cleanup`](../../.agents/skills/post-merge-cleanup/SKILL.md) | Branch/worktree/Docker cleanup procedure |

### Frontend Skills (OpenCode-specific)

Frontend specialist skills live under [`.opencode/skills/`](../../.opencode/skills) and are documented in [`frontend-specialist-skills.md`](frontend-specialist-skills.md).

## Usage Rules

1. **Load on demand** — only load a skill when the current task phase requires it. Do not load all skills at session start.
2. **Canonical docs win** — skills summarize but do not replace the canonical source documents. If a skill and its source document disagree, the source document is authoritative.
3. **Model-agnostic** — skills must not reference specific model capabilities or limitations.
4. **Each skill references its source** — every skill links back to its canonical document.

## Skill Loading

### OpenCode

```sh
# Load a skill by name
skill backend-quality-gates
```

### Codex

```sh
# Codex loads skills from .agents/skills/ automatically
@skills backend-quality-gates
```

### Claude Code

```sh
# Claude Code loads skills from .agents/skills/ automatically
@skills backend-quality-gates
```

## For Each Skill, Know

- **When to load** — at which phase of the task
- **What it checks** — the core checklist items
- **Where the source is** — which canonical document to reference if clarification is needed

## References

- [docs/ai-agents/pr-quality-gates.md](../pr-quality-gates.md) — canonical quality gates
- [docs/ai-agents/agent-command-runbook.md](../agent-command-runbook.md) — standard commands
- [docs/ai-agents/backend-agent-template.md](../backend-agent-template.md) — backend roles
- [docs/ai-agents/secret-handling-policy.md](../secret-handling-policy.md) — secret rules
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
