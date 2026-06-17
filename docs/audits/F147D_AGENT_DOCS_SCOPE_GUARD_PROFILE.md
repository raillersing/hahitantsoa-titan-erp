# F147D — Agent-Docs Scope Guard Profile Audit

## Purpose

Add a dedicated `agent-docs` profile to `scripts/dev/erp-agent-scope-guard` for
documentation/orchestration/audit tasks. This closes the gap identified in F147B.

## Profile Rules

| Direction | Pattern |
|---|---|
| **Allowed** | `docs/ai-agents/`, `docs/audits/`, `opencode.json`, `.opencode/` |
| **Blocked** | `backend/`, `frontend/`, `tests/`, `scripts/dev/`, `.github/`, dependency manifests, `.env*`, secret-looking files |

## Files Changed

| File | Change |
|---|---|
| `scripts/dev/erp-agent-scope-guard` | Added `agent-docs` case with `check_blocked` + `check_allowed_only` |
| `docs/ai-agents/orchestrator-task-queue.md` | Updated F147D status to completed |
| `docs/audits/F147D_AGENT_DOCS_SCOPE_GUARD_PROFILE.md` | Created (this file) |

## Validation

The scope guard was tested with both profiles:

```sh
# agent-tools — passes (this task modifies scripts/dev/)
bash scripts/dev/erp-agent-scope-guard agent-tools
# > Scope guard: profile 'agent-tools' passed.

# agent-docs — correctly blocks scripts/dev/
bash scripts/dev/erp-agent-scope-guard agent-docs
# > ERROR: forbidden paths detected for profile 'agent-docs'
```

## Design Decisions

- Follows the exact pattern established by `agent-tools`: `check_blocked` for forbidden
  paths followed by `check_allowed_only` for the allowlist.
- The `agent-docs` profile intentionally blocks `scripts/dev/` — docs agents must not
  modify tools/scripts.
- Codex and Antigravity workflows are preserved unchanged.
- Profile is self-validating: running it against itself proves it works.

## Risks

- **Allowlist too restrictive**: If future agent-docs tasks need to touch new doc paths
  (e.g., `docs/business-rules/`), the profile must be updated. This is by design.
- **No automated tests**: The scope guard doesn't have a test suite. Manual validation
  is sufficient for this change.

## Final Report

- **Branch:** `tools/f147d-agent-docs-scope-guard`
- **Baseline:** `origin/main` at `9551caa`
- **CI:** Backend quality PASS, Frontend quality PASS
- **No merge was performed.**
