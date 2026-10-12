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
create table if not exists public.bookings (id uuid primary key default gen_random_uuid(), name text not null, phone text not null, date date not null, time time not null, guests int not null, comment text default '', status text not null default 'new', created_at timestamptz not null default now());
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
