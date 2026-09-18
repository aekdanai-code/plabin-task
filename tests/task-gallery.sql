-- Run against a local database with the app migrations and auth/storage schemas.
-- Test fixtures are rolled back, including all task/share/notification changes.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
('10000000-0000-4000-8000-000000000001','gallery-owner@example.test'),
('10000000-0000-4000-8000-000000000002','gallery-viewer@example.test'),
('10000000-0000-4000-8000-000000000003','gallery-editor@example.test'),
('10000000-0000-4000-8000-000000000004','gallery-outsider@example.test');
insert into public.categories(id,category_name,color) values ('20000000-0000-4000-8000-000000000001','Gallery test','#007AFF');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.reserve_task_image('30000000-0000-4000-8000-000000000001',null,'one.png','image/png',3145728);
select public.reserve_task_image('30000000-0000-4000-8000-000000000002',null,'two.png','image/png',100);
do $$ begin
  begin
    perform public.reserve_task_image('30000000-0000-4000-8000-000000000003',null,'oversized.png','image/png',3145729);
    raise exception 'TEST_ACCEPTED_OVERSIZE';
  exception when others then if sqlerrm <> 'INVALID_IMAGE_MAX_3_MB' then raise; end if; end;
  begin
    perform public.reserve_task_image('30000000-0000-4000-8000-000000000003',null,'script.svg','image/svg+xml',100);
    raise exception 'TEST_ACCEPTED_SVG';
  exception when others then if sqlerrm <> 'INVALID_IMAGE_MAX_3_MB' then raise; end if; end;
end $$;
insert into storage.objects(bucket_id,name,metadata)
select 'task-images',storage_path,jsonb_build_object('size',size_bytes,'mimetype',mime_type) from public.task_images where uploaded_by=auth.uid();
select public.save_task_content(null,
'{"task_name":"Gallery original","description":"Hello","description_richtext":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello","marks":[{"type":"bold"}]}]}]},"category_id":"20000000-0000-4000-8000-000000000001","checklist_items":[{"item_name":"Check","weight":1}],"shares":[{"user_id":"10000000-0000-4000-8000-000000000002","permission":"VIEWER"},{"user_id":"10000000-0000-4000-8000-000000000003","permission":"EDITOR"}]}',
array['30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001']::uuid[], '40000000-0000-4000-8000-000000000001', null);
select public.save_task_content(null,'{}',array[]::uuid[],'40000000-0000-4000-8000-000000000001',null);
do $$ begin
  if (select count(*) from public.tasks where task_name='Gallery original') <> 1 then raise exception 'DUPLICATE_TASK'; end if;
  if (select sort_order from public.task_images where file_name='two.png') <> 1 then raise exception 'ORDER_LOST'; end if;
  if (select count(*) from storage.objects where bucket_id='task-images') <> 2 then raise exception 'OWNER_CANNOT_READ'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare tid uuid; begin
  select id into tid from public.tasks where task_name='Gallery original';
  if tid is null or (select count(*) from public.task_images) <> 2 or (select count(*) from storage.objects where bucket_id='task-images') <> 2 then raise exception 'VIEWER_CANNOT_READ'; end if;
  begin
    perform public.reserve_task_image('30000000-0000-4000-8000-000000000003',tid,'three.png','image/png',100);
    raise exception 'VIEWER_UPLOADED';
  exception when others then if sqlerrm <> 'EDIT_PERMISSION_REQUIRED' then raise; end if; end;
  begin
    perform public.save_task_content(tid,'{}',array[]::uuid[],'40000000-0000-4000-8000-000000000002',null);
    raise exception 'VIEWER_EDITED';
  exception when others then if sqlerrm <> 'EDIT_PERMISSION_REQUIRED' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
do $$ begin
  if exists(select 1 from public.task_images) or exists(select 1 from storage.objects where bucket_id='task-images') then raise exception 'OUTSIDER_CAN_READ'; end if;
  begin
    perform public.save_task_content(null,'{}',array['30000000-0000-4000-8000-000000000001']::uuid[],'40000000-0000-4000-8000-000000000003',null);
    raise exception 'FOREIGN_IMAGE_CLAIMED';
  exception when others then if sqlerrm <> 'INVALID_TASK_IMAGE' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ declare t public.tasks; p jsonb; begin
  select * into t from public.tasks where task_name='Gallery original';
  p := jsonb_build_object('task_name','Gallery updated','description','Updated','category_id',t.category_id,'checklist_items',jsonb_build_array(jsonb_build_object('id',(select id from public.checklist_items where task_id=t.id limit 1),'item_name','Check','weight',1,'is_checked',false)));
  begin
    perform public.save_task_content(t.id,p,array[]::uuid[],'40000000-0000-4000-8000-000000000004',t.updated_at-interval '1 second');
    raise exception 'STALE_WRITE_ACCEPTED';
  exception when others then if sqlerrm <> 'TASK_CHANGED_RELOAD' then raise; end if; end;
  perform public.reserve_task_image('30000000-0000-4000-8000-000000000003',t.id,'missing.png','image/png',100);
  begin
    perform public.save_task_content(t.id,p,array['30000000-0000-4000-8000-000000000003']::uuid[],'40000000-0000-4000-8000-000000000005',t.updated_at);
    raise exception 'MISSING_IMAGE_ACCEPTED';
  exception when others then if sqlerrm <> 'IMAGE_UPLOAD_INCOMPLETE' then raise; end if; end;
  if (select task_name from public.tasks where id=t.id) <> 'Gallery original' or (select count(*) from public.task_images where task_id=t.id and not is_removed) <> 2 then raise exception 'NON_ATOMIC_SAVE'; end if;
  perform public.discard_task_images(array['30000000-0000-4000-8000-000000000003']::uuid[]);
  if (select count(*) from public.task_images where task_id=t.id and not is_removed) <> 2 then raise exception 'CANCEL_DELETED_EXISTING'; end if;
  perform public.save_task_content(t.id,p,array['30000000-0000-4000-8000-000000000002']::uuid[],'40000000-0000-4000-8000-000000000006',t.updated_at);
  if (select count(*) from public.task_images where task_id=t.id and not is_removed) <> 1 then raise exception 'REMOVE_FAILED'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.task_images) <> 1 or (select count(*) from storage.objects where bucket_id='task-images') <> 1 then raise exception 'REMOVED_IMAGE_VISIBLE'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
delete from storage.objects where bucket_id='task-images' and name like '%30000000-0000-4000-8000-000000000001%';
do $$ begin
  if exists(select 1 from storage.objects where name like '%30000000-0000-4000-8000-000000000001%') then raise exception 'CLEANUP_DENIED'; end if;
end $$;
reset role;
rollback;
select 'PASS: size, MIME, atomic save, ordering, retry, viewer/outsider permissions, stale write, cancel and removal' as result;
