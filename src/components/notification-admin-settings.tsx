"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellRing, BookOpen, CheckCircle2, ExternalLink, Mail, MessageCircle, RefreshCw, Save, Send, ShieldCheck, X } from "lucide-react";
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

const templateVariables = [
  ["recipient_name", "ชื่อผู้รับการแจ้งเตือน (ใช้ชื่อที่แสดง หรืออีเมลถ้าไม่มีชื่อ)"],
  ["actor_name", "ชื่อผู้ที่ทำรายการ; หากเป็นงานอัตโนมัติจะแสดงว่า “ระบบ”"],
  ["task_name", "ชื่อ Task ที่เกี่ยวข้องกับการแจ้งเตือน"],
  ["task_url", "ลิงก์สำหรับเปิดดูรายละเอียด Task"],
  ["category_name", "ชื่อหมวดหมู่ของ Task"],
  ["progress", "เปอร์เซ็นต์ความคืบหน้า เป็นตัวเลขโดยไม่รวมเครื่องหมาย %"],
  ["due_at", "วันและเวลากำหนดส่ง ในรูปแบบ วัน/เดือน/ปี ชั่วโมง:นาที"],
  ["event_time", "วันและเวลาที่เกิด Event ในรูปแบบ วัน/เดือน/ปี ชั่วโมง:นาที"],
  ["checklist_item_name", "ชื่อรายการ Checklist (มีค่าเฉพาะ Event ที่เกี่ยวกับ Checklist)"],
  ["event_title", "ชื่อหัวข้อของ Event เช่น “Task เสร็จสิ้นแล้ว”"],
  ["event_message", "ข้อความสรุปเหตุการณ์ที่ระบบสร้างให้"],
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
  const [smtpGuideOpen, setSmtpGuideOpen] = useState(false);
  const [lineGuideOpen, setLineGuideOpen] = useState(false);
  const smtpGuideButtonRef = useRef<HTMLButtonElement>(null);
  const lineGuideButtonRef = useRef<HTMLButtonElement>(null);
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
    <section className="overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
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
          guideButtonRef={smtpGuideButtonRef}
          onGuide={() => setSmtpGuideOpen(true)}
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
          guideButtonRef={lineGuideButtonRef}
          onGuide={() => setLineGuideOpen(true)}
          onTest={() => run(() => queueTestNotification("LINE"))}
        >
          <form action={(formData) => run(() => updateLineChannelConfig(Object.fromEntries(formData)))} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="is_enabled" value={String(initial.line.is_enabled)} />
            <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" defaultChecked={initial.line.is_enabled} onChange={(event) => { const hidden = event.currentTarget.form?.elements.namedItem("is_enabled") as HTMLInputElement | null; if (hidden) hidden.value = String(event.target.checked); }} className="h-5 w-5 accent-apple-blue" /> เปิด LINE</label>
            <Field label="ชื่อ Official Account" name="official_account_name" defaultValue={initial.line.official_account_name ?? ""} />
            <Field label="Basic ID เช่น @plabin" name="official_account_basic_id" defaultValue={initial.line.official_account_basic_id ?? ""} />
            <Field label="Channel ID" name="channel_id" defaultValue={initial.line.channel_id ?? ""} />
            <Field label={`Channel access token ${initial.line.access_token_configured ? "(ตั้งค่าแล้ว · เว้นว่างเพื่อคงเดิม)" : ""}`} name="channel_access_token" type="password" />
            <Field label={`Channel secret ${initial.line.channel_secret_configured ? "(ตั้งค่าแล้ว · เว้นว่างเพื่อคงเดิม)" : ""}`} name="channel_secret" type="password" />
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
              <TemplateVariableGuide />
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

      {smtpGuideOpen ? (
        <SmtpSetupGuideModal
          onClose={() => {
            setSmtpGuideOpen(false);
            window.requestAnimationFrame(() => smtpGuideButtonRef.current?.focus());
          }}
        />
      ) : null}

      {lineGuideOpen ? (
        <LineSetupGuideModal
          onClose={() => {
            setLineGuideOpen(false);
            window.requestAnimationFrame(() => lineGuideButtonRef.current?.focus());
          }}
        />
      ) : null}
    </section>
  );
}

function SmtpSetupGuideModal({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="smtp-guide-title"
        aria-describedby="smtp-guide-description"
        className="flex max-h-[min(880px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-apple-line px-5 py-4 sm:px-6">
          <span className="rounded-lg bg-apple-blue/10 p-2 text-apple-blue"><Mail className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="smtp-guide-title" className="text-xl font-semibold text-apple-text">คู่มือตั้งค่า SMTP Email</h2>
            <p id="smtp-guide-description" className="mt-1 text-sm leading-6 text-apple-muted">ตั้งค่าผู้ให้บริการ SMTP, Credential, ผู้ส่ง และทดสอบการส่ง Email จาก Plabin Task</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-apple-bg text-apple-muted hover:text-apple-text" title="ปิดคู่มือ" aria-label="ปิดคู่มือ">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="apple-scrollbar overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
            <GuideStep number="1" title="เลือกผู้ให้บริการ SMTP">
              <p>แนะนำให้ใช้บริการ Transactional Email ที่รองรับ SMTP Username/Password หรือ API Key เช่น SendGrid, Mailgun หรือ Brevo เพราะเหมาะกับการส่งข้อความอัตโนมัติและมี Delivery log ของผู้ให้บริการ</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ProviderExample provider="SendGrid" host="smtp.sendgrid.net" port="587" security="STARTTLS" username="apikey" password="API Key" />
                <ProviderExample provider="Mailgun" host="smtp.mailgun.org" port="587" security="STARTTLS" username="SMTP username" password="SMTP password" />
                <ProviderExample provider="Brevo" host="smtp-relay.brevo.com" port="587" security="STARTTLS" username="SMTP login" password="SMTP key" />
                <ProviderExample provider="Gmail ส่วนบุคคล" host="smtp.gmail.com" port="587 หรือ 465" security="STARTTLS หรือ TLS" username="อีเมลเต็ม" password="App Password 16 หลัก" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <GuideLink href="https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api" label="คู่มือ SendGrid" />
                <GuideLink href="https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-smtp" label="คู่มือ Mailgun" />
                <GuideLink href="https://help.brevo.com/hc/en-us/articles/360001005870-SMTP-relay" label="คู่มือ Brevo" />
                <GuideLink href="https://support.google.com/accounts/answer/185833" label="Google App Password" />
              </div>
            </GuideStep>

            <GuideStep number="2" title="ยืนยันผู้ส่งและ Domain">
              <p>เพิ่มและยืนยันอีเมลผู้ส่งหรือ Domain ใน Dashboard ของผู้ให้บริการก่อน จากนั้นตั้งค่า SPF และ DKIM ตามค่าที่ผู้ให้บริการออกให้ หากมี DMARC ให้ตั้งเพิ่มเพื่อช่วยลดโอกาสเข้า Spam</p>
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-800">อีเมลผู้ส่งใน Plabin Task ต้องตรงกับ Sender หรือ Domain ที่ผ่านการยืนยัน มิฉะนั้นผู้ให้บริการอาจตอบกลับด้วยรหัส 550 หรือ 553</p>
            </GuideStep>

            <GuideStep number="3" title="เตรียม Credential สำหรับ SMTP">
              <dl className="grid gap-2 sm:grid-cols-2">
                <GuideValue name="SMTP Host" description="ชื่อ Server จากผู้ให้บริการ เช่น smtp.sendgrid.net" />
                <GuideValue name="Port" description="แนะนำ 587 สำหรับ STARTTLS หรือใช้ 465 เมื่อผู้ให้บริการระบุ TLS" />
                <GuideValue name="Username" description="อาจเป็น SMTP login, อีเมล หรือคำว่า apikey ตามผู้ให้บริการ" />
                <GuideValue name="Password" description="ใช้ SMTP password, API Key หรือ App Password ห้ามใช้ค่าที่ไม่ใช่ SMTP Credential" />
              </dl>
            </GuideStep>

            <GuideStep number="4" title="เลือก Security ให้ตรงกับ Port">
              <div className="overflow-x-auto rounded-lg border border-apple-line">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-apple-bg text-apple-muted"><tr><th className="p-3">Security</th><th className="p-3">Port ที่พบบ่อย</th><th className="p-3">ความหมาย</th></tr></thead>
                  <tbody className="divide-y divide-apple-line text-apple-muted">
                    <tr><td className="p-3 font-semibold text-apple-text">STARTTLS</td><td className="p-3">587</td><td className="p-3">เริ่มเชื่อมต่อแล้วอัปเกรดเป็น TLS — ตัวเลือกแนะนำสำหรับผู้ให้บริการส่วนใหญ่</td></tr>
                    <tr><td className="p-3 font-semibold text-apple-text">TLS</td><td className="p-3">465</td><td className="p-3">เข้ารหัสตั้งแต่เริ่มเชื่อมต่อ หรือ Implicit TLS</td></tr>
                    <tr><td className="p-3 font-semibold text-apple-text">NONE</td><td className="p-3">ขึ้นกับระบบ</td><td className="p-3">ไม่บังคับเข้ารหัส ไม่แนะนำสำหรับการส่งผ่านอินเทอร์เน็ต</td></tr>
                  </tbody>
                </table>
              </div>
            </GuideStep>

            <GuideStep number="5" title="กรอกค่าในหน้า SMTP ของ Plabin Task">
              <ol className="list-decimal space-y-2 pl-5">
                <li>กรอก Host, Port, Security, Username และ Password ตามข้อมูลของผู้ให้บริการ</li>
                <li>ชื่อผู้ส่งคือชื่อที่ผู้รับเห็น เช่น Plabin Task</li>
                <li>อีเมลผู้ส่งต้องเป็น Sender หรือ Domain ที่ยืนยันแล้ว</li>
                <li>Reply-to คืออีเมลที่จะรับคำตอบ สามารถเว้นว่างได้</li>
                <li>เปิดสวิตช์ “เปิด Email” แล้วกดบันทึก</li>
              </ol>
              <p className="mt-3 rounded-lg bg-apple-blue/5 p-3 text-apple-blue">Password จะถูกเก็บใน Supabase Vault และไม่ถูกส่งกลับมาแสดงใน Browser หากระบบแจ้งว่าตั้งค่าแล้ว ให้เว้นช่อง Password ว่างเพื่อคงค่าเดิม</p>
            </GuideStep>

            <GuideStep number="6" title="ทดสอบการส่ง">
              <p>กด “ส่งทดสอบ” ระบบจะเพิ่ม Email เข้าคิว จากนั้นเปิดแท็บ Delivery log เพื่อตรวจสอบ สถานะปกติจะเปลี่ยนจาก PENDING เป็น SENT หลัง Worker ทำงาน</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>ตรวจทั้ง Inbox และ Spam/Junk รวมถึง Delivery log ใน Dashboard ของผู้ให้บริการ SMTP</span>
              </div>
            </GuideStep>

            <GuideStep number="7" title="แก้ปัญหาเมื่อส่งไม่สำเร็จ">
              <dl className="space-y-2">
                <TroubleshootingItem code="535 / Authentication failed" solution="ตรวจ Username และ Password; SendGrid ต้องใช้ Username ว่า apikey ส่วน Gmail ต้องใช้ App Password ไม่ใช่รหัสผ่านบัญชี" />
                <TroubleshootingItem code="Connection timeout" solution="ตรวจ Host/Port, เลือก 587 STARTTLS ก่อน และตรวจว่าผู้ให้บริการหรือ Network ไม่ได้บล็อก Port" />
                <TroubleshootingItem code="TLS / certificate error" solution="ตรวจว่าเลือก STARTTLS สำหรับ 587 หรือ TLS สำหรับ 465 ตรงตามคู่มือผู้ให้บริการ" />
                <TroubleshootingItem code="550 / 553 sender rejected" solution="ยืนยัน Sender/Domain และตรวจว่าอีเมลผู้ส่งตรงกับสิทธิ์ของ Credential" />
                <TroubleshootingItem code="SENT แต่ไม่พบ Email" solution="ตรวจ Spam/Junk, SPF, DKIM, DMARC และ Activity/Delivery log ของผู้ให้บริการ" />
              </dl>
            </GuideStep>

            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">ข้อจำกัดของ Microsoft 365</p>
                <p className="mt-1 text-xs leading-5 text-red-700">ฟอร์มปัจจุบันรองรับ Username/Password แต่ยังไม่รองรับ OAuth 2.0 สำหรับ SMTP ดังนั้น Microsoft 365/Exchange Online ที่ปิด Basic authentication จะใช้งานกับการตั้งค่านี้ไม่ได้ ควรใช้ Transactional SMTP provider ที่รองรับ API Key แทน</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-apple-line px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg bg-apple-text px-5 py-2.5 text-sm font-semibold text-white">เข้าใจแล้ว</button>
        </footer>
      </section>
    </div>
  );
}

function ProviderExample({ provider, host, port, security, username, password }: { provider: string; host: string; port: string; security: string; username: string; password: string }) {
  return (
    <div className="rounded-lg border border-apple-line p-3 text-xs">
      <p className="font-semibold text-apple-text">{provider}</p>
      <dl className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-apple-muted">
        <dt>Host</dt><dd className="break-all font-mono text-apple-text">{host}</dd>
        <dt>Port</dt><dd>{port}</dd>
        <dt>Security</dt><dd>{security}</dd>
        <dt>Username</dt><dd>{username}</dd>
        <dt>Password</dt><dd>{password}</dd>
      </dl>
    </div>
  );
}

function TroubleshootingItem({ code, solution }: { code: string; solution: string }) {
  return <div className="rounded-lg border border-apple-line p-3"><dt className="text-xs font-semibold text-apple-text">{code}</dt><dd className="mt-1 text-xs leading-5 text-apple-muted">{solution}</dd></div>;
}

function LineSetupGuideModal({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-guide-title"
        aria-describedby="line-guide-description"
        className="flex max-h-[min(880px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-apple-line px-5 py-4 sm:px-6">
          <span className="rounded-lg bg-[#06C755]/10 p-2 text-[#06C755]"><MessageCircle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="line-guide-title" className="text-xl font-semibold text-apple-text">คู่มือตั้งค่า LINE Official Account</h2>
            <p id="line-guide-description" className="mt-1 text-sm leading-6 text-apple-muted">ทำตามลำดับตั้งแต่สร้าง Messaging API จนถึงทดสอบส่งข้อความจาก Plabin Task</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-apple-bg text-apple-muted hover:text-apple-text" title="ปิดคู่มือ" aria-label="ปิดคู่มือ">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="apple-scrollbar overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
            <GuideStep number="1" title="สร้าง LINE Official Account และเปิด Messaging API">
              <p>เข้า LINE Official Account Manager เพื่อสร้างบัญชี จากนั้นเปิดใช้ Messaging API และเลือกหรือสร้าง Provider ที่ต้องการ ระบบ LINE จะสร้าง Messaging API Channel ให้บัญชีนี้</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GuideLink href="https://manager.line.biz/" label="LINE Official Account Manager" />
                <GuideLink href="https://developers.line.biz/console/" label="LINE Developers Console" />
              </div>
            </GuideStep>

            <GuideStep number="2" title="เก็บข้อมูลจาก LINE Developers Console">
              <p>เปิด Channel ที่สร้างไว้ แล้วเตรียมข้อมูลต่อไปนี้ โดยห้ามส่ง Token หรือ Secret ผ่านแชตหรือเก็บไว้ใน Git:</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <GuideValue name="ชื่อ Official Account" description="ชื่อที่สมาชิกเห็นใน LINE" />
                <GuideValue name="Basic ID" description="รูปแบบ @xxxx จากหน้า Messaging API" />
                <GuideValue name="Channel ID" description="อยู่ในแท็บ Basic settings" />
                <GuideValue name="Channel secret" description="อยู่ในแท็บ Basic settings" />
                <GuideValue name="Channel access token" description="ออก Token จากแท็บ Messaging API" />
                <GuideValue name="Add friend URL" description="ลิงก์เพิ่มเพื่อนหรือ QR code ของ Official Account" />
              </dl>
            </GuideStep>

            <GuideStep number="3" title="Deploy Webhook ของโปรเจกต์ขึ้น Supabase">
              <p>รันคำสั่งต่อไปนี้จากโฟลเดอร์โปรเจกต์ โดยแทน <code className="rounded bg-apple-bg px-1 font-mono text-xs">YOUR_PROJECT_REF</code> ด้วย Project Reference จาก Supabase Dashboard:</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#1d1d1f] p-4 text-xs leading-6 text-white"><code>{`supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy line-webhook
supabase functions deploy notification-delivery-worker`}</code></pre>
              <p className="mt-3">Webhook URL ที่ต้องใช้คือ:</p>
              <code className="mt-2 block overflow-x-auto rounded-lg border border-apple-line bg-apple-bg p-3 text-xs text-apple-text">https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook</code>
            </GuideStep>

            <GuideStep number="4" title="ตั้ง Webhook ใน LINE Developers Console">
              <ol className="list-decimal space-y-2 pl-5">
                <li>เปิดแท็บ Messaging API ของ Channel</li>
                <li>วาง URL จากขั้นตอนก่อนหน้าในช่อง Webhook URL แล้วกด Update</li>
                <li>กด Verify และตรวจว่าผลเป็น Success</li>
                <li>เปิดสวิตช์ Use webhook</li>
                <li>แนะนำให้ปิด Auto-reply messages หากไม่ต้องการให้ตอบซ้ำกับข้อความจากระบบ</li>
              </ol>
            </GuideStep>

            <GuideStep number="5" title="กรอกค่าในหน้า LINE ของ Plabin Task">
              <p>กลับมาที่ฟอร์มด้านหลังคู่มือนี้ กรอกค่าทั้งหมด เปิดสวิตช์ “เปิด LINE” แล้วกดบันทึก ระบบจะเก็บ Channel access token และ Channel secret ใน Supabase Vault และจะไม่แสดงค่ากลับมาที่ Browser</p>
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-800">ถ้าหน้าฟอร์มระบุว่า Credential ตั้งค่าแล้ว ให้เว้นช่อง Token หรือ Secret ว่างเพื่อเก็บค่าเดิม</p>
            </GuideStep>

            <GuideStep number="6" title="เชื่อม LINE ของสมาชิกแต่ละคน">
              <ol className="list-decimal space-y-2 pl-5">
                <li>สมาชิกเพิ่ม LINE Official Account เป็นเพื่อน</li>
                <li>เข้า Plabin Task → โปรไฟล์ → การแจ้งเตือนของฉัน</li>
                <li>กดสร้างรหัสเชื่อม LINE ซึ่งมีอายุจำกัด</li>
                <li>ส่งข้อความ <code className="rounded bg-apple-bg px-1 font-mono text-xs">LINK XXXXXXXX</code> ไปยัง Official Account</li>
                <li>รอข้อความยืนยันว่าเชื่อมสำเร็จ แล้วจึงเปิดรับ Event ที่ต้องการ</li>
              </ol>
            </GuideStep>

            <GuideStep number="7" title="ทดสอบและตรวจสอบผล">
              <p>กด “ส่งทดสอบ” ในแท็บ LINE แล้วเปิดแท็บ Delivery log สถานะควรเปลี่ยนจาก PENDING เป็น SENT หากเป็น FAILED หรือ SKIPPED ให้ตรวจ Credential, การเชื่อมบัญชีสมาชิก, Use webhook และ Error ใน Delivery log</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#06C755]/10 p-3 text-sm text-[#087d39]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>ตั้งค่าสำเร็จเมื่อสมาชิกได้รับข้อความทดสอบทาง LINE และ Delivery log แสดงสถานะ SENT</span>
              </div>
            </GuideStep>

            <div className="flex items-start gap-3 rounded-lg border border-apple-line bg-apple-bg p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-apple-blue" />
              <div>
                <p className="text-sm font-semibold text-apple-text">ความปลอดภัย</p>
                <p className="mt-1 text-xs leading-5 text-apple-muted">หากสงสัยว่า Channel access token หรือ Channel secret รั่ว ให้ยกเลิกหรือออกค่าใหม่ใน LINE Developers Console แล้วนำค่ามาบันทึกใหม่ทันที</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-apple-line px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg bg-apple-text px-5 py-2.5 text-sm font-semibold text-white">เข้าใจแล้ว</button>
        </footer>
      </section>
    </div>
  );
}

function GuideStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 sm:grid-cols-[36px_1fr]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-apple-blue text-sm font-bold text-white">{number}</span>
      <div className="min-w-0 pt-1 text-sm leading-6 text-apple-muted">
        <h3 className="mb-1 font-semibold text-apple-text">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function GuideValue({ name, description }: { name: string; description: string }) {
  return <div className="rounded-lg border border-apple-line p-3"><dt className="text-xs font-semibold text-apple-text">{name}</dt><dd className="mt-1 text-xs leading-5 text-apple-muted">{description}</dd></div>;
}

function GuideLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold text-apple-blue hover:bg-apple-blue/10">{label}<ExternalLink className="h-3.5 w-3.5" /></a>;
}

function TemplateVariableGuide() {
  return (
    <aside className="overflow-hidden rounded-lg border border-apple-line bg-apple-bg" aria-labelledby="template-variable-guide-title">
      <div className="border-b border-apple-line px-4 py-3">
        <h3 id="template-variable-guide-title" className="text-sm font-semibold text-apple-text">คู่มือตัวแปรใน Template</h3>
        <p className="mt-1 text-xs leading-5 text-apple-muted">
          ใส่ตัวแปรในรูปแบบ <code className="rounded bg-white px-1.5 py-0.5 font-mono text-apple-text">{"{{variable_name}}"}</code> ระบบจะแทนค่าตอนส่ง และจะแสดง <code className="rounded bg-white px-1.5 py-0.5 font-mono text-apple-text">-</code> เมื่อ Event นั้นไม่มีข้อมูล
        </p>
      </div>
      <dl className="grid gap-px bg-apple-line sm:grid-cols-2">
        {templateVariables.map(([name, description]) => (
          <div key={name} className="bg-white px-4 py-3">
            <dt><code className="font-mono text-xs font-semibold text-apple-blue">{`{{${name}}}`}</code></dt>
            <dd className="mt-1 text-xs leading-5 text-apple-muted">{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function Field({ label, name, type = "text", defaultValue, value, onChange }: { label: string; name: string; type?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<input name={name} type={type} defaultValue={defaultValue} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm" /></label>;
}

function SaveButton({ pending }: { pending: boolean }) {
  return <button disabled={pending} className="flex items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"><Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึก"}</button>;
}

function ChannelForm({ icon, title, configured, onGuide, guideButtonRef, onTest, children }: { icon: React.ReactNode; title: string; configured: boolean; onGuide?: () => void; guideButtonRef?: React.RefObject<HTMLButtonElement | null>; onTest: () => void; children: React.ReactNode }) {
  return <div className="p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-apple-bg p-2 text-apple-blue">{icon}</span><div className="mr-auto"><h3 className="font-semibold">{title}</h3><p className="text-xs text-apple-muted">Credential: {configured ? "ตั้งค่าแล้ว" : "ยังไม่ครบ"}</p></div><div className="flex flex-wrap gap-2">{onGuide ? <button ref={guideButtonRef} type="button" onClick={onGuide} className="flex items-center gap-2 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold text-apple-text hover:bg-black/5"><BookOpen className="h-4 w-4" /> คู่มือการตั้งค่า</button> : null}<button type="button" onClick={onTest} className="flex items-center gap-2 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold text-apple-blue"><Send className="h-4 w-4" /> ส่งทดสอบ</button></div></div>{children}</div>;
}
