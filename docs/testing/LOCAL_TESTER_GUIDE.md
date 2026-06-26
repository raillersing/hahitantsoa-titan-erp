# Local Tester Guide — Hahitantsoa / Titan ERP

## Prerequisites

- Git clone of the repository
- Docker Desktop (Windows) with WSL2 backend
- Node.js 22+ and npm
- Python 3.14+ with `pip` and `pipx`

## Quick setup

```bash
# 1. Start backend services (PostgreSQL, Redis)
cd /home/raillersing/projects/hahitantsoa-titan-erp
docker compose -f compose.agent-ci.yaml up -d db redis

# 2. Backend environment and migrations
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env   # edit if needed
python manage.py migrate

# 3. Seed all demo data (in dependency order)
python manage.py seed_all_demo

# 4. (Optional) Seed an admin user for full permission testing
python manage.py seed_dev_admin

# 5. Start backend dev server
python manage.py runserver 0.0.0.0:8000 &

# 6. Frontend
cd ../frontend
npm ci
cp .env.example .env
npm run dev

# 7. Open http://localhost:5173
```

## Credentials

| User | Username | Password | Permissions |
|------|----------|----------|-------------|
| Dev user (default) | `dev` | `dev` | `is_staff=False`, `is_superuser=False` |
| Admin (optional) | `admin` | `admin` | `is_staff=True`, `is_superuser=True` |

Dev user credentials are configured via `DJANGO_DEV_USERNAME` / `DJANGO_DEV_PASSWORD` env vars.
Admin user credentials are configured via `DJANGO_ADMIN_USERNAME` / `DJANGO_ADMIN_PASSWORD` env vars.

## Demo data overview

After `seed_all_demo`, the system contains:

| Entity | Count | Details |
|--------|-------|---------|
| Customers | 4 | 2 generic + 2 realistic (SARL Event Plus, Mairie d'Analakely) |
| Inventory items | 3 | Sonorisation, Projecteur, Pack sonorisation+eclairage |
| Availability | periodic | Created by `seed_demo_availability` |
| Titan reservation drafts | 5 | See lifecycle states below |
| Hahitantsoa event drafts | 3 | 3 draft event reservations |

### Titan reservation draft lifecycle states

| Ref | Status | Contract | Deposit | Confirmed | Note |
|-----|--------|----------|---------|-----------|------|
| RD-DEMO-TITAN-001 | draft | - | - | - | Simple draft, no lifecycle actions |
| RD-DEMO-TITAN-002 | draft | - | - | - | Draft with 3 line items |
| RD-DEMO-TITAN-003 | draft | signed | - | - | Contract signed, awaiting deposit |
| RD-DEMO-TITAN-004 | confirmed | signed | received | yes | Fully confirmed, can be used for billing tests |
| RD-DEMO-TITAN-005 | confirmed | signed | received | yes | Past reservation, confirmed |

## Test scenarios

### Scenario A: Titan rental flow (full lifecycle)

1. **Log in** as `dev`/`dev`
2. Navigate to **Titan** in the sidebar
3. View the list of inventory items (3 demo items available)
4. Create a **new reservation draft**:
   - Select customer: "SARL Event Plus"
   - Select period: tomorrow, 4 hours
   - Select items: "Sonorisation standard" (qty 1)
   - Save as draft
5. Open the draft detail and:
   - Mark **contract signed**
   - Mark **deposit received**
   - **Confirm** the reservation
6. Verify the draft status changed from `draft` to `confirmed`
7. Navigate to **Commercial Ops** from the confirmed draft:
   - **Billing**: create an invoice from the confirmed reservation
   - **Payments**: record a payment against the invoice
   - **Logistics**: create a delivery/pickup logistics event
8. Navigate to **Dashboard** and verify summary counts reflect the new reservation

### Scenario B: Hahitantsoa event flow

1. Navigate to **Hahitantsoa** in the sidebar
2. View the discovery panel (read-only concepts)
3. View the 3 pre-seeded event drafts
4. Create a new event draft:
   - Event name: "Fête de la musique"
   - Venue: "Place de l'Indépendance, Antananarivo"
   - Customer: "Mairie d'Analakely"
   - Period: next month, 8 hours
   - Items: select demo inventory items
5. Check availability preview for the selected period
6. Check confirmation preflight
7. Confirm the event draft
8. (Optional) Create an amendment request and modify lines

### Scenario C: Customer and commercial operations

1. Navigate to **Customers**, search for "SARL Event Plus"
2. View the customer detail
3. Navigate to **Commercial Ops** — explore the tabbed interface:
   - **Billing**: view invoices (none seeded yet, create from confirmed reservation RD-DEMO-TITAN-004)
   - **Payments**: create and confirm a payment
   - **Logistics**: create logistics events for confirmed reservations
   - **Documents**: generate proforma, contract, or invoice PDF
   - **Returns**: manage return operations
   - **Damage/Loss**: handle damage/loss settlements
4. Navigate to **Cashbox**: open a session, view movements
5. Navigate to **Caution**: view caution deposits and refund opportunities

### Scenario D: Dashboard, audit, and identity

1. Navigate to **Dashboard** — verify summary counts and quick links
2. Navigate to **Audit** — verify the audit log shows recent events
3. Navigate to **Identity** — view roles and assignments
4. (With admin user) Navigate to **Identity** to manage roles and permissions

### Scenario E: Planning panel

1. Navigate to **Planning** in the sidebar
2. View the weekly planning table with Titan and Hahitantsoa filters
3. Toggle between this week and next week
4. Verify pre-seeded reservations appear on their scheduled dates
5. Verify scope tags (Titan/Hahitantsoa), duration, and resource counts are visible

### Scenario F: Admin user full permission testing

1. **Log in** as `admin`/`admin` (requires `seed_dev_admin`)
2. Navigate to **Identity** — manage roles, create new roles, assign permissions
3. Verify all administrative functions are accessible
4. Verify write operations (create, update, delete) work across all modules

## Cleanup

```bash
# Stop backend dev server (Ctrl+C or kill)

# Stop Docker services
cd /home/raillersing/projects/hahitantsoa-titan-erp
docker compose -f compose.agent-ci.yaml down

# Re-seed from scratch (idempotent, upserts):
python manage.py seed_all_demo
```

## Known limitations

- Billing invoices are not pre-seeded; create them from a confirmed reservation (RD-DEMO-TITAN-004 is confirmed and ready)
- Logistics events are not pre-seeded; create them from Commercial Ops
- Pre-seeded admin user available via `seed_dev_admin` (not included in `seed_all_demo` — run separately)
- Reports/exports UI is intentionally not implemented — gated behind a pending business/legal decision on export data scope, format, and access controls. No endpoints exist, no frontend components. The `#reports` navigation entry is a placeholder.
- Availability is seeded with a fixed 2-hour block starting at the next hour; refresh daily for current data
- All demo data is created with `DEBUG=True` guard — never runs in production
