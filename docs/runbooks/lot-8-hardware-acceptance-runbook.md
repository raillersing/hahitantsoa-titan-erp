# Lot 8 — Physical Hardware Acceptance & Raspberry Pi Deployment Runbook

## 1. Context and Purpose

This runbook defines the operational deployment and physical verification procedures for
**Lot 8** of the 2026-11-05 Client Correction Plan (`reports/plan-corrections-client-2026-11-05.md`),
following the complete merge of all software requirements (Phases 1–12 and Lots R1–R11).

### Acceptance Scope
1. **Server Hardware Qualification**: Deployment on a customer-premise **Raspberry Pi 5** (8 GB RAM, ARM64, Debian 12 Bookworm).
2. **Thermal Receipt Printing Acceptance**: Physical print calibration on an **Xprinter 80 mm thermal printer** using the approved **80 × 104 mm** geometry.
3. **Multi-Terminal LAN Verification**: Real concurrent qualification across two physical client devices (tablets or workstations) accessing the on-premise Raspberry Pi server.

---

## 2. Raspberry Pi 5 On-Premise Architecture

### 2.1 Hardware Specification
- **Host**: Raspberry Pi 5 Model B (8 GB RAM recommended, 4 GB minimum).
- **Storage**: High-endurance microSD card (A2, V30 class) or USB 3.0 NVMe SSD (minimum 64 GB).
- **Network**: Wired Gigabit Ethernet (`eth0`), assigned a static IP (e.g., `192.168.1.50/24`) or static DHCP lease on the local router.
- **Operating System**: Raspberry Pi OS 64-bit (Debian 12 Bookworm, kernel 6.6+).

### 2.2 System Services & Containers
The on-premise stack runs via Docker Compose with dedicated restart policies:
```
+--------------------------------------------------------------+
|                     Local Network (LAN)                      |
|                  192.168.1.0/24 (Wi-Fi / RJ45)               |
+--------------------------------------------------------------+
                               |
                               v
                     Port 80 / 443 (HTTP/HTTPS)
+--------------------------------------------------------------+
| Raspberry Pi 5: Reverse Proxy (Nginx / Caddy)                 |
| - Serves Vite static frontend bundle (/app/dist)             |
| - Proxies /api/ and /admin/ to Backend                       |
| - Local TLS termination (self-signed LAN cert or mkcert)     |
+--------------------------------------------------------------+
            |                                      |
            v                                      v
+------------------------+            +------------------------+
| titan-backend:prod     |            | db: postgres:17        |
| - Django Gunicorn      | <--------> | - Persistent storage   |
| - WeasyPrint PDF engine|            |   under /var/lib/...   |
+------------------------+            +------------------------+
            |
            v
+------------------------+
| redis: 7.4-alpine      |
| - Sessions & caching   |
+------------------------+
```

---

## 3. Deployment & Migration Procedures

### Step 3.1: Host Environment Preparation
1. Ensure Docker Engine and Docker Compose Plugin are installed:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   ```
2. Verify host memory and swap allocation:
   ```bash
   free -m
   # Recommended: 2 GB swapfile if running on 4 GB RAM models
   ```

### Step 3.2: Pulling Verified Release Images
Ensure the deployment checks out the exact verified `main` commit (`aa8e69697dfcfc2d9c193123ed50b0fecd2cb6b0`):
```bash
git clone https://github.com/raillersing/hahitantsoa-titan-erp.git /opt/titan-erp
cd /opt/titan-erp
git checkout aa8e69697dfcfc2d9c193123ed50b0fecd2cb6b0
```

### Step 3.3: Pre-Deployment Backup
Before executing migrations on an existing on-premise installation:
```bash
# Export existing PostgreSQL database
docker compose -f compose.prod.yaml exec -T db pg_dump -U titan titan > /opt/backups/titan_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

### Step 3.4: Applying Migrations
Execute the migrations non-destructively:
```bash
docker compose -f compose.prod.yaml run --rm backend python backend/manage.py migrate --noinput
```
Expected migrations applied:
- `customers.0012_...`
- `reservations.0014_reservationwizardsession_reservationwizardfile_and_more`
- `inventory.0013_stock_truth_alerts`

### Step 3.5: Healthcheck Verification
Check that all services are healthy and responsive:
```bash
curl -f http://localhost:8000/api/v1/health/ || echo "Health check failed"
```

---

## 4. Xprinter 80 mm Thermal Receipt Calibration

### 4.1 Target Physical Geometry: 80 × 104 mm
- **Paper Roll Width**: Standard 80 mm thermal paper roll (printable width: 72 mm / 576 dots).
- **Target Page Length**: 104 mm fixed height receipt (aspect ratio ~ 0.77).
- **Resolution**: 203 DPI (8 dots/mm).

### 4.2 Printer Configuration & Connection
1. **Connection Modes**:
   - **USB direct**: Connected to Raspberry Pi USB 2.0/3.0 port (`/dev/usb/lp0`).
   - **LAN (Ethernet)**: Connected to same subnet (e.g. `192.168.1.100:9100`).
2. **Linux CUPS Driver Setup**:
   ```bash
   # Install CUPS and printer utilities
   sudo apt-get install -y cups printer-driver-all
   sudo usermod -aG lpadmin $USER
   # Register printer with 80x104mm custom media
   lpadmin -p Xprinter_Receipt -E -v usb://Xprinter/... -m raw
   ```

### 4.3 Browser / Client Print Calibration
When printing via Web Browser (Chrome / Edge / Firefox):
- **Paper Size**: Select `Custom: 80 mm × 104 mm` (or `Receipt 80 × 104 mm`).
- **Margins**: Set to **None** (margins are handled strictly inside CSS `@page { size: 80mm 104mm; margin: 2mm 3mm; }`).
- **Headers and Footers**: **Disabled** (uncheck "Headers and footers" to avoid date/URL printing on top and bottom).
- **Scale**: **100%** (do not use "Fit to printable area" to avoid distortion of barcodes and QR codes).

### 4.4 Physical Print Inspection Checklist
| Item | Verification Step | Expected Physical Result | Pass/Fail |
|---|---|---|---|
| **P-1** | Header Alignment | Logo centered, company details clearly legible without clipping. | [ ] |
| **P-2** | Reference & Date | Official document reference (e.g. `REC-2026-0001`) printed with ISO date/time. | [ ] |
| **P-3** | Line Items Table | Description, unit price, quantity, and subtotal aligned properly within 72 mm printable width. | [ ] |
| **P-4** | Barcode / QR Code | Thermal scan of barcode/QR with standard mobile camera decodes accurate reservation URL. | [ ] |
| **P-5** | Multi-Page Continuation | For receipts exceeding 104 mm, pagination prints page 1/2 and 2/2 without cutting financial numbers in half. | [ ] |
| **P-6** | Cutter / Tear-off | Tear-off line is located exactly 3–5 mm below the final footer text or barcode. | [ ] |

---

## 5. Multi-Terminal LAN Qualification Protocol

Execute these test scenarios with two operators using two separate physical devices on the local network (e.g., Terminal A: Laptop, Terminal B: Tablet).

### Scenario 1: Cross-Terminal Wizard Session Recovery (Lot R5)
1. **Operator A (Terminal A)**:
   - Log into ERP as commercial agent.
   - Navigate to `Nouvelle réservation` (Reservation Wizard).
   - Enter Customer, Dates, and select 3 items. Complete Step 1 and Step 2.
   - Observe automatic background sync (server persistence).
   - Close browser tab on Terminal A before confirming.
2. **Operator B (Terminal B)**:
   - Log into ERP with the same or collaborator account.
   - Access the in-progress wizard sessions list (`/api/v1/reservations/wizard-sessions/`).
   - Resume the session saved by Operator A.
   - **Verification**: All selected dates, items, quantities, and uploaded attachments appear exactly as entered on Terminal A without data loss.

### Scenario 2: Optimistic Locking & Conflict Avoidance (HTTP 409)
1. **Terminal A & Terminal B**: Both open the same wizard session at revision 2.
2. **Terminal A**: Changes end date and saves (revision advances to 3).
3. **Terminal B**: Attempts to modify item quantities from old revision 2 and clicks Next.
4. **Verification**:
   - Backend responds with structured `HTTP 409 Conflict`.
   - Terminal B UI displays conflict banner explaining that the session was updated on another terminal.
   - Allows Terminal B to load the latest server state without silent data overwrite.

### Scenario 3: Real-Time Live Refresh Propagation (Lot R8)
1. **Terminal A**: Opens `Planning` or `Réservations`.
2. **Terminal B**: Creates a new reservation or confirms an existing booking.
3. **Terminal A**: Observe window focus or automatic live refresh interval (~15–30s).
4. **Verification**: Terminal A updates its calendar/table to reflect Terminal B's reservation without requiring a full manual browser page reload.

### Scenario 4: Stock Truth & Rupture Indicators (Lot R9)
1. **Terminal A**: Navigates to `Catalogue` / `Stock`.
2. **Terminal B**: Confirms a reservation that books the remaining inventory of an article (e.g. 5 available -> 5 reserved).
3. **Verification**:
   - Stock summary reflects `available_stock = 0`, `reserved_stock = 5`.
   - The article displays `Rupture` badge instead of `Inactif`.
   - `reconcile_inventory_stock_alerts` updates notification indicators.

---

## 6. Rollback & Emergency Recovery Protocol

In case of hardware failure or service interruption during acceptance:

1. **Service Restart**:
   ```bash
   docker compose -f compose.prod.yaml restart backend
   ```
2. **Database Rollback** (if unrecoverable schema error occurs):
   ```bash
   docker compose -f compose.prod.yaml down
   docker volume rm titan-erp_postgres_data
   docker compose -f compose.prod.yaml up -d db
   cat /opt/backups/titan_pre_migration_*.sql | docker compose -f compose.prod.yaml exec -T db psql -U titan titan
   docker compose -f compose.prod.yaml up -d
   ```
3. **Emergency Logging Inspection**:
   ```bash
   docker compose -f compose.prod.yaml logs --tail=100 -f backend
   ```

---

## 7. Acceptance Sign-Off

| Verification Milestone | Responsible Role | Date Verified | Signature / Status |
|---|---|---|---|
| Raspberry Pi 5 Container Boot & Healthcheck | Infrastructure Lead | ____________ | [ ] APPROVED |
| Xprinter 80 mm Thermal Print Physical Check | Commercial Manager | ____________ | [ ] APPROVED |
| Multi-Terminal Wizard Concurrency Test | QA / Commercial Operator | ____________ | [ ] APPROVED |
| Final Operational Handover | Product Owner / Human Authority | ____________ | [ ] APPROVED |
