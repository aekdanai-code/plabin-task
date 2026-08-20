begin;

alter table public.checklist_notes
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;

create index idx_checklist_notes_deleted_by
on public.checklist_notes (deleted_by)
where deleted_by is not null;

drop policy if exists checklist_notes_update on public.checklist_notes;

create policy checklist_notes_update
on public.checklist_notes
for update
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_check_task(item.task_id)
  )
)
with check (
  exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_check_task(item.task_id)
  )
  and (
    (
      is_active
      and author_id = (select auth.uid())
      and deleted_at is null
      and deleted_by is null
    )
    or (
      not is_active
      and deleted_at is not null
      and deleted_by = (select auth.uid())
    )
  )
);

create or replace function private.guard_checklist_note_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.checklist_item_id is distinct from old.checklist_item_id
     or new.created_at is distinct from old.created_at then
    raise exception 'CHECKLIST_NOTE_IDENTITY_IMMUTABLE';
  end if;

  if not old.is_active then
    raise exception 'CHECKLIST_NOTE_ALREADY_INACTIVE';
  end if;

  if new.is_active then
    if new.deleted_at is not null or new.deleted_by is not null then
      raise exception 'ACTIVE_CHECKLIST_NOTE_CANNOT_BE_DELETED';
    end if;
  else
    if new.deleted_at is null or new.deleted_by is null then
      raise exception 'CHECKLIST_NOTE_DELETE_AUDIT_REQUIRED';
    end if;
    if new.content is distinct from old.content
       or new.author_id is distinct from old.author_id then
      raise exception 'CHECKLIST_NOTE_DELETE_CANNOT_EDIT_CONTENT';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_checklist_note_update() from public, anon, authenticated;

commit;
