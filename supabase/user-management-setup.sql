-- MASTER PRINT: secure in-site user management
-- Run once in Supabase SQL Editor while signed in as project owner.

alter table public.profiles
  add column if not exists department text,
  add column if not exists email text;

create or replace function public.mp_is_company_admin(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = target_company
      and p.is_active = true
      and p.role in ('owner', 'admin')
  );
$$;

revoke all on function public.mp_is_company_admin(uuid) from public;
grant execute on function public.mp_is_company_admin(uuid) to authenticated;

grant select, insert, update on public.profiles to authenticated;

-- Keep each user's own profile readable; admins can read company profiles.
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "admins read company profiles" on public.profiles;
drop policy if exists "admins insert company profiles" on public.profiles;
drop policy if exists "admins update company profiles" on public.profiles;

create policy "users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "admins read company profiles"
on public.profiles for select to authenticated
using (public.mp_is_company_admin(company_id));

create policy "admins insert company profiles"
on public.profiles for insert to authenticated
with check (public.mp_is_company_admin(company_id));

create policy "admins update company profiles"
on public.profiles for update to authenticated
using (public.mp_is_company_admin(company_id))
with check (public.mp_is_company_admin(company_id));
