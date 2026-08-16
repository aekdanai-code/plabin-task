"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, Mail, MessageCircle, RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  queueTestNotification,
  retryNotificationDelivery,
  updateEmailChannelConfig,
  updateLineChannelConfig,
  updateNotificationEventRule,
  updateNotificationSystemSettings,
  updateNotificationTemplate
} from "@/actions/notification-settings-actions";
import { formatThaiDate } from "@/lib/format";
import type { NotificationEventRule, NotificationTemplate, UserNotificationChannel } from "@/types/app";

type AdminNotificationData = {
  system: {
    is_enabled: boolean;
    app_base_url: string;
    timezone: string;
    max_retry_attempts: number;
    retry_delays_minutes: number[];
  };
  email: {
    is_enabled: boolean;
    smtp_host: string | null;
    smtp_port: number;
    smtp_security: "TLS" | "STARTTLS" | "NONE";
    smtp_username: string | null;
    from_name: string;
    from_email: string | null;
    reply_to_email: string | null;
    connection_timeout_seconds: number;
    password_configured: boolean;
  };
  line: {
    is_enabled: boolean;
    official_account_name: string | null;
    official_account_basic_id: string | null;
    channel_id: string | null;
    add_friend_url: string | null;
    webhook_url: string | null;
    access_token_configured: boolean;
    channel_secret_configured: boolean;
  };
  rules: NotificationEventRule[];
  templates: NotificationTemplate[];
  deliveries: Array<{
    id: string;
    channel: "EMAIL" | "LINE";
    status: string;
    destination_masked: string | null;
    attempt_count: number;
    last_error_message: string | null;
    created_at: string;
  }>;
  members: UserNotificationChannel[];
};

const tabs = [
  ["events", "Events"],
  ["email", "SMTP"],
  ["line", "LINE"],
  ["templates", "Templates"],
  ["deliveries", "Delivery log"]
] as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-apple-muted">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-apple-blue" />
      {label}
    </label>
  );
}

export function NotificationAdminSettings({ initial }: { initial: AdminNotificationData }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("events");
  const [rules, setRules] = useState(initial.rules);
  const [templates, setTemplates] = useState(initial.templates);
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState(initial.templates[0]?.id ?? "");
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === templateId), [templateId, templates]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    if (isPending) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      }
      else toast.error(result.message);
    });
  }

  function saveRule(rule: NotificationEventRule) {
    run(() => updateNotificationEventRule(rule));
  }

  return (
    <section className="mt-10 overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
      <div className="border-b border-apple-line p-5 sm:p-6">
        <p className="text-sm font-medium text-apple-blue">Admin only</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-apple-text">
          <BellRing className="h-6 w-6" /> ระบบการแจ้งเตือน
        </h2>
        <p className="mt-2 text-sm text-apple-muted">ควบคุม Event, SMTP, LINE Official Account, ข้อความ และการส่งซ้ำ</p>
      </div>

      <div className="apple-scrollbar flex gap-2 overflow-x-auto border-b border-apple-line p-3">
        {tabs.map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? "bg-apple-text text-white" : "bg-apple-bg text-apple-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "events" ? (
        <div className="p-5 sm:p-6">
          <form
            action={(formData) =>
              run(() =>
                updateNotificationSystemSettings({
                  is_enabled: formData.get("is_enabled") === "on",
                  app_base_url: String(formData.get("app_base_url") ?? ""),
                  timezone: String(formData.get("timezone") ?? "Asia/Bangkok"),
                  max_retry_attempts: Number(formData.get("max_retry_attempts")),
                  retry_delays_minutes: String(formData.get("retry_delays") ?? "")
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter((value) => Number.isFinite(value) && value > 0)
                })
              )
            }
            className="grid gap-4 rounded-lg bg-apple-bg p-4 md:grid-cols-2"
          >
            <label className="flex items-center gap-3 md:col-span-2">
              <input name="is_enabled" type="checkbox" defaultChecked={initial.system.is_enabled} className="h-5 w-5 accent-apple-blue" />
              <span className="font-semibold">เปิดระบบแจ้งเตือนทั้งหมด</span>
            </label>
            <Field label="App URL" name="app_base_url" defaultValue={initial.system.app_base_url} />
            <Field label="Timezone" name="timezone" defaultValue={initial.system.timezone} />
            <Field label="จำนวน Retry สูงสุด" name="max_retry_attempts" type="number" defaultValue={String(initial.system.max_retry_attempts)} />
            <Field label="Retry delays (นาที, คั่นด้วย comma)" name="retry_delays" defaultValue={initial.system.retry_delays_minutes.join(", ")} />
            <button disabled={isPending} className="flex items-center justify-center gap-2 rounded-lg bg-apple-blue px-4 py-3 text-sm font-semibold text-white md:col-span-2">
              <Save className="h-4 w-4" /> บันทึกค่ากลาง
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {rules.map((rule) => (
              <div key={rule.event_type} className="rounded-lg border border-apple-line p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-apple-text">{rule.display_name}</p>
                    <p className="mt-1 text-xs text-apple-muted">{rule.event_type} · {rule.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Toggle checked={rule.is_enabled} label="เปิด Event" onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, is_enabled: value } : row))} />
                    <Toggle checked={rule.in_app_enabled} label="In-app" onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, in_app_enabled: value } : row))} />
                    <Toggle checked={rule.email_enabled} label="Email" onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, email_enabled: value } : row))} />
                    <Toggle checked={rule.line_enabled} label="LINE" onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, line_enabled: value } : row))} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                  <Field label="Cooldown (นาที)" name={`${rule.event_type}-cooldown`} type="number" value={String(rule.cooldown_minutes)} onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, cooldown_minutes: Number(value) } : row))} />
                  {rule.event_type === "TASK_DUE_SOON" ? (
                    <Field label="แจ้งล่วงหน้า (นาที, comma)" name="reminders" value={rule.reminder_offsets_minutes.join(", ")} onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, reminder_offsets_minutes: value.split(",").map(Number).filter((number) => number > 0) } : row))} />
                  ) : rule.event_type === "TASK_OVERDUE" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="แจ้งซ้ำทุก (นาที, 0=ครั้งเดียว)" name="overdue_repeat" type="number" value={String(rule.overdue_repeat_minutes)} onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, overdue_repeat_minutes: Number(value) } : row))} />
                      <Field label="จำนวนครั้งสูงสุด" name="overdue_max" type="number" value={String(rule.overdue_max_occurrences)} onChange={(value) => setRules((rows) => rows.map((row) => row.event_type === rule.event_type ? { ...row, overdue_max_occurrences: Number(value) } : row))} />
                    </div>
                  ) : <span />}
                  <button type="button" disabled={isPending} onClick={() => saveRule(rule)} className="flex items-center justify-center gap-2 rounded-lg bg-apple-bg px-4 py-2.5 text-sm font-semibold text-apple-blue">
                    <Save className="h-4 w-4" /> บันทึก
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "email" ? (
        <ChannelForm
          icon={<Mail className="h-5 w-5" />}
          title="SMTP Email"
          configured={initial.email.password_configured}
          onTest={() => run(() => queueTestNotification("EMAIL"))}
        >
          <form action={(formData) => run(() => updateEmailChannelConfig(Object.fromEntries(formData)))} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="is_enabled" value={String(initial.email.is_enabled)} />
            <label className="flex items-center gap-3 md:col-span-2"><input name="is_enabled_checkbox" type="checkbox" defaultChecked={initial.email.is_enabled} onChange={(event) => { const hidden = event.currentTarget.form?.elements.namedItem("is_enabled") as HTMLInputElement | null; if (hidden) hidden.value = String(event.target.checked); }} className="h-5 w-5 accent-apple-blue" /> เปิด Email</label>
            <Field label="SMTP Host" name="smtp_host" defaultValue={initial.email.smtp_host ?? ""} />
            <Field label="Port" name="smtp_port" type="number" defaultValue={String(initial.email.smtp_port)} />
            <label className="text-sm font-medium">Security<select name="smtp_security" defaultValue={initial.email.smtp_security} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3"><option>TLS</option><option>STARTTLS</option><option>NONE</option></select></label>
            <Field label="Username" name="smtp_username" defaultValue={initial.email.smtp_username ?? ""} />
            <Field label={`Password ${initial.email.password_configured ? "(ตั้งค่าแล้ว · เว้นว่างเพื่อคงเดิม)" : ""}`} name="smtp_password" type="password" />
            <Field label="ชื่อผู้ส่ง" name="from_name" defaultValue={initial.email.from_name} />
            <Field label="อีเมลผู้ส่ง" name="from_email" type="email" defaultValue={initial.email.from_email ?? ""} />
            <Field label="Reply-to" name="reply_to_email" type="email" defaultValue={initial.email.reply_to_email ?? ""} />
            <input type="hidden" name="connection_timeout_seconds" value={initial.email.connection_timeout_seconds} />
            <SaveButton pending={isPending} />
          </form>
        </ChannelForm>
      ) : null}

      {tab === "line" ? (
        <ChannelForm
          icon={<MessageCircle className="h-5 w-5" />}
          title="LINE Official Account"
          configured={initial.line.access_token_configured && initial.line.channel_secret_configured}
          onTest={() => run(() => queueTestNotification("LINE"))}
        >
          <form action={(formData) => run(() => updateLineChannelConfig(Object.fromEntries(formData)))} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="is_enabled" value={String(initial.line.is_enabled)} />
            <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" defaultChecked={initial.line.is_enabled} onChange={(event) => { const hidden = event.currentTarget.form?.elements.namedItem("is_enabled") as HTMLInputElement | null; if (hidden) hidden.value = String(event.target.checked); }} className="h-5 w-5 accent-apple-blue" /> เปิด LINE</label>
            <Field label="ชื่อ Official Account" name="official_account_name" defaultValue={initial.line.official_account_name ?? ""} />
            <Field label="Basic ID เช่น @plabin" name="official_account_basic_id" defaultValue={initial.line.official_account_basic_id ?? ""} />
            <Field label="Channel ID" name="channel_id" defaultValue={initial.line.channel_id ?? ""} />
            <Field label={`Channel access token ${initial.line.access_token_configured ? "(ตั้งค่าแล้ว)" : ""}`} name="channel_access_token" type="password" />
            <Field label={`Channel secret ${initial.line.channel_secret_configured ? "(ตั้งค่าแล้ว)" : ""}`} name="channel_secret" type="password" />
            <Field label="Add friend URL" name="add_friend_url" type="url" defaultValue={initial.line.add_friend_url ?? ""} />
            <Field label="Webhook URL" name="webhook_url" type="url" defaultValue={initial.line.webhook_url ?? ""} />
            <SaveButton pending={isPending} />
          </form>
        </ChannelForm>
      ) : null}

      {tab === "templates" ? (
        <div className="p-5 sm:p-6">
          <label className="text-sm font-medium">เลือก Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3">{templates.map((template) => <option key={template.id} value={template.id}>{template.event_type} · {template.channel}</option>)}</select></label>
          {selectedTemplate ? (
            <form action={() => run(() => updateNotificationTemplate(selectedTemplate))} className="mt-4 space-y-4">
              <Field label="Subject / Title" name="subject" value={selectedTemplate.subject_template} onChange={(value) => setTemplates((rows) => rows.map((row) => row.id === selectedTemplate.id ? { ...row, subject_template: value } : row))} />
              <label className="block text-sm font-medium">ข้อความ<textarea rows={8} value={selectedTemplate.body_text_template} onChange={(event) => setTemplates((rows) => rows.map((row) => row.id === selectedTemplate.id ? { ...row, body_text_template: event.target.value } : row))} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 font-mono text-sm" /></label>
              {selectedTemplate.channel === "EMAIL" ? <label className="block text-sm font-medium">HTML<textarea rows={8} value={selectedTemplate.body_html_template ?? ""} onChange={(event) => setTemplates((rows) => rows.map((row) => row.id === selectedTemplate.id ? { ...row, body_html_template: event.target.value } : row))} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 font-mono text-sm" /></label> : null}
              <p className="rounded-lg bg-apple-bg p-3 text-xs leading-5 text-apple-muted">ตัวแปร: {"{{recipient_name}}, {{actor_name}}, {{task_name}}, {{task_url}}, {{category_name}}, {{progress}}, {{due_at}}, {{event_time}}, {{checklist_item_name}}, {{event_title}}"}</p>
              <SaveButton pending={isPending} />
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "deliveries" ? (
        <div className="p-5 sm:p-6">
          <p className="mb-4 text-sm text-apple-muted">สมาชิกเชื่อม LINE แล้ว {initial.members.filter((member) => member.line_link_status === "LINKED").length}/{initial.members.length} คน</p>
          <div className="overflow-x-auto rounded-lg border border-apple-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-apple-bg text-xs text-apple-muted"><tr><th className="p-3">เวลา</th><th className="p-3">ช่องทาง</th><th className="p-3">ปลายทาง</th><th className="p-3">สถานะ</th><th className="p-3">ครั้ง</th><th className="p-3">Error</th><th className="p-3" /></tr></thead>
              <tbody className="divide-y divide-apple-line">{initial.deliveries.map((delivery) => <tr key={delivery.id}><td className="whitespace-nowrap p-3">{formatThaiDate(delivery.created_at)}</td><td className="p-3 font-semibold">{delivery.channel}</td><td className="p-3">{delivery.destination_masked ?? "-"}</td><td className="p-3"><span className="rounded bg-apple-bg px-2 py-1 text-xs font-semibold">{delivery.status}</span></td><td className="p-3">{delivery.attempt_count}</td><td className="max-w-64 truncate p-3 text-apple-red" title={delivery.last_error_message ?? ""}>{delivery.last_error_message ?? "-"}</td><td className="p-3">{["FAILED", "SKIPPED"].includes(delivery.status) ? <button type="button" onClick={() => run(() => retryNotificationDelivery(delivery.id))} className="rounded-lg bg-apple-bg p-2 text-apple-blue" title="ส่งใหม่"><RefreshCw className="h-4 w-4" /></button> : null}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, name, type = "text", defaultValue, value, onChange }: { label: string; name: string; type?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<input name={name} type={type} defaultValue={defaultValue} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm" /></label>;
}

function SaveButton({ pending }: { pending: boolean }) {
  return <button disabled={pending} className="flex items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"><Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึก"}</button>;
}

function ChannelForm({ icon, title, configured, onTest, children }: { icon: React.ReactNode; title: string; configured: boolean; onTest: () => void; children: React.ReactNode }) {
  return <div className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="rounded-lg bg-apple-bg p-2 text-apple-blue">{icon}</span><div><h3 className="font-semibold">{title}</h3><p className="text-xs text-apple-muted">Credential: {configured ? "ตั้งค่าแล้ว" : "ยังไม่ครบ"}</p></div><button type="button" onClick={onTest} className="ml-auto flex items-center gap-2 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold text-apple-blue"><Send className="h-4 w-4" /> ส่งทดสอบ</button></div>{children}</div>;
}
