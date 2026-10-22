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
