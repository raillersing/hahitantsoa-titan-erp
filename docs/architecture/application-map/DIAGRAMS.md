# DIAGRAMS.md — Diagrammes Mermaid

> **Version:** F176A — 2026-06-24
> **Usage:** Références visuelles pour l'architecture, les flux et la navigation

---

## 1. Diagramme de contexte C4-like

```mermaid
graph TB
    subgraph Acteurs
        Operator["Opérateur ERP"]
        Admin["Administrateur / Superviseur"]
    end

    subgraph ERP[Hahitantsoa / Titan ERP]
        Frontend["Frontend React 19<br/>Hash-based SPA"]
        Backend["Backend Django 5 + DRF<br/>12 apps métier"]
        DB[(PostgreSQL 17)]
        Cache[(Redis 8)]
    end

    subgraph Externes
        MVola["Passerelle MVola<br/>(sandbox/live)"]
        PDFGen["Générateur PDF<br/>(Mock / WeasyPrint)"]
        K8s["Kubernetes / Docker<br/>(futur)"]
    end

    Operator -->|"Session + CSRF"| Frontend
    Admin -->|"Session + CSRF"| Frontend
    Frontend -->|"REST JSON /api/v1/"| Backend
    Backend -->|"SQL"| DB
    Backend -->|"Cache sessions"| Cache
    Backend -->|"HTTP callback"| MVola
    Backend -->|"HTML/PDF"| PDFGen
    K8s -->|"Orchestration"| Backend
```

---

## 2. Diagramme des conteneurs

```mermaid
graph LR
    subgraph Client
        Browser["Navigateur Web<br/>React 19 + Vite + CSS pur"]
    end

    subgraph Serveur
        Nginx["Nginx / Reverse Proxy<br/>(futur production)"]
        Django["Django Gunicorn<br/>REST Framework + Spectacular"]
    end

    subgraph Données
        Postgres[(PostgreSQL 17)]
        Redis[(Redis 8<br/>Sessions / Cache)]
        Static["Fichiers statiques<br/>(build Vite dist/ + media)"]
    end

    Browser -->|"HTTPS"| Nginx
    Nginx -->|"WSGI"| Django
    Nginx -->|"Static files"| Static
    Django -->|"SQL"| Postgres
    Django -->|"Redis protocol"| Redis
```

---

## 3. Graphe de dépendance des modules backend

```mermaid
graph TD
    common["common<br/>(base models)"]
    identity["identity<br/>(RBAC)"]
    audit["audit<br/>(journal)"]
    customers["customers"]
    inventory["inventory<br/>(items, stock, returns, damage)"]
    reservations["reservations<br/>(drafts, confirmation, closeout)"]
    hahitantsoa["hahitantsoa<br/>(event drafts, amendments)"]
    documents["documents<br/>(templates, instances, PDF)"]
    payments["payments<br/>(ledger, gateway, refunds)"]
    billing["billing<br/>(invoices, installments, credit notes)"]
    cashbox["cashbox<br/>(sessions, movements)"]
    logistics["logistics<br/>(events, handover, delivery notes)"]

    common --> identity
    common --> audit
    common --> customers
    common --> inventory

    identity --> audit
    identity --> logistics

    customers --> documents

    inventory --> documents
    inventory --> logistics
    inventory --> payments
    inventory --> billing
    inventory --> reservations

    reservations --> documents
    reservations --> hahitantsoa
    reservations --> identity

    hahitantsoa --> documents
    hahitantsoa --> payments
    hahitantsoa --> inventory

    payments --> documents
    payments --> billing
    payments --> hahitantsoa
    payments --> inventory

    billing --> documents
    billing --> inventory
    billing --> payments
    billing --> cashbox
    billing --> audit

    cashbox --> billing
    cashbox --> payments
    cashbox --> audit

    documents --> customers
    documents --> hahitantsoa
    documents --> reservations
    documents --> inventory

    logistics --> documents
    logistics --> inventory
    logistics --> reservations
```

---

## 4. Graphe de navigation frontend

```mermaid
graph TD
    App["App.tsx<br/>(Shell + Side Nav)"]
    Login["LoginPanel"]
    Dash["#dashboard<br/>DashboardPanel"]
    Titan["#titan<br/>Titan Module"]
    Hahit["#hahitantsoa<br/>Hahitantsoa Module"]
    Cust["#customers<br/>CustomerPanel"]
    Comm["#commercial-ops<br/>Commercial Ops Panel"]
    Idty["#identity<br/>IdentityPanel"]
    Caut["#caution-refund<br/>CautionRefundPanel"]

    App -->|"Unauthenticated"| Login
    App -->|"Authenticated"| Dash
    App --> Titan
    App --> Hahit
    App --> Cust
    App --> Comm
    App --> Idty
    App --> Caut

    Dash -->|"Navigate"| Titan
    Dash -->|"Navigate"| Hahit
    Dash -->|"Navigate"| Comm

    subgraph TitanSub
        T_Inv["Inline Inventory List"]
        T_Avail["AvailabilityPanel"]
        T_Stock["TitanStockMovementPanel"]
        T_Doc["DocumentArtifactPreviewPanel"]
    end
    Titan --> TitanSub

    subgraph HahitSub
        H_Disc["HahitantsoaDiscoveryPanel"]
        H_Draft["HahitantsoaEventDraftsPanel"]
    end
    Hahit --> HahitSub

    subgraph CommSub
        C_TitanDoc["TitanDocumentsPanel"]
        C_HahitDoc["HahitantsoaDocumentsPanel"]
        C_Pay["PaymentWorkflowPanel"]
        C_Bill["BillingInvoicePanel"]
        C_Log["LogisticsDeliveryPanel"]
        C_Ret["ReturnsHandlingPanel"]
        C_Brk["BreakageLossPanel"]
        C_Ledger["StockMovementLedgerPanel"]
    end
    Comm --> CommSub
```

---

## 5. Diagramme de séquence — Confirmation transactionnelle (Titan)

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant FE as AvailabilityPanel
    participant API as api.ts
    participant BE as reservations/confirmation.py
    participant DB as PostgreSQL
    participant AUD as audit/services.py

    Operator->>FE: Demande confirmation
    FE->>API: POST /api/v1/reservations/drafts/{id}/confirm/
    API->>BE: ReservationDraftConfirmAPIView

    BE->>DB: BEGIN transaction.atomic()
    BE->>DB: SELECT FOR UPDATE InventoryAvailability
    BE->>DB: Check prerequisites (contract, deposit, availability)
    alt Blocked
        BE-->>API: Error (prerequisites not met)
        API-->>FE: Error display
    else OK
        BE->>DB: UPDATE InventoryAvailability (blocked)
        BE->>DB: UPDATE ReservationDraft (status=confirmed, confirmed_at)
        BE->>DB: COMMIT
        BE->>AUD: transaction.on_commit(record_audit_event_on_commit)
        AUD->>DB: INSERT AuditEvent (actor, action, target)
        BE-->>API: ConfirmationResult
        API-->>FE: Success + updated draft
    end
```

---

## 6. Diagramme de séquence — Passerelle paiement MVola

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant FE as PaymentWorkflowPanel
    participant API as api.ts
    participant BE as payments/gateway.py
    participant MVola as MVola Sandbox
    participant DB as PostgreSQL

    Operator->>FE: Initier paiement mobile
    FE->>API: POST /api/v1/payments/gateway/initiate/{draft_id}/
    API->>BE: GatewayPaymentInitiateAPIView
    BE->>BE: initiate_mobile_money_payment()
    BE->>MVola: HTTP request (sandbox)
    MVola-->>BE: Pending transaction reference
    BE->>DB: INSERT Payment (status=pending)
    BE-->>API: Payment (pending)
    API-->>FE: Payment pending

    MVola->>BE: POST /api/v1/payments/gateway/callback/ (async)
    BE->>BE: process_gateway_callback()
    BE->>DB: UPDATE Payment (status=confirmed/failed)
    BE->>DB: transaction.on_commit(audit)
```

---

## 7. Diagramme agent — Workflow multi-agent

```mermaid
graph LR
    subgraph Orchestrateur
        Queue["Task Queue<br/>orchestrator-task-queue.md"]
        Runbook["Runbook<br/>agent-command-runbook.md"]
        Carto["Cartographie<br/>application-map/"]
    end

    subgraph BackendAgents
        AgentA["Agent A<br/>Implementer"]
        AgentB["Agent B<br/>Reviewer"]
        AgentC["Agent C<br/>Test Reviewer"]
        AgentD["Agent D<br/>Architecture Guardian"]
        AgentE["Agent E<br/>Migration/Data Integrity"]
        AgentF["Agent F<br/>Documentation/Status"]
    end

    subgraph FrontendAgents
        FEA["Agent FE-A<br/>Implementer"]
        FEB["Agent FE-B<br/>UI/UX Reviewer"]
        FEC["Agent FE-C<br/>Accessibility"]
        FED["Agent FE-D<br/>Test Reviewer"]
        FEE["Agent FE-E<br/>API Contract"]
        FEF["Agent FE-F<br/>Scope Guardian"]
    end

    subgraph Infra
        CI["CI GitHub Actions<br/>backend + frontend"]
        PR["PR + Review"]
        MainCI["Main CI Post-Merge"]
    end

    Queue --> AgentA
    Queue --> FEA
    Carto --> AgentA
    Carto --> FEA
    Runbook --> AgentA
    Runbook --> FEA

    AgentA --> AgentB
    AgentB --> AgentC
    AgentC --> AgentD
    AgentD --> AgentE
    AgentE --> AgentF
    AgentF --> PR

    FEA --> FEB
    FEB --> FEC
    FEC --> FED
    FED --> FEE
    FEE --> FEF
    FEF --> PR

    PR --> CI
    CI -->|"Vert"| MainCI
```

---

## 8. Diagramme de séquence — Flux de clôture commercial (closeout)

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant FE as Commercial Ops Panel
    participant API as api.ts
    participant RES as reservations/closeout.py
    participant BIL as billing/services.py
    participant PAY as payments/services.py
    participant INV as inventory/services.py
    participant LOG as logistics/selectors.py
    participant DB as PostgreSQL
    participant AUD as audit/services.py

    Operator->>FE: Demander résumé closeout
    FE->>API: GET /api/v1/reservations/drafts/{id}/closeout/
    API->>RES: ReservationDraftCloseoutSummaryAPIView

    RES->>BIL: compute_reservation_financial_closeout_summary()
    BIL->>DB: SELECT invoices, settlements, installments
    BIL-->>RES: Financial summary

    RES->>PAY: SELECT payments, refund obligations
    PAY->>DB: SELECT Payment, BillingRefundObligation
    PAY-->>RES: Payment summary

    RES->>INV: get_event_operations_summary()
    INV->>DB: SELECT return operations, damage/loss settlements
    INV-->>RES: Operations summary

    RES->>LOG: logistics_events_for_reservation_draft()
    LOG->>DB: SELECT LogisticsEvent
    LOG-->>RES: Logistics summary

    RES-->>API: CloseoutSummary JSON
    API-->>FE: Affichage résumé cross-app

    Operator->>FE: Exécuter closeout
    FE->>API: POST /api/v1/reservations/drafts/{id}/closeout/execute/
    API->>RES: ReservationDraftCloseoutExecuteAPIView

    RES->>DB: transaction.atomic()
    RES->>DB: UPDATE statuts finaux, créer documents de clôture
    RES->>DB: COMMIT
    RES->>AUD: transaction.on_commit(record_audit_event_on_commit)
    AUD->>DB: INSERT AuditEvent
    RES-->>API: CloseoutResult
    API-->>FE: Success
```

---

## 9. Diagramme d'état — Réservation Titan

```mermaid
stateDiagram-v2
    [*] --> Draft : Création
    Draft --> Draft : Mise à jour lignes/client/période
    Draft --> ContractSigned : Marquage contrat signé
    ContractSigned --> DepositReceived : Marquage acompte reçu
    DepositReceived --> Confirmed : Confirmation transactionnelle
    Confirmed --> Cancelled : Annulation
    Draft --> Cancelled : Annulation

    note right of Confirmed
        Requiert : contrat signé + acompte + disponibilité revalidée
        Verrou : select_for_update sur InventoryAvailability
    end note

    note right of Cancelled
        Libère les blocs de disponibilité
    end note
```

---

## 10. Diagramme d'état — Instance de document

```mermaid
stateDiagram-v2
    [*] --> Prepared : Préparation (création instance)
    Prepared --> Generated : Génération runtime HTML
    Generated --> GeneratedPDF : Génération PDF
    Generated --> Voided : Annulation
    GeneratedPDF --> Voided : Annulation
    Prepared --> Voided : Annulation
```

---
*Fin des diagrammes*
