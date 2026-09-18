-- Keep legacy text for search, notifications and old clients. Rich content is rendered
-- from a validated JSON tree, never injected as HTML.
begin;
alter table public.tasks add column description_richtext jsonb;
alter table public.tasks add constraint task_richtext_size check (
  description_richtext is null or (
    jsonb_typeof(description_richtext) = 'object'
    and description_richtext->>'type' = 'doc'
    and octet_length(description_richtext::text) <= 100000
  )
);

create table public.task_images (
  id uuid primary key,
  task_id uuid references public.tasks(id) on delete cascade,
  intended_task_id uuid references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  sort_order integer not null default 0,
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index task_images_task_order on public.task_images(task_id, sort_order);
create index task_images_uploader on public.task_images(uploaded_by, created_at);
create index task_images_intended_task on public.task_images(intended_task_id);
alter table public.task_images enable row level security;
revoke all on public.task_images from anon, authenticated;
grant select on public.task_images to authenticated;
create policy task_images_read on public.task_images for select to authenticated using (
  (select private.is_active_user()) and (
    (task_id is null and uploaded_by = (select auth.uid()))
    or (task_id is not null and private.can_view_task(task_id)
      and exists (select 1 from public.tasks t where t.id = task_id and not t.is_deleted)
      and (not is_removed or private.can_edit_task(task_id)))
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', false, 3145728, array['image/jpeg','image/png','image/webp']);

create policy task_image_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'task-images' and exists (
    select 1 from public.task_images i where i.storage_path = name
      and (not i.is_removed or (i.task_id is null and i.uploaded_by = (select auth.uid())) or private.can_edit_task(i.task_id))
  )
);
create policy task_image_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-images' and (select private.is_active_user()) and exists (
    select 1 from public.task_images i where i.storage_path = name
      and i.uploaded_by = (select auth.uid()) and i.task_id is null and not i.is_removed
      and i.created_at > now() - interval '24 hours'
      and (i.intended_task_id is null or private.can_edit_task(i.intended_task_id))
  )
);
-- Never overwrite an attached object. Removal happens only after the save commits.
create policy task_image_objects_delete on storage.objects for delete to authenticated using (
  bucket_id = 'task-images' and (select private.is_active_user()) and exists (
    select 1 from public.task_images i where i.storage_path = name and i.is_removed
      and ((i.task_id is null and i.uploaded_by = (select auth.uid())) or private.can_edit_task(i.task_id))
  )
);

create function private.reserve_task_image(next_id uuid, target_task_id uuid, next_file_name text, next_mime_type text, next_size integer)
returns public.task_images language plpgsql security definer set search_path = '' as $$
declare image public.task_images; extension text;
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  if target_task_id is not null and (not private.can_edit_task(target_task_id)
    or not exists(select 1 from public.tasks where id = target_task_id and not is_deleted)) then raise exception 'EDIT_PERMISSION_REQUIRED'; end if;
  extension := case next_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if extension is null or next_size is null or next_size not between 1 and 3145728 then raise exception 'INVALID_IMAGE_MAX_3_MB'; end if;
  -- Serialise reservations per user to enforce a bounded staging area.
  perform 1 from public.profiles where id = (select auth.uid()) for update;
  select * into image from public.task_images where id = next_id;
  if found then
    if image.uploaded_by <> (select auth.uid()) or image.task_id is not null or image.is_removed
      or image.intended_task_id is distinct from target_task_id or image.file_name <> next_file_name
      or image.mime_type <> next_mime_type or image.size_bytes <> next_size then raise exception 'IMAGE_ID_REUSED'; end if;
    return image;
  end if;
  if (select count(*) from public.task_images where uploaded_by = (select auth.uid()) and task_id is null and not is_removed and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'TOO_MANY_PENDING_IMAGES';
  end if;
  insert into public.task_images(id, intended_task_id, uploaded_by, storage_path, file_name, mime_type, size_bytes)
  values (next_id, target_task_id, (select auth.uid()), (select auth.uid())::text || '/' || next_id::text || '.' || extension, next_file_name, next_mime_type, next_size)
  returning * into image;
  return image;
end $$;
create function public.reserve_task_image(next_id uuid, target_task_id uuid, next_file_name text, next_mime_type text, next_size integer)
returns public.task_images language sql security invoker set search_path = '' as $$
  select private.reserve_task_image(next_id, target_task_id, next_file_name, next_mime_type, next_size);
$$;

create function private.discard_task_images(image_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  if cardinality(image_ids) > 30 then raise exception 'TOO_MANY_IMAGES'; end if;
  update public.task_images set is_removed = true
  where id = any(image_ids) and uploaded_by = (select auth.uid()) and task_id is null;
end $$;
create function public.discard_task_images(image_ids uuid[])
returns void language sql security invoker set search_path = '' as $$ select private.discard_task_images(image_ids); $$;

create function private.save_task_content(target_task_id uuid, payload jsonb, image_ids uuid[], request_id uuid, expected_updated_at timestamptz)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  saved public.tasks;
  previous private.mutation_requests;
  image public.task_images;
  image_id uuid;
  position integer := 0;
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  if request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if target_task_id is not null and not private.can_edit_task(target_task_id) then raise exception 'EDIT_PERMISSION_REQUIRED'; end if;
  insert into private.mutation_requests(user_id, idempotency_key, operation, resource_id)
  values ((select auth.uid()), request_id, 'SAVE_TASK_CONTENT', target_task_id) on conflict do nothing;
  if not found then
    select * into previous from private.mutation_requests where user_id = (select auth.uid()) and idempotency_key = request_id;
    if previous.operation <> 'SAVE_TASK_CONTENT' or (target_task_id is not null and previous.resource_id is distinct from target_task_id) then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    select * into saved from public.tasks where id = previous.resource_id and not is_deleted;
    if saved.id is null or not private.can_edit_task(saved.id) then raise exception 'EDIT_PERMISSION_REQUIRED'; end if;
    return saved;
  end if;
  if image_ids is null or cardinality(image_ids) > 10 or cardinality(image_ids) <> (select count(distinct value) from unnest(image_ids) value) then raise exception 'INVALID_GALLERY_MAX_10'; end if;
  if target_task_id is not null then
    select * into saved from public.tasks where id = target_task_id and not is_deleted for update;
    if saved.id is null then raise exception 'TASK_NOT_FOUND'; end if;
    if expected_updated_at is null or saved.updated_at is distinct from expected_updated_at then raise exception 'TASK_CHANGED_RELOAD'; end if;
  end if;
  -- Lock images before claiming them, preventing reuse by two concurrent saves.
  perform 1 from public.task_images where id = any(image_ids) order by id for update;
  foreach image_id in array image_ids loop
    select * into image from public.task_images where id = image_id;
    if image.id is null or image.is_removed or not coalesce((
      (image.task_id = target_task_id and target_task_id is not null)
      or (image.task_id is null and image.uploaded_by = (select auth.uid())
        and image.intended_task_id is not distinct from target_task_id)
    ), false) then raise exception 'INVALID_TASK_IMAGE'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'task-images' and o.name = image.storage_path
      and (o.metadata->>'size')::bigint = image.size_bytes and o.metadata->>'mimetype' = image.mime_type) then raise exception 'IMAGE_UPLOAD_INCOMPLETE'; end if;
  end loop;
  if target_task_id is null then
    saved := public.create_task_with_items(payload->>'task_name', payload->>'description', (payload->>'category_id')::uuid, payload->'checklist_items', coalesce(payload->'shares','[]'::jsonb));
  else
    saved := public.update_task_with_items(target_task_id, payload->>'task_name', payload->>'description', (payload->>'category_id')::uuid, payload->'checklist_items', payload->'shares');
  end if;
  update public.tasks set description_richtext = nullif(payload->'description_richtext', 'null'::jsonb),
    due_at = nullif(payload->>'due_at','')::timestamptz, due_timezone = 'Asia/Bangkok' where id = saved.id;
  update public.task_images set is_removed = true where task_id = saved.id and not is_removed and not (id = any(image_ids));
  foreach image_id in array image_ids loop
    position := position + 1;
    update public.task_images set task_id = saved.id, sort_order = position where id = image_id;
  end loop;
  update private.mutation_requests set resource_id = saved.id where user_id = (select auth.uid()) and idempotency_key = request_id;
  select * into saved from public.tasks where id = saved.id;
  return saved;
end $$;
create function public.save_task_content(target_task_id uuid, payload jsonb, image_ids uuid[], request_id uuid, expected_updated_at timestamptz default null)
returns public.tasks language sql security invoker set search_path = '' as $$
  select private.save_task_content(target_task_id, payload, image_ids, request_id, expected_updated_at);
$$;

revoke all on function private.reserve_task_image(uuid,uuid,text,text,integer), public.reserve_task_image(uuid,uuid,text,text,integer),
  private.discard_task_images(uuid[]), public.discard_task_images(uuid[]),
  private.save_task_content(uuid,jsonb,uuid[],uuid,timestamptz), public.save_task_content(uuid,jsonb,uuid[],uuid,timestamptz) from public, anon;
grant execute on function private.reserve_task_image(uuid,uuid,text,text,integer), public.reserve_task_image(uuid,uuid,text,text,integer),
  private.discard_task_images(uuid[]), public.discard_task_images(uuid[]),
  private.save_task_content(uuid,jsonb,uuid[],uuid,timestamptz), public.save_task_content(uuid,jsonb,uuid[],uuid,timestamptz) to authenticated;

commit;
