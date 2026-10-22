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
