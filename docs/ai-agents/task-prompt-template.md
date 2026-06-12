# Multi-agent task prompt template

```text
Repository:
<path>

Baseline:
- base branch: <branch>
- expected commit: <sha>

Task:
<task id and title>

Objective:
<small, testable result>

Scope:
- allowed files/areas: <list>
- forbidden files/areas: <list>
- forbidden behavior: <list>

Required agents:
- backend: <Agent A-F roles or none>
- frontend: <Agent FE-A-F roles or none>
- Codex subagents: use when available; otherwise execute roles sequentially in Codex

Execution authorization:
- inspect: yes/no
- edit: yes/no
- commit: yes/no
- push: yes/no
- open PR: yes/no
- merge: no

Required implementation:
<requirements>

Required tests/checks:
<focused checks and applicable quality gates>

PR body requirements:
- summary
- files changed
- agent findings and resolutions
- tests/checks
- explicit exclusions
- risks and next slice
- No merge was performed.

Final report requirements:
- branch
- commit SHA
- PR number/URL when created
- files changed
- agent findings
- tests/checks with exact results
- scope confirmation
- risks/blockers
- No merge was performed.

Environment rules:
- important commands use scripts/dev/erp-logged-run with heredoc stdin
- use .venv/bin/python, .venv/bin/pytest, or Docker Compose; no bare python
- never read, display, source, inspect, or modify .env or secrets
- use Codex and Codex subagents only
- OpenClaw is decommissioned: never create, modify, resync, commit, push, merge, or
  rely on OpenClaw sandbox output
```
