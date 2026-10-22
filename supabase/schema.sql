-- Reference snapshot only. Apply timestamped files in supabase/migrations instead.
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(), category text not null, name_ru text not null, name_en text not null,
  composition_ru text default '', composition_en text default '', strength text default '', price numeric not null default 0, is_hit boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), date date not null, time time not null, title_ru text not null, title_en text not null,
  description_ru text default '', description_en text default '', image_url text default '', status text not null default 'draft' check (status in ('published','draft','moderation')), created_at timestamptz not null default now()
);
create table if not exists public.gallery_photos (id uuid primary key default gen_random_uuid(), image_url text not null, caption_ru text default '', caption_en text default '', created_at timestamptz not null default now());
create table if not exists public.reviews (id uuid primary key default gen_random_uuid(), author text not null, rating int not null check (rating between 1 and 5), text_ru text not null, text_en text default '', status text not null default 'moderation' check (status in ('published','moderation')), created_at timestamptz not null default now());
create table if not exists public.bookings (id uuid primary key default gen_random_uuid(), name text not null, phone text not null, date date not null, time time not null, guests int not null, comment text default '', status text not null default 'pending', created_at timestamptz not null default now());
create table if not exists public.rate_limits (
  key_hash text primary key,
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);
create index if not exists rate_limits_expires_at_idx on public.rate_limits (expires_at);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
  checked_at timestamptz := clock_timestamp();
begin
  if p_key is null or p_key = '' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit arguments';
  end if;

  delete from public.rate_limits where expires_at <= checked_at;

  insert into public.rate_limits (key_hash, request_count, window_started_at, expires_at)
  values (p_key, 1, checked_at, checked_at + make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update
  set request_count = public.rate_limits.request_count + 1
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

alter table public.menu_items enable row level security; alter table public.events enable row level security; alter table public.gallery_photos enable row level security; alter table public.reviews enable row level security; alter table public.bookings enable row level security;
alter table public.rate_limits enable row level security;
drop policy if exists "published menu is public" on public.menu_items;
drop policy if exists "published events are public" on public.events;
drop policy if exists "published gallery is public" on public.gallery_photos;
drop policy if exists "published reviews are public" on public.reviews;
create policy "published menu is public" on public.menu_items for select using (true);
create policy "published events are public" on public.events for select using (status = 'published');
create policy "published gallery is public" on public.gallery_photos for select using (true);
create policy "published reviews are public" on public.reviews for select using (status = 'published');
drop policy if exists "admins manage content" on public.menu_items;
drop policy if exists "admins manage events" on public.events;
drop policy if exists "admins manage gallery" on public.gallery_photos;
drop policy if exists "admins manage reviews" on public.reviews;
drop policy if exists "anyone can create booking" on public.bookings;

revoke all on table public.rate_limits from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- PR 1 foundation upgrade. Apply after 0001; safe to repeat.
begin;

alter table public.bookings drop constraint if exists bookings_status_check;
update public.bookings set status = 'pending' where status not in ('pending', 'confirmed', 'declined') or status is null;
alter table public.bookings alter column status set default 'pending';
alter table public.bookings alter column status set not null;
alter table public.bookings add constraint bookings_status_check check (status in ('pending', 'confirmed', 'declined'));
create index if not exists bookings_status_created_at_idx on public.bookings (status, created_at);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  checked_at timestamptz := clock_timestamp();
  current_count integer;
begin
  if p_key is null or p_key = '' or length(p_key) > 200 or p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'Invalid rate limit arguments';
  end if;
  -- Bounded cleanup on every write, including blocked requests.
  delete from public.rate_limits where key_hash in (
    select key_hash from public.rate_limits where expires_at <= checked_at order by expires_at, key_hash limit 1000
  );
  insert into public.rate_limits as limits (key_hash, request_count, window_started_at, expires_at)
  values (p_key, 1, checked_at, checked_at + make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update set
    request_count = case when limits.expires_at <= checked_at then 1 else least(limits.request_count::bigint + 1, 2147483647)::integer end,
    window_started_at = case when limits.expires_at <= checked_at then checked_at else limits.window_started_at end,
    expires_at = case when limits.expires_at <= checked_at then checked_at + make_interval(secs => p_window_seconds) else limits.expires_at end
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;

revoke all on table public.rate_limits from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- All admin writes go through authenticated app endpoints using service_role.
-- Public browser sessions cannot mutate content or create bookings directly.
revoke insert, update, delete on public.menu_items, public.events, public.gallery_photos, public.reviews, public.bookings from anon, authenticated;
grant select, insert, update, delete on public.menu_items, public.events, public.gallery_photos, public.reviews, public.bookings, public.rate_limits to service_role;

-- No upload UI in PR 1. The server helper supports JPEG/PNG/WebP <= 5 MiB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media public read" on storage.objects;
drop policy if exists "media server insert" on storage.objects;
drop policy if exists "media server update" on storage.objects;
drop policy if exists "media server delete" on storage.objects;
create policy "media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "media server insert" on storage.objects for insert to service_role with check (bucket_id = 'media');
create policy "media server update" on storage.objects for update to service_role using (bucket_id = 'media') with check (bucket_id = 'media');
create policy "media server delete" on storage.objects for delete to service_role using (bucket_id = 'media');

commit;

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

begin;
alter table public.menu_items add column if not exists portion_ru text not null default '';
alter table public.menu_items add column if not exists portion_en text not null default '';
create table if not exists public.admin_members (
  email text primary key check (email=lower(trim(email)) and length(email) between 3 and 254 and position('@' in email)>1),
  created_at timestamptz not null default now()
);
alter table public.admin_members enable row level security;
revoke all on public.admin_members from public, anon, authenticated;
grant select,insert,update,delete on public.admin_members to service_role;
drop policy if exists "server owner manages team" on public.admin_members;
create policy "server owner manages team" on public.admin_members for all to service_role using(true) with check(true);
-- Illustrative portions for the explicitly seeded demo menu only; preserve existing edits.
update public.menu_items m set portion_ru=v.ru, portion_en=v.en from (values
 ('d3e00000-0000-4000-8000-000000000001'::uuid,'200 мл','200 ml'),
 ('d3e00000-0000-4000-8000-000000000002'::uuid,'180 мл','180 ml'),
 ('d3e00000-0000-4000-8000-000000000003'::uuid,'300 мл','300 ml'),
 ('d3e00000-0000-4000-8000-000000000004'::uuid,'250 мл','250 ml'),
 ('d3e00000-0000-4000-8000-000000000005'::uuid,'320 г','320 g'),
 ('d3e00000-0000-4000-8000-000000000006'::uuid,'300 г','300 g'),
 ('d3e00000-0000-4000-8000-000000000007'::uuid,'150 г','150 g'),
 ('d3e00000-0000-4000-8000-000000000008'::uuid,'500 мл','500 ml')
) v(id,ru,en) where m.id=v.id and m.portion_ru='' and m.portion_en='';
commit;
-- Per-item menu photographs. Safe to repeat; existing custom photographs are preserved.
begin;
alter table public.menu_items add column if not exists image_url text not null default '';

-- Existing positions keep a clearly labelled category illustration until an admin replaces it.
update public.menu_items
set image_url = case
  when category = 'Десерты' then '/images/stock/dessert.jpg'
  when category = 'Горячее' then '/images/stock/pasta.jpg'
  when category in ('Закуски', 'Салаты') then '/images/stock/salad.jpg'
  when category in ('Кофе', 'Чай', 'Безалкогольные') then '/images/stock/coffee.jpg'
  else '/images/stock/cocktails.jpg'
end
where image_url = '';

alter table public.menu_items drop constraint if exists menu_items_image_url_check;
alter table public.menu_items add constraint menu_items_image_url_check check (
  image_url = '' or image_url ~ '^https://' or
  image_url ~ '^/images/stock/(dessert|pasta|salad|coffee|cocktails)\.jpg$'
);
-- Existing RLS and service-role-only writes remain unchanged.
notify pgrst, 'reload schema';
commit;
-- Telegram MVP: private configuration, bindings, atomic decisions and durable replies.
begin;
create table if not exists public.telegram_settings (
  id boolean primary key default true check(id),
  bot_id bigint not null check(bot_id > 0), username text not null,
  secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
  previous_secret_hash text, previous_valid_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.telegram_admins (
  bot_id bigint not null, telegram_user_id bigint not null check(telegram_user_id > 0),
  chat_id bigint not null check(chat_id = telegram_user_id),
  web_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(bot_id,telegram_user_id), unique(bot_id,web_user_id)
);
create table if not exists public.telegram_link_tokens (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  web_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists telegram_link_expiry_idx on public.telegram_link_tokens(expires_at);
create table if not exists public.telegram_updates (
  bot_id bigint not null, update_id bigint not null check(update_id >= 0),
  processed_at timestamptz not null default now(), primary key(bot_id,update_id)
);
create table if not exists public.telegram_sessions (
  bot_id bigint not null, chat_id bigint not null,
  locale text not null check(locale in ('ru','en')),
  updated_at timestamptz not null default now(), primary key(bot_id,chat_id)
);
create table if not exists public.booking_status_audit (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_user_id uuid not null, source text not null check(source in ('web','telegram')),
  before_status text not null, after_status text not null, created_at timestamptz not null default now()
);
create table if not exists public.telegram_outbox (
  id uuid primary key default gen_random_uuid(), bot_id bigint not null,
  update_id bigint not null, ordinal integer not null, job jsonb not null,
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_token uuid, lease_until timestamptz, delivered_at timestamptz, dead_at timestamptz,
  created_at timestamptz not null default now(), unique(bot_id,update_id,ordinal)
);
create index if not exists telegram_outbox_pending_idx on public.telegram_outbox(bot_id,update_id,next_attempt_at)
  where delivered_at is null and dead_at is null;

create or replace function public.transition_booking_status(
 p_id uuid, p_status text, p_expected text, p_actor uuid, p_source text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings; outcome text;
begin
 if p_actor is null or p_status is null or p_expected is null or p_source is null or p_status not in ('pending','confirmed','declined') or p_expected not in ('pending','confirmed','declined') or p_source not in ('web','telegram') then raise exception 'invalid_transition'; end if;
 select * into b from public.bookings where id=p_id for update;
 if not found then return jsonb_build_object('outcome','not_found'); end if;
 if b.status=p_status then outcome:='already';
 elsif b.status<>p_expected then outcome:='conflict';
 elsif p_status='confirmed' and ((b.date+b.time) at time zone 'Asia/Bishkek') <= clock_timestamp() then outcome:='past';
 else
  insert into public.booking_status_audit(booking_id,actor_user_id,source,before_status,after_status) values(b.id,p_actor,p_source,b.status,p_status);
  update public.bookings set status=p_status where id=b.id returning * into b;
  outcome:='changed';
 end if;
 return jsonb_build_object('outcome',outcome,'booking',to_jsonb(b));
end $$;

create or replace function public.finish_telegram_update(
 p_bot_id bigint, p_update_id bigint, p_chat_id bigint, p_tg_user_id bigint,
 p_locale text, p_replies jsonb, p_action text default 'none',
 p_booking_id uuid default null, p_web_user_id uuid default null, p_link_hash text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare outcome text:='normal'; transition jsonb; jobs jsonb; job jsonb; ordinal integer:=0; target_user uuid; status_label text;
begin
 if p_update_id is null or p_bot_id is null or p_action is null or p_locale is null or p_replies is null or p_update_id<0 or p_bot_id<=0 or p_action not in ('none','confirm','decline','link') or p_locale not in ('ru','en') or jsonb_typeof(p_replies)<>'object' then raise exception 'invalid_update'; end if;
 insert into public.telegram_updates(bot_id,update_id) values(p_bot_id,p_update_id) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true); end if;
 if p_action in ('confirm','decline','link') then
  if p_web_user_id is null or p_tg_user_id is null or p_chat_id is null or p_tg_user_id<=0 or p_chat_id<>p_tg_user_id then raise exception 'invalid_actor'; end if;
 end if;
 if p_action in ('confirm','decline') then
  -- App revalidates the binding against current web-admin rights on every request.
  if not exists(select 1 from public.telegram_admins where bot_id=p_bot_id and telegram_user_id=p_tg_user_id and chat_id=p_chat_id and web_user_id=p_web_user_id) then raise exception 'invalid_actor'; end if;
  transition:=public.transition_booking_status(p_booking_id,case when p_action='confirm' then 'confirmed' else 'declined' end,'pending',p_web_user_id,'telegram');
  outcome:=transition->>'outcome';
 elsif p_action='link' then
  delete from public.telegram_link_tokens where token_hash=p_link_hash and web_user_id=p_web_user_id and expires_at>clock_timestamp() returning web_user_id into target_user;
  if not found then outcome:='link_expired';
  else
   delete from public.telegram_admins where bot_id=p_bot_id and web_user_id=target_user;
   insert into public.telegram_admins(bot_id,telegram_user_id,chat_id,web_user_id) values(p_bot_id,p_tg_user_id,p_chat_id,target_user)
   on conflict(bot_id,telegram_user_id) do update set chat_id=excluded.chat_id,web_user_id=excluded.web_user_id,created_at=now();
  end if;
 end if;
 if p_chat_id is not null then
  insert into public.telegram_sessions(bot_id,chat_id,locale) values(p_bot_id,p_chat_id,p_locale)
  on conflict(bot_id,chat_id) do update set locale=excluded.locale,updated_at=now();
 end if;
 jobs:=coalesce(p_replies->outcome,p_replies->'normal','[]'::jsonb);
 if jsonb_typeof(jobs)<>'array' or jsonb_array_length(jobs)>8 then raise exception 'invalid_jobs'; end if;
 status_label:=coalesce(p_replies#>>array['status_labels',transition#>>'{booking,status}'],'');
 for job in select value from jsonb_array_elements(jobs) loop
  if job->>'method' is null or job->>'method' not in ('sendMessage','editMessageText','answerCallbackQuery') then raise exception 'invalid_job_method'; end if;
  if job#>>'{params,text}' is not null then job:=jsonb_set(job,'{params,text}',to_jsonb(replace(job#>>'{params,text}','{booking_status}',status_label))); end if;
  insert into public.telegram_outbox(bot_id,update_id,ordinal,job) values(p_bot_id,p_update_id,ordinal,job);
  ordinal:=ordinal+1;
 end loop;
 delete from public.telegram_link_tokens where expires_at<now();
 delete from public.telegram_outbox where created_at<now()-interval '7 days';
 delete from public.telegram_updates where processed_at<now()-interval '30 days';
 delete from public.telegram_sessions where updated_at<now()-interval '90 days';
 return jsonb_build_object('duplicate',false,'outcome',outcome);
end $$;

create or replace function public.claim_telegram_delivery(p_bot_id bigint,p_update_id bigint)
returns setof public.telegram_outbox language plpgsql security definer set search_path=public,pg_temp as $$
declare job_id uuid;
begin
 select id into job_id from public.telegram_outbox
 where bot_id=p_bot_id and update_id=p_update_id and delivered_at is null and dead_at is null
 and next_attempt_at<=now() and (lease_until is null or lease_until<now())
 order by ordinal for update skip locked limit 1;
 if not found then return; end if;
 return query update public.telegram_outbox set lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=job_id returning *;
end $$;
create or replace function public.ack_telegram_delivery(p_id uuid,p_lease uuid,p_success boolean,p_permanent boolean,p_retry_after integer default 5)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.telegram_outbox set
 delivered_at=case when p_success then now() else null end,
 dead_at=case when not p_success and p_permanent then now() else null end,
 next_attempt_at=now()+make_interval(secs=>greatest(1,least(3600,p_retry_after))),lease_until=null,lease_token=null
 where id=p_id and lease_token=p_lease and delivered_at is null and dead_at is null;
 return found;
end $$;

do $$ declare tbl text; fn record; begin
 foreach tbl in array array['telegram_settings','telegram_admins','telegram_link_tokens','telegram_updates','telegram_sessions','booking_status_audit','telegram_outbox'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on table public.%I from public,anon,authenticated',tbl);
  execute format('grant select,insert,update,delete on table public.%I to service_role',tbl);
 end loop;
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('transition_booking_status','finish_telegram_update','claim_telegram_delivery','ack_telegram_delivery') loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to service_role',fn.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
