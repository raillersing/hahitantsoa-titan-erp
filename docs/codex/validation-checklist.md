# Codex validation checklist

Use this checklist at the end of a Codex task. Trim only the checks that are clearly irrelevant to the approved scope.

## Prompt workflow

- [ ] Confirm whether the task was sensitive, structural or explicitly approval-gated.
- [ ] Confirm sensitive work started with `PLAN ONLY`.
- [ ] Confirm `PLAN ONLY` listed files to create or modify.
- [ ] Confirm `PLAN ONLY` listed planned validations.
- [ ] Confirm implementation started only after explicit approval.
- [ ] Confirm implementation followed `IMPLEMENT APPROVED PLAN`.
- [ ] Confirm no files outside the approved scope were changed.
- [ ] Confirm no `git add`, commit or push was executed.

## Git and scope

- [ ] Use the logged terminal wrapper for long or important local validations when useful:

  ```sh
  scripts/dev/erp-logged-run <task-name> <<'EOF'
  <commands>
  EOF
  ```

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
  set -a && source .env && set +a && .venv/bin/python -m pytest <target>
  ```

- [ ] Run app migration check when a Django app or model area changed:

  ```sh
  set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations <app> --check --dry-run
  ```

- [ ] Run global migration check when models or installed apps changed:

  ```sh
  set -a && source .env && set +a && .venv/bin/python backend/manage.py makemigrations --check --dry-run
  ```

- [ ] Run Django system check when backend Django code or settings changed:

  ```sh
  set -a && source .env && set +a && .venv/bin/python backend/manage.py check
  ```

## Docker and readiness

- [ ] Run Docker validation when DB, migrations, Compose, API behavior or local service behavior changed.

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
