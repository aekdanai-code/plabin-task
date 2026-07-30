import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const checklistInputSchema = z.object({
  item_name: z.string().trim().min(1, "กรุณาระบุรายการ").max(200),
  weight: z.coerce.number().min(0, "น้ำหนักต้องมากกว่าหรือเท่ากับ 0")
});

export const taskInputSchema = z.object({
  task_name: z.string().trim().min(1, "กรุณาระบุชื่อ Task").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
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

export const notificationPreferencesSchema = z.object({
  task_shared: z.boolean(),
  task_updated: z.boolean()
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
