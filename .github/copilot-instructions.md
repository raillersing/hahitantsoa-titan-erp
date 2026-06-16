# Copilot instructions - Hahitantsoa / Titan ERP

Follow `AGENTS.md` as the concise source of truth and `docs/ai-agents/` as the only
official detailed multi-agent workflow.

Keep prompts short and reference these official documents instead of repeating long
command lists:

- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/backend-agent-template.md` for backend Agent A-F role selection
- `docs/ai-agents/prompt-contracts/backend-orchestrator.md` for backend orchestrator
  prompts
- `docs/ai-agents/frontend-agent-template.md` for frontend Agent FE-A through FE-F role
  selection
- `docs/ai-agents/prompt-contracts/frontend-orchestrator.md` for frontend orchestrator
  prompts

- One task, one branch, one controlled PR.
- One agent, one worktree, one branch, one non-overlapping scope.
- Use the required backend or frontend agent roles for the task risk.
- In backend orchestration, assign only relevant agents: Agent A implements, Agent B
  reviews independently, and Agents C/D/E/F are used only when relevant.
- In frontend orchestration, assign only relevant agents: Agent FE-A implements, Agent
  FE-B reviews independently when UI behavior changes, and Agent FE-C/FE-D/FE-E/FE-F
  are used only when relevant.
- Keep backend orchestration, frontend orchestration, and Antigravity/tooling
  orchestration separate. Use the matching prompt contract or tooling governance docs.
- Review agents report findings and never silently edit.
- Run important commands through `scripts/dev/erp-logged-run` using heredoc stdin.
- Use `.venv/bin/python`, `.venv/bin/pytest`, or Docker Compose instead of bare
  `python`.
- Never read, display, source, inspect, or modify `.env` or secrets.
- Never touch tokens, private keys, or secret-like files.
- Use Codex and Codex subagents only.
- OpenClaw is decommissioned: do not create, modify, resync, commit, push, merge, or
  rely on OpenClaw sandbox output.
- Keep Titan limited to `material`, `article`, and `material_pack`.
- Do not invent business behavior, APIs, payloads, models, migrations, or frontend
  workflows.
- Backend agents must not fix frontend. Frontend agents must not mutate backend unless
  an explicit API contract mismatch authorization allows the minimum required change.
- Backend bundles must stay medium-sized and coherent.
- Never modify another active worktree and never put two agents on the same files.
- Review agents are non-mutating unless explicitly authorized.
- After F138B/F138C merge on `main`, use `scripts/dev/erp-backend-compose-ci`,
  `scripts/dev/erp-agent-scope-guard`, and `scripts/dev/erp-worktree-preflight` when
  applicable.
- Require CI before merge and post-merge validation on `main`.
- Reporting alone is not a stopping condition.
- After merge and green `main` CI, continue to the next clear backend bundle unless a
  hard stop condition occurs.
- After merge and green `main` CI, continue to the next clear frontend bundle unless a
  hard stop condition occurs.
- After merge, confirm `main` CI and clean local task/review branches when authorized.
- Never merge automatically.
