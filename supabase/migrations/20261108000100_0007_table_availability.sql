-- Shared inventory for website and Telegram. Requests hold a table until declined.
begin;
alter table public.bookings add column if not exists table_id text
  check (table_id in ('T1','T2','T3','T4','T5','T6','T7','T8'));
create index if not exists bookings_table_visit_idx on public.bookings(table_id,date,time)
  where table_id is not null and status in ('pending','confirmed');
alter table public.telegram_sessions add column if not exists flow jsonb;

-- Older requests recorded their selected table only in this server-written prefix.
-- Preserve even overlapping legacy requests; staff can resolve those individually.
drop trigger if exists guard_table_booking on public.bookings;
update public.bookings set table_id=substring(comment from '^Пожелание к бронированию: стол (T[1-8]) \(')
where table_id is null and comment ~ '^Пожелание к бронированию: стол T[1-8] \('
  and time>=time '10:00' and time<time '22:00';

create or replace function public.guard_table_booking()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare seats integer;
begin
 if new.table_id is null or new.status='declined' then return new; end if;
 seats:=case new.table_id when 'T1' then 2 when 'T2' then 2 when 'T3' then 4
   when 'T4' then 4 when 'T5' then 4 when 'T6' then 6 when 'T7' then 2 when 'T8' then 6 else 0 end;
 if new.guests > seats then raise exception 'table_capacity' using errcode='23514'; end if;
 if new.time < time '10:00' or new.time >= time '22:00' then raise exception 'booking_hours' using errcode='23514'; end if;
 -- Serialize all writes to this table, including status changes by administrators.
 perform pg_advisory_xact_lock(hashtextextended('venue-table:'||new.table_id,0));
 if exists(select 1 from public.bookings b where b.table_id=new.table_id and b.date=new.date
   and b.status in ('pending','confirmed') and b.id<>new.id
   and b.date+b.time < least(new.date+new.time+interval '2 hours',new.date+time '22:00')
   and new.date+new.time < least(b.date+b.time+interval '2 hours',b.date+time '22:00')) then
   raise exception 'table_unavailable' using errcode='23P01';
 end if;
 return new;
end $$;
create trigger guard_table_booking before insert or update of table_id,date,time,guests,status
  on public.bookings for each row execute function public.guard_table_booking();

-- No guest names, phones, comments or booking IDs leave this function.
create or replace function public.available_venue_tables(p_date date,p_time time,p_guests integer)
returns table(id text) language sql stable security definer set search_path=public,pg_temp as $$
 select t.id from (values ('T1',2),('T2',2),('T3',4),('T4',4),('T5',4),('T6',6),('T7',2),('T8',6)) t(id,seats)
 where p_guests between 1 and t.seats and p_time>=time '10:00' and p_time<time '22:00'
 and ((p_date+p_time) at time zone 'Asia/Bishkek')>now()
 and not exists(select 1 from public.bookings b where b.table_id=t.id and b.date=p_date
   and b.status in ('pending','confirmed')
   and b.date+b.time < least(p_date+p_time+interval '2 hours',p_date+time '22:00')
   and p_date+p_time < least(b.date+b.time+interval '2 hours',b.date+time '22:00'))
 order by t.id;
$$;
revoke all on function public.available_venue_tables(date,time,integer) from public,anon,authenticated;
grant execute on function public.available_venue_tables(date,time,integer) to service_role;
revoke all on function public.guard_table_booking() from public,anon,authenticated;
grant execute on function public.guard_table_booking() to service_role;

-- The update transaction is replaced below to persist visitor flow and booking
-- together with its deduplication marker and durable Telegram reply.

create or replace function public.finish_telegram_update(
 p_bot_id bigint, p_update_id bigint, p_chat_id bigint, p_tg_user_id bigint,
 p_locale text, p_replies jsonb, p_action text default 'none',
 p_booking_id uuid default null, p_web_user_id uuid default null, p_link_hash text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare outcome text:='normal'; transition jsonb; jobs jsonb; job jsonb; ordinal integer:=0; target_user uuid; status_label text; current_flow jsonb; guest jsonb;
begin
 if p_update_id is null or p_bot_id is null or p_action is null or p_locale is null or p_replies is null or p_update_id<0 or p_bot_id<=0 or p_action not in ('none','confirm','decline','link','guest_flow','guest_booking') or p_locale not in ('ru','en') or jsonb_typeof(p_replies)<>'object' then raise exception 'invalid_update'; end if;
 insert into public.telegram_updates(bot_id,update_id) values(p_bot_id,p_update_id) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true); end if;
 if p_action in ('confirm','decline','link') then
  if p_web_user_id is null or p_tg_user_id is null or p_chat_id is null or p_tg_user_id<=0 or p_chat_id<>p_tg_user_id then raise exception 'invalid_actor'; end if;
 end if;
 if p_action in ('guest_flow','guest_booking') then
  if p_chat_id is null or p_chat_id<>p_tg_user_id or p_chat_id<=0 then raise exception 'invalid_guest'; end if;
  insert into public.telegram_sessions(bot_id,chat_id,locale) values(p_bot_id,p_chat_id,p_locale) on conflict do nothing;
  select flow into current_flow from public.telegram_sessions where bot_id=p_bot_id and chat_id=p_chat_id for update;
  if coalesce(current_flow->>'token','')<>coalesce(p_replies->>'expected_token','') then outcome:='stale';
  elsif p_action='guest_booking' then
   guest:=p_replies->'guest_booking';
   if current_flow->>'step' is distinct from 'review' or coalesce((current_flow->>'expires')::timestamptz,'epoch'::timestamptz)<=clock_timestamp() then outcome:='stale';
   elsif not public.check_rate_limit('tg-book:'||p_bot_id||':'||p_chat_id,5,600) then outcome:='booking_limit';
   elsif ((guest->>'date')::date+(guest->>'time')::time) at time zone 'Asia/Bishkek' <= clock_timestamp() then outcome:='past';
   else
    begin
     insert into public.bookings(id,name,phone,date,time,guests,comment,table_id,status)
     values((guest->>'id')::uuid,guest->>'name',guest->>'phone',(guest->>'date')::date,(guest->>'time')::time,(guest->>'guests')::integer,guest->>'comment',guest->>'table_id','pending');
    exception when exclusion_violation then outcome:='table_conflict'; end;
   end if;
  end if;
  if outcome<>'stale' then
   update public.telegram_sessions set flow=case when p_action='guest_booking' then null else nullif(p_replies->'flow','null'::jsonb) end where bot_id=p_bot_id and chat_id=p_chat_id;
  end if;
 elsif p_action in ('confirm','decline') then
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
 update public.telegram_sessions set flow=null where flow is not null and (flow->>'expires')::timestamptz<now();
 return jsonb_build_object('duplicate',false,'outcome',outcome);
end $$;


notify pgrst,'reload schema';
commit;
