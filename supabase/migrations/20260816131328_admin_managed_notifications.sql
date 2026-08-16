begin;

-- Notification delivery is controlled globally by Admin through
-- notification_system_settings and notification_event_rules. Historical
-- per-user preferences are preserved for audit/rollback purposes but are no
-- longer read by the notification pipeline or writable through the Data API.
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

  new.is_in_app_visible := coalesce(global_enabled, true)
    and coalesce(rule_enabled, true)
    and coalesce(channel_enabled, true)
    and new.delivery_channel_override is null;
  return new;
end;
$$;

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
  recipient_line_status text;
  delivery_id uuid;
begin
  select is_enabled, max_retry_attempts into global_enabled, max_attempts
  from public.notification_system_settings where id;
  select * into rule_row from public.notification_event_rules where event_type = new.event_type;
  if new.delivery_channel_override is null
    and (not coalesce(global_enabled, true) or not coalesce(rule_row.is_enabled, true)) then return new; end if;

  select * into email_row from public.email_channel_config where id;
  select * into line_row from public.line_channel_config where id;
  select coalesce(unc.email_address, p.email), unc.line_user_id, unc.line_link_status
  into recipient_email, recipient_line, recipient_line_status
  from public.profiles p
  left join public.user_notification_channels unc on unc.user_id = p.id
  where p.id = new.user_id;

  if new.delivery_channel_override = 'EMAIL' or (
    new.delivery_channel_override is null
    and coalesce(rule_row.email_enabled, true)
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
    and coalesce(rule_row.line_enabled, true)
  ) then
    insert into public.notification_deliveries (notification_id, user_id, channel, status, destination_masked, last_error_code)
    values (
      new.id, new.user_id, 'LINE',
      case when coalesce(line_row.is_enabled, false) and recipient_line is not null and recipient_line_status = 'LINKED' then 'PENDING' else 'SKIPPED' end,
      case when recipient_line is null then null else left(recipient_line, 5) || '***' || right(recipient_line, 4) end,
      case
        when not coalesce(line_row.is_enabled, false) then 'CHANNEL_DISABLED'
        when recipient_line is null or recipient_line_status is null then 'LINE_NOT_LINKED'
        when recipient_line_status <> 'LINKED' then 'LINE_' || recipient_line_status
        else null
      end
    )
    on conflict (notification_id, channel) do nothing
    returning id into delivery_id;
    if delivery_id is not null
      and coalesce(line_row.is_enabled, false)
      and recipient_line is not null
      and recipient_line_status = 'LINKED' then
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

drop policy if exists notification_preferences_select_own on public.notification_preferences;
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;
drop policy if exists user_notification_preferences_select on public.user_notification_preferences;
drop policy if exists user_notification_preferences_insert_own on public.user_notification_preferences;
drop policy if exists user_notification_preferences_update_own on public.user_notification_preferences;

revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.user_notification_preferences from anon, authenticated;

comment on table public.notification_preferences is 'Legacy per-user notification preferences; ignored by the Admin-managed notification pipeline.';
comment on table public.user_notification_preferences is 'Legacy per-event user preferences; ignored by the Admin-managed notification pipeline.';

commit;
