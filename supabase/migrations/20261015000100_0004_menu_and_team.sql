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
