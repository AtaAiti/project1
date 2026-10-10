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
alter table public.menu_items enable row level security; alter table public.events enable row level security; alter table public.gallery_photos enable row level security; alter table public.reviews enable row level security; alter table public.bookings enable row level security;
create policy "published menu is public" on public.menu_items for select using (true);
create policy "published events are public" on public.events for select using (status = 'published');
create policy "published gallery is public" on public.gallery_photos for select using (true);
create policy "published reviews are public" on public.reviews for select using (status = 'published');
create policy "admins manage content" on public.menu_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admins manage events" on public.events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admins manage gallery" on public.gallery_photos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admins manage reviews" on public.reviews for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "anyone can create booking" on public.bookings for insert with check (true);
