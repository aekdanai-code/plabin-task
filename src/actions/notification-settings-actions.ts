"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fail, ok, toErrorResult } from "@/lib/result";
import {
  emailChannelConfigSchema,
  eventNotificationPreferenceSchema,
  lineChannelConfigSchema,
  notificationEventRuleSchema,
  notificationSystemSettingsSchema,
  notificationTemplateSchema,
  uuidSchema
} from "@/lib/validators";
import type {
  EventNotificationPreference,
  NotificationEventRule,
  NotificationTemplate,
  UserNotificationChannel
} from "@/types/app";

export async function getNotificationAdminData() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const [system, email, line, rules, templates, deliveries, members] = await Promise.all([
      supabase.from("notification_system_settings").select("*").eq("id", true).single(),
      supabase.from("email_channel_config").select("*").eq("id", true).single(),
      supabase.from("line_channel_config").select("*").eq("id", true).single(),
      supabase.from("notification_event_rules").select("*").order("event_type"),
      supabase.from("notification_templates").select("*").order("event_type").order("channel"),
      supabase.from("notification_deliveries").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("user_notification_channels").select("*").order("updated_at", { ascending: false })
    ]);
    const error = [system, email, line, rules, templates, deliveries, members].find((result) => result.error)?.error;
    if (error) return fail("LOAD_NOTIFICATION_SETTINGS_FAILED", error.message);
    return ok(
      {
        system: system.data,
        email: { ...email.data, password_configured: Boolean(email.data?.smtp_password_secret_id) },
        line: {
          ...line.data,
          access_token_configured: Boolean(line.data?.channel_access_token_secret_id),
          channel_secret_configured: Boolean(line.data?.channel_secret_secret_id)
        },
        rules: (rules.data ?? []) as NotificationEventRule[],
        templates: (templates.data ?? []) as NotificationTemplate[],
        deliveries: deliveries.data ?? [],
        members: (members.data ?? []) as UserNotificationChannel[]
      },
      "โหลดการตั้งค่าการแจ้งเตือนสำเร็จ"
    );
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateNotificationSystemSettings(payload: unknown) {
  try {
    const admin = await requireAdmin();
    const input = notificationSystemSettingsSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_system_settings")
      .update({ ...input, updated_by: admin.id })
      .eq("id", true);
    if (error) return fail("UPDATE_NOTIFICATION_SYSTEM_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "บันทึกการตั้งค่าระบบแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateNotificationEventRule(payload: unknown) {
  try {
    const admin = await requireAdmin();
    const input = notificationEventRuleSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_event_rules")
      .update({ ...input, updated_by: admin.id })
      .eq("event_type", input.event_type);
    if (error) return fail("UPDATE_NOTIFICATION_RULE_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "บันทึก Event แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateNotificationTemplate(payload: unknown) {
  try {
    const admin = await requireAdmin();
    const currentVersion = Number((payload as { template_version?: unknown }).template_version ?? 1);
    const input = notificationTemplateSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_templates")
      .update({
        subject_template: input.subject_template,
        body_text_template: input.body_text_template,
        body_html_template: input.body_html_template || null,
        is_active: input.is_active,
        template_version: Math.max(1, currentVersion + 1),
        updated_by: admin.id
      })
      .eq("id", input.id);
    if (error) return fail("UPDATE_NOTIFICATION_TEMPLATE_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "บันทึก Template แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateEmailChannelConfig(payload: unknown) {
  try {
    const admin = await requireAdmin();
    const raw = payload as Record<string, unknown>;
    const input = emailChannelConfigSchema.parse({ ...raw, is_enabled: raw.is_enabled === true || raw.is_enabled === "true" });
    const supabase = await createClient();
    let secretId: string | undefined;
    if (input.smtp_password) {
      const secret = await supabase.rpc("set_notification_secret", {
        secret_name: "notification_smtp_password",
        secret_value: input.smtp_password
      });
      if (secret.error || !secret.data) return fail("SAVE_SMTP_SECRET_FAILED", secret.error?.message ?? "บันทึก SMTP password ไม่สำเร็จ");
      secretId = String(secret.data);
    }
    const { smtp_password: _password, ...config } = input;
    const { error } = await supabase
      .from("email_channel_config")
      .update({
        ...config,
        smtp_host: config.smtp_host || null,
        smtp_username: config.smtp_username || null,
        from_email: config.from_email || null,
        reply_to_email: config.reply_to_email || null,
        ...(secretId ? { smtp_password_secret_id: secretId } : {}),
        updated_by: admin.id
      })
      .eq("id", true);
    if (error) return fail("UPDATE_EMAIL_CONFIG_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "บันทึก SMTP แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateLineChannelConfig(payload: unknown) {
  try {
    const admin = await requireAdmin();
    const raw = payload as Record<string, unknown>;
    const input = lineChannelConfigSchema.parse({ ...raw, is_enabled: raw.is_enabled === true || raw.is_enabled === "true" });
    const supabase = await createClient();
    let accessTokenSecretId: string | undefined;
    let channelSecretId: string | undefined;
    if (input.channel_access_token) {
      const secret = await supabase.rpc("set_notification_secret", {
        secret_name: "notification_line_access_token",
        secret_value: input.channel_access_token
      });
      if (secret.error || !secret.data) return fail("SAVE_LINE_TOKEN_FAILED", secret.error?.message ?? "บันทึก LINE token ไม่สำเร็จ");
      accessTokenSecretId = String(secret.data);
    }
    if (input.channel_secret) {
      const secret = await supabase.rpc("set_notification_secret", {
        secret_name: "notification_line_channel_secret",
        secret_value: input.channel_secret
      });
      if (secret.error || !secret.data) return fail("SAVE_LINE_SECRET_FAILED", secret.error?.message ?? "บันทึก LINE secret ไม่สำเร็จ");
      channelSecretId = String(secret.data);
    }
    const { channel_access_token: _token, channel_secret: _secret, ...config } = input;
    const { error } = await supabase
      .from("line_channel_config")
      .update({
        ...config,
        official_account_name: config.official_account_name || null,
        official_account_basic_id: config.official_account_basic_id || null,
        channel_id: config.channel_id || null,
        add_friend_url: config.add_friend_url || null,
        webhook_url: config.webhook_url || null,
        ...(accessTokenSecretId ? { channel_access_token_secret_id: accessTokenSecretId } : {}),
        ...(channelSecretId ? { channel_secret_secret_id: channelSecretId } : {}),
        updated_by: admin.id
      })
      .eq("id", true);
    if (error) return fail("UPDATE_LINE_CONFIG_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "บันทึก LINE Official Account แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function queueTestNotification(channel: "EMAIL" | "LINE") {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("queue_test_notification", { target_channel: channel });
    if (error || !data) return fail("QUEUE_TEST_NOTIFICATION_FAILED", error?.message ?? "สร้างข้อความทดสอบไม่สำเร็จ");
    return ok(String(data), `เพิ่มข้อความทดสอบ ${channel} เข้าคิวแล้ว`);
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function retryNotificationDelivery(deliveryId: string) {
  try {
    uuidSchema.parse(deliveryId);
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc("retry_notification_delivery", { target_delivery_id: deliveryId });
    if (error) return fail("RETRY_NOTIFICATION_FAILED", error.message);
    revalidatePath("/settings");
    return ok(null, "เพิ่มรายการกลับเข้าคิวแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function getOwnNotificationSettings() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const service = createServiceClient();
    const [preferences, channel, rules, lineConfig] = await Promise.all([
      supabase.from("user_notification_preferences").select("*").eq("user_id", user.id),
      supabase.from("user_notification_channels").select("*").eq("user_id", user.id).maybeSingle(),
      service.from("notification_event_rules").select("event_type,display_name,description,is_enabled").order("event_type"),
      service.from("line_channel_config").select("is_enabled,official_account_name,official_account_basic_id,add_friend_url").eq("id", true).single()
    ]);
    const error = [preferences, channel, rules, lineConfig].find((result) => result.error)?.error;
    if (error) return fail("LOAD_OWN_NOTIFICATION_SETTINGS_FAILED", error.message);
    return ok(
      {
        preferences: (preferences.data ?? []) as EventNotificationPreference[],
        channel: channel.data as UserNotificationChannel | null,
        rules: rules.data ?? [],
        lineConfig: lineConfig.data
      },
      "โหลดการตั้งค่าสำเร็จ"
    );
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateOwnEventPreference(payload: unknown) {
  try {
    const user = await requireUser();
    const input = eventNotificationPreferenceSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase.from("user_notification_preferences").upsert(
      { user_id: user.id, ...input },
      { onConflict: "user_id,event_type" }
    );
    if (error) return fail("UPDATE_NOTIFICATION_PREFERENCE_FAILED", error.message);
    revalidatePath("/profile");
    revalidatePath("/");
    return ok(null, "บันทึกการตั้งค่าการแจ้งเตือนแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function startLineAccountLink() {
  try {
    await requireUser();
    const code = randomBytes(4).toString("hex").toUpperCase();
    const tokenHash = createHash("sha256").update(code).digest("hex");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("issue_line_link_token", { link_token_hash: tokenHash });
    if (error || !data) return fail("START_LINE_LINK_FAILED", error?.message ?? "สร้างรหัสเชื่อม LINE ไม่สำเร็จ");
    revalidatePath("/profile");
    return ok({ code, expiresAt: String(data) }, "สร้างรหัสเชื่อม LINE แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function unlinkLineAccount() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("unlink_own_line");
    if (error) return fail("UNLINK_LINE_FAILED", error.message);
    revalidatePath("/profile");
    return ok(null, "ยกเลิกการเชื่อม LINE แล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}
