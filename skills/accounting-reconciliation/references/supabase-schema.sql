-- Accounting reconciliation schema (generic, reusable)
-- Apply in Supabase SQL editor or migration pipeline.

create schema if not exists accounting;
create extension if not exists pgcrypto;

create or replace function accounting.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists accounting.vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  vendor_name text not null,
  country_code text,
  default_currency char(3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_key, vendor_name)
);

create table if not exists accounting.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  source_system text not null default 'email',
  source_account text not null,
  source_message_id text not null,
  source_attachment_id text,
  vendor_id uuid references accounting.vendors(id) on delete set null,
  vendor_name text not null,
  invoice_number text,
  invoice_date date not null,
  due_date date,
  currency char(3) not null,
  subtotal_amount numeric(14,2),
  tax_amount numeric(14,2),
  total_amount numeric(14,2) not null,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partially_paid', 'paid', 'void', 'unknown')),
  file_store_provider text not null default 'google-drive'
    check (file_store_provider in ('google-drive', 'supabase-storage', 's3', 'local', 'other')),
  file_store_root_path text,
  file_store_path text not null,
  external_file_id text,
  external_parent_id text,
  external_web_url text,
  external_download_url text,
  file_store_metadata jsonb not null default '{}'::jsonb,
  file_name text not null,
  file_mime_type text,
  file_sha256 text,
  parsed_confidence numeric(5,2),
  raw_extraction jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_key, source_system, source_message_id, file_store_provider, file_store_path)
);

create table if not exists accounting.income_events (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  source_system text not null default 'stripe',
  stripe_invoice_id text not null,
  stripe_payment_intent_id text,
  customer_id text,
  customer_name text,
  customer_email text,
  currency char(3) not null,
  amount_gross numeric(14,2) not null,
  amount_tax numeric(14,2),
  amount_net numeric(14,2),
  paid_at timestamptz not null,
  period_start date,
  period_end date,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_key, stripe_invoice_id)
);

create table if not exists accounting.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  report_type text not null
    check (report_type in ('weekly_expense', 'monthly_income', 'tax', 'profitability', 'catch_up', 'filing_pack', 'custom')),
  period_start date not null,
  period_end date not null,
  currency char(3) not null,
  total_expenses numeric(14,2),
  total_income numeric(14,2),
  net_result numeric(14,2),
  body_markdown text not null,
  body_json jsonb not null default '{}'::jsonb,
  delivered_channel text,
  delivered_to text,
  created_at timestamptz not null default now()
);

create table if not exists accounting.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  job_key text not null,
  run_started_at timestamptz not null default now(),
  run_finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'partial')),
  rows_inserted integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  report_id uuid references accounting.report_snapshots(id) on delete set null,
  error_message text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists accounting.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  legal_country_code char(2) not null,
  subdivision_code text,
  entity_type text not null
    check (entity_type in ('sole_prop', 'corporation', 'llc', 'partnership', 'nonprofit', 'other')),
  reporting_currency char(3) not null,
  fiscal_year_end_month smallint not null check (fiscal_year_end_month between 1 and 12),
  fiscal_year_end_day smallint not null check (fiscal_year_end_day between 1 and 31),
  sales_tax_registered boolean not null default false,
  payroll_enabled boolean not null default false,
  home_office_treatment text not null default 'unknown'
    check (home_office_treatment in ('unknown', 'actual', 'simplified', 'reimbursement', 'accountant_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_key, entity_key)
);

create table if not exists accounting.tax_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  period_type text not null
    check (period_type in ('monthly', 'quarterly', 'annual', 'custom')),
  tax_year integer not null,
  period_start date not null,
  period_end date not null,
  bookkeeping_status text not null default 'open'
    check (bookkeeping_status in ('open', 'reconciled', 'ready_for_review', 'closed')),
  filing_status text not null default 'not_started'
    check (filing_status in ('not_started', 'in_progress', 'ready_for_review', 'filed', 'amended')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_key, entity_key, period_type, period_start, period_end)
);

create table if not exists accounting.filing_obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  period_id uuid references accounting.tax_periods(id) on delete set null,
  obligation_type text not null,
  jurisdiction_country_code char(2) not null,
  jurisdiction_subdivision_code text,
  due_date date not null,
  balance_due_date date,
  filing_status text not null default 'not_started'
    check (filing_status in ('not_started', 'in_progress', 'ready_for_review', 'filed', 'waived', 'not_applicable')),
  filed_at timestamptz,
  confirmation_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  invoice_id uuid references accounting.invoices(id) on delete cascade,
  period_id uuid references accounting.tax_periods(id) on delete set null,
  allocation_category text not null,
  tax_treatment text not null,
  deductible_percent numeric(5,2),
  business_use_percent numeric(5,2),
  reviewer_status text not null default 'pending'
    check (reviewer_status in ('pending', 'accepted', 'needs_review', 'rejected')),
  rationale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.asset_register (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  vendor_id uuid references accounting.vendors(id) on delete set null,
  source_invoice_id uuid references accounting.invoices(id) on delete set null,
  asset_name text not null,
  asset_category text not null,
  placed_in_service_date date,
  service_start_date date,
  useful_life_months integer,
  currency char(3) not null,
  cost_basis numeric(14,2) not null,
  residual_value numeric(14,2),
  depreciation_method text,
  tax_classification text,
  disposal_date date,
  status text not null default 'active'
    check (status in ('active', 'disposed', 'written_off')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.sales_tax_filings (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  filing_period_id uuid references accounting.tax_periods(id) on delete set null,
  tax_type text not null,
  jurisdiction_country_code char(2) not null,
  jurisdiction_subdivision_code text,
  return_status text not null default 'not_started'
    check (return_status in ('not_started', 'in_progress', 'ready_for_review', 'filed', 'amended')),
  taxable_sales numeric(14,2),
  exempt_sales numeric(14,2),
  input_tax_credits numeric(14,2),
  tax_collected numeric(14,2),
  tax_payable numeric(14,2),
  filed_at timestamptz,
  confirmation_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.owner_compensation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  event_type text not null
    check (event_type in ('salary', 'dividend', 'bonus', 'reimbursement', 'benefit', 'owner_draw', 'other')),
  event_date date not null,
  gross_amount numeric(14,2) not null,
  withholding_amount numeric(14,2),
  employer_cost_amount numeric(14,2),
  currency char(3) not null,
  payroll_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.shareholder_loan_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  tax_period_id uuid references accounting.tax_periods(id) on delete set null,
  transaction_date date not null,
  direction text not null
    check (direction in ('to_shareholder', 'from_shareholder')),
  amount numeric(14,2) not null,
  currency char(3) not null,
  description text not null,
  source_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.tax_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  period_id uuid references accounting.tax_periods(id) on delete set null,
  adjustment_type text not null,
  description text not null,
  amount numeric(14,2) not null,
  currency char(3) not null,
  affects_expense boolean not null default false,
  affects_income boolean not null default false,
  reviewer_status text not null default 'pending'
    check (reviewer_status in ('pending', 'accepted', 'needs_review', 'rejected')),
  source_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting.workpapers (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  entity_key text not null default 'default',
  period_id uuid references accounting.tax_periods(id) on delete set null,
  workpaper_type text not null
    check (workpaper_type in ('filing_pack', 'home_office', 'fixed_asset', 'sales_tax', 'catch_up', 'income_reconciliation', 'expense_reconciliation', 'custom')),
  title text not null,
  body_markdown text,
  body_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'final')),
  prepared_at timestamptz,
  prepared_by text,
  file_store_provider text
    check (file_store_provider in ('google-drive', 'supabase-storage', 's3', 'local', 'other')),
  file_store_root_path text,
  file_store_path text,
  external_file_id text,
  external_web_url text,
  file_store_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendors_workspace on accounting.vendors (workspace_key);
create index if not exists idx_invoices_workspace_date on accounting.invoices (workspace_key, invoice_date desc);
create index if not exists idx_invoices_vendor on accounting.invoices (workspace_key, vendor_name);
create index if not exists idx_invoices_file_sha on accounting.invoices (workspace_key, file_sha256);
create index if not exists idx_invoices_external_file_id on accounting.invoices (workspace_key, file_store_provider, external_file_id);
create index if not exists idx_income_workspace_paid on accounting.income_events (workspace_key, paid_at desc);
create index if not exists idx_reports_workspace_period on accounting.report_snapshots (workspace_key, period_start, period_end);
create index if not exists idx_job_runs_workspace_started on accounting.job_runs (workspace_key, run_started_at desc);
create index if not exists idx_tax_profiles_workspace on accounting.tax_profiles (workspace_key, entity_key);
create index if not exists idx_tax_periods_workspace on accounting.tax_periods (workspace_key, entity_key, period_start desc);
create index if not exists idx_filing_obligations_status on accounting.filing_obligations (workspace_key, filing_status, due_date);
create index if not exists idx_expense_allocations_invoice on accounting.expense_allocations (workspace_key, invoice_id);
create index if not exists idx_asset_register_workspace on accounting.asset_register (workspace_key, entity_key, status);
create index if not exists idx_sales_tax_filings_workspace on accounting.sales_tax_filings (workspace_key, entity_key, return_status);
create index if not exists idx_owner_comp_workspace_date on accounting.owner_compensation_events (workspace_key, entity_key, event_date desc);
create index if not exists idx_shareholder_loan_workspace_date on accounting.shareholder_loan_ledger (workspace_key, entity_key, transaction_date desc);
create index if not exists idx_tax_adjustments_workspace on accounting.tax_adjustments (workspace_key, entity_key, created_at desc);
create index if not exists idx_workpapers_workspace on accounting.workpapers (workspace_key, entity_key, status);

drop trigger if exists trg_vendors_updated_at on accounting.vendors;
create trigger trg_vendors_updated_at
before update on accounting.vendors
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_invoices_updated_at on accounting.invoices;
create trigger trg_invoices_updated_at
before update on accounting.invoices
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_income_events_updated_at on accounting.income_events;
create trigger trg_income_events_updated_at
before update on accounting.income_events
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_tax_profiles_updated_at on accounting.tax_profiles;
create trigger trg_tax_profiles_updated_at
before update on accounting.tax_profiles
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_tax_periods_updated_at on accounting.tax_periods;
create trigger trg_tax_periods_updated_at
before update on accounting.tax_periods
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_filing_obligations_updated_at on accounting.filing_obligations;
create trigger trg_filing_obligations_updated_at
before update on accounting.filing_obligations
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_expense_allocations_updated_at on accounting.expense_allocations;
create trigger trg_expense_allocations_updated_at
before update on accounting.expense_allocations
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_asset_register_updated_at on accounting.asset_register;
create trigger trg_asset_register_updated_at
before update on accounting.asset_register
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_sales_tax_filings_updated_at on accounting.sales_tax_filings;
create trigger trg_sales_tax_filings_updated_at
before update on accounting.sales_tax_filings
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_owner_compensation_updated_at on accounting.owner_compensation_events;
create trigger trg_owner_compensation_updated_at
before update on accounting.owner_compensation_events
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_shareholder_loan_updated_at on accounting.shareholder_loan_ledger;
create trigger trg_shareholder_loan_updated_at
before update on accounting.shareholder_loan_ledger
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_tax_adjustments_updated_at on accounting.tax_adjustments;
create trigger trg_tax_adjustments_updated_at
before update on accounting.tax_adjustments
for each row execute function accounting.set_updated_at();

drop trigger if exists trg_workpapers_updated_at on accounting.workpapers;
create trigger trg_workpapers_updated_at
before update on accounting.workpapers
for each row execute function accounting.set_updated_at();

create or replace view accounting.v_weekly_expense as
select
  workspace_key,
  date_trunc('week', invoice_date::timestamp)::date as week_start,
  currency,
  sum(total_amount) as total_expenses,
  count(*) as invoice_count
from accounting.invoices
group by workspace_key, date_trunc('week', invoice_date::timestamp)::date, currency;

create or replace view accounting.v_monthly_income as
select
  workspace_key,
  date_trunc('month', paid_at)::date as month_start,
  currency,
  sum(amount_gross) as gross_income,
  sum(coalesce(amount_net, amount_gross)) as net_income,
  sum(coalesce(amount_tax, 0)) as tax_collected,
  count(*) as paid_invoice_count
from accounting.income_events
group by workspace_key, date_trunc('month', paid_at)::date, currency;

create or replace view accounting.v_open_filing_obligations as
select
  fo.workspace_key,
  fo.entity_key,
  fo.obligation_type,
  fo.jurisdiction_country_code,
  fo.jurisdiction_subdivision_code,
  fo.due_date,
  fo.balance_due_date,
  fo.filing_status,
  tp.tax_year,
  tp.period_start,
  tp.period_end
from accounting.filing_obligations fo
left join accounting.tax_periods tp on tp.id = fo.period_id
where fo.filing_status not in ('filed', 'waived', 'not_applicable');

create or replace view accounting.v_period_profitability as
with expense_totals as (
  select
    workspace_key,
    date_trunc('month', invoice_date::timestamp)::date as period_start,
    currency,
    sum(total_amount) as total_expenses
  from accounting.invoices
  group by workspace_key, date_trunc('month', invoice_date::timestamp)::date, currency
),
income_totals as (
  select
    workspace_key,
    date_trunc('month', paid_at)::date as period_start,
    currency,
    sum(coalesce(amount_net, amount_gross)) as total_income
  from accounting.income_events
  group by workspace_key, date_trunc('month', paid_at)::date, currency
),
adjustment_totals as (
  select
    ta.workspace_key,
    date_trunc('month', tp.period_start::timestamp)::date as period_start,
    ta.currency,
    sum(case when ta.affects_income then ta.amount else 0 end) as income_adjustments,
    sum(case when ta.affects_expense then ta.amount else 0 end) as expense_adjustments
  from accounting.tax_adjustments ta
  join accounting.tax_periods tp on tp.id = ta.period_id
  group by ta.workspace_key, date_trunc('month', tp.period_start::timestamp)::date, ta.currency
)
select
  coalesce(it.workspace_key, et.workspace_key, at.workspace_key) as workspace_key,
  coalesce(it.period_start, et.period_start, at.period_start) as period_start,
  coalesce(it.currency, et.currency, at.currency) as currency,
  coalesce(it.total_income, 0) + coalesce(at.income_adjustments, 0) as total_income,
  coalesce(et.total_expenses, 0) + coalesce(at.expense_adjustments, 0) as total_expenses,
  (coalesce(it.total_income, 0) + coalesce(at.income_adjustments, 0))
    - (coalesce(et.total_expenses, 0) + coalesce(at.expense_adjustments, 0)) as net_result
from income_totals it
full outer join expense_totals et
  on it.workspace_key = et.workspace_key
 and it.period_start = et.period_start
 and it.currency = et.currency
full outer join adjustment_totals at
  on coalesce(it.workspace_key, et.workspace_key) = at.workspace_key
 and coalesce(it.period_start, et.period_start) = at.period_start
 and coalesce(it.currency, et.currency) = at.currency;
