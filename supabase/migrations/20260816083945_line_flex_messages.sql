begin;

-- Flex Messages render the task details and action button structurally, so the
-- default LINE copy should only contain the notification summary. Preserve any
-- template that an admin has already customized.
update public.notification_templates
set
  subject_template = '{{event_title}}',
  body_text_template = '{{actor_name}}{{event_message}}',
  template_version = template_version + 1,
  updated_at = now()
where channel = 'LINE'
  and locale = 'th'
  and subject_template = '{{event_title}}: {{task_name}}'
  and body_text_template = E'{{event_title}}\n\nTask: {{task_name}}\nผู้ดำเนินการ: {{actor_name}}\nสถานะ: {{progress}}%\nกำหนดส่ง: {{due_at}}\n\nดูรายละเอียด: {{task_url}}';

commit;
