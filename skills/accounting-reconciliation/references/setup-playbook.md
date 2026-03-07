# Setup Playbook

This setup is intentionally generic so the same skill can be reused across organizations.

## 1) Define Runtime Configuration

Set these values in your deployment secret manager:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RECON_WORKSPACE_KEY`
- `RECON_TZ`
- `RECON_NOTIFICATION_CHANNEL`
- `RECON_NOTIFICATION_DESTINATION`
- `RECON_FILE_STORE_PROVIDER`
- `RECON_FILE_STORE_ROOT_PATH`
- Email provider credentials (OAuth or API)
- Stripe credentials (read-only invoice access for reconciliation)

Optional:

- `SUPABASE_STORAGE_BUCKET` (only when `RECON_FILE_STORE_PROVIDER=supabase-storage`)
- `RECON_DEFAULT_CURRENCY` (for missing currency fields)
- `RECON_EMAIL_LABEL` (default `Invoice`)
- `RECON_ENTITY_KEY` (default `default`)
- Google Drive auth and folder-creation permissions when `RECON_FILE_STORE_PROVIDER=google-drive`

## 2) Apply Database Schema

Apply `supabase-schema.sql` for a fresh install:

```bash
# Example with psql-style connection string
psql "<supabase-postgres-connection>" -f ./skills/accounting-reconciliation/references/supabase-schema.sql
```

For an existing live project that already has the baseline reconciliation schema, apply the additive migration instead:

```bash
psql "<supabase-postgres-connection>" -f ./skills/accounting-reconciliation/references/supabase-migration-tax-prep.sql
```

If the project already used `storage_bucket` / `storage_path` columns and you want to move to external file-store metadata, apply the compatibility migration too:

```bash
psql "<supabase-postgres-connection>" -f ./skills/accounting-reconciliation/references/supabase-migration-external-file-store.sql
```

Or run the relevant SQL in Supabase SQL Editor.

## 3) Initialize Entity Tax Profile

Create one `accounting.tax_profiles` row per legal entity or filing unit.

Minimum fields to set up first:

- `workspace_key`
- `entity_key`
- `legal_country_code`
- `subdivision_code`
- `entity_type`
- `reporting_currency`
- `fiscal_year_end_month`
- `fiscal_year_end_day`
- `sales_tax_registered`
- `payroll_enabled`
- `home_office_treatment`

Recommended pattern:

- keep `workspace_key` stable for the tenant or business unit
- use `entity_key` to separate legal entities if one workspace handles more than one filer
- set `home_office_treatment` conservatively to `accountant_review` until the workflow is confirmed

## 4) Configure External File Storage

Recommended default: Google Drive.

Suggested provider settings:

- `RECON_FILE_STORE_PROVIDER=google-drive`
- `RECON_FILE_STORE_ROOT_PATH=<top-level-drive-folder>`

Drive organization pattern:

- Top-level folder: `${RECON_FILE_STORE_ROOT_PATH}`
- Year folder: `<yyyy>`
- Month folder: `<mm>`
- File path: `${RECON_FILE_STORE_ROOT_PATH}/<yyyy>/<mm>/<source-message-id>/<file-name>`

Recommendation:

- Use year-first folders so a human accountant can browse by tax year quickly.
- Store only metadata in Supabase:
  - `file_store_provider`
  - `file_store_root_path`
  - `file_store_path`
  - `external_file_id`
  - `external_web_url`
  - `file_sha256`
- If Google Drive is unavailable, `supabase-storage` can still be used as a fallback provider.

## 5) Seed Filing Periods and Obligations

Before the first tax report, seed `accounting.tax_periods` and `accounting.filing_obligations`.

Recommended baseline:

- create annual periods for income-tax readiness
- create monthly or quarterly periods for sales-tax and internal close workflows
- create obligations per jurisdiction instead of assuming one filing stream

Examples of obligation types:

- `corporate_income_tax`
- `sales_tax`
- `payroll`
- `information_return`
- `state_income_tax`
- `franchise_tax`

Keep the schema generic. The exact filing calendar should come from the user's jurisdiction and entity profile, not from hardcoded dates in the skill.

## 6) Configure Weekly Job

Friday at 11:00 PM in your configured timezone:

```bash
openclaw cron add \
  --name "Weekly Invoice Reconciliation" \
  --cron "0 23 * * 5" \
  --tz "${RECON_TZ}" \
  --session isolated \
  --announce \
  --channel "${RECON_NOTIFICATION_CHANNEL}" \
  --to "${RECON_NOTIFICATION_DESTINATION}" \
  --message "Run weekly invoice reconciliation from email: find new invoice attachments, apply Invoice label, extract vendor/amount/date/currency/invoice number, upload files to the configured external file store with Google Drive preferred, upsert invoices and vendors, write job run, and send accountant-style weekly expense report."
```

## 7) Configure Monthly Job

Monthly income reconciliation (day 1 at 11:00 PM):

```bash
openclaw cron add \
  --name "Monthly Income Reconciliation" \
  --cron "0 23 1 * *" \
  --tz "${RECON_TZ}" \
  --session isolated \
  --announce \
  --channel "${RECON_NOTIFICATION_CHANNEL}" \
  --to "${RECON_NOTIFICATION_DESTINATION}" \
  --message "Run monthly Stripe income reconciliation: fetch paid Stripe invoices for current month, upsert income events, write job run, and send accountant-style monthly income report."
```

## 8) Configure Catch-Up Mode

For users who are behind on filings, initialize the backlog before running tax reports.

Recommended order:

1. Create one `accounting.tax_periods` row per missing year.
2. Add matching `accounting.filing_obligations` rows.
3. Add a `catch_up` workpaper for each year.
4. Re-run invoice and income reconciliation period by period.
5. Use `accounting.expense_allocations`, `accounting.tax_adjustments`, and `accounting.owner_compensation_events` to hold uncertain or reconstructed items.

Three-year catch-up baseline:

- open the last three tax years first
- track each year independently
- do not block one year from review because another still has missing evidence

## 9) On-Demand Report Commands

Use these prompts in OpenClaw chat surfaces:

- Tax report:
  - `Create a tax report for workspace <workspace-key> from <yyyy-mm-dd> to <yyyy-mm-dd>.`
- Profitability report:
  - `Create a profitability report for workspace <workspace-key> from <yyyy-mm-dd> to <yyyy-mm-dd>.`
- Custom finance report:
  - `Create a custom finance report for workspace <workspace-key> with grouping by <vendor|month|customer>.`
- Catch-up action plan:
  - `Create a catch-up tax action plan for workspace <workspace-key> covering the last 3 tax years.`
- Filing-pack preparation:
  - `Prepare a filing pack for workspace <workspace-key> and entity <entity-key> for tax year <yyyy>.`

## 10) Validation Checklist

After setup, validate in this order:

1. Secrets are present in runtime.
2. A test invoice file uploads to the configured external file store with expected path format.
3. `accounting.invoices` row contains matching `file_store_provider`, `file_store_path`, and `external_file_id` or equivalent external reference.
4. Weekly summary is delivered to configured channel.
5. Monthly Stripe summary is delivered and persisted.
6. `accounting.tax_profiles` and `accounting.tax_periods` are populated for the target entity.
7. Open obligations appear in `accounting.v_open_filing_obligations`.
8. `accounting.job_runs` entries show successful run status.

## 11) Review Gates

Require human review before marking any filing artifact ready when one of these is true:

- home-office treatment is unclear or mixed-use percentages are estimated
- the entity is incorporated and the expense may create a shareholder benefit
- owner compensation, reimbursements, or shareholder loans are incomplete
- capital assets were booked as period expenses and need reclassification
- sales-tax registration or filing cadence is uncertain
- one or more years are late or reconstructed from partial records
- there is cross-border income, payroll, or nexus exposure

## 12) Multi-Account Strategy

For multiple email identities, do not hardcode accounts in the skill. Configure account source externally:

- Option A: one OpenClaw profile/gateway per mailbox (cleanest operational model)
- Option B: one gateway with mailbox list, with account identifier saved in `source_account`

In both models:

- keep `RECON_WORKSPACE_KEY` logical and stable
- isolate credentials per mailbox
- preserve idempotency keys per source account

## 13) Official References

Use official guidance for due dates, home-office methods, and late filings. These are reference points for setup and review, not hardcoded defaults:

- Canada T2 corporation tax guide: [https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4012/t2-corporation-income-tax-guide-before-you-start.html](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4012/t2-corporation-income-tax-guide-before-you-start.html)
- CRA business-use-of-home expenses: [https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/completing-form-t2125/business-use-home-expenses.html](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/completing-form-t2125/business-use-home-expenses.html)
- CRA employees who are shareholders: [https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-22900-other-employment-expenses/employees-shareholders.html](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-22900-other-employment-expenses/employees-shareholders.html)
- CRA GST/HST registration: [https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-account/register-account.html](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-account/register-account.html)
- IRS Publication 587 (business use of home): [https://www.irs.gov/publications/p587](https://www.irs.gov/publications/p587)
- IRS past-due returns guidance: [https://www.irs.gov/businesses/small-businesses-self-employed/filing-past-due-tax-returns](https://www.irs.gov/businesses/small-businesses-self-employed/filing-past-due-tax-returns)

## 14) Publish and Add to OpenClaw

Website publishing pattern:

1. Publish `SKILL.md` as the canonical process document.
2. Publish `references/supabase-schema.sql`, `references/supabase-migration-tax-prep.sql`, `references/supabase-migration-external-file-store.sql`, and `references/report-templates.md` as downloadable artifacts.
3. Keep placeholders in docs (`<workspace-key>`, `<destination>`, `<project-id>`) so published content stays reusable.

OpenClaw runtime pattern:

1. Place the skill folder under a scanned skills root.
2. Verify discovery:
   - `openclaw skills list | rg accounting-reconciliation`
3. Verify readiness:
   - `openclaw skills check`
