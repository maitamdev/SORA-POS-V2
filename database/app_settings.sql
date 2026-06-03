-- Run once in Supabase SQL Editor before using Settings API.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid null references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists app_settings_updated_at_idx
  on public.app_settings(updated_at desc);

alter table public.app_settings enable row level security;

-- The backend uses SUPABASE_SERVICE_ROLE_KEY, so it can bypass RLS.
-- No browser/client direct access policy is required.
