# Copilot instructions - Hahitantsoa / Titan ERP

Follow `AGENTS.md` as the concise source of truth and `docs/ai-agents/` as the only
official detailed multi-agent workflow.

- One task, one branch, one controlled PR.
- Use the required backend or frontend agent roles for the task risk.
- Review agents report findings and never silently edit.
- Run important commands through `scripts/dev/erp-logged-run` using heredoc stdin.
- Use `.venv/bin/python`, `.venv/bin/pytest`, or Docker Compose instead of bare
  `python`.
- Never read, display, source, inspect, or modify `.env` or secrets.
- Use Codex and Codex subagents only.
- OpenClaw is decommissioned: do not create, modify, resync, commit, push, merge, or
  rely on OpenClaw sandbox output.
- Keep Titan limited to `material`, `article`, and `material_pack`.
- Do not invent business behavior, APIs, payloads, models, migrations, or frontend
  workflows.
- Require CI before merge and post-merge validation on `main`.
- After merge, confirm `main` CI and clean local task/review branches when authorized.
- Never merge automatically.
