# Prompt Patterns — Business Diagram Templates

These are proven prompt patterns for common business diagram types.
Copy, adapt, and use these as the starting point when a user requests a diagram.

---

## 1. Inbound Email Handling Flow

```
Draw an Excalidraw diagram for inbound email handling workflow.

Left-to-right swimlane layout with 3 actor lanes:
  Lane 1 (top): Customer / External
  Lane 2 (middle): Email System / AI
  Lane 3 (bottom): Support Team / CRM

Flow:
  1. Email arrives → Email Server receives
  2. AI Triage classifies (Decision: spam? urgent? category)
  3. If spam → Archive
  4. If urgent → Escalate to senior agent
  5. If normal → Route to queue
  6. Agent reviews → Drafts response → Sends
  7. Interaction logged to CRM

Decisions: diamond shapes for "Is Spam?", "Is Urgent?", "Needs Approval?"
Style: layered zones, color-coded by actor, arrows with descriptive labels.
Colors: Blue for system layers, Green for customer, Yellow for decisions.
```

---

## 2. Accounting / Invoice Recording Flow

```
Draw an Excalidraw business process flow for recording a supplier invoice.

Top-down swimlane with roles:
  Lane 1: Accounts Payable Clerk
  Lane 2: Accountant / Finance Manager
  Lane 3: CFO (approval only)
  Lane 4: ERP System

Steps:
  1. Invoice received (email or mail)
  2. AP Clerk: verify vendor, match to PO
  3. Decision: Does PO exist? → if no: create PO or reject
  4. AP Clerk: enter invoice in ERP
  5. Decision: Amount > $5,000? → if yes: route for manager approval
  6. Accountant: review and approve
  7. Decision: Amount > $50,000? → if yes: CFO approval required
  8. ERP: posts journal entry (Dr: Expense, Cr: AP)
  9. Payment scheduled in ERP
  10. On payment date: Dr: AP, Cr: Cash

Decision diamonds for each approval threshold.
Style: Swimlanes with distinct zone colors per role, clear approval routing arrows.
```

---

## 3. System Architecture (like HR App sample)

```
Draw a system architecture diagram in the style of the HR App Architecture sample.

Layers (top to bottom):

Client Layer (green background):
  Boxes: [Feature A] [Feature B] [Feature C]

Application Layer (blue background):
  Label: "Next.js — Can be Self Hosted"
  Inner box: [AI SDK / LLM Router]
  Auth annotation: "JWT Token Auth Protected, RBAC" (on arrow from client to app)

On-Premise / Server Layer (blue background, left 70%):
  Sub-zone: Ollama
    Model boxes: [Model A] [Model B] [Model C]
                 [Model D] [Model E] [Model F]
  Sub-zone: Storage (database icon)
    Boxes: [Storage] [SQL DB] [Vectorstore]
    Label: "Protected by RLS"

Right side panel: [Reverse Proxy (Nginx)]

Arrows:
  Client → App: "JWT Token Auth Protected, RBAC"
  App ↔ Reverse Proxy: "Request/Response"
  Ollama → Reverse Proxy: "Inference →"
  Reverse Proxy → DB Zone: "DB Operations ←"

Use exact same green/blue color scheme, 2px strokes, Virgil font.
```

---

## 4. Data Ingestion Pipeline

```
Draw an Excalidraw data pipeline architecture diagram.

Left-to-right flow with 4 stages:

Stage 1 — Ingest (blue zone):
  Sources: [REST API] [Webhook] [File Upload] [Database CDC]
  Collector: [Kafka / Message Queue]

Stage 2 — Transform (purple zone):
  [Schema Validation]
  [Data Enrichment]
  [Deduplication]
  Processing: [Spark / dbt]

Stage 3 — Store (dark blue zone):
  [Data Warehouse (Snowflake)]
  [Data Lake (S3)]
  [Cache (Redis)]

Stage 4 — Serve (green zone):
  [REST API]
  [GraphQL]
  [BI Dashboard]
  [ML Model Serving]

Arrows labeled with: throughput estimates, data format (JSON, Parquet, etc.)
Add latency annotation: "< 500ms" on real-time paths, "batch: nightly" on batch paths.
```

---

## 5. User Onboarding Flow (SaaS)

```
Draw an Excalidraw user onboarding flow for a SaaS product.

Top-down flow, left-to-right within each stage.

Stage 1 — Acquisition:
  [Landing Page] → [Sign Up Form] → [Email Verification]

Stage 2 — Activation:
  [Welcome Email] → [Dashboard Intro Tour] → [First Action Prompt]
  Decision: Completed setup? → if no: reminder email sequence

Stage 3 — Engagement:
  [Feature Discovery] → [Invite Team] → [Integration Setup]
  Decision: Connected integration? → if yes: power user track

Stage 4 — Retention:
  [Weekly Digest Email] → [Usage Milestone] → [Upsell Trigger]
  Decision: 30-day inactive? → if yes: win-back campaign

Use color progression: Gray → Blue → Green → Purple as user matures.
Decision diamonds at each stage gate. Arrows labeled with trigger conditions.
```

---

## 6. API Request Lifecycle

```
Draw an Excalidraw architecture diagram for an API request lifecycle.

Top-down flow:

Client: [Mobile App / Web Browser]
  ↓ HTTPS request

Edge Layer: [CDN / WAF]
  ↓ filtered request

Gateway: [API Gateway]
  → Auth: [JWT Validation Service]
  → Rate Limit: [Redis Rate Limiter]
  ↓ validated request

Application: [Load Balancer]
  → [App Server 1]  [App Server 2]  [App Server 3]  (parallel)
  Each server:
    → [Business Logic]
    → [Cache Check (Redis)]
    ↓ on cache miss
    → [Database (Postgres)]

Response path: reverse arrows (dashed) back up the chain.

Add latency budget annotations on each arrow:
  CDN: ~5ms, Gateway: ~10ms, App: ~50ms, DB: ~20ms
```

---

## 7. Customer Support Escalation Flow

```
Draw a customer support escalation flow.

Left-to-right with decision tree branching:

Entry points (top):
  [Chat Widget] [Email] [Phone] [Social Media]
  → All converge to: [Support Ticket Created]

Tier 1:
  [AI Chatbot attempts resolution]
  Decision: Resolved? → Yes: [Close + CSAT] | No: → Tier 2

Tier 2:
  [L1 Support Agent]
  Decision: Technical issue? → Yes: → Tier 3
  Decision: Resolved in 24h? → No: → Manager Escalation

Tier 3:
  [Technical Specialist]
  Decision: Bug confirmed? → Yes: → [Engineering Queue]
  Decision: Resolved in 48h? → No: → VIP Escalation

VIP/Engineering Track:
  [Engineering Team] → [Fix Deployed] → [Customer Notified] → [Close]

SLA timers on each stage: "L1: 4h", "L2: 24h", "L3: 48h"
Colors: Green for resolved paths, Red for escalation paths.
```

---

## 8. Product Release Pipeline (CI/CD)

```
Draw a CI/CD release pipeline diagram.

Left-to-right stages:

Developer: [Code Commit] → [Pull Request]

CI Pipeline:
  [Lint + Format] → [Unit Tests] → [Integration Tests] → [Build Docker Image]
  Decision: All checks pass? → if no: Notify developer (red arrow back)

Staging:
  [Deploy to Staging] → [Smoke Tests] → [QA Review]
  Decision: QA approved? → if no: back to CI

Production:
  [Create Release Tag] → [Deploy to Prod (canary 10%)]
  Monitoring: [Error Rate Check]
  Decision: Error rate < 1%? → if yes: [Full Rollout] | if no: [Rollback]

Post-deploy:
  [Update Changelog] → [Notify Stakeholders] → [Monitor 24h]

Color code: Blue=CI, Yellow=Staging, Green=Prod success, Red=Failure/Rollback paths.
```

---

## 9. Compounding Pharmacy Order Flow (Ugo's wife's domain)

```
Draw a compounding pharmacy order processing flow.

Swimlane layout with 4 actors:
  Lane 1: Patient / Prescriber
  Lane 2: Pharmacy Front Desk
  Lane 3: Compounding Pharmacist
  Lane 4: Quality / Compliance

Flow:
  1. Prescriber sends Rx (e-prescribe or fax)
  2. Front Desk: verify patient identity + insurance
  3. Decision: Valid Rx? → if no: contact prescriber
  4. Front Desk: enter order in pharmacy system
  5. Pharmacist: review formula against Master Formulation Record
  6. Decision: Any drug interactions? → if yes: consult prescriber
  7. Pharmacist: compound medication (with lot tracking)
  8. Quality Check: verify potency, pH, appearance
  9. Decision: Passes QC? → if no: discard + rework
  10. Label generation + Beyond-Use Date assignment
  11. Final pharmacist sign-off
  12. Patient pickup or delivery dispatch
  13. Record retained for compliance (5yr minimum)

Compliance annotations: "USP 795/797 compliance" on compounding stage.
Colors: Blue=system, Green=approved paths, Red=rejection paths, Purple=compliance.
```

---

## 10. AI Agent Workflow

```
Draw an Excalidraw diagram for an AI agent workflow with tool use.

Hub-and-spoke layout with the LLM Orchestrator at center.

Inputs (left side):
  [User Prompt] → [Context Window]
  [Memory Store] → [Context Window]
  [System Prompt] → [Context Window]
  → All feed into: [LLM Orchestrator (Claude/GPT)]

Tools (radiating from center):
  [Web Search Tool]
  [Code Executor]
  [Database Query]
  [Email / Calendar API]
  [File System]
  [External APIs]

Decision loop:
  LLM → [Tool Selection]
  → Tool executes → Result returned to LLM
  Loop: [More tools needed?] → if yes: back to Tool Selection
  → if no: [Final Response Generation]

Output (right side):
  [Response to User]
  [Memory Update]
  [Action Executed]

Annotations: "Max N iterations" on the loop. "Streaming" on response arrow.
Style: Central hub larger than spokes, tool boxes uniform size, loop arrow visible.
```
