# F148G — Production Readiness / QA Infrastructure Audit

## 1. Executive Summary

This report evaluates the production readiness and QA infrastructure of the
Hahitantsoa/Titan ERP system. It is a docs-only audit based on repository evidence
from F148A §5.10 and live inspection. No scripts, workflows, config files, or code
are modified.

**Estimated production readiness: 40%** (unchanged from F148A)

The system has solid unit/integration test coverage for backend domains and a working
CI pipeline, but lacks the infrastructure needed for production deployment, E2E
validation, and development velocity tooling.

---

## 2. Current QA and CI State

| Parameter | Value |
|---|---|
| **Backend test files** | 89 files (~14,230 lines) |
| **Frontend test files** | 13 files (~86 test cases) |
| **E2E test files** | 0 (empty `tests/e2e/` with only `.gitkeep`) |
| **CI workflow** | `.github/workflows/ci.yml` — Backend quality + Frontend quality |
| **CI concurrency/cancel** | Not configured |
| **Secret scanning** | Local-only (`erp-secret-scan-local`) |
| **Coverage reporting** | Not configured |
| **tsc type checking in CI** | Not configured |
| **Pre-commit hooks** | Not configured |
| **Conftest/factory fixtures** | None |
| **Production deployment config** | None |

---

## 3. Gap Analysis

### 3.1 No Shared Test Fixtures (conftest.py)

**Impact:** High. Every test file bootstraps its own data inline. This creates:
- High maintenance burden when model schemas change
- Inconsistent test data across test files
- No reusable factory patterns (factory_boy or similar)
- Higher barrier for writing new tests

**Evidence:** No `conftest.py` exists anywhere in `tests/`. All 89 backend test files
create their own ORM objects inline.

### 3.2 No E2E Tests

**Impact:** High. The `tests/e2e/` directory contains only a `.gitkeep` placeholder.
There is no system-level validation that:
- The full request/response chain works
- Frontend and backend integrate correctly
- Authentication flows work end-to-end
- Business workflows (reservation → document → payment) execute correctly

### 3.3 No Coverage Reporting

**Impact:** Medium. Without coverage measurement:
- Untested code paths are invisible
- PRs can merge without testing new code
- No coverage regression gate exists
- No baseline to track QA improvement over time

**Evidence:** No `[tool.coverage]` section in `pyproject.toml`, no `.coveragerc`,
no coverage step in CI.

### 3.4 No TypeScript Type Checking in CI

**Impact:** Medium. The frontend builds with Vite (which does not type-check), and
CI does not run `tsc --noEmit`. This means:
- TypeScript errors can pass CI
- `any`-typed values and type mismatches go undetected until runtime
- Developers must remember to run `tsc --noEmit` locally

**Evidence:** CI workflow has zero mentions of `tsc`.

### 3.5 No Production Deployment Configuration

**Impact:** Medium. The system has:
- No nginx, gunicorn, or uvicorn configuration
- No production Docker Compose file
- No environment-specific settings profile
- No health check endpoints beyond basic `/healthz/`
- No monitoring, logging, or alerting setup

All infrastructure is CI-only.

### 3.6 No CI Concurrency or Auto-Cancel

**Impact:** Low-Medium. Multiple pushes to the same PR can stack CI runs, wasting
runner time. The CI workflow has no `concurrency` setting to cancel in-progress runs
when a new push arrives.

### 3.7 No Pre-Commit Hooks

**Impact:** Low. Developers must remember to run `ruff`, `tsc`, `git diff --check`,
and secret scanning manually. No automated gate prevents committing:
- Whitepace errors
- Unformatted Python
- Secret-like patterns in code
- TypeScript type errors

### 3.8 No Secret Scanning in CI

**Impact:** Low-Medium. The `scripts/dev/erp-secret-scan-local` script exists for
local use but is not run in CI. Secrets committed by accident would only be caught
after push (via GitHub's built-in secret scanning, not custom patterns).

---

## 4. Recommended QA Infrastructure Improvements

These are docs-only recommendations. Implementation would require a separate
tools-governance task after F148B completes and F145H/F147F merge.

| # | Improvement | Effort | Dependencies |
|---|---|---|---|
| 1 | Add `conftest.py` with shared fixtures + factory fixtures | Medium | None (pure test infra) |
| 2 | Add `tsc --noEmit` step to CI frontend job | Small | None |
| 3 | Add coverage reporting to CI (`pytest --cov --cov-report=`) | Small | Requires pytest-cov in deps |
| 4 | Add CI concurrency/auto-cancel setting | Small | None |
| 5 | Implement 1-2 E2E smoke tests (health + login + basic flow) | Medium | Requires Playwright/Selenium |
| 6 | Add production Docker Compose + gunicorn config | Medium | Requires deployment env |
| 7 | Add secret scanning to CI | Small | None (script exists) |
| 8 | Add pre-commit hook config | Small | None |

---

## 5. Validation Performed

- `bash scripts/dev/erp-agent-scope-guard agent-docs` — PASS (no forbidden paths)
- `git diff --check` — PASS (no whitespace errors)
- `git status --short` — clean
- No `backend/`, `frontend/`, `tests/`, `scripts/dev/`, `.github/`, `.env`, or
  dependency manifest files created or modified
- No `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` included
