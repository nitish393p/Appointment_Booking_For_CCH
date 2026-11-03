-- =====================================================================
-- CyberCase Appointments - Supabase schema with role-based security
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
-- Roles: director | assistant_director | forensics_expert
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'forensics_expert'
              check (role in ('director', 'assistant_director', 'forensics_expert')),
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.profiles alter column active set default false;

create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique,
  client_name  text not null,
  phone        text not null,
  email        text not null default '',
  service      text not null,
  urgency      text not null check (urgency in ('Low', 'Medium', 'High', 'Critical')),
  start_at     timestamptz not null,
  duration_min integer not null default 30 check (duration_min > 0),
  status       text not null default 'Requested'
               check (status in ('Requested', 'Confirmed', 'Rescheduled', 'Completed', 'Cancelled', 'No-show')),
  notes        text not null default '',
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists appointments_active_start_at_idx
  on public.appointments (start_at)
  where status in ('Requested', 'Confirmed', 'Rescheduled');

-- Fees are kept in their own table so they can be locked to leadership only.
create table if not exists public.appointment_finance (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  fee            numeric(12, 2) not null default 0 check (fee >= 0)
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  amount          numeric(12, 2) not null check (amount > 0),
  paid_on         date not null,
  method          text not null,
  note            text not null default '',
  recorded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.activity (
  id              bigint generated always as identity primary key,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  actor           uuid references auth.users(id) on delete set null,
  event           text not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

-- Role of the logged-in user; null if the account is inactive or missing.
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = pg_catalog, public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_leader()
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(public.my_role() in ('director', 'assistant_director'), false)
$$;

create or replace function public.is_director()
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(public.my_role() = 'director', false)
$$;

-- Conflict check for the whole team. Returns true/false only, never other people's details.
create or replace function public.has_conflict(p_start timestamptz, p_duration integer, p_exclude uuid default null)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.appointments a
    where a.status in ('Requested', 'Confirmed', 'Rescheduled')
      and (p_exclude is null or a.id <> p_exclude)
      and a.start_at < p_start + make_interval(mins => p_duration)
      and p_start < a.start_at + make_interval(mins => a.duration_min)
  )
$$;

-- New accounts must be activated by a director before they can access staff data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps updated_at current and stops forensics experts changing anything beyond status and notes.
create or replace function public.guard_appointment_update()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  if public.is_leader() then
    return new;
  end if;

  if (new.client_name, new.phone, new.email, new.service,
      new.urgency, new.start_at, new.duration_min, new.assigned_to)
     is distinct from
     (old.client_name, old.phone, old.email, old.service,
      old.urgency, old.start_at, old.duration_min, old.assigned_to) then
    raise exception 'Forensics experts can only change the status and notes.';
  end if;

  if new.status is distinct from old.status and new.status not in ('Completed', 'No-show') then
    raise exception 'Forensics experts can only mark an appointment Completed or No-show.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_guard on public.appointments;
create trigger appointments_guard
  before update on public.appointments
  for each row execute function public.guard_appointment_update();

-- Enforces the no-overlap rule atomically for staff and public bookings.
create or replace function public.guard_active_appointment_conflict()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status not in ('Requested', 'Confirmed', 'Rescheduled') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('cybercase:appointments'), 0);

  if exists (
    select 1 from public.appointments a
    where a.id <> new.id
      and a.status in ('Requested', 'Confirmed', 'Rescheduled')
      and a.start_at < new.start_at + make_interval(mins => new.duration_min)
      and new.start_at < a.start_at + make_interval(mins => a.duration_min)
  ) then
    raise exception 'This time overlaps an active appointment.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_conflict_guard on public.appointments;
create trigger appointments_conflict_guard
  before insert or update on public.appointments
  for each row execute function public.guard_active_appointment_conflict();

-- ---------------------------------------------------------------- row level security

alter table public.profiles            enable row level security;
alter table public.appointments        enable row level security;
alter table public.appointment_finance enable row level security;
alter table public.payments            enable row level security;
alter table public.activity            enable row level security;

-- Profiles: every active team member can see names and roles (needed for assignments).
drop policy if exists "profiles: team can view" on public.profiles;
create policy "profiles: team can view"
  on public.profiles for select to authenticated
  using (public.my_role() is not null);

-- Only the director can change roles or deactivate accounts.
drop policy if exists "profiles: director updates" on public.profiles;
create policy "profiles: director updates"
  on public.profiles for update to authenticated
  using (public.is_director())
  with check (public.is_director());

-- Appointments: leaders see all; forensics experts see only appointments assigned to them.
drop policy if exists "appointments: view" on public.appointments;
create policy "appointments: view"
  on public.appointments for select to authenticated
  using (public.my_role() is not null and (public.is_leader() or assigned_to = auth.uid()));

drop policy if exists "appointments: leaders create" on public.appointments;
drop policy if exists "appointments: active staff create" on public.appointments;
create policy "appointments: active staff create"
  on public.appointments for insert to authenticated
  with check (
    public.my_role() is not null
    and (public.is_leader() or assigned_to = auth.uid())
  );

drop policy if exists "appointments: update own or leader" on public.appointments;
create policy "appointments: update own or leader"
  on public.appointments for update to authenticated
  using (public.my_role() is not null and (public.is_leader() or assigned_to = auth.uid()))
  with check (public.my_role() is not null and (public.is_leader() or assigned_to = auth.uid()));

drop policy if exists "appointments: director deletes" on public.appointments;
create policy "appointments: director deletes"
  on public.appointments for delete to authenticated
  using (public.is_director());

-- Fees: leadership only. Forensics experts never receive these rows.
drop policy if exists "finance: leaders" on public.appointment_finance;
create policy "finance: leaders"
  on public.appointment_finance for all to authenticated
  using (public.is_leader())
  with check (public.is_leader());

-- Payments: leadership only.
drop policy if exists "payments: leaders" on public.payments;
create policy "payments: leaders"
  on public.payments for all to authenticated
  using (public.is_leader())
  with check (public.is_leader());

-- Activity: leaders see everything; others see entries for their assigned appointments.
drop policy if exists "activity: view" on public.activity;
create policy "activity: view"
  on public.activity for select to authenticated
  using (
    public.is_leader()
    or exists (
      select 1 from public.appointments a
      where a.id = activity.appointment_id and a.assigned_to = auth.uid()
    )
  );

drop policy if exists "activity: write as yourself" on public.activity;
create policy "activity: write as yourself"
  on public.activity for insert to authenticated
  with check (
    actor = auth.uid()
    and public.my_role() is not null
    and (
      public.is_leader()
      or exists (
        select 1 from public.appointments a
        where a.id = activity.appointment_id and a.assigned_to = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------- privileges

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on function public.my_role() from public;
revoke all on function public.is_leader() from public;
revoke all on function public.is_director() from public;
revoke all on function public.has_conflict(timestamptz, integer, uuid) from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_appointment_update() from public;
revoke all on function public.guard_active_appointment_conflict() from public;

grant execute on function public.has_conflict(timestamptz, integer, uuid) to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_leader() to authenticated;
grant execute on function public.is_director() to authenticated;
