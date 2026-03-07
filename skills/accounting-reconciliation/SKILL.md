---
name: accounting-reconciliation
description: Reusable accounting and tax-prep workflow for OpenClaw that performs weekly invoice reconciliation from email, monthly Stripe income reconciliation, jurisdiction-aware tax preparation support, Supabase data persistence, external file storage with Google Drive as the recommended backend, and on-demand reporting without hardcoded business identifiers.
metadata:
  {
    "openclaw":
      {
        "requires":
          {
            "env":
              [
                "SUPABASE_URL",
                "SUPABASE_SECRET_KEY",
                "RECON_WORKSPACE_KEY",
                "RECON_TZ",
                "RECON_NOTIFICATION_CHANNEL",
                "RECON_NOTIFICATION_DESTINATION",
                "RECON_FILE_STORE_PROVIDER",
                "RECON_FILE_STORE_ROOT_PATH",
              ],
          },
      },
  }
---

# Accounting Reconciliation & Tax Prep Automation

## Overview

Use this skill when a user needs accounting operations automated in OpenClaw with a generic, reusable process:

- Weekly invoice reconciliation (email -> labeled invoices -> extracted fields -> external file store + DB -> accountant-style summary)
- Monthly income reconciliation (Stripe paid invoices -> Supabase -> income report)
- On-demand reports (tax, profitability, and custom period summaries)
- Tax-prep readiness for Canada and US entities, including incorporated-owner review paths, filing obligations, and late-filer catch-up workflows

Never hardcode account emails, workspace identifiers, channels, or vendor-specific IDs into this skill implementation.

## Required Runtime Inputs

Expect these to come from environment/config, not hardcoded values:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RECON_WORKSPACE_KEY` (logical tenant or workspace key)
- `RECON_TZ` (IANA timezone, for example `America/Toronto`)
- `RECON_NOTIFICATION_CHANNEL` (`slack`, `telegram`, or `email`)
- `RECON_NOTIFICATION_DESTINATION` (channel id, chat id, or email destination)
- `RECON_FILE_STORE_PROVIDER` (`google-drive` recommended; `supabase-storage` supported as fallback)
- `RECON_FILE_STORE_ROOT_PATH` (top-level Drive folder name/path or provider-specific root path)
- Stripe auth configuration (API key or equivalent secure auth path)
- Email provider auth configuration (for mailbox search, labels, and attachment retrieval)
- Google Drive auth configuration when `RECON_FILE_STORE_PROVIDER=google-drive`
- Optional `SUPABASE_STORAGE_BUCKET` only when `RECON_FILE_STORE_PROVIDER=supabase-storage`

## Suggested Supabase Schema

Use this baseline schema so file storage and accounting records stay linked and idempotent.

Core tables:

- `accounting.vendors`
  - `id` (uuid pk)
  - `workspace_key` (text)
  - `vendor_name` (text)
  - unique: `(workspace_key, vendor_name)`

- `accounting.invoices`
  - `id` (uuid pk)
  - `workspace_key`, `source_system`, `source_account`, `source_message_id`
  - `vendor_id` (fk -> `accounting.vendors.id`) + `vendor_name` (denormalized)
  - `invoice_date`, `currency`, `total_amount`
  - file linkage: `file_store_provider`, `file_store_root_path`, `file_store_path`, `external_file_id`, `external_web_url`, `file_name`, `file_sha256`
  - parsing fields: `parsed_confidence`, `raw_extraction`
  - unique idempotency key: `(workspace_key, source_system, source_message_id, file_store_provider, file_store_path)`

- `accounting.income_events`
  - `id` (uuid pk)
  - `workspace_key`, `source_system` (`stripe`)
  - `stripe_invoice_id` (unique per workspace)
  - amounts: `amount_gross`, `amount_tax`, `amount_net`, `currency`
  - `paid_at`, `raw_payload`
  - unique: `(workspace_key, stripe_invoice_id)`

- `accounting.report_snapshots`
  - `id` (uuid pk)
  - `workspace_key`, `report_type`, `period_start`, `period_end`, `currency`
  - report payloads: `body_markdown`, `body_json`
  - delivery metadata: `delivered_channel`, `delivered_to`

- `accounting.job_runs`
  - `id` (uuid pk)
  - `workspace_key`, `job_key`, `status`
  - counters: `rows_inserted`, `rows_updated`, `rows_skipped`
  - optional link: `report_id` (fk -> `accounting.report_snapshots.id`)
  - error and context: `error_message`, `context`

Tax-prep tables:

- `accounting.tax_profiles`
  - one row per workspace/entity
  - stores legal country, province/state, entity type, fiscal-year pattern, sales-tax registration, payroll usage, and preferred home-office treatment path

- `accounting.tax_periods`
  - tracks period windows and readiness across monthly, quarterly, annual, and catch-up workflows

- `accounting.filing_obligations`
  - tracks due dates, filing status, jurisdiction, balance-due date, and confirmation references

- `accounting.expense_allocations`
  - stores deductible percentage, business-use percentage, tax category, and reviewer notes for mixed-use or special-case expenses

- `accounting.asset_register`
  - tracks capital assets, depreciation/amortization policy, and source invoice linkage

- `accounting.sales_tax_filings`
  - tracks collected tax, credits, payable amounts, filing status, and jurisdiction by period

- `accounting.owner_compensation_events`
  - records salary, dividends, reimbursements, benefits, and other owner-manager compensation events

- `accounting.shareholder_loan_ledger`
  - records loans to and from owners/shareholders with tax-period linkage

- `accounting.tax_adjustments`
  - stores year-end or filing-only adjustments outside source-system invoices or Stripe events

- `accounting.workpapers`
  - stores filing-pack outputs, catch-up packs, home-office calculations, and review notes with optional storage linkage

Suggested views:

- `accounting.v_weekly_expense`
- `accounting.v_monthly_income`
- `accounting.v_open_filing_obligations`
- `accounting.v_period_profitability`

Storage path convention:

- `${RECON_FILE_STORE_ROOT_PATH}/<yyyy>/<mm>/<source-message-id>/<filename>`

Recommended default:

- `google-drive` as file store
- create year-first folders for accountant browsing, for example `Tax and Invoices/2026/03/...`
- keep only file metadata and links in Supabase tables

Canonical SQL implementation is in:

- `references/supabase-schema.sql`
- `references/supabase-migration-tax-prep.sql` for upgrading an existing live project

## Weekly Invoice Reconciliation Workflow

Target schedule: Friday at 11:00 PM in `RECON_TZ`.

1. Discover candidate invoice emails
- Search configured mailbox(es) for new messages since last successful weekly run.
- Apply or verify invoice label/tag (for example `Invoice`) on matching messages.
- Restrict to messages with invoice-like attachments (`pdf`, image, or common office docs).

2. Extract invoice fields
- Parse each invoice attachment and collect:
  - vendor
  - amount
  - invoice date
  - currency
  - invoice number (if present)
- Keep extraction confidence and raw extraction payload for auditability.

3. Store invoice files in external file storage
- Default to Google Drive when available.
- Upload each original file to the configured external file store instead of storing invoice binaries in Supabase.
- Use deterministic pathing:
  - `<file-store-root>/<yyyy>/<mm>/<source-message-id>/<filename>`
- Record provider, path, external file id, web url, and checksum to support deduplication.

4. Persist structured records in Supabase
- Upsert vendor records.
- Upsert invoice records with storage linkage.
- Record an execution entry in `accounting.job_runs`.
- Use idempotency keys so reruns do not duplicate records.

5. Produce and deliver weekly expense report
- Generate a professional accountant-style summary with:
  - total expenses
  - vendor breakdown
  - week-over-week movement
  - anomalies or missing fields
- Save report snapshot in `accounting.report_snapshots`.
- Deliver to configured notification channel.

## Monthly Income Reconciliation Workflow

Target schedule: monthly (usually day 1 at 11:00 PM in `RECON_TZ`).

1. Pull paid Stripe invoices
- Query Stripe for paid invoices during target month window.
- Capture payer, amount, currency, tax, paid timestamp, and Stripe ids.

2. Persist income records
- Upsert into `accounting.income_events` keyed by Stripe invoice id plus workspace key.
- Record execution in `accounting.job_runs`.

3. Generate monthly income report
- Summarize gross income, net income, tax collected, and top customers.
- Save snapshot in `accounting.report_snapshots`.
- Deliver using configured notification channel.

## On-Demand Reporting Workflow

Support these report families using Supabase as source of truth:

- Tax report
- Profitability report
- Custom range accounting summary

For each on-demand request:

1. Validate period and currency assumptions.
2. Query normalized tables (`invoices`, `income_events`, optional adjustments).
3. Produce report in both machine-readable (`json`) and narrative (`markdown`) forms.
4. Save to `accounting.report_snapshots` and optionally deliver.

## Tax Preparation Coverage

Use the reconciliation data as the evidence layer, then add tax-specific classification and review state before any filing output is treated as ready.

1. Build entity tax profile
- Capture country, province/state, entity type, fiscal year-end, sales-tax registration, payroll status, reporting currency, and filing cadence.
- Keep this in `accounting.tax_profiles`.

2. Create filing obligations
- Generate obligations by jurisdiction and period into `accounting.filing_obligations`.
- Track due date, balance-due date, filing status, and confirmation reference separately from bookkeeping status.

3. Classify high-risk expense areas
- Use `accounting.expense_allocations` for mixed-use costs such as home office, internet, software bundles, meals, and travel.
- Require an explicit treatment path for home-office claims:
  - self-employed actual-cost method
  - self-employed simplified method
  - employee/shareholder reimbursement route
  - accountant review

4. Track capital and owner-manager items
- Record durable purchases in `accounting.asset_register` instead of forcing them into period expenses.
- Record salary, dividends, reimbursements, benefits, and shareholder-loan movements in dedicated tables.

5. Produce accountant-ready workpapers
- Build filing packs, review checklists, and adjustment schedules into `accounting.workpapers`.
- Keep narrative output, machine-readable output, and supporting file links together.

6. Gate final outputs
- Do not represent a return as file-ready when any obligation, allocation, adjustment, or workpaper is still in `needs_review` or equivalent status.
- Flag incorporated-owner home-office claims, shareholder benefits, cross-border income, missing periods, and late-filed years for human review.

## Backlog and Catch-Up Workflow

Use this when the user is one or more years behind on taxes or bookkeeping.

1. Open missing periods
- Create annual and sub-annual rows in `accounting.tax_periods` for each missing year.
- Create matching `accounting.filing_obligations` rows before any reconstruction begins.

2. Build a document gap list
- Inventory bank feeds, email invoices, receipts, payroll records, Stripe payouts, prior filings, and sales-tax records.
- Save gaps and blockers in `accounting.workpapers`.

3. Reconstruct books period by period
- Run invoice and income reconciliation for each missing period.
- Backfill tax adjustments, owner compensation, and shareholder-loan entries as needed.

4. Resolve mixed-use and missing-support items
- Push uncertain entries into `accounting.expense_allocations` with `needs_review` status.
- Avoid auto-claiming home-office or shareholder expenses when the treatment path is unclear.

5. Produce a filing pack for each year
- Generate year-specific tax report, profitability report, open-obligation summary, and supporting workpapers.
- Mark each year independently so one unresolved year does not block visibility into another.

6. Deliver a catch-up action plan
- Summarize what is filing-ready, what still lacks evidence, estimated exposure or balance due, and the next accountant-review items.
- Use this workflow for users who have not filed for multiple years, including a three-year catch-up horizon.

## OpenClaw Cron Templates

Use isolated cron sessions and make delivery explicit.

Weekly invoice reconciliation (Friday 11 PM):

```bash
openclaw cron add \
  --name "Weekly Invoice Reconciliation" \
  --cron "0 23 * * 5" \
  --tz "${RECON_TZ}" \
  --session isolated \
  --announce \
  --channel "${RECON_NOTIFICATION_CHANNEL}" \
  --to "${RECON_NOTIFICATION_DESTINATION}" \
  --message "Run weekly invoice reconciliation: fetch new invoice emails, ensure Invoice label, extract vendor/amount/date, upload files to the configured external file store with Google Drive preferred, upsert Supabase records, and deliver accountant-style weekly expense summary."
```

Monthly income reconciliation (day 1 at 11 PM):

```bash
openclaw cron add \
  --name "Monthly Income Reconciliation" \
  --cron "0 23 1 * *" \
  --tz "${RECON_TZ}" \
  --session isolated \
  --announce \
  --channel "${RECON_NOTIFICATION_CHANNEL}" \
  --to "${RECON_NOTIFICATION_DESTINATION}" \
  --message "Run monthly Stripe income reconciliation: pull paid invoices, upsert income records in Supabase, and deliver accountant-style monthly income report."
```

## Guardrails

- No hardcoded email addresses, channel ids, vendor names, Stripe ids, or workspace ids.
- Use secrets and env variables only for credentials.
- Prefer idempotent upserts for all reconciliations.
- Preserve source files in the external file store and keep row-to-file linkage in DB.
- Keep all sensitive keys out of logs and report payloads.
- Treat jurisdiction-specific tax calculations as reviewable guidance, not irreversible filing decisions.
- Require explicit review on incorporated-owner home-office claims, shareholder benefits, late filings, and cross-border cases.
- Do not store invoice binaries in Supabase when an external file store is configured.

## References

- Schema: `references/supabase-schema.sql`
- Live-project migration: `references/supabase-migration-tax-prep.sql`
- External file-store migration: `references/supabase-migration-external-file-store.sql`
- Setup and rollout: `references/setup-playbook.md`
- Report format templates: `references/report-templates.md`
