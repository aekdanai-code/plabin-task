create function public.clone_task(
  source_task_id uuid,
  next_task_name text,
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
  values ((select auth.uid()), request_id, 'CLONE_TASK')
  on conflict do nothing;

  if not found then
    select operation, resource_id
    into existing_operation, existing_resource_id
    from private.mutation_requests
    where user_id = (select auth.uid()) and idempotency_key = request_id;

    if existing_operation <> 'CLONE_TASK' then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    select * into new_task from public.tasks where id = existing_resource_id;
    if new_task.id is null then raise exception 'IDEMPOTENT_RESULT_NOT_FOUND'; end if;
    return new_task;
  end if;

  new_task := public.clone_task(source_task_id, next_task_name);
  update private.mutation_requests
  set resource_id = new_task.id
  where user_id = (select auth.uid()) and idempotency_key = request_id;
  return new_task;
end;
$$;

revoke all on function public.clone_task(uuid, text) from authenticated;
revoke all on function public.clone_task(uuid, text, uuid) from public, anon;
grant execute on function public.clone_task(uuid, text, uuid) to authenticated;
