-- Generated from Task.xlsx for plabin-task.
-- Run 001_initial_schema.sql first.
-- Required: create these users in Supabase Authentication before running this file:
--   - aekdanai@gmail.com
--   - beetoolbox66@gmail.com
--   - plabin2025@gmail.com
--   - supeerat.pom@gmail.com
-- The script is transactional and idempotent. Missing Auth users stop the import before any data changes.

begin;

do $$
declare missing_emails text;
begin
  select string_agg(required.email, ', ' order by required.email)
  into missing_emails
  from (values ('aekdanai@gmail.com'), ('beetoolbox66@gmail.com'), ('plabin2025@gmail.com'), ('supeerat.pom@gmail.com')) as required(email)
  where not exists (select 1 from auth.users au where lower(au.email) = required.email);
  if missing_emails is not null then
    raise exception 'Create these users in Supabase Authentication first: %', missing_emails;
  end if;
end $$;

-- Preserve original timestamps and calculated values during migration.
alter table public.profiles disable trigger profiles_touch;
alter table public.profiles disable trigger guard_last_admin;
alter table public.categories disable trigger categories_touch;
alter table public.tasks disable trigger tasks_touch;
alter table public.tasks disable trigger guard_task_update;
alter table public.checklist_items disable trigger checklist_touch;
alter table public.checklist_items disable trigger guard_checklist_update;
alter table public.checklist_items disable trigger checklist_recalculate;
alter table public.task_shares disable trigger shares_touch;

with source(email, display_name, avatar_url, is_active, created_at, last_login_at, role) as (
  values
  ('aekdanai@gmail.com', 'aekdanai', 'https://lh3.googleusercontent.com/a/ACg8ocKH-vlFBYQlC5mVy9vX6INOl9F3A1MpiGs06X6--nCq1gsE48M=s288-c-no', true, '2026-07-14T15:36:18.123+07:00'::timestamptz, '2026-07-29T08:52:55.446+07:00'::timestamptz, 'ADMIN'),
  ('beetoolbox66@gmail.com', 'BeeToolbox', null, true, '2026-07-16T00:00:00.000+07:00'::timestamptz, '2026-07-16T10:17:06.417+07:00'::timestamptz, 'USER'),
  ('plabin2025@gmail.com', 'Tae', null, true, '2026-07-23T00:00:00.000+07:00'::timestamptz, '2026-07-25T15:45:15.104+07:00'::timestamptz, 'USER'),
  ('supeerat.pom@gmail.com', 'Pom', null, true, '2026-07-23T00:00:00.000+07:00'::timestamptz, '2026-07-25T16:25:02.668+07:00'::timestamptz, 'USER')
)
insert into public.profiles (id, email, display_name, avatar_url, is_active, created_at, updated_at, last_login_at, role)
select au.id, s.email, s.display_name, s.avatar_url, s.is_active, s.created_at, s.created_at, s.last_login_at, s.role::public.app_role
from source s join auth.users au on lower(au.email) = s.email
on conflict (id) do update set
  email = excluded.email, display_name = excluded.display_name, avatar_url = excluded.avatar_url,
  is_active = excluded.is_active, created_at = excluded.created_at, updated_at = excluded.updated_at,
  last_login_at = excluded.last_login_at, role = excluded.role;

do $$
begin
  if exists (
    with source(id, category_name) as (values
  ('26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'สินค้าใหม่'),
  ('f5a6a64a-1c78-4f1e-9c16-10dee0a32083'::uuid, 'สต๊อกสินค้า'),
  ('ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'งานทั่วไป'),
  ('ebe2f175-bbb2-4fe7-b556-3a5ddads060c'::uuid, 'งานระบบ'),
  ('10f28386-924a-4e2b-ad34-c2b30758b539'::uuid, 'งานออกแบบ'),
  ('861f1c00-ed2e-44a1-811b-1fc8eab8acf8'::uuid, 'Marketplace'),
  ('1ade9bf9-4895-481c-971a-bcb81ad18705'::uuid, 'งานกราฟิก')
    )
    select 1
    from public.categories c
    join source s on lower(s.category_name) = lower(c.category_name) and s.id <> c.id
    where exists (select 1 from public.tasks t where t.category_id = c.id)
  ) then
    raise exception 'A same-name category with a different ID is already used by existing tasks';
  end if;
end $$;

with source(id, category_name) as (
  values
  ('26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'สินค้าใหม่'),
  ('f5a6a64a-1c78-4f1e-9c16-10dee0a32083'::uuid, 'สต๊อกสินค้า'),
  ('ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'งานทั่วไป'),
  ('ebe2f175-bbb2-4fe7-b556-3a5ddads060c'::uuid, 'งานระบบ'),
  ('10f28386-924a-4e2b-ad34-c2b30758b539'::uuid, 'งานออกแบบ'),
  ('861f1c00-ed2e-44a1-811b-1fc8eab8acf8'::uuid, 'Marketplace'),
  ('1ade9bf9-4895-481c-971a-bcb81ad18705'::uuid, 'งานกราฟิก')
)
delete from public.categories c
using source s
where lower(s.category_name) = lower(c.category_name)
  and s.id <> c.id
  and not exists (select 1 from public.tasks t where t.category_id = c.id);

insert into public.categories (id, category_name, color, owner_id, sort_order, is_active, created_at, updated_at)
values
  ('26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'สินค้าใหม่', '#303085', null, 2, true, '2026-07-14T15:33:45.844+07:00'::timestamptz, '2026-07-14T15:33:45.844+07:00'::timestamptz),
  ('f5a6a64a-1c78-4f1e-9c16-10dee0a32083'::uuid, 'สต๊อกสินค้า', '#8f533e', null, 3, true, '2026-07-14T15:33:46.719+07:00'::timestamptz, '2026-07-14T15:33:46.719+07:00'::timestamptz),
  ('ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'งานทั่วไป', '#8E8E93', null, 1, true, '2026-07-14T15:33:47.034+07:00'::timestamptz, '2026-07-14T15:33:47.034+07:00'::timestamptz),
  ('ebe2f175-bbb2-4fe7-b556-3a5ddads060c'::uuid, 'งานระบบ', '#FFBD59', null, 4, true, '2026-07-14T15:33:47.034+07:00'::timestamptz, '2026-07-14T15:33:47.034+07:00'::timestamptz),
  ('10f28386-924a-4e2b-ad34-c2b30758b539'::uuid, 'งานออกแบบ', '#AF52DE', null, 2, false, '2026-07-16T10:08:31.482+07:00'::timestamptz, '2026-07-25T10:35:06.146+07:00'::timestamptz),
  ('861f1c00-ed2e-44a1-811b-1fc8eab8acf8'::uuid, 'Marketplace', '#007AFF', null, 3, true, '2026-07-16T10:08:31.848+07:00'::timestamptz, '2026-07-16T10:08:31.848+07:00'::timestamptz),
  ('1ade9bf9-4895-481c-971a-bcb81ad18705'::uuid, 'งานกราฟิก', '#AF52DE', null, 2, true, '2026-07-24T15:11:18.755+07:00'::timestamptz, '2026-07-24T15:11:18.755+07:00'::timestamptz)
on conflict (id) do update set
  category_name = excluded.category_name, color = excluded.color, owner_id = excluded.owner_id,
  sort_order = excluded.sort_order, is_active = excluded.is_active,
  created_at = excluded.created_at, updated_at = excluded.updated_at;

with source(id, task_name, description, category_id, owner_email, progress, status, is_archived, created_at, updated_at, completed_at, archived_at, is_deleted) as (
  values
  ('28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'โซ่สแตนเลส 304 ร้าน ezTools', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 100, 'COMPLETED', true, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:23:28.711+07:00'::timestamptz, '2026-07-25T21:17:07.634+07:00'::timestamptz, '2026-07-25T21:23:28.711+07:00'::timestamptz, false),
  ('74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'สำเนา - โซ่สแตนเลส 304 ร้าน ezTools', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:00.961+07:00'::timestamptz, null, null, true),
  ('65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'สำเนา - โซ่สแตนเลส 304 ร้าน ezTools', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:19.824+07:00'::timestamptz, null, null, true),
  ('229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'สกรูตัวหนอน 304 ร้าน ezTools', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:46.861+07:00'::timestamptz, null, null, true),
  ('36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'แหวนรอง 304 ภาพใหม่', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 100, 'COMPLETED', true, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:34:58.774+07:00'::timestamptz, '2026-07-16T16:33:48.335+07:00'::timestamptz, '2026-07-16T16:34:58.774+07:00'::timestamptz, false),
  ('b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'แหวนสปริง 304 ภาพใหม่', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 100, 'COMPLETED', true, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:53.889+07:00'::timestamptz, '2026-07-16T22:36:19.650+07:00'::timestamptz, '2026-07-16T22:36:53.889+07:00'::timestamptz, false),
  ('6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'ขอเพิ่ม limit ตะกร้าใน lazada', null, 'ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'aekdanai@gmail.com', 100, 'COMPLETED', true, '2026-07-16T09:56:34.349+07:00'::timestamptz, '2026-07-23T20:52:59.991+07:00'::timestamptz, '2026-07-22T15:49:06.003+07:00'::timestamptz, '2026-07-23T20:52:59.991+07:00'::timestamptz, false),
  ('a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'ปรับราคาขายใน TikTok', 'ทุกร้าน สำหรับสินค้าที่อยู่ใน โปรโมชั่นลดคงที่', 'ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-16T09:58:14.963+07:00'::timestamptz, '2026-07-16T10:15:39.619+07:00'::timestamptz, null, null, false),
  ('8a2444bf-5b49-4eb2-bbef-b3155356f184'::uuid, 'เก็บตกสินค้า น็อตหัวจมบาง', 'ขนาดM6*80 / M8*16 / M8*80 / M10*80 / M10*100 / M12*20', 'ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-16T10:22:56.938+07:00'::timestamptz, '2026-07-16T10:22:59.887+07:00'::timestamptz, null, null, false),
  ('f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'สกรูตัวหนอน 304', 'ขนาด M3, M4, M5, M6, M8', '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:58.432+07:00'::timestamptz, null, null, false),
  ('9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'เว็บไซต์ plabin.in.th', null, 'ebe2f175-bbb2-4fe7-b556-3a53b7b1060c'::uuid, 'aekdanai@gmail.com', 0.89, 'IN_PROGRESS', false, '2026-07-17T14:08:25.195+07:00'::timestamptz, '2026-07-22T15:46:41.849+07:00'::timestamptz, null, null, false),
  ('35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'พุกสลีพ ยกกล่อง', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 52.86, 'IN_PROGRESS', false, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:29.497+07:00'::timestamptz, null, null, false),
  ('57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'ชุดสกรูหกเหลี่ยม+น็อตหัวปีก', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:30.271+07:00'::timestamptz, null, null, false),
  ('b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'ชุดสกรูหัวปีก+น็อตหัวปีก', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 3.64, 'IN_PROGRESS', false, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:55.518+07:00'::timestamptz, null, null, false),
  ('b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'เต๋าต่อสายไฟ ภาพใหม่', null, '10f28386-924a-4e2b-ad34-c2b30758b539'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:44.073+07:00'::timestamptz, null, null, false),
  ('f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'สำเนา - โซ่สแตนเลส 304 ร้าน ezTools', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'aekdanai@gmail.com', 0, 'TODO', false, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:16.647+07:00'::timestamptz, null, null, true),
  ('e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'สำเนา - ชุดสกรูหัวปีก+น็อตหัวปีก', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'plabin2025@gmail.com', 0, 'TODO', false, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, null, null, false),
  ('0a3a050f-66f9-4f8c-9ea6-9eb2dc7daa17'::uuid, 'ขาฉิ่งโยก', null, '26c84bd2-51b7-4f0c-b00e-4c7c545c5869'::uuid, 'supeerat.pom@gmail.com', 0, 'TODO', false, '2026-07-25T14:35:44.070+07:00'::timestamptz, '2026-07-25T14:35:46.810+07:00'::timestamptz, null, null, false)
)
insert into public.tasks (id, task_name, description, category_id, owner_id, progress, status, is_archived, created_at, updated_at, completed_at, archived_at, is_deleted)
select s.id, s.task_name, s.description, s.category_id, p.id, s.progress, s.status::public.task_status,
       s.is_archived, s.created_at, s.updated_at, s.completed_at, s.archived_at, s.is_deleted
from source s join public.profiles p on lower(p.email) = s.owner_email
on conflict (id) do update set
  task_name = excluded.task_name, description = excluded.description, category_id = excluded.category_id,
  owner_id = excluded.owner_id, progress = excluded.progress, status = excluded.status,
  is_archived = excluded.is_archived, created_at = excluded.created_at, updated_at = excluded.updated_at,
  completed_at = excluded.completed_at, archived_at = excluded.archived_at, is_deleted = excluded.is_deleted;

with source(id, task_id, item_name, weight, is_checked, sort_order, checked_email, checked_at, created_at, updated_at, is_deleted) as (
  values
  ('3765f274-0631-42b0-b08a-5294739371fa'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'หาข้อมูล', 2, true, 1, 'aekdanai@gmail.com', '2026-07-14T15:40:33.479+07:00'::timestamptz, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('99e9d695-fae0-4a92-a288-70bcb18f7f5c'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'รูปภาพร้าน ezTools', 8, true, 2, 'aekdanai@gmail.com', '2026-07-22T15:40:13.263+07:00'::timestamptz, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('b57ab695-073d-4ee6-a908-cfe7aa2fa5d0'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, true, 9, 'aekdanai@gmail.com', '2026-07-24T10:54:14.844+07:00'::timestamptz, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('226e94e8-667c-45ca-8782-8620755ceda6'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, true, 10, 'aekdanai@gmail.com', '2026-07-25T21:17:06.529+07:00'::timestamptz, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:17:06.529+07:00'::timestamptz, false),
  ('3d77ca33-5cb3-4afc-9a47-8c54b78d5bda'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, true, 11, 'aekdanai@gmail.com', '2026-07-25T11:00:33.517+07:00'::timestamptz, '2026-07-14T15:39:51.174+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('8a5b83f3-fa7a-4766-add5-3b3348834f43'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'หาข้อมูล', 1, false, 1, null, null, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:01.872+07:00'::timestamptz, true),
  ('facd8ba4-24ca-48ec-80d9-381af8ba216f'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'สร้างรูปภาพ ใน Canva', 5, false, 2, null, null, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:02.252+07:00'::timestamptz, true),
  ('ab271f7b-a95a-46f5-9ebd-f336406d984e'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'ลงสินค้า Shopee', 1, false, 3, null, null, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:02.853+07:00'::timestamptz, true),
  ('6aa49871-1072-4fc7-abf9-7eb3be2e7081'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'ลงสินค้า Lazada', 1, false, 4, null, null, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:03.487+07:00'::timestamptz, true),
  ('b85f2994-237f-4e02-9218-3bb9a552cfb1'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'ลงสินค้า TikTok', 1, false, 5, null, null, '2026-07-14T15:49:23.071+07:00'::timestamptz, '2026-07-14T15:50:04.079+07:00'::timestamptz, true),
  ('caca5334-fee5-4560-b83d-b7453d67ebea'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'หาข้อมูล', 1, false, 1, null, null, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:20.791+07:00'::timestamptz, true),
  ('ce930c36-3809-4327-afb1-cf3292d54cea'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'สร้างรูปภาพ ใน Canva', 5, false, 2, null, null, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:21.135+07:00'::timestamptz, true),
  ('826cb581-c10c-45a9-8732-c63f50aa604e'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'ลงสินค้า Shopee', 1, false, 3, null, null, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:22.035+07:00'::timestamptz, true),
  ('060bcdf6-11c8-457f-8294-5cce2727f888'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'ลงสินค้า Lazada', 1, false, 4, null, null, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:23.446+07:00'::timestamptz, true),
  ('365e14b5-3e85-4cc1-a878-496e217c0590'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'ลงสินค้า TikTok', 1, false, 5, null, null, '2026-07-14T15:49:35.633+07:00'::timestamptz, '2026-07-14T15:51:24.157+07:00'::timestamptz, true),
  ('9d2756dd-289e-4b13-aba4-8c523b085e60'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'หาข้อมูล', 1, false, 1, null, null, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:47.852+07:00'::timestamptz, true),
  ('cb52b349-defe-44d5-904e-158645855142'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'สร้างรูปภาพ ใน Canva', 5, false, 2, null, null, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:48.242+07:00'::timestamptz, true),
  ('d3491975-8405-47d1-9a4b-5b46d842225d'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'ลงสินค้าทุก platform ของ ezTools', 1, false, 4, null, null, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:49.217+07:00'::timestamptz, true),
  ('390e639f-1ad8-4b59-9c0d-2674efc57b79'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'ลงสินค้าทุก platform ของ BeeToolbox', 1, false, 5, null, null, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:50.561+07:00'::timestamptz, true),
  ('7aab35ab-7839-4afb-ab30-5a52d43209be'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'ลงสินค้าทุก platform ของ LoftSter', 1, false, 6, null, null, '2026-07-14T19:41:32.506+07:00'::timestamptz, '2026-07-16T16:43:51.673+07:00'::timestamptz, true),
  ('3fd6b6b3-007e-44a6-a519-c95b46c6516a'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'หาข้อมูล', 1, true, 1, 'aekdanai@gmail.com', '2026-07-15T19:35:17.193+07:00'::timestamptz, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('6e269303-a609-439f-a911-cbabe0165e12'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'รูปภาพสินค้า ezTools', 5, true, 2, 'aekdanai@gmail.com', '2026-07-15T19:35:22.294+07:00'::timestamptz, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('b4c0e7d8-c28c-406c-81be-23867780d194'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'อัพเดททุก platform ของ ezTools', 1, true, 7, 'aekdanai@gmail.com', '2026-07-16T12:53:33.863+07:00'::timestamptz, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('ae7cbc8f-2813-4a31-b78c-50fc6adfafdc'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'อัพเดททุก platform ของ BeeToolBox', 1, true, 8, 'aekdanai@gmail.com', '2026-07-16T12:18:42.117+07:00'::timestamptz, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('de424b41-36ae-4a6a-9812-7488a796ee0b'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'อัพเดททุก platform ของ LoftSter', 1, true, 9, 'aekdanai@gmail.com', '2026-07-16T16:33:45.825+07:00'::timestamptz, '2026-07-15T19:32:15.044+07:00'::timestamptz, '2026-07-16T16:33:45.825+07:00'::timestamptz, false),
  ('832c504a-ef35-419b-8467-ca9e180354a9'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'รูปภาพสินค้า BeeToolBox', 5, true, 3, 'aekdanai@gmail.com', '2026-07-15T19:35:28.296+07:00'::timestamptz, '2026-07-15T19:34:50.606+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('20f85cc3-dba6-47f4-be91-43b9ea1de5b4'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'รูปภาพสินค้า LoftSter', 5, true, 4, 'aekdanai@gmail.com', '2026-07-15T19:35:35.346+07:00'::timestamptz, '2026-07-15T19:34:50.606+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('bfc3b773-ecba-43cd-9f0c-0e4684397837'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'ภาพตัวเลือกสินค้า', 5, true, 6, 'aekdanai@gmail.com', '2026-07-16T11:52:08.322+07:00'::timestamptz, '2026-07-15T19:34:50.606+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('55e297db-83b9-4cba-961f-0b9ae3dda2d4'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'วัดขนาดสินค้าใหม่ และบันทึกลงใน Sheet', 3, true, 5, 'aekdanai@gmail.com', '2026-07-16T10:46:51.323+07:00'::timestamptz, '2026-07-15T19:38:10.281+07:00'::timestamptz, '2026-07-16T16:33:24.453+07:00'::timestamptz, false),
  ('733a6d21-8a1f-4578-930f-bfc48be68851'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'หาข้อมูล', 1, true, 1, 'aekdanai@gmail.com', '2026-07-15T21:08:56.622+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('e05fffe5-6d9a-42c1-bc9b-b300205327e7'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'รูปภาพสินค้า ezTools', 5, true, 2, 'aekdanai@gmail.com', '2026-07-15T21:09:02.212+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('520fdd09-ae9f-4fa6-8001-4eca879afb98'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'รูปภาพสินค้า BeeToolBox', 5, true, 3, 'aekdanai@gmail.com', '2026-07-15T21:09:08.341+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('337fb357-680e-4f9d-9859-8748542166a0'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'รูปภาพสินค้า LoftSter', 5, true, 4, 'aekdanai@gmail.com', '2026-07-15T21:09:32.839+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('c020e7f5-ce79-45fc-94f2-e61bdff26c08'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'วัดขนาดสินค้าใหม่ และบันทึกลงใน Sheet', 3, true, 5, 'aekdanai@gmail.com', '2026-07-16T16:39:27.724+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('f6cb5c75-ce5d-441e-8cc1-3fa39b717bce'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'ภาพตัวเลือกสินค้า', 5, true, 6, 'aekdanai@gmail.com', '2026-07-16T16:39:33.913+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('c4338b41-69ec-471c-a3a4-a4ec4253f661'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'อัพเดทสินค้าร้าน ezTools', 2, true, 7, 'aekdanai@gmail.com', '2026-07-16T21:45:28.807+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('a94c81b2-04ba-44ec-ba67-66ce1bed5df1'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'อัพเดทสินค้าร้าน BeeToolBox', 2, true, 8, 'aekdanai@gmail.com', '2026-07-16T22:18:24.161+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('3acee674-ddce-46ff-8b13-b17c2dedd9fe'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'อัพเดทสินค้าร้าน LoftSter', 2, true, 9, 'aekdanai@gmail.com', '2026-07-16T22:36:17.054+07:00'::timestamptz, '2026-07-15T21:08:06.658+07:00'::timestamptz, '2026-07-16T22:36:24.544+07:00'::timestamptz, false),
  ('a475126f-c414-4aba-9629-a67e3ce9ddee'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'ขอ limit เพิ่ม ร้าน ezTools', 1, true, 1, 'aekdanai@gmail.com', '2026-07-22T15:21:15.330+07:00'::timestamptz, '2026-07-16T09:56:34.349+07:00'::timestamptz, '2026-07-22T15:49:10.655+07:00'::timestamptz, false),
  ('3932248a-9a9d-4bb9-bf15-45787adc5e37'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'ขอ limit เพิ่ม ร้าน BeeToolBox', 1, true, 2, 'aekdanai@gmail.com', '2026-07-22T15:21:22.218+07:00'::timestamptz, '2026-07-16T09:56:34.349+07:00'::timestamptz, '2026-07-22T15:49:10.655+07:00'::timestamptz, false),
  ('cd2901c2-5a6b-485b-b428-206c6b1f2b55'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'ขอ limit เพิ่ม ร้าน LoftSter', 1, true, 3, 'aekdanai@gmail.com', '2026-07-22T15:49:03.923+07:00'::timestamptz, '2026-07-16T09:56:34.349+07:00'::timestamptz, '2026-07-22T15:49:10.655+07:00'::timestamptz, false),
  ('0552d93f-c62b-4e70-8f43-7cf1d8eacfc9'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'ปรับราคาใน ezTools', 1, false, 1, null, null, '2026-07-16T09:58:14.963+07:00'::timestamptz, '2026-07-16T10:15:38.689+07:00'::timestamptz, false),
  ('003e3d1f-e60e-4d00-b3c3-ab9943500d8a'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'ปรับราคาใน BeeToolbox', 1, false, 2, null, null, '2026-07-16T09:58:14.963+07:00'::timestamptz, '2026-07-16T10:14:42.692+07:00'::timestamptz, false),
  ('b88878c8-08dc-4338-b200-12c80c96cf2c'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'ปรับราคาใน LoftSter', 1, false, 3, null, null, '2026-07-16T09:58:14.963+07:00'::timestamptz, '2026-07-16T10:14:42.692+07:00'::timestamptz, false),
  ('fe4c3316-7644-4e57-b7bb-cff369399064'::uuid, '8a2444bf-5b49-4eb2-bbef-b3155356f184'::uuid, 'ทำรูปภาพใหม่', 1, false, 1, null, null, '2026-07-16T10:22:56.938+07:00'::timestamptz, '2026-07-16T10:22:56.938+07:00'::timestamptz, false),
  ('c071bae5-fb20-40d8-9a87-813a50d17045'::uuid, '8a2444bf-5b49-4eb2-bbef-b3155356f184'::uuid, 'ทำภาพตัวเลือกใหม่', 1, false, 2, null, null, '2026-07-16T10:22:56.938+07:00'::timestamptz, '2026-07-16T10:22:56.938+07:00'::timestamptz, false),
  ('ef0cfbb8-6b9d-41ff-87f3-b47b44f324f5'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'สร้างรูปตัวเลือกสินค้า', 1, false, 3, null, null, '2026-07-16T16:38:09.780+07:00'::timestamptz, '2026-07-16T16:43:52.629+07:00'::timestamptz, true),
  ('4f04ce6d-223f-4d56-8a84-af8bd202d4be'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'รูปภาพร้าน BeeToolbox', 8, true, 3, 'aekdanai@gmail.com', '2026-07-22T15:40:17.572+07:00'::timestamptz, '2026-07-16T16:43:08.961+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('d977ab88-851b-49bd-96a2-54aaa5f3c474'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'รูปภาพร้าน LoftSter', 8, true, 4, 'aekdanai@gmail.com', '2026-07-22T15:40:22.307+07:00'::timestamptz, '2026-07-16T16:43:08.961+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('f4a393f3-5252-48f8-b855-c07e57493001'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 5, true, 6, 'aekdanai@gmail.com', '2026-07-25T21:15:45.988+07:00'::timestamptz, '2026-07-16T16:43:08.961+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('d290d072-8434-4f32-92dd-054fb5b021a5'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'คำนวนราคาขาย', 3, true, 7, 'aekdanai@gmail.com', '2026-07-24T10:53:47.114+07:00'::timestamptz, '2026-07-16T16:43:08.961+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('a36e05de-3fd1-4249-9c26-d6da868a570b'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'คำนวนราคา DropShip', 1, true, 8, 'aekdanai@gmail.com', '2026-07-24T10:53:52.483+07:00'::timestamptz, '2026-07-16T16:43:08.961+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('fc823c0f-5f3a-469d-8b55-a962d7389e67'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'หาข้อมูล เตรียมรูปภาพ', 2, false, 1, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('1e45902e-d18b-4899-abd2-a9904e71f10e'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'รูปภาพร้าน ezTools', 10, false, 2, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('d6f27fbb-7051-48ff-b609-804b8e636c87'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'รูปภาพร้าน BeeToolbox', 10, false, 3, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('0216830e-c469-4b18-ae54-373067945963'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'รูปภาพร้าน LoftSter', 10, false, 4, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('91b42808-c3f4-4048-b344-5cf1d995622d'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 10, false, 5, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('c0776dfd-cc45-43af-8afb-829450690a2b'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'คำนวนราคาขาย', 3, false, 6, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('886b5726-16e1-4ddf-a327-57a1c6bd7d01'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'คำนวนราคา DropShip', 1, false, 7, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('01aec30c-6c87-4349-96be-3cb47602e5dd'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 8, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('64d4813e-9e09-4ae6-802a-da88d618abc4'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 9, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('d195e51d-1bbc-41ce-ae1c-e5a93787f8df'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 10, null, null, '2026-07-16T16:44:29.699+07:00'::timestamptz, '2026-07-25T11:09:50.549+07:00'::timestamptz, false),
  ('f76b3f96-2268-46b7-9115-84d1b5b9c225'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'เช่า hosting', 1, false, 2, null, null, '2026-07-17T14:08:25.195+07:00'::timestamptz, '2026-07-22T15:46:36.738+07:00'::timestamptz, false),
  ('9e1dc0b8-40fa-4478-a1b7-5d31db3eb6ad'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'ลง wordpress', 1, false, 3, null, null, '2026-07-17T14:08:25.195+07:00'::timestamptz, '2026-07-22T15:46:36.738+07:00'::timestamptz, false),
  ('55b277db-707d-416f-9936-77ebed4d7dd3'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'config เว็บ', 10, false, 4, null, null, '2026-07-17T14:08:25.195+07:00'::timestamptz, '2026-07-22T15:46:36.738+07:00'::timestamptz, false),
  ('ddb864e9-c3b0-4535-a647-e854a2df2520'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'ลงสินค้า', 99, false, 5, null, null, '2026-07-17T14:08:25.195+07:00'::timestamptz, '2026-07-22T15:46:36.738+07:00'::timestamptz, false),
  ('dc653994-5e60-4bcb-bdc6-b3a1d947b351'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'แก้ไข size chart ใหม่ ทุกร้าน', 3, true, 5, 'aekdanai@gmail.com', '2026-07-25T11:00:27.849+07:00'::timestamptz, '2026-07-22T15:40:27.588+07:00'::timestamptz, '2026-07-25T21:15:51.689+07:00'::timestamptz, false),
  ('eefc42dd-9735-48fc-b918-244f972367fa'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'จดโดเมน plabin.in.th', 1, true, 1, 'aekdanai@gmail.com', '2026-07-22T15:46:31.816+07:00'::timestamptz, '2026-07-22T15:41:58.834+07:00'::timestamptz, '2026-07-22T15:46:36.738+07:00'::timestamptz, false),
  ('da4e1cd8-b2c9-4cdc-9692-cc91fcc464dd'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'หาข้อมูล', 2, true, 1, 'plabin2025@gmail.com', '2026-07-25T15:41:08.865+07:00'::timestamptz, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('56063b38-15b6-4779-9579-28803ceee632'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'รูปภาพร้าน ezTools', 10, true, 2, 'plabin2025@gmail.com', '2026-07-25T15:41:15.615+07:00'::timestamptz, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('2eab053e-9216-49b3-b095-16e9ed6b6581'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'รูปภาพร้าน BeeToolbox', 10, true, 3, 'plabin2025@gmail.com', '2026-07-25T15:41:22.142+07:00'::timestamptz, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('d1d3295d-22f1-4740-8496-52640b25e444'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'รูปภาพร้าน LoftSter', 10, true, 4, 'plabin2025@gmail.com', '2026-07-25T15:41:29.195+07:00'::timestamptz, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('e571ccdd-95ac-4689-be2f-35aaf648514c'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 20, false, 6, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('f26b5434-4fd3-4c25-90d4-a577793be0d6'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'คำนวนราคาขาย', 3, false, 7, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('02d2d375-a959-404a-a7a1-0d4ae60801ee'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'คำนวนราคา DropShip', 1, false, 8, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('b6036acf-88e8-4c68-aa0a-5dda3ab494eb'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 9, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('7f3edaff-2e43-49a7-8724-4dc7848e022f'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 10, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('92ad7cb1-e806-45e7-bb69-eef1850485a6'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 11, null, null, '2026-07-22T16:05:57.933+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('5a39d757-d513-4ab6-8eff-440180a1150f'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'ตาราง spec สินค้าแต่ละขนาด', 5, true, 5, 'plabin2025@gmail.com', '2026-07-25T15:41:50.165+07:00'::timestamptz, '2026-07-22T16:07:22.802+07:00'::timestamptz, '2026-07-28T11:14:19.194+07:00'::timestamptz, false),
  ('9c6fd7b4-5e7b-4917-ad16-6188e1a92acf'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'เตรียมรูปภาพ หาข้อมูล', 2, false, 1, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('196eb8be-6543-4955-8c83-092d5933249a'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'รูปภาพร้าน ezTools', 10, false, 2, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('43c1cea3-4dd9-4b8c-945d-cd6507a5b4e2'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'รูปภาพร้าน BeeToolbox', 10, false, 3, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('b9f07105-5c42-4b6c-8f47-6c35ab914550'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'รูปภาพร้าน LoftSter', 10, false, 4, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('699b99d2-848d-43b5-a96a-d75558871689'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 10, false, 5, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('18eacafa-e74c-4455-9375-a6261648f1b0'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'คำนวนราคาขาย', 3, false, 6, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('eb090a8d-8367-4549-9690-0eaf58af35ca'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'คำนวนราคา DropShip', 1, false, 7, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('26858e88-845c-4933-8077-acf32971cb13'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 8, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('3e6c7658-aec2-4840-a048-1d139204f7d1'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 9, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('b0e5bdc3-bef6-4d3c-8619-cf16078e6813'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 10, null, null, '2026-07-22T16:08:04.015+07:00'::timestamptz, '2026-07-25T10:51:23.105+07:00'::timestamptz, false),
  ('963609f6-0780-48bc-ae3e-63f8b8d42371'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'หาข้อมูล', 2, true, 1, 'plabin2025@gmail.com', '2026-07-25T11:06:17.505+07:00'::timestamptz, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('5ed8287e-1eac-495e-8f79-f1bd30cb33af'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'รูปภาพร้าน ezTools', 10, false, 2, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('2d7dbe63-c3eb-4476-a221-47ba9b820c4d'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'รูปภาพร้าน BeeToolbox', 10, false, 3, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('8cd261ab-e538-4f99-99f7-69bfc83eae0d'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'รูปภาพร้าน LoftSter', 10, false, 4, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('e6d23f81-d569-4a44-bc17-d670206a72a3'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 10, false, 5, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('553de374-7736-4633-b079-4520f7e16096'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'คำนวนราคาขาย', 3, false, 6, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('0df34a4b-a9c7-49c4-b7f5-ef62bf9b97aa'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'คำนวนราคา DropShip', 1, false, 7, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('5c5444aa-b5e8-4274-a1a7-f22ebbcf0dfd'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 8, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('2976ec88-2849-4bef-b797-cc11b27f893e'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 9, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('0161ea89-10dc-427d-8040-6a904c523123'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 10, null, null, '2026-07-22T16:09:24.070+07:00'::timestamptz, '2026-07-27T10:53:42.466+07:00'::timestamptz, false),
  ('b8757acd-1b8a-41a9-ad51-e7a7dd2d5a07'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'หาข้อมูล', 2, false, 1, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('7fc27318-5f03-47b8-a33e-a9f234a48aed'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'รูปภาพร้าน ezTools', 10, false, 2, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('9e0845f7-8d2a-4d0f-82a6-417b30954f6d'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'รูปภาพร้าน BeeToolbox', 10, false, 3, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('0d4efbbb-2aa7-400d-99a3-15f14d6d8f44'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'รูปภาพร้าน LoftSter', 10, false, 4, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('b234891e-6bb0-4e66-be1f-c7241a6cdcd5'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 10, false, 5, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('cc330e9f-cfa1-4e98-8646-8712bbbb7484'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'คำนวนราคาขาย', 3, false, 6, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:20:08.679+07:00'::timestamptz, true),
  ('900c466e-020b-4bec-8775-3e269140232a'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'คำนวนราคา DropShip', 1, false, 6, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:21:05.892+07:00'::timestamptz, true),
  ('1de4ab0b-22bf-4797-aace-b434be38a3a0'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 6, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('a944b10e-ad42-4277-b64b-3e667a699f6b'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 7, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('d206bb9f-0627-4057-9b69-c9efbe477339'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 8, null, null, '2026-07-22T16:19:26.710+07:00'::timestamptz, '2026-07-22T16:24:35.277+07:00'::timestamptz, false),
  ('d367030f-63e2-42fc-b44c-e565264aca01'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'หาข้อมูล', 2, false, 1, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:18.193+07:00'::timestamptz, true),
  ('ec5d1cc6-f993-43a2-a6a3-474749dae8e5'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'รูปภาพร้าน ezTools', 8, false, 2, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:18.764+07:00'::timestamptz, true),
  ('e8c021a7-8361-4474-bbe2-cc4f60871246'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'รูปภาพร้าน BeeToolbox', 8, false, 3, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:19.684+07:00'::timestamptz, true),
  ('e3d0d419-70be-483b-95ae-37ecfc8929a9'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'รูปภาพร้าน LoftSter', 8, false, 4, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:20.666+07:00'::timestamptz, true),
  ('23e5a4e7-952c-4a4c-905a-9eaf777fe49b'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'แก้ไข size chart ใหม่ ทุกร้าน', 3, false, 5, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:21.721+07:00'::timestamptz, true),
  ('172a6272-c311-487d-8f81-207b69f7e5d4'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 5, false, 6, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:23.224+07:00'::timestamptz, true),
  ('808c97ad-c1af-4e67-bf94-68e5d4452e24'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'คำนวนราคาขาย', 3, false, 7, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:24.508+07:00'::timestamptz, true),
  ('107d889f-f404-42a2-b57f-dbf53b2cde9d'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'คำนวนราคา DropShip', 1, false, 8, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:26.173+07:00'::timestamptz, true),
  ('bcbeb855-b22d-4849-9dfe-6568360a84ef'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 9, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:27.358+07:00'::timestamptz, true),
  ('ca2de65b-ab5a-4e24-a426-562548e9b1b9'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 10, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:28.286+07:00'::timestamptz, true),
  ('3a508a08-a2e3-4b28-baa8-151dd3b43ef9'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 11, null, null, '2026-07-25T11:08:07.302+07:00'::timestamptz, '2026-07-25T22:07:29.301+07:00'::timestamptz, true),
  ('3c28766b-6098-441b-ae03-05fe8533851d'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'หาข้อมูล', 2, false, 1, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('273a18b4-e461-4a7a-bf27-e2b10349344b'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'รูปภาพร้าน ezTools', 10, false, 2, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('963bb67b-6ffc-426f-9f3c-27b572ea7744'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'รูปภาพร้าน BeeToolbox', 10, false, 3, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('6f08d89f-d39f-4462-9db1-784ee4d91519'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'รูปภาพร้าน LoftSter', 10, false, 4, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('cccace6e-fa93-4390-b0dd-ed65f3dbb766'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'ภาพตัวเลือกสินค้าทุกร้าน', 10, false, 5, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('78c67f31-fcc1-4889-8e49-57919adbf781'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'คำนวนราคาขาย', 3, false, 6, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('1907a0b6-05db-482e-abca-c3d00bea6878'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'คำนวนราคา DropShip', 1, false, 7, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('55a7a582-bd17-4f0b-89ad-1df0afb1d044'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'ลงสินค้าทุก platform ร้าน ezTools', 3, false, 8, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('4f3175f3-34ac-4e48-8415-e32f9b46a583'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'ลงสินค้าทุก platform ร้าน BeeToolBox', 3, false, 9, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('78517a3e-d893-44f1-9d87-fd3f29c66cc3'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'ลงสินค้าทุก platform ร้าน LoftSter', 3, false, 10, null, null, '2026-07-25T11:09:00.402+07:00'::timestamptz, '2026-07-25T11:09:00.402+07:00'::timestamptz, false),
  ('2730fe49-8e34-4b57-850e-7ea8a8c3cbad'::uuid, '0a3a050f-66f9-4f8c-9ea6-9eb2dc7daa17'::uuid, 'สร้างคอนเทนต์', 1, false, 1, null, null, '2026-07-25T14:35:44.070+07:00'::timestamptz, '2026-07-25T14:35:44.070+07:00'::timestamptz, false),
  ('d2bec805-79b0-448e-a103-0a5098d021c9'::uuid, '0a3a050f-66f9-4f8c-9ea6-9eb2dc7daa17'::uuid, 'สร้างภาพ', 1, false, 2, null, null, '2026-07-25T14:35:44.070+07:00'::timestamptz, '2026-07-25T14:35:44.070+07:00'::timestamptz, false),
  ('49eda0c9-7c2e-4ce2-a9e5-62a419baf2a3'::uuid, '0a3a050f-66f9-4f8c-9ea6-9eb2dc7daa17'::uuid, 'ลงสินค้า', 1, false, 3, null, null, '2026-07-25T14:35:44.070+07:00'::timestamptz, '2026-07-25T14:35:44.070+07:00'::timestamptz, false)
)
insert into public.checklist_items (id, task_id, item_name, weight, is_checked, sort_order, checked_by, checked_at, created_at, updated_at, is_deleted)
select s.id, s.task_id, s.item_name, s.weight, s.is_checked, s.sort_order, p.id,
       s.checked_at, s.created_at, s.updated_at, s.is_deleted
from source s left join public.profiles p on lower(p.email) = s.checked_email
on conflict (id) do update set
  task_id = excluded.task_id, item_name = excluded.item_name, weight = excluded.weight,
  is_checked = excluded.is_checked, sort_order = excluded.sort_order, checked_by = excluded.checked_by,
  checked_at = excluded.checked_at, created_at = excluded.created_at, updated_at = excluded.updated_at,
  is_deleted = excluded.is_deleted;

with source(id, task_id, user_email, permission, shared_by_email, created_at, updated_at, is_active) as (
  values
  ('dc5e72bf-9ce0-48ba-8372-2906cf3eb93d'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'beetoolbox66@gmail.com', 'CHECKER', 'aekdanai@gmail.com', '2026-07-16T10:10:54.765+07:00'::timestamptz, '2026-07-16T10:14:45.098+07:00'::timestamptz, true),
  ('852bea5d-8ea4-42e9-b046-8c959993971a'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'plabin2025@gmail.com', 'CHECKER', 'aekdanai@gmail.com', '2026-07-25T11:09:56.690+07:00'::timestamptz, '2026-07-25T11:09:56.690+07:00'::timestamptz, true),
  ('f7c2733f-a9df-4c00-9996-85ab9d3296a9'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'EDITOR', 'aekdanai@gmail.com', '2026-07-25T11:12:47.912+07:00'::timestamptz, '2026-07-28T11:14:28.407+07:00'::timestamptz, true),
  ('ece0b5f2-ab5f-41ee-8b95-e254b68d1b87'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'plabin2025@gmail.com', 'EDITOR', 'aekdanai@gmail.com', '2026-07-27T10:52:57.991+07:00'::timestamptz, '2026-07-27T10:53:54.019+07:00'::timestamptz, true)
)
insert into public.task_shares (id, task_id, user_id, permission, shared_by, created_at, updated_at, is_active)
select s.id, s.task_id, recipient.id, s.permission::public.task_permission, actor.id, s.created_at, s.updated_at, s.is_active
from source s
join public.profiles recipient on lower(recipient.email) = s.user_email
join public.profiles actor on lower(actor.email) = s.shared_by_email
on conflict (id) do update set
  task_id = excluded.task_id, user_id = excluded.user_id, permission = excluded.permission,
  shared_by = excluded.shared_by, created_at = excluded.created_at, updated_at = excluded.updated_at,
  is_active = excluded.is_active;

with source(id, user_email, task_id, type, title, message, created_by_email, is_read, read_at, created_at) as (
  values
  ('585cdbf7-74ee-48a6-af0b-77345d4704a9'::uuid, 'plabin2025@gmail.com', 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'TASK_SHARED', 'มี Task ใหม่แชร์ถึงคุณ', 'ชุดสกรูหัวปีก+น็อตหัวปีก ถูกแชร์โดย aekdanai@gmail.com', 'aekdanai@gmail.com', true, '2026-07-25T11:04:26.517+07:00'::timestamptz, '2026-07-24T15:19:56.959+07:00'::timestamptz),
  ('a7c85ab5-905c-40f9-bf26-da7772c05406'::uuid, 'aekdanai@gmail.com', 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'TASK_UPDATED', 'Task มีการอัปเดต', 'ชุดสกรูหัวปีก+น็อตหัวปีก มีการอัปเดตจาก Tae', 'plabin2025@gmail.com', true, '2026-07-25T11:07:14.078+07:00'::timestamptz, '2026-07-25T11:06:59.336+07:00'::timestamptz),
  ('d39c96bf-0826-4209-a8a8-9ceb20171426'::uuid, 'plabin2025@gmail.com', 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'TASK_SHARED', 'มี Task ใหม่แชร์ถึงคุณ', 'สกรูตัวหนอน 304 ถูกแชร์โดย aekdanai@gmail.com', 'aekdanai@gmail.com', true, '2026-07-25T11:10:23.429+07:00'::timestamptz, '2026-07-25T11:09:57.318+07:00'::timestamptz),
  ('d017e9ef-250c-4ee1-aa45-0f0d3de1585a'::uuid, 'plabin2025@gmail.com', '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'TASK_SHARED', 'มี Task ใหม่แชร์ถึงคุณ', 'พุกสลีพ ยกกล่อง ถูกแชร์โดย aekdanai@gmail.com', 'aekdanai@gmail.com', true, '2026-07-25T11:13:33.159+07:00'::timestamptz, '2026-07-25T11:12:48.242+07:00'::timestamptz),
  ('aedd6f9e-594b-48cf-96b4-4ae939ac22fe'::uuid, 'plabin2025@gmail.com', 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'TASK_SHARED', 'มี Task ใหม่แชร์ถึงคุณ', 'ชุดสกรูหัวปีก+น็อตหัวปีก ถูกแชร์โดย aekdanai@gmail.com', 'aekdanai@gmail.com', false, null, '2026-07-27T10:52:58.206+07:00'::timestamptz)
)
insert into public.notifications (id, user_id, task_id, type, title, message, created_by, is_read, read_at, created_at)
select s.id, recipient.id, s.task_id, s.type::public.notification_type, s.title, s.message,
       actor.id, s.is_read, s.read_at, s.created_at
from source s
join public.profiles recipient on lower(recipient.email) = s.user_email
left join public.profiles actor on lower(actor.email) = s.created_by_email
on conflict (id) do update set
  user_id = excluded.user_id, task_id = excluded.task_id, type = excluded.type, title = excluded.title,
  message = excluded.message, created_by = excluded.created_by, is_read = excluded.is_read,
  read_at = excluded.read_at, created_at = excluded.created_at;

with source(id, task_id, user_email, action, detail_json, created_at) as (
  values
  ('09dd3e0d-d480-4480-a3b7-0f278974477b'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CREATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-14T15:39:55.438+07:00'::timestamptz),
  ('b0706c8f-b48d-4c64-8b6e-e228ff00c74a'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"3765f274-0631-42b0-b08a-5294739371fa"}'::jsonb, '2026-07-14T15:40:35.615+07:00'::timestamptz),
  ('61d5fb0b-7e3c-4fee-bec4-014c87127b29'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-14T15:40:38.570+07:00'::timestamptz),
  ('81a4f37a-9c1a-41cf-804a-cd1d93f5ab6c'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"3765f274-0631-42b0-b08a-5294739371fa"}'::jsonb, '2026-07-14T15:40:45.538+07:00'::timestamptz),
  ('3b1c7240-5715-45a9-ae9b-9f9189918cfb'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"99e9d695-fae0-4a92-a288-70bcb18f7f5c"}'::jsonb, '2026-07-14T15:40:52.623+07:00'::timestamptz),
  ('95a5e9ee-e20e-461f-961b-c28d73c1f3b8'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"b57ab695-073d-4ee6-a908-cfe7aa2fa5d0"}'::jsonb, '2026-07-14T15:40:58.746+07:00'::timestamptz),
  ('90bb90db-da01-4e22-ba6d-3b5fdf6150c8'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"226e94e8-667c-45ca-8782-8620755ceda6"}'::jsonb, '2026-07-14T15:41:03.469+07:00'::timestamptz),
  ('6c79a55c-5922-40f4-ac17-f123536a72f2'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"3d77ca33-5cb3-4afc-9a47-8c54b78d5bda"}'::jsonb, '2026-07-14T15:41:10.540+07:00'::timestamptz),
  ('27ac4f80-407b-4eb6-b64e-e1a75f8c5929'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-14T15:41:34.350+07:00'::timestamptz),
  ('2c3bc380-5d71-45a6-97b4-8a34a9c4b42d'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"3765f274-0631-42b0-b08a-5294739371fa"}'::jsonb, '2026-07-14T15:41:42.198+07:00'::timestamptz),
  ('1cdd5fd7-6c07-46cf-92a2-d9b181cc026f'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"99e9d695-fae0-4a92-a288-70bcb18f7f5c"}'::jsonb, '2026-07-14T15:41:48.819+07:00'::timestamptz),
  ('b0d4cab4-41e4-4a9c-999b-7fca590fc30f'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"b57ab695-073d-4ee6-a908-cfe7aa2fa5d0"}'::jsonb, '2026-07-14T15:41:54.353+07:00'::timestamptz),
  ('f5d30213-028f-4281-b8de-bff59677d052'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"226e94e8-667c-45ca-8782-8620755ceda6"}'::jsonb, '2026-07-14T15:42:00.984+07:00'::timestamptz),
  ('945389c6-5aee-4c93-a46f-d9b7caae569c'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"3d77ca33-5cb3-4afc-9a47-8c54b78d5bda"}'::jsonb, '2026-07-14T15:42:09.010+07:00'::timestamptz),
  ('0509b67c-d0f7-4f3d-aeae-80f82f096d59'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-14T15:49:28.099+07:00'::timestamptz),
  ('a1081761-714c-415a-8891-3bc9e9b5bf90'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-14T15:49:40.442+07:00'::timestamptz),
  ('eb1bc0e8-5830-41ef-9ae5-82bcc03e34bc'::uuid, '74e98de4-790e-4f51-9120-8a2017ad6b0d'::uuid, 'aekdanai@gmail.com', 'DELETE_TASK', '{}'::jsonb, '2026-07-14T15:50:06.153+07:00'::timestamptz),
  ('f3cc1328-10e0-489e-8ec8-e2e062a6e536'::uuid, '65c16213-4bbe-4ea4-9f98-caa67528fdae'::uuid, 'aekdanai@gmail.com', 'DELETE_TASK', '{}'::jsonb, '2026-07-14T15:51:26.120+07:00'::timestamptz),
  ('5486cd05-15a0-4ab2-83d1-e1fc38b82fde'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-14T19:41:36.916+07:00'::timestamptz),
  ('7de78bbd-d9ee-4ce3-9a0d-58eb3a54f4b2'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304 ร้าน ezTools"}'::jsonb, '2026-07-14T19:43:09.202+07:00'::timestamptz),
  ('4ca4a4bc-3240-4d9a-aa01-59521f337933'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"9d2756dd-289e-4b13-aba4-8c523b085e60"}'::jsonb, '2026-07-14T19:43:17.771+07:00'::timestamptz),
  ('de0a63c4-7157-487f-9233-71812bd7a450'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"cb52b349-defe-44d5-904e-158645855142"}'::jsonb, '2026-07-14T19:43:25.681+07:00'::timestamptz),
  ('2b1be46f-87cc-4284-b924-b1a212f55874'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"d3491975-8405-47d1-9a4b-5b46d842225d"}'::jsonb, '2026-07-14T19:43:33.084+07:00'::timestamptz),
  ('1546e9ae-94c5-4ffa-96eb-8b25344c6593'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"390e639f-1ad8-4b59-9c0d-2674efc57b79"}'::jsonb, '2026-07-14T19:43:40.149+07:00'::timestamptz),
  ('a1061e8d-9f6b-4bd4-a0eb-54ea65b5c559'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_ITEM', '{"itemId":"7aab35ab-7839-4afb-ab30-5a52d43209be"}'::jsonb, '2026-07-14T19:43:47.622+07:00'::timestamptz),
  ('f5a3b94c-c165-4038-b8e8-0de4d210cb62'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-15T19:32:19.236+07:00'::timestamptz),
  ('78b815b4-c4e7-4d86-8c90-1cda1c5a05ee'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-15T19:34:01.231+07:00'::timestamptz),
  ('9b959b69-931a-4977-9d92-2d0fe73877f0'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-15T19:34:14.799+07:00'::timestamptz),
  ('f9b2b76a-be45-4de7-87ff-4ffd326e88d3'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-15T19:34:29.314+07:00'::timestamptz),
  ('11835efd-d2f3-4fc2-ba0b-5f2ab69de8f6'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-15T19:34:56.865+07:00'::timestamptz),
  ('af34eb10-0afc-4251-94c2-02d5c84b2c8f'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"3fd6b6b3-007e-44a6-a519-c95b46c6516a"}'::jsonb, '2026-07-15T19:35:20.429+07:00'::timestamptz),
  ('37a1ddf8-a6bc-45e2-9d86-09f61d15c68a'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"6e269303-a609-439f-a911-cbabe0165e12"}'::jsonb, '2026-07-15T19:35:24.267+07:00'::timestamptz),
  ('efefa11a-53f4-4895-a547-907da08811f8'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"832c504a-ef35-419b-8467-ca9e180354a9"}'::jsonb, '2026-07-15T19:35:30.755+07:00'::timestamptz),
  ('1b982786-e401-4aa2-bd00-b05fc6685791'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"20f85cc3-dba6-47f4-be91-43b9ea1de5b4"}'::jsonb, '2026-07-15T19:35:37.824+07:00'::timestamptz),
  ('3c200f8d-4139-4618-adf2-be650db25381'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-15T19:35:48.960+07:00'::timestamptz),
  ('09e0984a-d9b8-4e15-8292-4dbe49244eb8'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-15T19:38:06.355+07:00'::timestamptz),
  ('72122da4-884d-418f-8512-291e4069e6d2'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-15T19:38:18.472+07:00'::timestamptz),
  ('91b487e8-5024-46f7-9c47-e30cc609a21e'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"36ea7cbf-5678-4f70-a265-59be244a330d"}'::jsonb, '2026-07-15T21:08:13.428+07:00'::timestamptz),
  ('7596592c-d6d1-41a3-8281-c82a756ef08a'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"733a6d21-8a1f-4578-930f-bfc48be68851"}'::jsonb, '2026-07-15T21:08:58.970+07:00'::timestamptz),
  ('34d3e4db-610d-4e0c-8b6e-3666e65fef7f'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"e05fffe5-6d9a-42c1-bc9b-b300205327e7"}'::jsonb, '2026-07-15T21:09:04.643+07:00'::timestamptz),
  ('97eab3ac-9f1b-4adc-9767-6650ba4be0eb'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"520fdd09-ae9f-4fa6-8001-4eca879afb98"}'::jsonb, '2026-07-15T21:09:11.191+07:00'::timestamptz),
  ('d2b9311f-ee49-4f16-838e-e4a8d0299011'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนสปริง 304 ภาพใหม่"}'::jsonb, '2026-07-15T21:09:27.249+07:00'::timestamptz),
  ('ad70f674-9fad-48be-b176-b3848b091756'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"337fb357-680e-4f9d-9859-8748542166a0"}'::jsonb, '2026-07-15T21:09:36.992+07:00'::timestamptz),
  ('1acc0e2e-6914-465f-8801-eb17de84ba81'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'CREATE_TASK', '{"name":"ขอเพิ่ม limit ตะกร้างใน lazada"}'::jsonb, '2026-07-16T09:56:37.108+07:00'::timestamptz),
  ('a8f23a65-24cd-4b49-8148-d3d915555e15'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'aekdanai@gmail.com', 'CREATE_TASK', '{"name":"ปรับราคาขายใน TikTok"}'::jsonb, '2026-07-16T09:58:19.790+07:00'::timestamptz),
  ('34e4a59b-6dcc-4a9f-ab72-c7d410d33a7e'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ปรับราคาขายใน TikTok"}'::jsonb, '2026-07-16T10:10:56.140+07:00'::timestamptz),
  ('ed3ff39e-fed7-4f1c-98ae-95eacc40120d'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ปรับราคาขายใน TikTok"}'::jsonb, '2026-07-16T10:14:46.826+07:00'::timestamptz),
  ('53745e47-fb10-4534-b435-54ee12cb13bf'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'beetoolbox66@gmail.com', 'CHECK_ITEM', '{"itemId":"0552d93f-c62b-4e70-8f43-7cf1d8eacfc9"}'::jsonb, '2026-07-16T10:15:34.984+07:00'::timestamptz),
  ('3b67957e-0b2b-49d2-8657-7b0c83a45a67'::uuid, 'a163f0db-555b-4854-8c16-8de96ba2a891'::uuid, 'beetoolbox66@gmail.com', 'UNCHECK_ITEM', '{"itemId":"0552d93f-c62b-4e70-8f43-7cf1d8eacfc9"}'::jsonb, '2026-07-16T10:15:40.392+07:00'::timestamptz),
  ('282cece3-e8ad-4317-bf1a-f3699e642ced'::uuid, '8a2444bf-5b49-4eb2-bbef-b3155356f184'::uuid, 'aekdanai@gmail.com', 'CREATE_TASK', '{"name":"เก็บตกสินค้า น็อตหัวจมบาง"}'::jsonb, '2026-07-16T10:23:01.960+07:00'::timestamptz),
  ('c54fe48f-a7f5-4ab4-83af-ee372e1d399d'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"55e297db-83b9-4cba-961f-0b9ae3dda2d4"}'::jsonb, '2026-07-16T10:46:53.631+07:00'::timestamptz),
  ('eb12181c-196b-46e9-9059-762bab640bdd'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-16T10:47:10.108+07:00'::timestamptz),
  ('1f3aaf15-7227-4e86-ade3-a32f388bf405'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"bfc3b773-ecba-43cd-9f0c-0e4684397837"}'::jsonb, '2026-07-16T11:52:11.036+07:00'::timestamptz),
  ('e10aa7ef-1f20-4b5a-8e95-ffff2ce83372'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-16T11:52:35.389+07:00'::timestamptz),
  ('ec348e66-1e6d-4c5c-8620-115f671f6dfd'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"ae7cbc8f-2813-4a31-b78c-50fc6adfafdc"}'::jsonb, '2026-07-16T12:18:45.353+07:00'::timestamptz),
  ('9e4fa824-8719-45f0-b2a9-beb1ef01aac6'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-16T12:18:57.589+07:00'::timestamptz),
  ('ac6b15bc-4988-4714-bc9b-4e5b6ecacc8f'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"b4c0e7d8-c28c-406c-81be-23867780d194"}'::jsonb, '2026-07-16T12:53:37.845+07:00'::timestamptz),
  ('80e3efc8-726d-46d6-9f3d-5c65788030f3'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-16T12:53:47.136+07:00'::timestamptz),
  ('9111dc59-53f3-4650-b015-65c49c24cf47'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนรอง 304 ภาพใหม่"}'::jsonb, '2026-07-16T16:33:38.708+07:00'::timestamptz),
  ('96b58e8a-6199-4cf7-aa6a-12af6bccce2f'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"de424b41-36ae-4a6a-9812-7488a796ee0b"}'::jsonb, '2026-07-16T16:33:50.319+07:00'::timestamptz),
  ('b56ae901-ae86-4ce0-84fc-8ba5b6293bf5'::uuid, '36ea7cbf-5678-4f70-a265-59be244a330d'::uuid, 'aekdanai@gmail.com', 'ARCHIVE_TASK', '{}'::jsonb, '2026-07-16T16:35:01.035+07:00'::timestamptz),
  ('effdec4e-f26b-4469-84d9-d2d1b3b505b4'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-16T16:37:45.151+07:00'::timestamptz),
  ('f65109ed-c24f-4334-82f6-f5078efff5c1'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304 ร้าน ezTools"}'::jsonb, '2026-07-16T16:38:22.449+07:00'::timestamptz),
  ('5f387ea7-22f3-4ba8-b01c-08fa4b26c638'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"c020e7f5-ce79-45fc-94f2-e61bdff26c08"}'::jsonb, '2026-07-16T16:39:31.063+07:00'::timestamptz),
  ('f353692d-b9af-4e73-b475-ca670750b934'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"f6cb5c75-ce5d-441e-8cc1-3fa39b717bce"}'::jsonb, '2026-07-16T16:39:38.752+07:00'::timestamptz),
  ('c36f3257-c06a-4c0c-848f-a31cfa94dda4'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนสปริง 304 ภาพใหม่"}'::jsonb, '2026-07-16T16:39:55.905+07:00'::timestamptz),
  ('82eb8682-e71f-4f95-af2f-403ed0c3ec52'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-16T16:40:35.008+07:00'::timestamptz),
  ('78f27266-f89d-405c-8839-9c8e58909241'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-16T16:41:03.607+07:00'::timestamptz),
  ('83bbdb8c-418e-47ee-8ded-59c3e23a116f'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-16T16:41:52.268+07:00'::timestamptz),
  ('44a26bbd-38d7-43da-bce9-d0078aa4633f'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-16T16:42:07.851+07:00'::timestamptz),
  ('f7a4a932-1e41-4430-bb67-6be55e64d1b5'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-16T16:43:18.048+07:00'::timestamptz),
  ('ed823afc-558e-47ef-a139-9415f6d2be5b'::uuid, '229eebf7-90ed-4c25-b811-480ff22c434a'::uuid, 'aekdanai@gmail.com', 'DELETE_TASK', '{}'::jsonb, '2026-07-16T16:43:55.096+07:00'::timestamptz),
  ('ddc37f03-1886-4bc8-a375-9e3c7fd1c7a8'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-16T16:44:39.358+07:00'::timestamptz),
  ('53500040-a505-45a2-bba2-bedf7dca048a'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304"}'::jsonb, '2026-07-16T16:46:04.470+07:00'::timestamptz),
  ('357c799d-862a-4c62-b5c4-873974923e3e'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนสปริง 304 ภาพใหม่"}'::jsonb, '2026-07-16T21:13:28.260+07:00'::timestamptz),
  ('ccbab8c1-3491-4084-b6b2-d143b10cdceb'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ขอเพิ่ม limit ตะกร้าใน lazada"}'::jsonb, '2026-07-16T21:15:20.980+07:00'::timestamptz),
  ('26ce809b-b9c2-4b1e-ac18-963b4968f319'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"c4338b41-69ec-471c-a3a4-a4ec4253f661"}'::jsonb, '2026-07-16T21:45:31.034+07:00'::timestamptz),
  ('b68ffbb6-e54d-4396-9e42-eab785f05e54'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"a94c81b2-04ba-44ec-ba67-66ce1bed5df1"}'::jsonb, '2026-07-16T22:18:28.066+07:00'::timestamptz),
  ('36f56c7f-3cea-4062-b772-0335e67abc74'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"3acee674-ddce-46ff-8b13-b17c2dedd9fe"}'::jsonb, '2026-07-16T22:36:21.663+07:00'::timestamptz),
  ('7b7f534c-d022-42f0-85e8-bae1abd3d5bc'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"แหวนสปริง 304 ภาพใหม่"}'::jsonb, '2026-07-16T22:36:36.137+07:00'::timestamptz),
  ('05789669-c85a-46f2-ac97-796a583ce1cb'::uuid, 'b8e9e060-abf5-4e68-897c-c9d6b0be454d'::uuid, 'aekdanai@gmail.com', 'ARCHIVE_TASK', '{}'::jsonb, '2026-07-16T22:36:55.227+07:00'::timestamptz),
  ('22735891-916c-4e19-846c-1bc63a60b710'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304"}'::jsonb, '2026-07-16T22:38:25.989+07:00'::timestamptz),
  ('411582bc-971d-404c-a5a3-0001bc921705'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'CREATE_TASK', '{"name":"เว็บไซต์ plabin"}'::jsonb, '2026-07-17T14:08:30.165+07:00'::timestamptz),
  ('78e18a05-02d7-49c4-b6da-7c76e43fb68f'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"เว็บไซต์ plabin.in.th"}'::jsonb, '2026-07-17T14:10:11.120+07:00'::timestamptz),
  ('e46f46b7-2233-4f33-8baf-9804ca994813'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"a475126f-c414-4aba-9629-a67e3ce9ddee"}'::jsonb, '2026-07-22T15:21:19.032+07:00'::timestamptz),
  ('449e024f-bceb-455a-bcd0-8f47100797e0'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"3932248a-9a9d-4bb9-bf15-45787adc5e37"}'::jsonb, '2026-07-22T15:21:25.083+07:00'::timestamptz),
  ('a81d724e-e3b9-4630-8b04-0727227e6b5e'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ขอเพิ่ม limit ตะกร้าใน lazada"}'::jsonb, '2026-07-22T15:21:33.031+07:00'::timestamptz),
  ('25a49ba1-b3f4-4bd6-8eea-caabdc8655b2'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-22T15:40:09.426+07:00'::timestamptz),
  ('cdb76e9d-8a5a-4ce6-a64f-7c7ef7894e11'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"99e9d695-fae0-4a92-a288-70bcb18f7f5c"}'::jsonb, '2026-07-22T15:40:15.686+07:00'::timestamptz),
  ('9fc2b7ca-1947-4ca9-abbd-5763fd1fbbdf'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"4f04ce6d-223f-4d56-8a84-af8bd202d4be"}'::jsonb, '2026-07-22T15:40:19.425+07:00'::timestamptz),
  ('a8b594dc-f98a-4ef3-8fd5-7e0dc5a7c540'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"d977ab88-851b-49bd-96a2-54aaa5f3c474"}'::jsonb, '2026-07-22T15:40:25.393+07:00'::timestamptz),
  ('197c2a0b-a87d-4b9a-b96d-e24ddd14f22d'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-22T15:40:36.873+07:00'::timestamptz),
  ('c8af9c10-f03c-4737-b76e-029156fbb694'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-22T15:41:32.402+07:00'::timestamptz),
  ('57ea1b1b-99d2-45bb-9007-8efd4646f5c5'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"เว็บไซต์ plabin.in.th"}'::jsonb, '2026-07-22T15:42:04.829+07:00'::timestamptz),
  ('2f572567-241b-4bae-8809-06e3b5bef95c'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"eefc42dd-9735-48fc-b918-244f972367fa"}'::jsonb, '2026-07-22T15:46:33.958+07:00'::timestamptz),
  ('48ec62ba-203d-4cd5-ab10-45e25a840fb4'::uuid, '9bc3b3ce-9269-4e6d-ac38-912f48c99d05'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"เว็บไซต์ plabin.in.th"}'::jsonb, '2026-07-22T15:46:43.085+07:00'::timestamptz),
  ('80ecf382-feb3-4146-be89-c81d2a20cf7c'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"cd2901c2-5a6b-485b-b428-206c6b1f2b55"}'::jsonb, '2026-07-22T15:49:06.862+07:00'::timestamptz),
  ('abf3c64a-2841-4e3e-b541-ebeacc640fa0'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ขอเพิ่ม limit ตะกร้าใน lazada"}'::jsonb, '2026-07-22T15:49:15.613+07:00'::timestamptz),
  ('b5c4b2bd-7b4b-4be8-b56b-a467c7109b12'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"f1027ae1-a273-48d8-9e34-b51c79d79cea"}'::jsonb, '2026-07-22T16:06:05.493+07:00'::timestamptz),
  ('0283b721-c527-4318-9ce7-7e5003660c0d'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-22T16:07:19.461+07:00'::timestamptz),
  ('6c0bc467-0d5d-49b2-83da-a28bd7d79b60'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"พุกสลีพ ยกกล่อง"}'::jsonb, '2026-07-22T16:07:34.191+07:00'::timestamptz),
  ('bb0820e2-9e0b-4d14-98ae-4170c007e683'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"f1027ae1-a273-48d8-9e34-b51c79d79cea"}'::jsonb, '2026-07-22T16:08:10.437+07:00'::timestamptz),
  ('cc1ad17d-3d33-4a28-b5d2-2b4b1a702a31'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหกเหลี่ยม+น็อตหัวปีก"}'::jsonb, '2026-07-22T16:09:05.750+07:00'::timestamptz),
  ('09073fb4-e942-4dd1-a4d0-358e6d06002e'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b"}'::jsonb, '2026-07-22T16:09:30.080+07:00'::timestamptz),
  ('21efdf78-cab7-4d24-acf1-b3664a6cb5c6'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหัวปีก+น็อตหัวปีก"}'::jsonb, '2026-07-22T16:10:39.233+07:00'::timestamptz),
  ('72e80bae-3e64-4add-add0-8b59e3e0480c'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"b61a17ea-8fab-4913-a9d8-f73f0c937410"}'::jsonb, '2026-07-22T16:19:33.652+07:00'::timestamptz),
  ('1e2e89f0-3210-4c72-ad57-d8265d01e1f2'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'aekdanai@gmail.com', 'DELETE_ITEM', '{"itemId":"cc330e9f-cfa1-4e98-8646-8712bbbb7484"}'::jsonb, '2026-07-22T16:20:11.484+07:00'::timestamptz),
  ('72648ab4-2558-48a8-b4cf-5b9aae091f94'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"เต๋าต่อสายไฟ ภาพใหม่"}'::jsonb, '2026-07-22T16:20:45.798+07:00'::timestamptz),
  ('45e54aa4-2e10-434f-963d-ccf683922875'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'aekdanai@gmail.com', 'DELETE_ITEM', '{"itemId":"900c466e-020b-4bec-8775-3e269140232a"}'::jsonb, '2026-07-22T16:21:08.711+07:00'::timestamptz),
  ('94b1a50d-4d3b-4418-a352-eab9203ab6b2'::uuid, 'b914f237-0eb6-490b-8c02-51da02405326'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"เต๋าต่อสายไฟ ภาพใหม่"}'::jsonb, '2026-07-22T16:24:45.167+07:00'::timestamptz),
  ('dfde6b97-9701-40cb-863a-44ccfddc3f94'::uuid, '6aaeeaec-52ab-4397-9e18-c7f43365ed56'::uuid, 'aekdanai@gmail.com', 'ARCHIVE_TASK', '{}'::jsonb, '2026-07-23T20:53:01.454+07:00'::timestamptz),
  ('2cf20a57-6574-4d98-8eb9-751ca9331471'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"d290d072-8434-4f32-92dd-054fb5b021a5"}'::jsonb, '2026-07-24T10:53:50.201+07:00'::timestamptz),
  ('65cbc8e9-057c-4262-8d3b-b944489a677f'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"a36e05de-3fd1-4249-9c26-d6da868a570b"}'::jsonb, '2026-07-24T10:53:54.707+07:00'::timestamptz),
  ('7166b42c-1ac5-479d-b08d-6e0a6a7af1f8'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-24T10:54:10.769+07:00'::timestamptz),
  ('c0ebc29d-cc54-4655-8873-8a76aa113c92'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"b57ab695-073d-4ee6-a908-cfe7aa2fa5d0"}'::jsonb, '2026-07-24T10:54:17.806+07:00'::timestamptz),
  ('fe76ac1d-1b31-469f-9e0a-0c900553dade'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304"}'::jsonb, '2026-07-24T13:45:45.764+07:00'::timestamptz),
  ('736a445d-a642-437b-9777-6b18ea90df42'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหัวปีก+น็อตหัวปีก"}'::jsonb, '2026-07-24T15:19:59.349+07:00'::timestamptz),
  ('1411f49d-371e-4cfa-a356-6bec98aa440a'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-25T10:51:06.825+07:00'::timestamptz),
  ('39ab843e-b263-4b0f-a541-8295407548bd'::uuid, '57dbc19d-2a0b-4b3a-9ab3-7e13a62d893b'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหกเหลี่ยม+น็อตหัวปีก"}'::jsonb, '2026-07-25T10:51:31.193+07:00'::timestamptz),
  ('df12041e-b7aa-4d9d-a212-50f2842a110e'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"dc653994-5e60-4bcb-bdc6-b3a1d947b351"}'::jsonb, '2026-07-25T11:00:30.186+07:00'::timestamptz),
  ('c9e1ce58-cd32-4794-855a-879eb178c1a9'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"3d77ca33-5cb3-4afc-9a47-8c54b78d5bda"}'::jsonb, '2026-07-25T11:00:35.665+07:00'::timestamptz),
  ('940dab9e-ac06-4e1c-9dca-7dd2f23809ab'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-25T11:00:46.545+07:00'::timestamptz),
  ('4c6c5230-4764-4450-ad5d-058eac0327cc'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหัวปีก+น็อตหัวปีก"}'::jsonb, '2026-07-25T11:04:56.226+07:00'::timestamptz),
  ('313a06b8-f108-4676-8196-f9f901f62280'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"963609f6-0780-48bc-ae3e-63f8b8d42371"}'::jsonb, '2026-07-25T11:06:19.292+07:00'::timestamptz),
  ('cf286d14-7b57-46ed-bdb6-d2d3dbc5a548'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'plabin2025@gmail.com', 'NOTIFY_TASK', '{"recipients":1}'::jsonb, '2026-07-25T11:07:00.112+07:00'::timestamptz),
  ('36dd68f1-5332-4507-a34f-826da723ac34'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'aekdanai@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"28c586dc-3d25-4d1e-add3-5015dfb7c389"}'::jsonb, '2026-07-25T11:08:13.854+07:00'::timestamptz),
  ('eedddb7d-8eae-4e13-aac6-e0abfbf26a09'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'aekdanai@gmail.com', 'REORDER_ITEMS', '{}'::jsonb, '2026-07-25T11:08:47.247+07:00'::timestamptz),
  ('ac1e9780-1bdc-497c-aafb-6a69887daa5a'::uuid, 'e50a9c57-cdd0-4833-86ff-2aa4b65f6aa8'::uuid, 'plabin2025@gmail.com', 'CLONE_TASK', '{"sourceTaskId":"b61a17ea-8fab-4913-a9d8-f73f0c937410"}'::jsonb, '2026-07-25T11:09:06.631+07:00'::timestamptz),
  ('5991a224-1f42-4564-a7e4-d2be0e4c5607'::uuid, 'f1027ae1-a273-48d8-9e34-b51c79d79cea'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"สกรูตัวหนอน 304"}'::jsonb, '2026-07-25T11:09:59.332+07:00'::timestamptz),
  ('59e2795e-5246-4957-aed4-9a0d6daa4951'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"พุกสลีพ ยกกล่อง"}'::jsonb, '2026-07-25T11:12:51.848+07:00'::timestamptz),
  ('0304bb1c-125c-4005-b842-41c383049c49'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"พุกสลีพ ยกกล่อง"}'::jsonb, '2026-07-25T11:13:27.361+07:00'::timestamptz),
  ('6b4e5113-f557-4209-8275-9b4da197e166'::uuid, '0a3a050f-66f9-4f8c-9ea6-9eb2dc7daa17'::uuid, 'supeerat.pom@gmail.com', 'CREATE_TASK', '{"name":"ขาฉิ่งโยก"}'::jsonb, '2026-07-25T14:35:47.908+07:00'::timestamptz),
  ('8fecaa79-1473-4124-a73e-fb6a96181639'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"da4e1cd8-b2c9-4cdc-9692-cc91fcc464dd"}'::jsonb, '2026-07-25T15:41:11.681+07:00'::timestamptz),
  ('de31c83a-02b3-4d02-b778-384f3bf930b0'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"56063b38-15b6-4779-9579-28803ceee632"}'::jsonb, '2026-07-25T15:41:19.170+07:00'::timestamptz),
  ('f6307c4b-9a61-4a1d-9d15-bd8f7a8f2344'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"2eab053e-9216-49b3-b095-16e9ed6b6581"}'::jsonb, '2026-07-25T15:41:26.810+07:00'::timestamptz),
  ('26ed0fad-1fdc-4576-81c9-16b7b51969bb'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"d1d3295d-22f1-4740-8496-52640b25e444"}'::jsonb, '2026-07-25T15:41:32.775+07:00'::timestamptz),
  ('0ce6bd38-e5cf-469c-8d44-8bd9a8a46805'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'UPDATE_TASK', '{"name":"พุกสลีพ ยกกล่อง"}'::jsonb, '2026-07-25T15:41:45.384+07:00'::timestamptz),
  ('a8cde39d-c289-4b62-8337-cb0cbe3e5934'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'plabin2025@gmail.com', 'CHECK_ITEM', '{"itemId":"5a39d757-d513-4ab6-8eff-440180a1150f"}'::jsonb, '2026-07-25T15:41:52.924+07:00'::timestamptz),
  ('9b580263-99fd-45da-9aef-ca7de168050e'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"f4a393f3-5252-48f8-b855-c07e57493001"}'::jsonb, '2026-07-25T21:15:48.564+07:00'::timestamptz),
  ('75c563e2-b876-4323-8dc9-463b30814da9'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"โซ่สแตนเลส 304 ร้าน ezTools"}'::jsonb, '2026-07-25T21:16:08.637+07:00'::timestamptz),
  ('29b61ee7-9a29-4415-a9c2-e6ea637c543a'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'CHECK_ITEM', '{"itemId":"226e94e8-667c-45ca-8782-8620755ceda6"}'::jsonb, '2026-07-25T21:17:09.697+07:00'::timestamptz),
  ('4dcb5611-6310-4e6d-bf31-9bb994108d0d'::uuid, '28c586dc-3d25-4d1e-add3-5015dfb7c389'::uuid, 'aekdanai@gmail.com', 'ARCHIVE_TASK', '{}'::jsonb, '2026-07-25T21:23:30.000+07:00'::timestamptz),
  ('2d1b75eb-a1e9-41c9-86c3-c8e9bfeb1e6e'::uuid, 'f24b3826-625d-4491-bb13-d6a3ed96ac20'::uuid, 'aekdanai@gmail.com', 'DELETE_TASK', '{}'::jsonb, '2026-07-25T22:07:32.553+07:00'::timestamptz),
  ('1fdd8692-ab7b-4150-946b-0640a18b83a9'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหัวปีก+น็อตหัวปีก"}'::jsonb, '2026-07-27T10:52:59.729+07:00'::timestamptz),
  ('2cd33628-0963-4ea6-9628-fa8c9e07a465'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'REMOVE_SHARE', '{"email":"                                             "}'::jsonb, '2026-07-27T10:53:33.311+07:00'::timestamptz),
  ('78e65c2e-7013-462e-a3b6-6f8ed3632236'::uuid, 'b61a17ea-8fab-4913-a9d8-f73f0c937410'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"ชุดสกรูหัวปีก+น็อตหัวปีก"}'::jsonb, '2026-07-27T10:53:57.074+07:00'::timestamptz),
  ('3f02f649-1e31-41fc-90b2-385fbe385491'::uuid, '35293a7b-8c44-48b2-887a-5114d8d8b926'::uuid, 'aekdanai@gmail.com', 'UPDATE_TASK', '{"name":"พุกสลีพ ยกกล่อง"}'::jsonb, '2026-07-28T11:14:30.532+07:00'::timestamptz)
)
insert into public.activity_logs (id, task_id, user_id, action, detail_json, created_at)
select s.id, s.task_id, p.id, s.action::public.activity_action, s.detail_json, s.created_at
from source s left join public.profiles p on lower(p.email) = s.user_email
on conflict (id) do update set
  task_id = excluded.task_id, user_id = excluded.user_id, action = excluded.action,
  detail_json = excluded.detail_json, created_at = excluded.created_at;

with source(key, value, updated_at) as (
  values
  ('APP_NAME', 'Plabin Task Management', '2026-07-14T15:33:48.281+07:00'::timestamptz),
  ('TIMEZONE', 'Asia/Bangkok', '2026-07-14T15:33:48.499+07:00'::timestamptz)
)
insert into public.settings (key, value, updated_at)
select key, to_jsonb(value::text), updated_at from source
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

alter table public.profiles enable trigger profiles_touch;
alter table public.profiles enable trigger guard_last_admin;
alter table public.categories enable trigger categories_touch;
alter table public.tasks enable trigger tasks_touch;
alter table public.tasks enable trigger guard_task_update;
alter table public.checklist_items enable trigger checklist_touch;
alter table public.checklist_items enable trigger guard_checklist_update;
alter table public.checklist_items enable trigger checklist_recalculate;
alter table public.task_shares enable trigger shares_touch;

commit;

-- Imported rows: 4 users, 7 categories, 18 tasks, 133 checklist items,
-- 4 valid task shares, 5 notifications, 147 activity logs, and 2 settings.
-- One inactive TaskShares row with a blank UserEmail was intentionally skipped.
