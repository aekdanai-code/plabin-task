import { createClient } from "npm:@supabase/supabase-js@2.110.5";
import nodemailer from "npm:nodemailer@7.0.6";
import { buildLineFlexMessage } from "./line-flex.ts";

type QueueMessage = { queue_message_id: number; delivery_id: string };

function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>;
  const key = Object.values(keys)[0];
  if (!key) throw new Error("SUPABASE_SECRET_KEY_MISSING");
  return key;
}

function render(template: string | null | undefined, payload: Record<string, unknown>, appBaseUrl: string) {
  let result = template || "";
  const values = {
    recipient_name: "-",
    actor_name: "ระบบ",
    task_name: "Task",
    task_url: "/",
    category_name: "-",
    progress: "-",
    due_at: "-",
    event_time: "-",
    checklist_item_name: "-",
    event_title: "การแจ้งเตือน",
    event_message: "",
    ...payload
  };
  for (const [key, value] of Object.entries(values)) {
    const replacement = key === "task_url" && String(value).startsWith("/")
      ? `${appBaseUrl.replace(/\/$/, "")}${String(value)}`
      : String(value ?? "-");
    result = result.replaceAll(`{{${key}}}`, replacement);
  }
  return result;
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  if (!cronSecret) return new Response("NOTIFICATION_CRON_SECRET is not configured", { status: 503 });
  if (request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await supabase.rpc("enqueue_due_notifications");
  const { data: messages, error: claimError } = await supabase.rpc("claim_notification_delivery_messages", { batch_size: 20 });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });

  const results: Array<{ deliveryId: string; status: string; error?: string }> = [];
  for (const message of (messages ?? []) as QueueMessage[]) {
    let subject = "";
    let body = "";
    try {
      const { data: delivery, error: deliveryError } = await supabase
        .from("notification_deliveries")
        .select("*")
        .eq("id", message.delivery_id)
        .single();
      if (deliveryError || !delivery) throw new Error(deliveryError?.message || "DELIVERY_NOT_FOUND");

      const { data: notification } = await supabase.from("notifications").select("*").eq("id", delivery.notification_id).single();
      if (!notification) throw new Error("NOTIFICATION_NOT_FOUND");
      const [{ data: event }, { data: profile }, { data: channel }, { data: settings }, { data: template }] = await Promise.all([
        supabase.from("notification_events").select("*").eq("id", notification.event_id).single(),
        supabase.from("profiles").select("email,display_name").eq("id", delivery.user_id).single(),
        supabase.from("user_notification_channels").select("*").eq("user_id", delivery.user_id).maybeSingle(),
        supabase.from("notification_system_settings").select("*").eq("id", true).single(),
        supabase.from("notification_templates").select("*").eq("event_type", notification.event_type).eq("channel", delivery.channel).eq("locale", "th").eq("is_active", true).maybeSingle()
      ]);
      const payload = { ...(event?.payload_json || {}), recipient_name: profile?.display_name || profile?.email || "สมาชิก" };
      subject = render(template?.subject_template || notification.title, payload, settings?.app_base_url || "");
      body = render(template?.body_text_template || notification.message, payload, settings?.app_base_url || "");
      let providerMessageId: string | null = null;

      if (delivery.channel === "LINE") {
        if (!channel?.line_user_id) throw new Error("LINE_NOT_LINKED");
        const [{ data: lineConfig }, { data: accessToken }] = await Promise.all([
          supabase.from("line_channel_config").select("*").eq("id", true).single(),
          supabase.rpc("get_notification_secret", { secret_name: "notification_line_access_token" })
        ]);
        if (!lineConfig?.is_enabled || !accessToken) throw new Error("LINE_CHANNEL_NOT_CONFIGURED");
        const response = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Line-Retry-Key": delivery.id
          },
          body: JSON.stringify({
            to: channel.line_user_id,
            messages: [buildLineFlexMessage({
              subject,
              body,
              payload,
              appBaseUrl: settings?.app_base_url || "",
              eventType: notification.event_type
            })]
          })
        });
        providerMessageId = response.headers.get("x-line-request-id");
        if (!response.ok) throw new Error(`LINE_${response.status}: ${await response.text()}`);
      } else {
        const [{ data: emailConfig }, { data: smtpPassword }] = await Promise.all([
          supabase.from("email_channel_config").select("*").eq("id", true).single(),
          supabase.rpc("get_notification_secret", { secret_name: "notification_smtp_password" })
        ]);
        const destination = channel?.email_address || profile?.email;
        if (!emailConfig?.is_enabled || !emailConfig.smtp_host || !emailConfig.from_email || !destination || !smtpPassword) {
          throw new Error("SMTP_CHANNEL_NOT_CONFIGURED");
        }
        const transporter = nodemailer.createTransport({
          host: emailConfig.smtp_host,
          port: emailConfig.smtp_port,
          secure: emailConfig.smtp_security === "TLS",
          requireTLS: emailConfig.smtp_security === "STARTTLS",
          auth: emailConfig.smtp_username ? { user: emailConfig.smtp_username, pass: smtpPassword } : undefined,
          connectionTimeout: emailConfig.connection_timeout_seconds * 1000
        });
        const info = await transporter.sendMail({
          from: { name: emailConfig.from_name, address: emailConfig.from_email },
          to: destination,
          replyTo: emailConfig.reply_to_email || undefined,
          subject,
          text: body,
          html: template?.body_html_template ? render(template.body_html_template, payload, settings?.app_base_url || "") : undefined,
          headers: { "X-Plabin-Delivery-ID": delivery.id }
        });
        providerMessageId = info.messageId;
      }

      const { data: status } = await supabase.rpc("record_notification_delivery_result", {
        queue_message_id: message.queue_message_id,
        target_delivery_id: delivery.id,
        succeeded: true,
        next_provider_message_id: providerMessageId,
        next_rendered_subject: subject,
        next_rendered_body: body,
        error_code: null,
        error_message: null
      });
      results.push({ deliveryId: delivery.id, status: status || "SENT" });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "UNKNOWN_DELIVERY_ERROR";
      const { data: status } = await supabase.rpc("record_notification_delivery_result", {
        queue_message_id: message.queue_message_id,
        target_delivery_id: message.delivery_id,
        succeeded: false,
        next_provider_message_id: null,
        next_rendered_subject: subject,
        next_rendered_body: body,
        error_code: messageText.split(":")[0].slice(0, 100),
        error_message: messageText
      });
      results.push({ deliveryId: message.delivery_id, status: status || "FAILED", error: messageText });
    }
  }

  return Response.json({ processed: results.length, results });
});
