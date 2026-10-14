-- PR 2. All writes use server-side authorization; personal data is never public.
begin;
alter table public.events add column if not exists capacity integer;
alter table public.events add column if not exists is_club_meeting boolean not null default false;
alter table public.events drop constraint if exists events_capacity_check;
alter table public.events add constraint events_capacity_check check (capacity is null or capacity > 0);
create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  phone text not null check (phone ~ '^\+996[0-9]{9}$'),
  guests integer not null default 1 check (guests between 1 and 6),
  created_at timestamptz not null default now()
);
create unique index if not exists event_rsvps_event_phone_idx on public.event_rsvps(event_id, phone);
alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from public, anon, authenticated;
-- Admin session/identity is checked by /api/admin; its server client uses service_role.
grant select, delete on public.event_rsvps to service_role;
revoke insert, update on public.event_rsvps from service_role;
drop policy if exists "server admin read rsvps" on public.event_rsvps;
drop policy if exists "server admin delete rsvps" on public.event_rsvps;
create policy "server admin read rsvps" on public.event_rsvps for select to service_role using (true);
create policy "server admin delete rsvps" on public.event_rsvps for delete to service_role using (true);

create or replace function public.create_event_rsvp(p_event_id uuid, p_name text, p_phone text, p_guests integer)
returns table(id uuid, event_id uuid, name text, phone text, guests integer, created_at timestamptz, seats_left integer)
language plpgsql security definer set search_path = public
as $$
declare e public.events%rowtype; taken bigint; saved public.event_rsvps%rowtype;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 200 or p_phone is null or p_phone !~ '^\+996[0-9]{9}$' or p_guests is null or p_guests not between 1 and 6 then
    raise exception using message = 'invalid_input', errcode = 'P0001';
  end if;
  select * into e from public.events where public.events.id = p_event_id for update;
  if not found or e.status <> 'published' then raise exception using message = 'event_not_found', errcode = 'P0001'; end if;
  if (e.date + e.time) at time zone 'Asia/Bishkek' <= clock_timestamp() then raise exception using message = 'event_past', errcode = 'P0001'; end if;
  if exists(select 1 from public.event_rsvps r where r.event_id = p_event_id and r.phone = p_phone) then raise exception using message = 'duplicate', errcode = 'P0001'; end if;
  select coalesce(sum(r.guests),0) into taken from public.event_rsvps r where r.event_id = p_event_id;
  if e.capacity is not null and taken >= e.capacity then raise exception using message = 'sold_out', errcode = 'P0001'; end if;
  if e.capacity is not null and taken + p_guests > e.capacity then raise exception using message = 'not_enough_seats', errcode = 'P0001'; end if;
  insert into public.event_rsvps as r (event_id,name,phone,guests) values (p_event_id,trim(p_name),p_phone,p_guests) returning r.* into saved;
  return query select saved.id,saved.event_id,saved.name,saved.phone,saved.guests,saved.created_at,case when e.capacity is null then null else (e.capacity-taken-p_guests)::integer end;
end;
$$;
revoke all on function public.create_event_rsvp(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_event_rsvp(uuid,text,text,integer) to service_role;

-- Only published event IDs and aggregate guest counts; no names, phones or RSVP IDs.
create or replace view public.event_seats as
select e.id as event_id, coalesce(sum(r.guests),0)::bigint as seats_taken
from public.events e left join public.event_rsvps r on r.event_id=e.id
where e.status='published' group by e.id;
revoke all on public.event_seats from public;
grant select on public.event_seats to anon, authenticated, service_role;

create or replace function public.guard_event_rsvp_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
declare taken bigint;
begin
  select coalesce(sum(guests),0) into taken from public.event_rsvps where event_id=old.id;
  if taken > 0 and (new.date is distinct from old.date or new.time is distinct from old.time) then raise exception using message='event_schedule_locked',errcode='P0001'; end if;
  if new.capacity is not null and new.capacity < taken then raise exception using message='capacity_below_taken',errcode='P0001'; end if;
  return new;
end;
$$;
revoke all on function public.guard_event_rsvp_changes() from public, anon, authenticated;
drop trigger if exists guard_event_rsvp_changes on public.events;
create trigger guard_event_rsvp_changes before update of date,time,capacity on public.events for each row execute function public.guard_event_rsvp_changes();
commit;
