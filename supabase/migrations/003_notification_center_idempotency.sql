create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  task_shared boolean not null default true,
  task_updated boolean not null default true,
  updated_at timestamptz not null default now()
);

create table private.mutation_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  operation text not null,
  resource_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index mutation_requests_created_at_idx
on private.mutation_requests (created_at);

create trigger notification_preferences_touch
before update on public.notification_preferences
for each row execute function private.touch_updated_at();

create function private.filter_notification_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference_enabled boolean;
begin
  select case new.type
    when 'TASK_SHARED'::public.notification_type then task_shared
    when 'TASK_UPDATED'::public.notification_type then task_updated
    else true
  end
  into preference_enabled
  from public.notification_preferences
  where user_id = new.user_id;

  if coalesce(preference_enabled, true) then
    return new;
  end if;
  return null;
end;
$$;

create trigger notifications_respect_preferences
before insert on public.notifications
for each row execute function private.filter_notification_preference();

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own
on public.notification_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

create policy notification_preferences_insert_own
on public.notification_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy notification_preferences_update_own
on public.notification_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

create function public.create_task_with_items(
  next_task_name text,
  next_description text,
  next_category_id uuid,
  next_checklist_items jsonb,
  next_task_shares jsonb,
  request_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_task public.tasks;
  existing_operation text;
  existing_resource_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;

  insert into private.mutation_requests (user_id, idempotency_key, operation)
  values ((select auth.uid()), request_id, 'CREATE_TASK')
  on conflict do nothing;

  if not found then
    select operation, resource_id
    into existing_operation, existing_resource_id
    from private.mutation_requests
    where user_id = (select auth.uid()) and idempotency_key = request_id;

    if existing_operation <> 'CREATE_TASK' then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    select * into new_task from public.tasks where id = existing_resource_id;
    if new_task.id is null then raise exception 'IDEMPOTENT_RESULT_NOT_FOUND'; end if;
    return new_task;
  end if;

  new_task := public.create_task_with_items(
    next_task_name,
    next_description,
    next_category_id,
    next_checklist_items,
    next_task_shares
  );

  update private.mutation_requests
  set resource_id = new_task.id
  where user_id = (select auth.uid()) and idempotency_key = request_id;
  return new_task;
end;
$$;

create function public.update_task_with_items(
  target_task_id uuid,
  next_task_name text,
  next_description text,
  next_category_id uuid,
  next_checklist_items jsonb,
  next_task_shares jsonb,
  request_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_task public.tasks;
  existing_operation text;
  existing_resource_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;

  insert into private.mutation_requests (user_id, idempotency_key, operation, resource_id)
  values ((select auth.uid()), request_id, 'UPDATE_TASK', target_task_id)
  on conflict do nothing;

  if not found then
    select operation, resource_id
    into existing_operation, existing_resource_id
    from private.mutation_requests
    where user_id = (select auth.uid()) and idempotency_key = request_id;

    if existing_operation <> 'UPDATE_TASK' or existing_resource_id <> target_task_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into updated_task from public.tasks where id = target_task_id;
    if updated_task.id is null then raise exception 'IDEMPOTENT_RESULT_NOT_FOUND'; end if;
    return updated_task;
  end if;

  updated_task := public.update_task_with_items(
    target_task_id,
    next_task_name,
    next_description,
    next_category_id,
    next_checklist_items,
    next_task_shares
  );
  return updated_task;
end;
$$;

create function public.toggle_checklist_item(
  target_item_id uuid,
  next_checked boolean,
  request_id uuid
)
returns public.checklist_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_item public.checklist_items;
  target_task_id uuid;
  existing_operation text;
  existing_resource_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;

  insert into private.mutation_requests (user_id, idempotency_key, operation, resource_id)
  values ((select auth.uid()), request_id, 'TOGGLE_CHECKLIST', target_item_id)
  on conflict do nothing;

  if not found then
    select operation, resource_id
    into existing_operation, existing_resource_id
    from private.mutation_requests
    where user_id = (select auth.uid()) and idempotency_key = request_id;

    if existing_operation <> 'TOGGLE_CHECKLIST' or existing_resource_id <> target_item_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into updated_item from public.checklist_items where id = target_item_id;
    if updated_item.id is null then raise exception 'IDEMPOTENT_RESULT_NOT_FOUND'; end if;
    return updated_item;
  end if;

  select task_id into target_task_id
  from public.checklist_items
  where id = target_item_id and not is_deleted;

  if target_task_id is null then raise exception 'CHECKLIST_ITEM_NOT_FOUND'; end if;
  if not private.can_check_task(target_task_id) then raise exception 'CHECK_PERMISSION_REQUIRED'; end if;

  update public.checklist_items
  set is_checked = next_checked,
      checked_by = case when next_checked then (select auth.uid()) else null end,
      checked_at = case when next_checked then now() else null end
  where id = target_item_id
  returning * into updated_item;

  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (
    target_task_id,
    (select auth.uid()),
    case when next_checked then 'CHECK_ITEM'::public.activity_action else 'UNCHECK_ITEM'::public.activity_action end,
    '{}'::jsonb
  );
  return updated_item;
end;
$$;

create function public.reorder_checklist_items(
  target_task_id uuid,
  ordered_item_ids uuid[],
  request_id uuid
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_id uuid;
  item_index integer := 0;
  existing_operation text;
  existing_resource_id uuid;
  result_ids uuid[];
begin
  if (select auth.uid()) is null then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;

  insert into private.mutation_requests (user_id, idempotency_key, operation, resource_id)
  values ((select auth.uid()), request_id, 'REORDER_CHECKLIST', target_task_id)
  on conflict do nothing;

  if not found then
    select operation, resource_id
    into existing_operation, existing_resource_id
    from private.mutation_requests
    where user_id = (select auth.uid()) and idempotency_key = request_id;

    if existing_operation <> 'REORDER_CHECKLIST' or existing_resource_id <> target_task_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select array_agg(id order by sort_order)
    into result_ids
    from public.checklist_items
    where task_id = target_task_id and not is_deleted;
    return coalesce(result_ids, '{}'::uuid[]);
  end if;

  if private.task_access_level(target_task_id) not in ('OWNER', 'EDITOR') then
    raise exception 'EDIT_PERMISSION_REQUIRED';
  end if;
  if coalesce(array_length(ordered_item_ids, 1), 0) = 0 then
    raise exception 'CHECKLIST_REQUIRED';
  end if;
  if (
    select count(*) <> count(distinct incoming_id)
    from unnest(ordered_item_ids) incoming_id
  ) then
    raise exception 'DUPLICATE_CHECKLIST_ITEM';
  end if;
  if (
    select count(*)
    from public.checklist_items
    where task_id = target_task_id and not is_deleted
  ) <> cardinality(ordered_item_ids) then
    raise exception 'CHECKLIST_ITEMS_MISMATCH';
  end if;

  foreach item_id in array ordered_item_ids
  loop
    if not exists (
      select 1 from public.checklist_items
      where id = item_id and task_id = target_task_id and not is_deleted
    ) then
      raise exception 'INVALID_CHECKLIST_ITEM';
    end if;
    item_index := item_index + 1;
    update public.checklist_items
    set sort_order = item_index
    where id = item_id and task_id = target_task_id;
  end loop;

  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (target_task_id, (select auth.uid()), 'REORDER_ITEMS', '{}'::jsonb);
  return ordered_item_ids;
end;
$$;

revoke all on function public.create_task_with_items(text, text, uuid, jsonb, jsonb) from authenticated;
revoke all on function public.update_task_with_items(uuid, text, text, uuid, jsonb, jsonb) from authenticated;

revoke all on function public.create_task_with_items(text, text, uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.update_task_with_items(uuid, text, text, uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.toggle_checklist_item(uuid, boolean, uuid) from public, anon;
revoke all on function public.reorder_checklist_items(uuid, uuid[], uuid) from public, anon;

grant execute on function public.create_task_with_items(text, text, uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.update_task_with_items(uuid, text, text, uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.toggle_checklist_item(uuid, boolean, uuid) to authenticated;
grant execute on function public.reorder_checklist_items(uuid, uuid[], uuid) to authenticated;
