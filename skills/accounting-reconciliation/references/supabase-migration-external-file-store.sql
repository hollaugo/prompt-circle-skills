-- External file-store compatibility migration for the accounting-reconciliation skill.
-- Use this when an existing project already has legacy storage_bucket/storage_path columns.

create schema if not exists accounting;

alter table accounting.invoices
  add column if not exists file_store_provider text,
  add column if not exists file_store_root_path text,
  add column if not exists file_store_path text,
  add column if not exists external_file_id text,
  add column if not exists external_parent_id text,
  add column if not exists external_web_url text,
  add column if not exists external_download_url text,
  add column if not exists file_store_metadata jsonb not null default '{}'::jsonb;

update accounting.invoices
set
  file_store_provider = coalesce(file_store_provider, case when storage_bucket is not null then 'supabase-storage' else 'google-drive' end),
  file_store_root_path = coalesce(file_store_root_path, storage_bucket),
  file_store_path = coalesce(file_store_path, storage_path)
where file_store_provider is null
   or file_store_root_path is null
   or file_store_path is null;

alter table accounting.invoices
  alter column file_store_provider set default 'google-drive';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_file_store_provider_check'
      and conrelid = 'accounting.invoices'::regclass
  ) then
    alter table accounting.invoices
      add constraint invoices_file_store_provider_check
      check (file_store_provider in ('google-drive', 'supabase-storage', 's3', 'local', 'other'))
      not valid;
  end if;
end
$$;

alter table accounting.invoices validate constraint invoices_file_store_provider_check;

create unique index if not exists idx_invoices_file_store_dedupe
  on accounting.invoices (workspace_key, source_system, source_message_id, file_store_provider, file_store_path);

create index if not exists idx_invoices_external_file_id
  on accounting.invoices (workspace_key, file_store_provider, external_file_id);

alter table accounting.workpapers
  add column if not exists file_store_provider text,
  add column if not exists file_store_root_path text,
  add column if not exists file_store_path text,
  add column if not exists external_file_id text,
  add column if not exists external_web_url text,
  add column if not exists file_store_metadata jsonb not null default '{}'::jsonb;

update accounting.workpapers
set
  file_store_provider = coalesce(file_store_provider, case when storage_bucket is not null then 'supabase-storage' else null end),
  file_store_root_path = coalesce(file_store_root_path, storage_bucket),
  file_store_path = coalesce(file_store_path, storage_path)
where file_store_provider is null
   or file_store_root_path is null
   or file_store_path is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workpapers_file_store_provider_check'
      and conrelid = 'accounting.workpapers'::regclass
  ) then
    alter table accounting.workpapers
      add constraint workpapers_file_store_provider_check
      check (file_store_provider in ('google-drive', 'supabase-storage', 's3', 'local', 'other'))
      not valid;
  end if;
end
$$;

alter table accounting.workpapers validate constraint workpapers_file_store_provider_check;
