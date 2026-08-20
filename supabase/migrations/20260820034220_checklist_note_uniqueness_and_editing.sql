begin;

alter table public.checklist_notes
  add column is_active boolean not null default true,
  add column updated_at timestamptz not null default now();

update public.checklist_notes
set updated_at = created_at;

-- Preserve every existing note, but expose only the newest note per checklist.
with ranked_notes as (
  select
    id,
    row_number() over (
      partition by checklist_item_id
      order by created_at desc, id desc
    ) as note_rank
  from public.checklist_notes
)
update public.checklist_notes note
set is_active = false
from ranked_notes ranked
where note.id = ranked.id
  and ranked.note_rank > 1;

create unique index idx_checklist_notes_one_active_per_item
on public.checklist_notes (checklist_item_id)
where is_active;

drop policy if exists checklist_notes_select on public.checklist_notes;
drop policy if exists checklist_notes_insert on public.checklist_notes;

create policy checklist_notes_select
on public.checklist_notes
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_view_task(item.task_id)
  )
);

create policy checklist_notes_insert
on public.checklist_notes
for insert
to authenticated
with check (
  is_active
  and author_id = (select auth.uid())
  and exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_check_task(item.task_id)
  )
);

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
  is_active
  and author_id = (select auth.uid())
  and exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_check_task(item.task_id)
  )
);

create function private.guard_checklist_note_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.checklist_item_id is distinct from old.checklist_item_id
     or new.created_at is distinct from old.created_at
     or new.is_active is distinct from old.is_active then
    raise exception 'CHECKLIST_NOTE_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_checklist_note_update
before update on public.checklist_notes
for each row execute function private.guard_checklist_note_update();

revoke all on function private.guard_checklist_note_update() from public, anon, authenticated;
grant update on public.checklist_notes to authenticated;

commit;
