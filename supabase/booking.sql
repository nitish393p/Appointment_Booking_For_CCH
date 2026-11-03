-- =====================================================================
-- CyberCase Appointments - public booking page support
-- Run AFTER schema.sql, in Supabase Dashboard > SQL Editor.
-- Visitors (not logged in) can ONLY call the two functions below.
-- They cannot read, list, or change any appointment data.
-- =====================================================================

-- Extra fields for bookings made from the website
alter table public.appointments add column if not exists consent_at timestamptz;
alter table public.appointments add column if not exists source text not null default 'staff';

-- Remove old overloads so PostgREST can discover the mode-free booking RPC.
do $$
declare
  function_signature regprocedure;
begin
  for function_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'public_book'
      and p.prokind = 'f'
  loop
    execute format('drop function %s', function_signature);
  end loop;
end;
$$;

-- Update the trigger function before dropping the field it previously referenced.
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

-- Existing meeting-mode values are intentionally removed with this legacy column.
alter table public.appointments drop column if exists mode;

-- Days the office is closed (leaders manage these)
create table if not exists public.blocked_dates (
  day     date primary key,
  reason  text not null default ''
);
alter table public.blocked_dates enable row level security;

drop policy if exists "blocked dates: leaders manage" on public.blocked_dates;
create policy "blocked dates: leaders manage"
  on public.blocked_dates for all to authenticated
  using (public.is_leader())
  with check (public.is_leader());

drop policy if exists "blocked dates: active staff read" on public.blocked_dates;
create policy "blocked dates: active staff read"
  on public.blocked_dates for select to authenticated
  using (public.my_role() is not null);

grant select, insert, update, delete on public.blocked_dates to authenticated;

-- ---------------------------------------------------------------
-- Office hours (IST). Change these numbers to match your office.
-- Slots are 30 minutes. Tuesday to Sunday, 10:30 to 18:00.
-- Blocked times: 10:00-11:00 AM and 1:00-3:30 PM.
-- ---------------------------------------------------------------
create or replace function public.public_slots(p_day date)
returns table (slot_time text, available boolean)
language sql stable security definer set search_path = pg_catalog, public, pg_temp
as $$
  with candidates as (
    select gs as local_start
    from generate_series(
      p_day + time '10:30',
      p_day + time '17:30',
      interval '30 minutes'
    ) as gs
    where extract(isodow from p_day) between 2 and 7          -- Tuesday to Sunday
      and not exists (select 1 from public.blocked_dates b where b.day = p_day)
      -- Exclude 10:00 AM to 11:00 AM (no appointments)
      and not (extract(hour from gs) = 10)
      -- Exclude 1:00 PM to 2:30 PM (no appointments)
      and not (extract(hour from gs) = 13 or (extract(hour from gs) = 14 and extract(minute from gs) = 0))
      -- Exclude lunch break: 2:00 pm to 3:30 pm
      and not (extract(hour from gs) = 14 or (extract(hour from gs) = 15 and extract(minute from gs) = 0))
  )
  select
    to_char(c.local_start, 'HH24:MI') as slot_time,
    (
      (c.local_start at time zone 'Asia/Kolkata') > now()
      and not exists (
        select 1 from public.appointments a
        where a.status in ('Requested', 'Confirmed', 'Rescheduled')
          and a.start_at < (c.local_start at time zone 'Asia/Kolkata') + interval '30 minutes'
          and (c.local_start at time zone 'Asia/Kolkata') < a.start_at + make_interval(mins => a.duration_min)
      )
    ) as available
  from candidates c
  order by c.local_start
$$;

-- ---------------------------------------------------------------
-- Booking. Validates everything on the server; the page's checks are only a convenience.
-- ---------------------------------------------------------------
create or replace function public.public_book(
  p_name     text,
  p_phone    text,
  p_email    text,
  p_service  text,
  p_day      date,
  p_time     text,
  p_notes    text,
  p_consent  boolean,
  p_website  text default '',         -- honeypot: real visitors leave this empty
  p_urgency  text default 'Medium'
)
returns text
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_start  timestamptz;
  v_ref    text;
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');  -- digits only
begin
  -- Honeypot: bots tend to fill in every field
  if coalesce(p_website, '') <> '' then
    raise exception 'Request could not be accepted.';
  end if;

  if p_consent is not true then
    raise exception 'Please agree to the privacy notice before booking.';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then
    raise exception 'Please enter your full name.';
  end if;

  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Please enter a valid mobile number.';
  end if;

  if coalesce(p_email, '') <> '' and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address, or leave it blank.';
  end if;

  if length(trim(coalesce(p_service, ''))) < 1 then
    raise exception 'Please choose at least one service.';
  end if;

  if p_urgency not in ('Low', 'Medium', 'High', 'Critical') then
    raise exception 'Please choose a valid urgency level.';
  end if;

  if length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Please keep the description under 1000 characters.';
  end if;

  -- Serialise bookings for the same day so two people cannot take the same slot at once
  perform pg_advisory_xact_lock(hashtext(p_day::text));

  if p_day < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Please choose today or a later date.';
  end if;

  if p_day > (now() at time zone 'Asia/Kolkata')::date + 30 then
    raise exception 'Please choose a date within the next 30 days.';
  end if;

  if extract(isodow from p_day) = 1 then
    raise exception 'The office is closed on Mondays. Please choose another day.';
  end if;

  if exists (select 1 from public.blocked_dates b where b.day = p_day) then
    raise exception 'The office is closed on that date. Please choose another day.';
  end if;

  v_start := (p_day + p_time::time)::timestamp at time zone 'Asia/Kolkata';

  if not exists (
    select 1 from public.public_slots(p_day) s
    where s.slot_time = p_time and s.available
  ) then
    raise exception 'That time is no longer available. Please choose another slot.';
  end if;

  -- One open request per mobile number per day
  if exists (
    select 1 from public.appointments a
    where a.phone = v_phone
      and a.status in ('Requested', 'Confirmed', 'Rescheduled')
      and (a.start_at at time zone 'Asia/Kolkata')::date = p_day
  ) then
    raise exception 'You already have a request for this day. Please call the office to change it.';
  end if;

  v_ref := 'CCH-' || to_char(p_day, 'YYYYMMDD') || '-'
           || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.appointments
    (ref, client_name, phone, email, service, urgency, start_at, duration_min,
     status, notes, consent_at, source)
  values
    (v_ref, trim(p_name), v_phone, coalesce(trim(p_email), ''), p_service, p_urgency,
     v_start, 30, 'Requested', coalesce(trim(p_notes), ''), now(), 'web_booking');

  insert into public.activity (appointment_id, actor, event)
  select a.id, null, 'Booking request received from the website'
  from public.appointments a where a.ref = v_ref;

  return v_ref;
end;
$$;

-- Visitors may call these two functions and nothing else
revoke all on function public.public_slots(date) from public;
revoke all on function public.public_book(text, text, text, text, date, text, text, boolean, text, text) from public;
grant execute on function public.public_slots(date) to anon, authenticated;
grant execute on function public.public_book(text, text, text, text, date, text, text, boolean, text, text)
  to anon, authenticated;

-- Make PostgREST discover the function immediately after this script commits.
notify pgrst, 'reload schema';

-- Verify the exact RPC signature and public execution grant.
select
  p.proname,
  pg_get_function_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'appointments'
      and c.column_name = 'mode'
  ) as legacy_mode_column_removed
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'public_book';
