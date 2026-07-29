create or replace function public.update_task_with_items(
  target_task_id uuid,
  next_task_name text,
  next_description text,
  next_category_id uuid,
  next_checklist_items jsonb,
  next_task_shares jsonb default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  updated_task public.tasks;
  item jsonb;
  item_id uuid;
  item_index integer := 0;
  next_item_name text;
  next_item_weight numeric;
  next_item_checked boolean;
begin
  if (select auth.uid()) is null or not private.is_active_user() then
    raise exception 'ACTIVE_LOGIN_REQUIRED';
  end if;

  select *
  into current_task
  from public.tasks
  where id = target_task_id and not is_deleted
  for update;

  if current_task.id is null then
    raise exception 'TASK_NOT_FOUND';
  end if;
  if private.task_access_level(target_task_id) not in ('OWNER', 'EDITOR') then
    raise exception 'EDIT_PERMISSION_REQUIRED';
  end if;
  if nullif(trim(next_task_name), '') is null then
    raise exception 'TASK_NAME_REQUIRED';
  end if;
  if not exists (select 1 from public.categories where id = next_category_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if jsonb_typeof(next_checklist_items) <> 'array' or jsonb_array_length(next_checklist_items) = 0 then
    raise exception 'CHECKLIST_REQUIRED';
  end if;
  if (
    select count(value->>'id') <> count(distinct value->>'id')
    from jsonb_array_elements(next_checklist_items)
    where value ? 'id' and nullif(value->>'id', '') is not null
  ) then
    raise exception 'DUPLICATE_CHECKLIST_ITEM';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(next_checklist_items) incoming
    where incoming.value ? 'id'
      and nullif(incoming.value->>'id', '') is not null
      and not exists (
        select 1
        from public.checklist_items existing
        where existing.id = (incoming.value->>'id')::uuid
          and existing.task_id = target_task_id
      )
  ) then
    raise exception 'INVALID_CHECKLIST_ITEM';
  end if;
  if next_task_shares is not null
     and private.task_access_level(target_task_id) <> 'OWNER' then
    raise exception 'OWNER_REQUIRED';
  end if;

  update public.tasks
  set task_name = trim(next_task_name),
      description = nullif(trim(coalesce(next_description, '')), ''),
      category_id = next_category_id
  where id = target_task_id
  returning * into updated_task;

  update public.checklist_items existing
  set is_deleted = true
  where existing.task_id = target_task_id
    and not existing.is_deleted
    and not exists (
      select 1
      from jsonb_array_elements(next_checklist_items) incoming
      where incoming.value ? 'id'
        and nullif(incoming.value->>'id', '') is not null
        and (incoming.value->>'id')::uuid = existing.id
    );

  for item in select value from jsonb_array_elements(next_checklist_items)
  loop
    item_index := item_index + 1;
    item_id := nullif(item->>'id', '')::uuid;
    next_item_name := trim(coalesce(item->>'item_name', ''));
    next_item_weight := coalesce((item->>'weight')::numeric, 0);
    next_item_checked := coalesce((item->>'is_checked')::boolean, false);

    if next_item_name = '' then raise exception 'CHECKLIST_ITEM_NAME_REQUIRED'; end if;
    if next_item_weight < 0 then raise exception 'INVALID_CHECKLIST_WEIGHT'; end if;

    if item_id is null then
      insert into public.checklist_items (
        task_id, item_name, weight, is_checked, sort_order, checked_by, checked_at
      )
      values (
        target_task_id,
        next_item_name,
        next_item_weight,
        next_item_checked,
        item_index,
        case when next_item_checked then (select auth.uid()) else null end,
        case when next_item_checked then now() else null end
      );
    else
      update public.checklist_items
      set item_name = next_item_name,
          weight = next_item_weight,
          is_checked = next_item_checked,
          sort_order = item_index,
          checked_by = case
            when next_item_checked and not is_checked then (select auth.uid())
            when not next_item_checked then null
            else checked_by
          end,
          checked_at = case
            when next_item_checked and not is_checked then now()
            when not next_item_checked then null
            else checked_at
          end,
          is_deleted = false
      where id = item_id and task_id = target_task_id;
    end if;
  end loop;

  if next_task_shares is not null then
    perform public.set_task_shares(target_task_id, next_task_shares);
  end if;

  perform private.recalculate_task_progress(target_task_id);
  insert into public.activity_logs (task_id, user_id, action, detail_json)
  values (
    target_task_id,
    (select auth.uid()),
    'UPDATE_TASK',
    jsonb_build_object('checklist_count', jsonb_array_length(next_checklist_items))
  );

  select * into updated_task from public.tasks where id = target_task_id;
  return updated_task;
end;
$$;

revoke all on function public.update_task_with_items(uuid, text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_task_with_items(uuid, text, text, uuid, jsonb, jsonb) to authenticated;
