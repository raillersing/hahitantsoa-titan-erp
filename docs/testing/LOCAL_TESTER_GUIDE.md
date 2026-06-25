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
docker compose -f compose.agent-ci.yaml up -d postgres18 redis8

# 2. Backend environment and migrations
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env   # edit if needed
python manage.py migrate

# 3. Seed demo data
python manage.py seed_demo_customers
python manage.py seed_demo_inventory
python manage.py seed_demo_availability
python manage.py seed_demo_reservation_drafts
python manage.py seed_demo_hahitantsoa_event_drafts
python manage.py seed_dev_user

# 4. Start backend dev server
python manage.py runserver 0.0.0.0:8000 &

# 5. Frontend
cd ../frontend
npm ci
cp .env.example .env
npm run dev

# 6. Open http://localhost:5173
```

Dev user credentials (from `seed_dev_user`):
- Username: `dev`
- Password: `dev`

## Demo data overview

After seeding, the system contains:

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

### Scenario A: Titan rental flow

1. **Log in** as `dev`/`dev`
2. Navigate to **Titan** in the sidebar
3. View the list of inventory items and reservation drafts
4. Create a **new reservation draft**: select a customer, period, and items
5. Open the draft detail and:
   - Mark **contract signed**
   - Mark **deposit received**
   - **Confirm** the reservation
6. View the draft status change from `draft` to `confirmed`

### Scenario B: Hahitantsoa event flow

1. Navigate to **Hahitantsoa** in the sidebar
2. View the discovery panel (read-only concepts)
3. Create a new event draft with event name, venue, period, and items
4. Check availability preview
5. Check confirmation preflight
6. Confirm the event draft
7. (Optional) Create an amendment request and modify lines

### Scenario C: Customer and commercial operations

1. Navigate to **Customers**, search for "SARL Event Plus"
2. View the customer detail
3. Navigate to **Commercial Ops** — explore the tabbed interface:
   - **Billing**: view invoices (none seeded yet, can be created from confirmed reservations)
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
3. Navigate to **Identity** — view roles and assignments (read-only for non-admin users)

## Cleanup

```bash
# Stop backend dev server (Ctrl+C or kill)

# Stop Docker services
cd /home/raillersing/projects/hahitantsoa-titan-erp
docker compose -f compose.agent-ci.yaml down

# Re-seed from scratch (drops and recreates data):
python manage.py seed_demo_customers    # re-runnable, upserts
python manage.py seed_demo_inventory    # re-runnable, upserts
python manage.py seed_demo_reservation_drafts  # re-runnable, upserts
python manage.py seed_demo_hahitantsoa_event_drafts  # re-runnable, upserts
```

## Known limitations

- Billing invoices are not pre-seeded; create them from a confirmed reservation
- Logistics events are not pre-seeded; create them from Commercial Ops
- No pre-seeded admin user with full permissions (use `seed_dev_user`)
- Reports/exports UI is a placeholder awaiting business decision
- Planning/calendar UI is a placeholder
- All demo data is created with `DEBUG=True` guard — never runs in production
