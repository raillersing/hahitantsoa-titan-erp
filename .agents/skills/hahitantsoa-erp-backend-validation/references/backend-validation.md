# Backend Validation

Approved patterns:

```sh
scripts/dev/erp-backend-compose-ci config --quiet
scripts/dev/erp-backend-compose-ci config --services
scripts/dev/erp-backend-compose-ci up -d db redis backend
scripts/dev/erp-backend-compose-ci exec -T backend python backend/manage.py check
scripts/dev/erp-backend-compose-ci run --rm backend python -m pytest tests/backend/...
scripts/ci/backend-quality tests/backend/...
```

Rules:

- Use project wrappers only.
- Do not read or source `.env`.
- Do not use host Python for backend Django validation.
- Keep validation scoped to the approved backend task.
