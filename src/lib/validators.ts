import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const checklistInputSchema = z.object({
  item_name: z.string().trim().min(1, "กรุณาระบุรายการ").max(200),
  weight: z.coerce.number().min(0, "น้ำหนักต้องมากกว่าหรือเท่ากับ 0")
});

export const taskInputSchema = z.object({
  task_name: z.string().trim().min(1, "กรุณาระบุชื่อ Task").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  due_at: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  category_id: uuidSchema,
  checklist_items: z.array(checklistInputSchema).min(1, "ต้องมี Checklist อย่างน้อย 1 รายการ"),
  shares: z
    .array(
      z.object({
        user_id: uuidSchema,
        permission: z.enum(["VIEWER", "CHECKER", "EDITOR"])
      })
    )
    .default([])
    .refine((rows) => new Set(rows.map((row) => row.user_id)).size === rows.length, "ไม่สามารถเลือกสมาชิกซ้ำได้")
});

export const taskUpdateSchema = taskInputSchema.omit({ shares: true }).extend({
  checklist_items: z
    .array(
      checklistInputSchema.extend({
        id: uuidSchema.optional(),
        is_checked: z.boolean(),
        sort_order: z.number().int().positive()
      })
    )
    .min(1, "ต้องมี Checklist อย่างน้อย 1 รายการ"),
  shares: taskInputSchema.shape.shares.optional()
});

export const shareSchema = z.object({
  user_id: uuidSchema,
  permission: z.enum(["VIEWER", "CHECKER", "EDITOR"])
});

export const categorySchema = z.object({
  category_name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "สีต้องเป็น HEX เช่น #007AFF")
});

export const memberUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
  role: z.enum(["ADMIN", "USER"]).optional(),
  is_active: z.boolean().optional()
});

export const notificationEventTypeSchema = z.enum([
  "TASK_SHARED",
  "TASK_UPDATED_MANUAL",
  "TASK_EDITED",
  "CHECKLIST_CHECKED",
  "CHECKLIST_UNCHECKED",
  "TASK_COMPLETED",
  "TASK_REOPENED",
  "TASK_ARCHIVED",
  "TASK_RESTORED",
  "TASK_DUE_SOON",
  "TASK_OVERDUE"
]);

export const notificationEventRuleSchema = z.object({
  event_type: notificationEventTypeSchema,
  is_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  email_enabled: z.boolean(),
  line_enabled: z.boolean(),
  cooldown_minutes: z.coerce.number().int().min(0).max(10080),
  reminder_offsets_minutes: z.array(z.coerce.number().int().positive().max(525600)).max(10),
  overdue_repeat_minutes: z.coerce.number().int().min(0).max(525600),
  overdue_max_occurrences: z.coerce.number().int().min(1).max(100)
});

export const notificationTemplateSchema = z.object({
  id: uuidSchema,
  subject_template: z.string().trim().min(1).max(300),
  body_text_template: z.string().trim().min(1).max(5000),
  body_html_template: z.string().max(20000).optional().nullable(),
  is_active: z.boolean()
});

export const emailChannelConfigSchema = z.object({
  is_enabled: z.boolean(),
  smtp_host: z.string().trim().max(255).optional().nullable(),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  smtp_security: z.enum(["TLS", "STARTTLS", "NONE"]),
  smtp_username: z.string().trim().max(255).optional().nullable(),
  smtp_password: z.string().max(1000).optional(),
  from_name: z.string().trim().min(1).max(120),
  from_email: z.string().email().optional().nullable().or(z.literal("")),
  reply_to_email: z.string().email().optional().nullable().or(z.literal("")),
  connection_timeout_seconds: z.coerce.number().int().min(3).max(120)
});

export const lineChannelConfigSchema = z.object({
  is_enabled: z.boolean(),
  official_account_name: z.string().trim().max(120).optional().nullable(),
  official_account_basic_id: z.string().trim().regex(/^@[A-Za-z0-9._-]+$/, "LINE Basic ID ต้องขึ้นต้นด้วย @").optional().nullable().or(z.literal("")),
  channel_id: z.string().trim().max(100).optional().nullable(),
  channel_access_token: z.string().max(2000).optional(),
  channel_secret: z.string().max(500).optional(),
  add_friend_url: z.string().url().optional().nullable().or(z.literal("")),
  webhook_url: z.string().url().optional().nullable().or(z.literal(""))
});

export const notificationSystemSettingsSchema = z.object({
  is_enabled: z.boolean(),
  app_base_url: z.string().url(),
  timezone: z.string().trim().min(1).max(100),
  max_retry_attempts: z.coerce.number().int().min(1).max(10),
  retry_delays_minutes: z.array(z.coerce.number().int().positive().max(10080)).min(1).max(10)
});

export const profileUpdateSchema = z.object({
  display_name: z.string().trim().min(1, "กรุณาระบุชื่อที่แสดง").max(120, "ชื่อที่แสดงยาวเกินไป"),
  contact_info: z.string().trim().max(200, "ข้อมูลติดต่อยาวเกินไป").optional().nullable()
});

export const passwordUpdateSchema = z
  .object({
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(72, "รหัสผ่านยาวเกินไป"),
    confirm_password: z.string()
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    path: ["confirm_password"]
  });
