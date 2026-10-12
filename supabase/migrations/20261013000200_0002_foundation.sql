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
