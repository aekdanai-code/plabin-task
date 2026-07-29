begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.app_role as enum ('ADMIN', 'USER');
create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'COMPLETED');
create type public.task_permission as enum ('VIEWER', 'CHECKER', 'EDITOR');
create type public.notification_type as enum ('TASK_SHARED', 'TASK_UPDATED');
create type public.activity_action as enum (
  'CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'ARCHIVE_TASK', 'RESTORE_TASK', 'CLONE_TASK',
  'ADD_ITEM', 'UPDATE_ITEM', 'DELETE_ITEM', 'CHECK_ITEM', 'UNCHECK_ITEM', 'REORDER_ITEMS',
  'SHARE_TASK', 'UPDATE_PERMISSION', 'REMOVE_SHARE', 'NOTIFY_TASK',
  'CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DEACTIVATE_CATEGORY',
  'INVITE_MEMBER', 'UPDATE_MEMBER', 'DEACTIVATE_MEMBER', 'REACTIVATE_MEMBER'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  avatar_url text,
  role public.app_role not null default 'USER',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  category_name text unique not null check (char_length(trim(category_name)) between 1 and 80),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  owner_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_name text not null check (char_length(trim(task_name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  category_id uuid not null references public.categories(id),
  owner_id uuid not null references public.profiles(id),
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  status public.task_status not null default 'TODO',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  is_deleted boolean not null default false
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 1 and 200),
  weight numeric(10,2) not null default 0 check (weight >= 0),
  is_checked boolean not null default false,
  sort_order integer not null default 0,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create table public.task_shares (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission public.task_permission not null,
  shared_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (task_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action public.activity_action not null,
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (lower(email));
create index idx_tasks_owner_updated on public.tasks (owner_id, updated_at desc);
create index idx_tasks_visible on public.tasks (is_deleted, is_archived, updated_at desc);
create index idx_checklist_task_order on public.checklist_items (task_id, is_deleted, sort_order);
create index idx_shares_user on public.task_shares (user_id, is_active);
create index idx_shares_task on public.task_shares (task_id, is_active);
create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);
create index idx_activity_task_created on public.activity_logs (task_id, created_at desc);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger categories_touch before update on public.categories
for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks
for each row execute function private.touch_updated_at();
create trigger checklist_touch before update on public.checklist_items
for each row execute function private.touch_updated_at();
create trigger shares_touch before update on public.task_shares
for each row execute function private.touch_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)),
    case
      when not exists (select 1 from public.profiles where role = 'ADMIN') then 'ADMIN'::public.app_role
      else 'USER'::public.app_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN' and is_active
  );
$$;

create function private.task_access_level(target_task_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.tasks
      where id = target_task_id and owner_id = (select auth.uid()) and not is_deleted
    ) then 'OWNER'
    else coalesce((
      select permission::text
      from public.task_shares
      where task_id = target_task_id
        and user_id = (select auth.uid())
        and is_active
      limit 1
    ), 'NONE')
  end;
$$;

create function private.can_view_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.task_access_level(target_task_id) in ('OWNER', 'VIEWER', 'CHECKER', 'EDITOR');
$$;

create function private.can_check_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.task_access_level(target_task_id) in ('OWNER', 'CHECKER', 'EDITOR');
$$;

create function private.can_edit_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and private.task_access_level(target_task_id) in ('OWNER', 'EDITOR');
$$;

create function private.guard_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'ADMIN' and old.is_active
     and (new.role <> 'ADMIN' or not new.is_active)
     and (select count(*) from public.profiles where role = 'ADMIN' and is_active) <= 1 then
    raise exception 'LAST_ACTIVE_ADMIN_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger guard_last_admin before update on public.profiles
for each row execute function private.guard_profile_admin();

create function private.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'TASK_OWNER_IMMUTABLE';
  end if;
  if (select auth.uid()) <> old.owner_id and (
    new.is_archived is distinct from old.is_archived
    or new.archived_at is distinct from old.archived_at
    or new.is_deleted is distinct from old.is_deleted
  ) then
    raise exception 'OWNER_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger guard_task_update before update on public.tasks
for each row execute function private.guard_task_update();

create function private.guard_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.task_access_level(old.task_id) = 'CHECKER' and (
    new.task_id is distinct from old.task_id
    or new.item_name is distinct from old.item_name
    or new.weight is distinct from old.weight
    or new.sort_order is distinct from old.sort_order
    or new.is_deleted is distinct from old.is_deleted
  ) then
    raise exception 'CHECKER_CAN_ONLY_TOGGLE';
  end if;
  return new;
end;
$$;

create trigger guard_checklist_update before update on public.checklist_items
for each row execute function private.guard_checklist_update();

create function private.recalculate_task_progress(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_weight numeric(12,2);
  completed_weight numeric(12,2);
  next_progress numeric(5,2);
  next_status public.task_status;
begin
  select coalesce(sum(weight), 0), coalesce(sum(weight) filter (where is_checked), 0)
  into total_weight, completed_weight
  from public.checklist_items
  where task_id = target_task_id and not is_deleted;

  next_progress := case when total_weight > 0 then round(completed_weight / total_weight * 100, 2) else 0 end;
  next_progress := least(next_progress, 100);
  next_status := case
    when next_progress = 0 then 'TODO'::public.task_status
    when next_progress >= 100 then 'COMPLETED'::public.task_status
    else 'IN_PROGRESS'::public.task_status
  end;

  update public.tasks
  set progress = next_progress,
      status = next_status,
      completed_at = case
        when next_status = 'COMPLETED' and completed_at is null then now()
        when next_status <> 'COMPLETED' then null
        else completed_at
      end
  where id = target_task_id;
end;
$$;

create function private.checklist_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recalculate_task_progress(coalesce(new.task_id, old.task_id));
  return coalesce(new, old);
end;
$$;

create trigger checklist_recalculate
after insert or update or delete on public.checklist_items
for each row execute function private.checklist_recalculate_trigger();

create function public.set_task_shares(target_task_id uuid, next_task_shares jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_row jsonb;
  target_user uuid;
  target_permission public.task_permission;
  actor_name text;
  task_title text;
  was_active boolean;
  changed_count integer := 0;
begin
  if (select auth.uid()) is null or private.task_access_level(target_task_id) <> 'OWNER' then
    raise exception 'OWNER_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(next_task_shares, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_SHARES';
  end if;
  if (
    select count(*) <> count(distinct value->>'user_id')
    from jsonb_array_elements(coalesce(next_task_shares, '[]'::jsonb))
  ) then
    raise exception 'DUPLICATE_SHARE_USER';
  end if;

  select task_name into task_title from public.tasks where id = target_task_id and not is_deleted;
  select coalesce(display_name, email) into actor_name from public.profiles where id = (select auth.uid());

  update public.task_shares existing
  set is_active = false
  where existing.task_id = target_task_id
    and existing.is_active
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(next_task_shares, '[]'::jsonb)) incoming
      where (incoming->>'user_id')::uuid = existing.user_id
    );

  for share_row in select value from jsonb_array_elements(coalesce(next_task_shares, '[]'::jsonb))
  loop
    target_user := (share_row->>'user_id')::uuid;
    target_permission := (share_row->>'permission')::public.task_permission;
    if target_user = (select auth.uid()) or not exists (
      select 1 from public.profiles where id = target_user and is_active
    ) then
      raise exception 'INVALID_SHARE_USER';
    end if;

    select is_active into was_active
    from public.task_shares
    where task_id = target_task_id and user_id = target_user;

    insert into public.task_shares (task_id, user_id, permission, shared_by, is_active)
    values (target_task_id, target_user, target_permission, (select auth.uid()), true)
    on conflict (task_id, user_id) do update
      set permission = excluded.permission,
          shared_by = excluded.shared_by,
          is_active = true;

    if was_active is distinct from true then
      insert into public.notifications (user_id, task_id, type, title, message, created_by)
      values (
        target_user,
        target_task_id,
        'TASK_SHARED',
        'มี Task ใหม่แชร์ให้คุณ',
        actor_name || ' แชร์ Task "' || task_title || '" ให้คุณ',
        (select auth.uid())
      );
    end if;
    changed_count := changed_count + 1;
  end loop;

  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (target_task_id, (select auth.uid()), 'SHARE_TASK', jsonb_build_object('share_count', changed_count));
  return changed_count;
end;
$$;

create function public.create_task_with_items(
  next_task_name text,
  next_description text,
  next_category_id uuid,
  next_checklist_items jsonb,
  next_task_shares jsonb default '[]'::jsonb
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_task public.tasks;
  item jsonb;
  item_index integer := 0;
begin
  if (select auth.uid()) is null or not private.is_active_user() then
    raise exception 'ACTIVE_LOGIN_REQUIRED';
  end if;
  if nullif(trim(next_task_name), '') is null then raise exception 'TASK_NAME_REQUIRED'; end if;
  if not exists (select 1 from public.categories where id = next_category_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if jsonb_typeof(next_checklist_items) <> 'array' or jsonb_array_length(next_checklist_items) = 0 then
    raise exception 'CHECKLIST_REQUIRED';
  end if;

  insert into public.tasks (task_name, description, category_id, owner_id)
  values (trim(next_task_name), nullif(trim(coalesce(next_description, '')), ''), next_category_id, (select auth.uid()))
  returning * into new_task;

  for item in select value from jsonb_array_elements(next_checklist_items)
  loop
    item_index := item_index + 1;
    insert into public.checklist_items (task_id, item_name, weight, sort_order)
    values (
      new_task.id,
      trim(item->>'item_name'),
      greatest(coalesce((item->>'weight')::numeric, 0), 0),
      item_index
    );
  end loop;

  perform public.set_task_shares(new_task.id, coalesce(next_task_shares, '[]'::jsonb));
  insert into public.activity_logs (task_id, user_id, action)
  values (new_task.id, (select auth.uid()), 'CREATE_TASK');
  select * into new_task from public.tasks where id = new_task.id;
  return new_task;
end;
$$;

create function public.clone_task(source_task_id uuid, next_task_name text)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_task public.tasks;
  new_task public.tasks;
begin
  if not private.can_view_task(source_task_id) then raise exception 'PERMISSION_DENIED'; end if;
  if nullif(trim(next_task_name), '') is null then raise exception 'TASK_NAME_REQUIRED'; end if;
  select * into source_task from public.tasks where id = source_task_id and not is_deleted;
  if source_task.id is null then raise exception 'TASK_NOT_FOUND'; end if;

  insert into public.tasks (task_name, description, category_id, owner_id)
  values (trim(next_task_name), source_task.description, source_task.category_id, (select auth.uid()))
  returning * into new_task;

  insert into public.checklist_items (task_id, item_name, weight, sort_order)
  select new_task.id, item_name, weight, sort_order
  from public.checklist_items
  where task_id = source_task_id and not is_deleted
  order by sort_order;

  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (new_task.id, (select auth.uid()), 'CLONE_TASK', jsonb_build_object('source_task_id', source_task_id));
  select * into new_task from public.tasks where id = new_task.id;
  return new_task;
end;
$$;

create function public.notify_task_team(target_task_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  task_title text;
  sent_count integer;
begin
  if private.task_access_level(target_task_id) not in ('OWNER', 'EDITOR') then
    raise exception 'EDIT_PERMISSION_REQUIRED';
  end if;
  if not exists (select 1 from public.task_shares where task_id = target_task_id and is_active) then
    raise exception 'TASK_NOT_SHARED';
  end if;
  select task_name into task_title from public.tasks where id = target_task_id and not is_deleted;
  select coalesce(display_name, email) into actor_name from public.profiles where id = (select auth.uid());

  insert into public.notifications (user_id, task_id, type, title, message, created_by)
  select recipient_id, target_task_id, 'TASK_UPDATED', 'Task มีการอัปเดต',
         actor_name || ' แจ้งว่า Task "' || task_title || '" มีการอัปเดต', (select auth.uid())
  from (
    select owner_id as recipient_id from public.tasks where id = target_task_id
    union
    select user_id from public.task_shares where task_id = target_task_id and is_active
  ) recipients
  where recipient_id <> (select auth.uid());
  get diagnostics sent_count = row_count;

  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (target_task_id, (select auth.uid()), 'NOTIFY_TASK', jsonb_build_object('recipient_count', sent_count));
  return sent_count;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.checklist_items enable row level security;
alter table public.task_shares enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (private.is_active_user() and (is_active or private.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy categories_select on public.categories for select to authenticated
using (private.is_active_user() and (is_active or private.is_admin()));
create policy categories_admin_insert on public.categories for insert to authenticated
with check (private.is_admin() and owner_id = (select auth.uid()));
create policy categories_admin_update on public.categories for update to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy tasks_select on public.tasks for select to authenticated
using (private.can_view_task(id));
create policy tasks_insert on public.tasks for insert to authenticated
with check (private.is_active_user() and owner_id = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
using (private.can_edit_task(id)) with check (private.can_edit_task(id));

create policy checklist_select on public.checklist_items for select to authenticated
using (private.can_view_task(task_id));
create policy checklist_insert on public.checklist_items for insert to authenticated
with check (private.can_edit_task(task_id));
create policy checklist_update on public.checklist_items for update to authenticated
using (private.can_check_task(task_id)) with check (private.can_check_task(task_id));

create policy shares_select on public.task_shares for select to authenticated
using (private.can_view_task(task_id));
create policy shares_owner_insert on public.task_shares for insert to authenticated
with check (private.task_access_level(task_id) = 'OWNER' and user_id <> (select auth.uid()));
create policy shares_owner_update on public.task_shares for update to authenticated
using (private.task_access_level(task_id) = 'OWNER')
with check (private.task_access_level(task_id) = 'OWNER' and user_id <> (select auth.uid()));

create policy notifications_select_own on public.notifications for select to authenticated
using (private.is_active_user() and user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy activity_insert_own on public.activity_logs for insert to authenticated
with check (private.is_active_user() and user_id = (select auth.uid()));

create policy settings_select on public.settings for select to authenticated
using (private.is_active_user());
create policy settings_admin_insert on public.settings for insert to authenticated
with check (private.is_admin());
create policy settings_admin_update on public.settings for update to authenticated
using (private.is_admin()) with check (private.is_admin());

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.task_access_level(uuid) to authenticated;
grant execute on function private.can_view_task(uuid) to authenticated;
grant execute on function private.can_check_task(uuid) to authenticated;
grant execute on function private.can_edit_task(uuid) to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert, update on public.checklist_items to authenticated;
grant select, insert, update on public.task_shares to authenticated;
grant select, update on public.notifications to authenticated;
grant insert on public.activity_logs to authenticated;
grant select, insert, update on public.settings to authenticated;

revoke all on function public.set_task_shares(uuid, jsonb) from public, anon;
revoke all on function public.create_task_with_items(text, text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.clone_task(uuid, text) from public, anon;
revoke all on function public.notify_task_team(uuid) from public, anon;
grant execute on function public.set_task_shares(uuid, jsonb) to authenticated;
grant execute on function public.create_task_with_items(text, text, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.clone_task(uuid, text) to authenticated;
grant execute on function public.notify_task_team(uuid) to authenticated;

commit;
