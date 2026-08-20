begin;

create table public.checklist_notes (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index idx_checklist_notes_item_created
on public.checklist_notes (checklist_item_id, created_at);

alter table public.checklist_notes enable row level security;

create policy checklist_notes_select
on public.checklist_notes
for select
to authenticated
using (
  exists (
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
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.checklist_items item
    where item.id = checklist_item_id
      and not item.is_deleted
      and private.can_check_task(item.task_id)
  )
);

revoke all on public.checklist_notes from public, anon;
grant select, insert on public.checklist_notes to authenticated;

commit;
