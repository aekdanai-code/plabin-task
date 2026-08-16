begin;

create extension if not exists pgmq;
create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.tasks
  add column if not exists due_at timestamptz,
  add column if not exists due_timezone text not null default 'Asia/Bangkok';

alter table public.notifications
  add column if not exists event_id uuid,
  add column if not exists event_type text,
  add column if not exists delivery_channel_override text check (delivery_channel_override is null or delivery_channel_override in ('EMAIL', 'LINE')),
  add column if not exists is_in_app_visible boolean not null default true;

create table if not exists public.notification_system_settings (
  id boolean primary key default true check (id),
  is_enabled boolean not null default true,
  app_base_url text not null default 'http://localhost:3000',
  timezone text not null default 'Asia/Bangkok',
  max_retry_attempts integer not null default 3 check (max_retry_attempts between 1 and 10),
  retry_delays_minutes integer[] not null default array[1, 5, 30],
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_channel_config (
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  smtp_host text,
  smtp_port integer not null default 587 check (smtp_port between 1 and 65535),
  smtp_security text not null default 'STARTTLS' check (smtp_security in ('TLS', 'STARTTLS', 'NONE')),
  smtp_username text,
  smtp_password_secret_id uuid,
  from_name text not null default 'Plabin Task',
  from_email text,
  reply_to_email text,
  connection_timeout_seconds integer not null default 15 check (connection_timeout_seconds between 3 and 120),
  last_test_status text check (last_test_status is null or last_test_status in ('PENDING', 'SUCCESS', 'FAILED')),
  last_test_error text,
  last_tested_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.line_channel_config (
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  official_account_name text,
  official_account_basic_id text,
  channel_id text,
  channel_access_token_secret_id uuid,
  channel_secret_secret_id uuid,
  add_friend_url text,
  webhook_url text,
  last_test_status text check (last_test_status is null or last_test_status in ('PENDING', 'SUCCESS', 'FAILED')),
  last_test_error text,
  last_tested_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_event_rules (
  event_type text primary key,
  display_name text not null,
  description text not null default '',
  is_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  line_enabled boolean not null default true,
  cooldown_minutes integer not null default 0 check (cooldown_minutes between 0 and 10080),
  reminder_offsets_minutes integer[] not null default '{}',
  overdue_repeat_minutes integer not null default 0 check (overdue_repeat_minutes between 0 and 525600),
  overdue_max_occurrences integer not null default 1 check (overdue_max_occurrences between 1 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (event_type in (
    'TASK_SHARED', 'TASK_UPDATED_MANUAL', 'TASK_EDITED',
    'CHECKLIST_CHECKED', 'CHECKLIST_UNCHECKED', 'TASK_COMPLETED', 'TASK_REOPENED',
    'TASK_ARCHIVED', 'TASK_RESTORED', 'TASK_DUE_SOON', 'TASK_OVERDUE'
  ))
);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null references public.notification_event_rules(event_type) on delete cascade,
  channel text not null check (channel in ('IN_APP', 'EMAIL', 'LINE')),
  locale text not null default 'th',
  subject_template text not null check (char_length(subject_template) between 1 and 300),
  body_text_template text not null check (char_length(body_text_template) between 1 and 5000),
  body_html_template text,
  template_version integer not null default 1 check (template_version > 0),
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (event_type, channel, locale)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null references public.notification_event_rules(event_type),
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  suppressed_reason text
);

alter table public.notifications
  drop constraint if exists notifications_event_id_fkey;
alter table public.notifications
  add constraint notifications_event_id_fkey foreign key (event_id) references public.notification_events(id) on delete set null;

create table if not exists public.user_notification_channels (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_address text,
  email_verified_at timestamptz,
  line_user_id text unique,
  line_link_status text not null default 'NOT_LINKED' check (line_link_status in ('NOT_LINKED', 'PENDING', 'LINKED', 'BLOCKED')),
  line_linked_at timestamptz,
  line_blocked_at timestamptz,
  last_line_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null references public.notification_event_rules(event_type) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  line_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_type)
);

create table if not exists private.line_link_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists private.notification_schedule_markers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null,
  schedule_key text not null,
  created_at timestamptz not null default now(),
  primary key (task_id, event_type, schedule_key)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('EMAIL', 'LINE')),
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'SENT', 'RETRYING', 'FAILED', 'SKIPPED')),
  destination_masked text,
  attempt_count integer not null default 0,
  provider_message_id text,
  rendered_subject text,
  rendered_body text,
  last_error_code text,
  last_error_message text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists idx_tasks_due on public.tasks (due_at) where due_at is not null and not is_deleted and not is_archived;
create index if not exists idx_notification_events_task_time on public.notification_events (task_id, occurred_at desc);
create index if not exists idx_notifications_event on public.notifications (event_id);
create index if not exists idx_notification_deliveries_status on public.notification_deliveries (status, next_retry_at, created_at);

do $$
begin
  if not exists (select 1 from pg_class where relnamespace = 'pgmq'::regnamespace and relname = 'q_notification_deliveries') then
    perform pgmq.create('notification_deliveries');
  end if;
end;
$$;

insert into public.notification_system_settings (id) values (true) on conflict (id) do nothing;
insert into public.email_channel_config (id) values (true) on conflict (id) do nothing;
insert into public.line_channel_config (id) values (true) on conflict (id) do nothing;

insert into public.notification_event_rules (event_type, display_name, description, cooldown_minutes, reminder_offsets_minutes)
values
  ('TASK_SHARED', 'ได้รับการแชร์ Task', 'แจ้งสมาชิกที่ได้รับสิทธิ์เข้าถึง Task ใหม่', 0, '{}'),
  ('TASK_UPDATED_MANUAL', 'ทีมกดแจ้งการอัปเดต', 'แจ้งเมื่อ Owner หรือ Editor กดปุ่มแจ้งทีม', 1, '{}'),
  ('TASK_EDITED', 'Task ถูกแก้ไข', 'แจ้งเมื่อข้อมูล Task ถูกแก้ไข', 5, '{}'),
  ('CHECKLIST_CHECKED', 'Checklist ถูกติ๊ก', 'แจ้งเมื่อมีผู้ทำ Checklist สำเร็จ', 0, '{}'),
  ('CHECKLIST_UNCHECKED', 'Checklist ถูกยกเลิก', 'แจ้งเมื่อมีผู้ยกเลิก Checklist', 0, '{}'),
  ('TASK_COMPLETED', 'Task เสร็จสิ้น', 'แจ้งเมื่อ Progress ถึง 100%', 0, '{}'),
  ('TASK_REOPENED', 'Task ถูกเปิดใหม่', 'แจ้งเมื่อ Task ที่เสร็จแล้วกลับมาดำเนินการ', 0, '{}'),
  ('TASK_ARCHIVED', 'Task ถูก Archive', 'แจ้งผู้ร่วมงานเมื่อเจ้าของ Archive Task', 0, '{}'),
  ('TASK_RESTORED', 'Task ถูก Restore', 'แจ้งผู้ร่วมงานเมื่อเจ้าของ Restore Task', 0, '{}'),
  ('TASK_DUE_SOON', 'Task ใกล้ครบกำหนด', 'แจ้งล่วงหน้าตามเวลาที่ Admin กำหนด', 0, array[1440, 60]),
  ('TASK_OVERDUE', 'Task เกินกำหนด', 'แจ้งเมื่อ Task เกินกำหนดและยังไม่เสร็จ', 0, '{}')
on conflict (event_type) do nothing;

insert into public.notification_templates (
  event_type, channel, locale, subject_template, body_text_template, body_html_template
)
select
  rule.event_type,
  channel.channel,
  'th',
  '{{event_title}}: {{task_name}}',
  case channel.channel
    when 'IN_APP' then '{{actor_name}}{{event_message}}'
    else E'{{event_title}}\n\nTask: {{task_name}}\nผู้ดำเนินการ: {{actor_name}}\nสถานะ: {{progress}}%\nกำหนดส่ง: {{due_at}}\n\nดูรายละเอียด: {{task_url}}'
  end,
  case when channel.channel = 'EMAIL' then
    '<h2>{{event_title}}</h2><p><strong>Task:</strong> {{task_name}}</p><p><strong>ผู้ดำเนินการ:</strong> {{actor_name}}</p><p><strong>สถานะ:</strong> {{progress}}%</p><p><strong>กำหนดส่ง:</strong> {{due_at}}</p><p><a href="{{task_url}}">ดูรายละเอียด Task</a></p>'
  else null end
from public.notification_event_rules rule
cross join (values ('IN_APP'), ('EMAIL'), ('LINE')) as channel(channel)
on conflict (event_type, channel, locale) do nothing;

create or replace function private.notification_event_title(target_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case target_event_type
    when 'TASK_SHARED' then 'มี Task ใหม่แชร์ให้คุณ'
    when 'TASK_UPDATED_MANUAL' then 'ทีมแจ้งว่า Task มีการอัปเดต'
    when 'TASK_EDITED' then 'Task ถูกแก้ไข'
    when 'CHECKLIST_CHECKED' then 'Checklist ถูกทำสำเร็จ'
    when 'CHECKLIST_UNCHECKED' then 'Checklist ถูกยกเลิก'
    when 'TASK_COMPLETED' then 'Task เสร็จสิ้นแล้ว'
    when 'TASK_REOPENED' then 'Task ถูกเปิดใหม่'
    when 'TASK_ARCHIVED' then 'Task ถูก Archive'
    when 'TASK_RESTORED' then 'Task ถูก Restore'
    when 'TASK_DUE_SOON' then 'Task ใกล้ครบกำหนด'
    when 'TASK_OVERDUE' then 'Task เกินกำหนด'
    else 'มีการอัปเดต Task'
  end;
$$;

create or replace function private.render_notification_text(template_text text, payload jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  rendered text := coalesce(template_text, '');
  variable_name text;
begin
  foreach variable_name in array array[
    'recipient_name', 'actor_name', 'task_name', 'task_url', 'category_name',
    'progress', 'due_at', 'event_time', 'checklist_item_name', 'event_title', 'event_message'
  ] loop
    rendered := replace(rendered, '{{' || variable_name || '}}', coalesce(payload->>variable_name, '-'));
  end loop;
  return rendered;
end;
$$;

create or replace function private.emit_task_event(
  target_task_id uuid,
  target_event_type text,
  actor_user_id uuid,
  extra_payload jsonb default '{}'::jsonb,
  only_recipient_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task public.tasks;
  actor_name text;
  event_row_id uuid;
  recipient record;
  payload jsonb;
  title_text text;
  message_text text;
  template_subject text;
  template_body text;
  sent_count integer := 0;
  cooldown_value integer := 0;
begin
  select * into target_task from public.tasks where id = target_task_id;
  if target_task.id is null then return 0; end if;

  select coalesce(display_name, email, 'ระบบ') into actor_name
  from public.profiles where id = actor_user_id;

  payload := jsonb_build_object(
    'event_title', private.notification_event_title(target_event_type),
    'event_message', ' มีการอัปเดต Task "' || target_task.task_name || '"',
    'actor_name', coalesce(actor_name, 'ระบบ'),
    'task_name', target_task.task_name,
    'category_name', coalesce((select category_name from public.categories where id = target_task.category_id), '-'),
    'task_url', '/?task=' || target_task.id::text,
    'progress', trim(to_char(target_task.progress, 'FM999990D00')),
    'due_at', coalesce(to_char(target_task.due_at at time zone target_task.due_timezone, 'DD/MM/YYYY HH24:MI'), '-'),
    'event_time', to_char(now() at time zone target_task.due_timezone, 'DD/MM/YYYY HH24:MI')
  ) || coalesce(extra_payload, '{}'::jsonb);

  insert into public.notification_events (event_type, task_id, actor_id, payload_json)
  values (target_event_type, target_task_id, actor_user_id, payload)
  returning id into event_row_id;

  select cooldown_minutes into cooldown_value
  from public.notification_event_rules where event_type = target_event_type;

  select subject_template, body_text_template
  into template_subject, template_body
  from public.notification_templates
  where event_type = target_event_type and channel = 'IN_APP' and locale = 'th' and is_active;

  for recipient in
    select distinct p.id, coalesce(p.display_name, p.email) as recipient_name
    from public.profiles p
    join (
      select target_task.owner_id as user_id
      union
      select ts.user_id from public.task_shares ts where ts.task_id = target_task_id and ts.is_active
    ) recipients on recipients.user_id = p.id
    where p.is_active
      and (actor_user_id is null or p.id <> actor_user_id)
      and (only_recipient_ids is null or p.id = any(only_recipient_ids))
  loop
    if coalesce(cooldown_value, 0) > 0 and exists (
      select 1
      from public.notifications recent_notification
      where recent_notification.user_id = recipient.id
        and recent_notification.task_id = target_task_id
        and recent_notification.event_type = target_event_type
        and recent_notification.created_at >= now() - make_interval(mins => cooldown_value)
    ) then
      continue;
    end if;
    payload := payload || jsonb_build_object('recipient_name', recipient.recipient_name);
    title_text := private.render_notification_text(coalesce(template_subject, '{{event_title}}'), payload);
    message_text := private.render_notification_text(coalesce(template_body, '{{actor_name}}{{event_message}}'), payload);
    insert into public.notifications (
      user_id, task_id, type, title, message, created_by, event_id, event_type
    ) values (
      recipient.id,
      target_task_id,
      case when target_event_type = 'TASK_SHARED' then 'TASK_SHARED'::public.notification_type else 'TASK_UPDATED'::public.notification_type end,
      title_text,
      message_text,
      actor_user_id,
      event_row_id,
      target_event_type
    );
    sent_count := sent_count + 1;
  end loop;
  return sent_count;
end;
$$;

drop trigger if exists notifications_respect_preferences on public.notifications;
drop function if exists private.filter_notification_preference();

create or replace function private.prepare_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  global_enabled boolean;
  rule_enabled boolean;
  channel_enabled boolean;
  preference_enabled boolean;
begin
  new.event_type := coalesce(new.event_type, case when new.type::text = 'TASK_SHARED' then 'TASK_SHARED' else 'TASK_UPDATED_MANUAL' end);

  if new.event_id is null then
    payload := jsonb_build_object(
      'event_title', new.title,
      'event_message', new.message,
      'task_url', case when new.task_id is null then '/' else '/?task=' || new.task_id::text end,
      'task_name', coalesce((select task_name from public.tasks where id = new.task_id), 'Task'),
      'progress', coalesce((select trim(to_char(progress, 'FM999990D00')) from public.tasks where id = new.task_id), '-'),
      'due_at', coalesce((select to_char(due_at at time zone due_timezone, 'DD/MM/YYYY HH24:MI') from public.tasks where id = new.task_id), '-'),
      'actor_name', coalesce((select coalesce(display_name, email) from public.profiles where id = new.created_by), 'ระบบ'),
      'recipient_name', coalesce((select coalesce(display_name, email) from public.profiles where id = new.user_id), 'สมาชิก'),
      'event_time', to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI')
    );
    insert into public.notification_events (event_type, task_id, actor_id, payload_json)
    values (new.event_type, new.task_id, new.created_by, payload)
    returning id into new.event_id;
  end if;

  select is_enabled into global_enabled from public.notification_system_settings where id;
  select is_enabled, in_app_enabled into rule_enabled, channel_enabled
  from public.notification_event_rules where event_type = new.event_type;
  select in_app_enabled into preference_enabled
  from public.user_notification_preferences
  where user_id = new.user_id and event_type = new.event_type;

  new.is_in_app_visible := coalesce(global_enabled, true)
    and coalesce(rule_enabled, true)
    and coalesce(channel_enabled, true)
    and coalesce(preference_enabled, true)
    and new.delivery_channel_override is null;
  return new;
end;
$$;

create trigger notifications_prepare
before insert on public.notifications
for each row execute function private.prepare_notification();

create or replace function private.create_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  global_enabled boolean;
  max_attempts integer;
  rule_row public.notification_event_rules;
  email_row public.email_channel_config;
  line_row public.line_channel_config;
  recipient_email text;
  recipient_line text;
  email_preference boolean;
  line_preference boolean;
  delivery_id uuid;
begin
  select is_enabled, max_retry_attempts into global_enabled, max_attempts
  from public.notification_system_settings where id;
  select * into rule_row from public.notification_event_rules where event_type = new.event_type;
  if new.delivery_channel_override is null
    and (not coalesce(global_enabled, true) or not coalesce(rule_row.is_enabled, true)) then return new; end if;

  select * into email_row from public.email_channel_config where id;
  select * into line_row from public.line_channel_config where id;
  select coalesce(unc.email_address, p.email), unc.line_user_id
  into recipient_email, recipient_line
  from public.profiles p
  left join public.user_notification_channels unc on unc.user_id = p.id
  where p.id = new.user_id;
  select email_enabled, line_enabled into email_preference, line_preference
  from public.user_notification_preferences
  where user_id = new.user_id and event_type = new.event_type;

  if new.delivery_channel_override = 'EMAIL' or (
    new.delivery_channel_override is null
    and coalesce(rule_row.email_enabled, true) and coalesce(email_preference, true)
  ) then
    insert into public.notification_deliveries (notification_id, user_id, channel, status, destination_masked, last_error_code)
    values (
      new.id, new.user_id, 'EMAIL',
      case when coalesce(email_row.is_enabled, false) and recipient_email is not null then 'PENDING' else 'SKIPPED' end,
      case when recipient_email is null then null else regexp_replace(recipient_email, '(^.).*(@.*$)', E'\\1***\\2') end,
      case when not coalesce(email_row.is_enabled, false) then 'CHANNEL_DISABLED' when recipient_email is null then 'DESTINATION_MISSING' else null end
    )
    on conflict (notification_id, channel) do nothing
    returning id into delivery_id;
    if delivery_id is not null and coalesce(email_row.is_enabled, false) and recipient_email is not null then
      begin
        perform pgmq.send('notification_deliveries', jsonb_build_object('delivery_id', delivery_id));
      exception when others then
        update public.notification_deliveries
        set status = 'FAILED', last_error_code = 'QUEUE_ENQUEUE_FAILED', last_error_message = left(sqlerrm, 1000)
        where id = delivery_id;
      end;
    end if;
  end if;

  delivery_id := null;
  if new.delivery_channel_override = 'LINE' or (
    new.delivery_channel_override is null
    and coalesce(rule_row.line_enabled, true) and coalesce(line_preference, true)
  ) then
    insert into public.notification_deliveries (notification_id, user_id, channel, status, destination_masked, last_error_code)
    values (
      new.id, new.user_id, 'LINE',
      case when coalesce(line_row.is_enabled, false) and recipient_line is not null then 'PENDING' else 'SKIPPED' end,
      case when recipient_line is null then null else left(recipient_line, 5) || '***' || right(recipient_line, 4) end,
      case when not coalesce(line_row.is_enabled, false) then 'CHANNEL_DISABLED' when recipient_line is null then 'LINE_NOT_LINKED' else null end
    )
    on conflict (notification_id, channel) do nothing
    returning id into delivery_id;
    if delivery_id is not null and coalesce(line_row.is_enabled, false) and recipient_line is not null then
      begin
        perform pgmq.send('notification_deliveries', jsonb_build_object('delivery_id', delivery_id));
      exception when others then
        update public.notification_deliveries
        set status = 'FAILED', last_error_code = 'QUEUE_ENQUEUE_FAILED', last_error_message = left(sqlerrm, 1000)
        where id = delivery_id;
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger notifications_create_deliveries
after insert on public.notifications
for each row execute function private.create_notification_deliveries();

create or replace function private.guard_user_notification_channel_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') and not private.is_admin() then
    if tg_op = 'INSERT' and (new.line_user_id is not null or new.line_link_status <> 'NOT_LINKED') then raise exception 'LINE_LINK_FLOW_REQUIRED'; end if;
    if tg_op = 'UPDATE' and (
      new.line_user_id is distinct from old.line_user_id
      or new.line_link_status is distinct from old.line_link_status
      or new.line_linked_at is distinct from old.line_linked_at
      or new.line_blocked_at is distinct from old.line_blocked_at
    ) then raise exception 'LINE_LINK_FLOW_REQUIRED'; end if;
  end if;
  return new;
end;
$$;

create trigger user_notification_channels_guard_identity
before insert or update on public.user_notification_channels
for each row execute function private.guard_user_notification_channel_identity();

create or replace function public.emit_task_notification(
  target_task_id uuid,
  target_event_type text,
  event_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  if target_event_type not in (
    'TASK_UPDATED_MANUAL', 'TASK_EDITED', 'CHECKLIST_CHECKED', 'CHECKLIST_UNCHECKED',
    'TASK_COMPLETED', 'TASK_REOPENED', 'TASK_ARCHIVED', 'TASK_RESTORED'
  ) then raise exception 'INVALID_NOTIFICATION_EVENT'; end if;
  if target_event_type in ('CHECKLIST_CHECKED', 'CHECKLIST_UNCHECKED') then
    if not private.can_check_task(target_task_id) then raise exception 'CHECK_PERMISSION_REQUIRED'; end if;
  elsif not private.can_edit_task(target_task_id) and private.task_access_level(target_task_id) <> 'OWNER' then
    raise exception 'EDIT_PERMISSION_REQUIRED';
  end if;
  return private.emit_task_event(target_task_id, target_event_type, (select auth.uid()), event_payload, null);
end;
$$;

create or replace function public.set_notification_secret(secret_name text, secret_value text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if secret_name not in ('notification_smtp_password', 'notification_line_access_token', 'notification_line_channel_secret') then
    raise exception 'INVALID_SECRET_NAME';
  end if;
  if nullif(secret_value, '') is null then raise exception 'SECRET_REQUIRED'; end if;
  select id into secret_id from vault.secrets where name = secret_name;
  if secret_id is null then
    select vault.create_secret(secret_value, secret_name, 'Plabin Task notification integration') into secret_id;
  else
    perform vault.update_secret(secret_id, secret_value, secret_name, 'Plabin Task notification integration');
  end if;
  return secret_id;
end;
$$;

create or replace function public.get_notification_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;

create or replace function public.complete_line_link(link_token_hash text, target_line_user_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_user_id uuid;
begin
  select user_id into linked_user_id
  from private.line_link_tokens
  where token_hash = link_token_hash and expires_at > now();
  if linked_user_id is null then raise exception 'INVALID_OR_EXPIRED_LINK_CODE'; end if;
  insert into public.user_notification_channels (user_id, line_user_id, line_link_status, line_linked_at)
  values (linked_user_id, target_line_user_id, 'LINKED', now())
  on conflict (user_id) do update
    set line_user_id = excluded.line_user_id,
        line_link_status = 'LINKED',
        line_linked_at = now(),
        line_blocked_at = null,
        last_line_error = null;
  delete from private.line_link_tokens where user_id = linked_user_id;
  return linked_user_id;
end;
$$;

create or replace function public.issue_line_link_token(link_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  expires timestamptz := now() + interval '15 minutes';
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  if link_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_LINK_TOKEN_HASH'; end if;
  insert into private.line_link_tokens (user_id, token_hash, expires_at)
  values ((select auth.uid()), link_token_hash, expires)
  on conflict (user_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now();
  insert into public.user_notification_channels (user_id, line_link_status)
  values ((select auth.uid()), 'PENDING')
  on conflict (user_id) do update set line_link_status = case when public.user_notification_channels.line_user_id is null then 'PENDING' else public.user_notification_channels.line_link_status end;
  return expires;
end;
$$;

create or replace function public.unlink_own_line()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_active_user() then raise exception 'ACTIVE_LOGIN_REQUIRED'; end if;
  insert into public.user_notification_channels (user_id, line_user_id, line_link_status)
  values ((select auth.uid()), null, 'NOT_LINKED')
  on conflict (user_id) do update
    set line_user_id = null, line_link_status = 'NOT_LINKED', line_linked_at = null,
        line_blocked_at = null, last_line_error = null;
end;
$$;

create or replace function public.claim_notification_delivery_messages(batch_size integer default 10)
returns table (queue_message_id bigint, delivery_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  queue_row record;
  claimed_delivery uuid;
begin
  for queue_row in
    select * from pgmq.read(queue_name => 'notification_deliveries', vt => 120, qty => least(greatest(batch_size, 1), 50))
  loop
    claimed_delivery := (queue_row.message->>'delivery_id')::uuid;
    update public.notification_deliveries
    set status = 'PROCESSING', attempt_count = attempt_count + 1, updated_at = now()
    where id = claimed_delivery and status in ('PENDING', 'RETRYING', 'PROCESSING');
    if found then
      queue_message_id := queue_row.msg_id;
      delivery_id := claimed_delivery;
      return next;
    else
      perform pgmq.archive('notification_deliveries', queue_row.msg_id);
    end if;
  end loop;
end;
$$;

create or replace function public.record_notification_delivery_result(
  queue_message_id bigint,
  target_delivery_id uuid,
  succeeded boolean,
  next_provider_message_id text default null,
  next_rendered_subject text default null,
  next_rendered_body text default null,
  error_code text default null,
  error_message text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_attempts integer;
  retry_limit integer;
  retry_delays integer[];
  retry_delay integer;
begin
  select attempt_count into delivery_attempts from public.notification_deliveries where id = target_delivery_id;
  select max_retry_attempts, retry_delays_minutes into retry_limit, retry_delays from public.notification_system_settings where id;
  perform pgmq.archive('notification_deliveries', queue_message_id);

  if succeeded then
    update public.notification_deliveries
    set status = 'SENT', provider_message_id = next_provider_message_id,
        rendered_subject = next_rendered_subject, rendered_body = next_rendered_body,
        last_error_code = null, last_error_message = null, next_retry_at = null,
        sent_at = now(), updated_at = now()
    where id = target_delivery_id;
    return 'SENT';
  end if;

  if delivery_attempts < coalesce(retry_limit, 3) then
    retry_delay := coalesce(retry_delays[least(delivery_attempts, cardinality(retry_delays))], 5);
    update public.notification_deliveries
    set status = 'RETRYING', rendered_subject = next_rendered_subject, rendered_body = next_rendered_body,
        last_error_code = error_code, last_error_message = left(error_message, 1000),
        next_retry_at = now() + make_interval(mins => retry_delay), updated_at = now()
    where id = target_delivery_id;
    perform pgmq.send('notification_deliveries', jsonb_build_object('delivery_id', target_delivery_id), retry_delay * 60);
    return 'RETRYING';
  end if;

  update public.notification_deliveries
  set status = 'FAILED', rendered_subject = next_rendered_subject, rendered_body = next_rendered_body,
      last_error_code = error_code, last_error_message = left(error_message, 1000),
      next_retry_at = null, updated_at = now()
  where id = target_delivery_id;
  return 'FAILED';
end;
$$;

create or replace function public.retry_notification_delivery(target_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.notification_deliveries
  set status = 'PENDING', attempt_count = 0, last_error_code = null,
      last_error_message = null, next_retry_at = null, updated_at = now()
  where id = target_delivery_id and status in ('FAILED', 'SKIPPED');
  if not found then raise exception 'DELIVERY_NOT_RETRYABLE'; end if;
  perform pgmq.send('notification_deliveries', jsonb_build_object('delivery_id', target_delivery_id));
end;
$$;

create or replace function public.queue_test_notification(target_channel text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := (select auth.uid());
  event_id uuid;
  created_notification_id uuid;
  delivery_id uuid;
  delivery_status text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if target_channel not in ('EMAIL', 'LINE') then raise exception 'INVALID_CHANNEL'; end if;
  insert into public.notification_events (event_type, actor_id, payload_json)
  values ('TASK_UPDATED_MANUAL', admin_id, jsonb_build_object(
    'event_title', 'ทดสอบระบบแจ้งเตือน', 'event_message', 'ข้อความทดสอบจาก Plabin Task',
    'task_name', 'ข้อความทดสอบ', 'task_url', '/', 'actor_name', 'Admin',
    'recipient_name', coalesce((select coalesce(display_name, email) from public.profiles where id = admin_id), 'Admin'),
    'progress', '-', 'due_at', '-', 'event_time', to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI')
  )) returning id into event_id;
  insert into public.notifications (user_id, type, title, message, created_by, event_id, event_type, delivery_channel_override, is_in_app_visible)
  values (admin_id, 'TASK_UPDATED', 'ทดสอบระบบแจ้งเตือน', 'ข้อความทดสอบจาก Plabin Task', admin_id, event_id, 'TASK_UPDATED_MANUAL', target_channel, false)
  returning id into created_notification_id;
  select id, status into delivery_id, delivery_status
  from public.notification_deliveries delivery
  where delivery.notification_id = created_notification_id and delivery.channel = target_channel;
  if delivery_id is null or delivery_status <> 'PENDING' then raise exception 'TEST_CHANNEL_OR_DESTINATION_NOT_READY'; end if;
  return delivery_id;
end;
$$;

create or replace function public.enqueue_due_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task record;
  offset_minutes integer;
  schedule_key text;
  created_count integer := 0;
  repeat_minutes integer;
  max_occurrences integer;
  occurrence integer;
begin
  for target_task in
    select t.* from public.tasks t
    where t.due_at is not null and not t.is_deleted and not t.is_archived and t.status <> 'COMPLETED'
  loop
    select min(configured_offset) into offset_minutes
    from unnest(coalesce((select reminder_offsets_minutes from public.notification_event_rules where event_type = 'TASK_DUE_SOON'), '{}')) configured_offset
    where target_task.due_at > now()
      and target_task.due_at <= now() + make_interval(mins => configured_offset);
    if offset_minutes is not null then
      schedule_key := target_task.due_at::text || ':before:' || offset_minutes::text;
      insert into private.notification_schedule_markers (task_id, event_type, schedule_key)
      values (target_task.id, 'TASK_DUE_SOON', schedule_key) on conflict do nothing;
      if found then
        perform private.emit_task_event(target_task.id, 'TASK_DUE_SOON', null, jsonb_build_object('reminder_minutes', offset_minutes), null);
        created_count := created_count + 1;
      end if;
    end if;
    if target_task.due_at <= now() then
      select overdue_repeat_minutes, overdue_max_occurrences into repeat_minutes, max_occurrences
      from public.notification_event_rules where event_type = 'TASK_OVERDUE';
      occurrence := case when coalesce(repeat_minutes, 0) = 0 then 0
        else floor(extract(epoch from (now() - target_task.due_at)) / (repeat_minutes * 60))::integer end;
      if occurrence < coalesce(max_occurrences, 1) then
        schedule_key := target_task.due_at::text || ':overdue:' || occurrence::text;
        insert into private.notification_schedule_markers (task_id, event_type, schedule_key)
        values (target_task.id, 'TASK_OVERDUE', schedule_key) on conflict do nothing;
        if found then
          perform private.emit_task_event(target_task.id, 'TASK_OVERDUE', null, jsonb_build_object('overdue_occurrence', occurrence + 1), null);
          created_count := created_count + 1;
        end if;
      end if;
    end if;
  end loop;
  return created_count;
end;
$$;

create trigger notification_system_settings_touch before update on public.notification_system_settings
for each row execute function private.touch_updated_at();
create trigger email_channel_config_touch before update on public.email_channel_config
for each row execute function private.touch_updated_at();
create trigger line_channel_config_touch before update on public.line_channel_config
for each row execute function private.touch_updated_at();
create trigger notification_event_rules_touch before update on public.notification_event_rules
for each row execute function private.touch_updated_at();
create trigger notification_templates_touch before update on public.notification_templates
for each row execute function private.touch_updated_at();
create trigger user_notification_channels_touch before update on public.user_notification_channels
for each row execute function private.touch_updated_at();
create trigger user_notification_preferences_touch before update on public.user_notification_preferences
for each row execute function private.touch_updated_at();
create trigger notification_deliveries_touch before update on public.notification_deliveries
for each row execute function private.touch_updated_at();

alter table public.notification_system_settings enable row level security;
alter table public.email_channel_config enable row level security;
alter table public.line_channel_config enable row level security;
alter table public.notification_event_rules enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_events enable row level security;
alter table public.user_notification_channels enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;
alter table private.line_link_tokens enable row level security;
alter table private.notification_schedule_markers enable row level security;

create policy notification_system_settings_admin_all on public.notification_system_settings for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy email_channel_config_admin_all on public.email_channel_config for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy line_channel_config_admin_all on public.line_channel_config for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy notification_event_rules_admin_all on public.notification_event_rules for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy notification_templates_admin_all on public.notification_templates for all to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy notification_events_admin_select on public.notification_events for select to authenticated
using (private.is_admin());
create policy user_notification_channels_select on public.user_notification_channels for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin());
create policy user_notification_channels_insert_own on public.user_notification_channels for insert to authenticated
with check (user_id = (select auth.uid()));
create policy user_notification_channels_update_own on public.user_notification_channels for update to authenticated
using (user_id = (select auth.uid()) or private.is_admin())
with check (user_id = (select auth.uid()) or private.is_admin());
create policy user_notification_preferences_select on public.user_notification_preferences for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin());
create policy user_notification_preferences_insert_own on public.user_notification_preferences for insert to authenticated
with check (user_id = (select auth.uid()));
create policy user_notification_preferences_update_own on public.user_notification_preferences for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_deliveries_admin_select on public.notification_deliveries for select to authenticated
using (private.is_admin());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
using (private.is_active_user() and user_id = (select auth.uid()) and is_in_app_visible);

revoke all on table public.notification_system_settings from anon, authenticated;
revoke all on table public.email_channel_config from anon, authenticated;
revoke all on table public.line_channel_config from anon, authenticated;
revoke all on table public.notification_event_rules from anon, authenticated;
revoke all on table public.notification_templates from anon, authenticated;
revoke all on table public.notification_events from anon, authenticated;
revoke all on table public.user_notification_channels from anon, authenticated;
revoke all on table public.user_notification_preferences from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;

-- Supabase owns and manages the Vault extension objects. A schema-wide REVOKE
-- attempts to alter internal crypto functions (for example
-- _crypto_aead_det_noncegen) and is rejected on hosted projects. Access
-- to decrypted secrets remains restricted through the explicitly protected
-- get_notification_secret RPC below; no Vault privileges are granted here.

grant select, insert, update on public.notification_system_settings to authenticated;
grant select, insert, update on public.email_channel_config to authenticated;
grant select, insert, update on public.line_channel_config to authenticated;
grant select, insert, update on public.notification_event_rules to authenticated;
grant select, insert, update on public.notification_templates to authenticated;
grant select on public.notification_events to authenticated;
grant select, insert, update on public.user_notification_channels to authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;

revoke all on function private.notification_event_title(text) from public, anon, authenticated;
revoke all on function private.render_notification_text(text, jsonb) from public, anon, authenticated;
revoke all on function private.emit_task_event(uuid, text, uuid, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function private.prepare_notification() from public, anon, authenticated;
revoke all on function private.create_notification_deliveries() from public, anon, authenticated;
revoke all on function private.guard_user_notification_channel_identity() from public, anon, authenticated;

revoke all on function public.emit_task_notification(uuid, text, jsonb) from public, anon;
grant execute on function public.emit_task_notification(uuid, text, jsonb) to authenticated;
revoke all on function public.set_notification_secret(text, text) from public, anon;
grant execute on function public.set_notification_secret(text, text) to authenticated;
revoke all on function public.get_notification_secret(text) from public, anon, authenticated;
grant execute on function public.get_notification_secret(text) to service_role;
revoke all on function public.complete_line_link(text, text) from public, anon, authenticated;
grant execute on function public.complete_line_link(text, text) to service_role;
revoke all on function public.issue_line_link_token(text) from public, anon;
grant execute on function public.issue_line_link_token(text) to authenticated;
revoke all on function public.unlink_own_line() from public, anon;
grant execute on function public.unlink_own_line() to authenticated;
revoke all on function public.claim_notification_delivery_messages(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_messages(integer) to service_role;
revoke all on function public.record_notification_delivery_result(bigint, uuid, boolean, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_notification_delivery_result(bigint, uuid, boolean, text, text, text, text, text) to service_role;
revoke all on function public.retry_notification_delivery(uuid) from public, anon;
grant execute on function public.retry_notification_delivery(uuid) to authenticated;
revoke all on function public.queue_test_notification(text) from public, anon;
grant execute on function public.queue_test_notification(text) to authenticated;
revoke all on function public.enqueue_due_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_due_notifications() to service_role;

update public.notifications set event_type = case when type::text = 'TASK_SHARED' then 'TASK_SHARED' else 'TASK_UPDATED_MANUAL' end
where event_type is null;

insert into public.user_notification_preferences (user_id, event_type, in_app_enabled)
select user_id, 'TASK_SHARED', task_shared from public.notification_preferences
on conflict (user_id, event_type) do nothing;
insert into public.user_notification_preferences (user_id, event_type, in_app_enabled)
select user_id, 'TASK_UPDATED_MANUAL', task_updated from public.notification_preferences
on conflict (user_id, event_type) do nothing;

commit;
