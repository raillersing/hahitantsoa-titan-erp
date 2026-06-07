# Codex validation checklist

Use this checklist at the end of a Codex task. Trim only the checks that are clearly irrelevant to the approved scope.

## Agent A - Implementer checklist

- [ ] Correct approved branch is active.
- [ ] Working tree was clean before the task started.
- [ ] Only the approved scope was modified.
- [ ] Documentation-only scope was preserved when applicable.
- [ ] Every terminal command used `scripts/dev/erp-logged-run`.
- [ ] Required validations were executed and their results summarized.
- [ ] Diff and changed files were summarized.
- [ ] Documentation/status was updated when applicable.
- [ ] No `.env` file was accessed.
- [ ] No `git add`, commit, push, PR creation or merge was performed.

## Agent B - Reviewer/QA checklist

- [ ] Review the diff and evidence without implementing changes.
- [ ] Verify the approved scope was respected.
- [ ] Verify Hahitantsoa and Titan business rules.
- [ ] Verify no forbidden files were modified.
- [ ] Verify validation logs and reported results.
- [ ] Identify missing tests or documentation when applicable.
- [ ] Confirm no `.env` access or secret exposure.
- [ ] Produce one verdict: `APPROVE`, `REQUEST CHANGES` or `BLOCK`.

## Prompt workflow

- [ ] Confirm whether the task was sensitive, structural or explicitly approval-gated.
- [ ] Confirm sensitive work started with `PLAN ONLY`.
- [ ] Confirm `PLAN ONLY` listed files to create or modify.
- [ ] Confirm `PLAN ONLY` listed planned validations.
- [ ] Confirm implementation started only after explicit approval.
- [ ] Confirm implementation followed `IMPLEMENT APPROVED PLAN`.
- [ ] Confirm no files outside the approved scope were changed.
- [ ] Confirm useful documentation updates were included in the same PR when necessary and reasonable.
- [ ] Confirm any separate documentation PR is justified by a large documentation review, a missed update, a workflow decision change, or a structural runbook/matrix/documentation change.
- [ ] Confirm no `git add`, commit or push was executed.

## Git and scope

- [ ] Agents use the logged terminal wrapper for every terminal command:

  ```sh
  scripts/dev/erp-logged-run <task-name> <<'EOF'
  <commands>
  EOF
  ```

- [ ] Confirm the wrapper receives commands through stdin/heredoc and was not invoked as
  `scripts/dev/erp-logged-run <task-name> bash -c '...'`.

- [ ] Confirm no command in a logged run prints `.env`, passwords, tokens or secrets.

- [ ] Confirm active branch:

  ```sh
  git branch --show-current
  ```

- [ ] Confirm working tree status:

  ```sh
  git status --short
  ```

- [ ] Review changed files:

  ```sh
  git diff --name-status
  git diff --stat
  ```

- [ ] Verify forbidden files were not changed:

  ```sh
  git diff --name-only -- .env .env.example compose.yaml pyproject.toml backend/config backend/apps docs/decisions
  ```

- [ ] Confirm `.env` is not tracked or staged:

  ```sh
  git status --short -- .env
  git ls-files .env
  ```

## Quality checks

- [ ] Use an already configured shell environment or documented local tooling for commands
  requiring environment variables. Validation commands must never source, print, inspect or
  otherwise read `.env` directly.

- [ ] Use `.venv/bin/python` and `.venv/bin/pytest` for local Python and pytest commands.

- [ ] Run Ruff format check when Python files changed:

  ```sh
  .venv/bin/python -m ruff format --check .
  ```

- [ ] Run Ruff lint when Python files changed:

  ```sh
  .venv/bin/python -m ruff check .
  ```

- [ ] Run targeted tests when code changed:

  ```sh
  .venv/bin/python -m pytest <target>
  ```

- [ ] Run app migration check when a Django app or model area changed:

  ```sh
  .venv/bin/python backend/manage.py makemigrations <app> --check --dry-run
  ```

- [ ] Run global migration check when models or installed apps changed:

  ```sh
  .venv/bin/python backend/manage.py makemigrations --check --dry-run
  ```

- [ ] Run Django system check when backend Django code or settings changed:

  ```sh
  .venv/bin/python backend/manage.py check
  ```

## Docker and readiness

- [ ] Run Docker validation when DB, migrations, Compose, API behavior or local service behavior changed.

- [ ] Confirm Docker services `db` and `redis` are healthy before running Titan/reservations DB
  tests.

- [ ] Run a temporary-container Django check when appropriate:

  ```sh
  docker compose run --rm backend python backend/manage.py check
  ```

- [ ] Check `/readyz/` if the backend is started:

  ```sh
  curl -i http://127.0.0.1:8000/readyz/
  ```

## Final report

- [ ] Report branch.
- [ ] Report files created and modified.
- [ ] Confirm no forbidden artifacts were created.
- [ ] Confirm `.env` was not touched.
- [ ] Report commands and results.
- [ ] List points to validate before commit.
