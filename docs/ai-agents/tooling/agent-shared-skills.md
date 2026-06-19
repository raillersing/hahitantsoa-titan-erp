# Agent Shared Skills Guide

This document describes the shared agent skills under [`.agents/skills/`](../../.agents/skills) and how to use them across agents (Codex, Claude Code, OpenCode).

## Overview

Shared skills provide load-on-demand checklists and procedures for repetitive agent tasks. They are model-agnostic and agent-agnostic — any agent that supports the `skill` tool can use them.

## Available Skills

| Skill | Purpose | Applies to |
|-------|---------|------------|
| [`erp-task-start`](../../.agents/skills/erp-task-start/SKILL.md) | Mandatory task-start baseline and scope check | All executable agents |
| [`erp-quality-gates`](../../.agents/skills/erp-quality-gates/SKILL.md) | Pre-commit quality verification for backend PRs | Backend agents |
| [`erp-agent-roles`](../../.agents/skills/erp-agent-roles/SKILL.md) | Role-specific checklists for backend agents A–F | Backend agents |
| [`erp-ci-workflow`](../../.agents/skills/erp-ci-workflow/SKILL.md) | CI wait, merge, and post-merge validation | All agents opening PRs |
| [`erp-worktree-discipline`](../../.agents/skills/erp-worktree-discipline/SKILL.md) | One-agent-one-worktree rules | All agents |
| [`erp-secret-handling`](../../.agents/skills/erp-secret-handling/SKILL.md) | Never-read-.env and log hygiene rules | All agents |
| [`erp-business-boundaries`](../../.agents/skills/erp-business-boundaries/SKILL.md) | Titan vs Hahitantsoa domain rules | All agents |
| [`erp-post-merge-cleanup`](../../.agents/skills/erp-post-merge-cleanup/SKILL.md) | Branch/worktree/Docker cleanup procedure | All agents after merge |

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
skill erp-quality-gates
```

### Codex

```sh
# Codex loads skills from .agents/skills/ automatically
@skills erp-quality-gates
```

### Claude Code

```sh
# Claude Code loads skills from .agents/skills/ automatically
@skills erp-quality-gates
```

## For Each Skill, Know

- **When to load** — at which phase of the task
- **What it checks** — the core checklist items
- **Where the source is** — which canonical document to reference if clarification is needed

## Onboarding for New Skills

When a new skill is added to `.agents/skills/`:

1. Add a row to the table above.
2. Update the skills portfolio audit (`F151C0`) if relevant.
3. Ensure the skill has `name` and `description` frontmatter.
4. Confirm no duplicate `name` values across `.agents/skills/` and `.opencode/skills/`.
5. Verify the skill follows model-agnostic and agent-agnostic conventions.
6. Update this guide if the skill changes existing loading or usage rules.

## Discovery

Agents can discover available skills by listing directories under `.agents/skills/`:

```sh
ls .agents/skills/*/SKILL.md
```

Each skill's `name` and `description` frontmatter fields allow agents to determine relevance without loading the full content.

## References

- [docs/ai-agents/pr-quality-gates.md](../pr-quality-gates.md) — canonical quality gates
- [docs/ai-agents/agent-command-runbook.md](../agent-command-runbook.md) — standard commands
- [docs/ai-agents/backend-agent-template.md](../backend-agent-template.md) — backend roles
- [docs/ai-agents/secret-handling-policy.md](../secret-handling-policy.md) — secret rules
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
