-- MASTER PRINT Cloud foundation
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'MASTER PRINT',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('owner','admin','manager','employee','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- First integration pass stores the existing browser ERP state as one company snapshot.
-- This preserves the current application's data shape while web/mobile clients are connected.
create table if not exists public.app_state (
  company_id uuid primary key references public.companies(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.set_app_state_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at
before update on public.app_state
for each row execute function public.set_app_state_updated_at();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.app_state enable row level security;

-- Company membership can read its own company record.
drop policy if exists "members read own company" on public.companies;
create policy "members read own company" on public.companies
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = companies.id and p.is_active
));

-- Users can read their own profile and profiles of colleagues in the same company.
drop policy if exists "members read company profiles" on public.profiles;
create policy "members read company profiles" on public.profiles
for select to authenticated
using (exists (
  select 1 from public.profiles me
  where me.id = auth.uid() and me.company_id = profiles.company_id and me.is_active
));

-- Only an owner/admin may add or change profiles for their company.
drop policy if exists "admins manage company profiles" on public.profiles;
create policy "admins manage company profiles" on public.profiles
for all to authenticated
using (exists (
  select 1 from public.profiles me
  where me.id = auth.uid()
    and me.company_id = profiles.company_id
    and me.is_active
    and me.role in ('owner','admin')
))
with check (exists (
  select 1 from public.profiles me
  where me.id = auth.uid()
    and me.company_id = profiles.company_id
    and me.is_active
    and me.role in ('owner','admin')
));

-- Active company members can read and write the shared ERP snapshot.
drop policy if exists "members read company state" on public.app_state;
create policy "members read company state" on public.app_state
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = app_state.company_id and p.is_active
));

drop policy if exists "members insert company state" on public.app_state;
create policy "members insert company state" on public.app_state
for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = app_state.company_id
    and p.is_active and p.role in ('owner','admin','manager','employee')
));

drop policy if exists "members update company state" on public.app_state;
create policy "members update company state" on public.app_state
for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = app_state.company_id
    and p.is_active and p.role in ('owner','admin','manager','employee')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.company_id = app_state.company_id
    and p.is_active and p.role in ('owner','admin','manager','employee')
));

grant select on public.companies to authenticated;
grant select on public.profiles to authenticated;
grant insert, select, update on public.app_state to authenticated;

-- Enable Postgres Changes so logged-in clients receive updates immediately.
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception when duplicate_object then
  null;
when undefined_object then
  raise notice 'Publication supabase_realtime not found; enable Realtime for app_state in Dashboard.';
end $$;

-- Optional private storage bucket for product photos and documents.
insert into storage.buckets (id, name, public)
values ('master-print-files', 'master-print-files', false)
on conflict (id) do nothing;

drop policy if exists "company users read master print files" on storage.objects;
create policy "company users read master print files"
on storage.objects for select to authenticated
using (
  bucket_id = 'master-print-files'
  and (storage.foldername(name))[1] = (
    select p.company_id::text from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
);

drop policy if exists "company users upload master print files" on storage.objects;
create policy "company users upload master print files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'master-print-files'
  and (storage.foldername(name))[1] = (
    select p.company_id::text from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
);

drop policy if exists "company users update master print files" on storage.objects;
create policy "company users update master print files"
on storage.objects for update to authenticated
using (
  bucket_id = 'master-print-files'
  and (storage.foldername(name))[1] = (
    select p.company_id::text from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
)
with check (
  bucket_id = 'master-print-files'
  and (storage.foldername(name))[1] = (
    select p.company_id::text from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
);
