"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, Copy, Link2, MessageCircle, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  startLineAccountLink,
  unlinkLineAccount,
  updateOwnEventPreference
} from "@/actions/notification-settings-actions";
import type { EventNotificationPreference, NotificationEventType, UserNotificationChannel } from "@/types/app";

type OwnNotificationSettings = {
  preferences: EventNotificationPreference[];
  channel: UserNotificationChannel | null;
  rules: Array<{ event_type: NotificationEventType; display_name: string; description: string; is_enabled: boolean }>;
  lineConfig: {
    is_enabled: boolean;
    official_account_name: string | null;
    official_account_basic_id: string | null;
    add_friend_url: string | null;
  } | null;
};

export function NotificationProfileSettings({ initial }: { initial: OwnNotificationSettings }) {
  const [preferences, setPreferences] = useState(initial.preferences);
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const linked = initial.channel?.line_link_status === "LINKED";
  const visibleRules = useMemo(() => initial.rules.filter((rule) => rule.is_enabled), [initial.rules]);

  function preferenceFor(eventType: NotificationEventType) {
    return preferences.find((row) => row.event_type === eventType) ?? {
      user_id: initial.channel?.user_id ?? "",
      event_type: eventType,
      in_app_enabled: true,
      email_enabled: true,
      line_enabled: true
    };
  }

  function toggle(eventType: NotificationEventType, channel: "in_app_enabled" | "email_enabled" | "line_enabled") {
    if (isPending) return;
    const previous = preferences;
    const current = preferenceFor(eventType);
    const next = { ...current, [channel]: !current[channel] };
    setPreferences((rows) => [...rows.filter((row) => row.event_type !== eventType), next]);
    startTransition(async () => {
      const result = await updateOwnEventPreference(next);
      if (result.ok) toast.success(result.message);
      else {
        setPreferences(previous);
        toast.error(result.message);
      }
    });
  }

  function startLink() {
    startTransition(async () => {
      const result = await startLineAccountLink();
      if (result.ok) {
        setLinkCode(result.data);
        toast.success(result.message);
      } else toast.error(result.message);
    });
  }

  function unlink() {
    startTransition(async () => {
      const result = await unlinkLineAccount();
      if (result.ok) {
        toast.success(result.message);
        window.location.reload();
      } else toast.error(result.message);
    });
  }

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
      <div className="border-b border-apple-line px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-apple-text"><BellRing className="h-5 w-5 text-apple-blue" /> การแจ้งเตือนของฉัน</h2>
        <p className="mt-1 text-sm text-apple-muted">เลือกช่องทางแยกตามเหตุการณ์ การตั้งค่านี้ไม่กระทบสมาชิกคนอื่น</p>
      </div>

      <div className="border-b border-apple-line p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="rounded-lg bg-[#06C755]/10 p-3 text-[#06C755]"><MessageCircle className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">LINE {initial.lineConfig?.official_account_name || initial.lineConfig?.official_account_basic_id || "Official Account"}</p>
            <p className="mt-1 text-sm text-apple-muted">สถานะ: {linked ? "เชื่อมต่อแล้ว" : initial.channel?.line_link_status === "PENDING" ? "รอเชื่อมต่อ" : "ยังไม่เชื่อมต่อ"}</p>
          </div>
          {linked ? (
            <button type="button" disabled={isPending} onClick={unlink} className="flex items-center justify-center gap-2 rounded-lg border border-apple-red px-4 py-2.5 text-sm font-semibold text-apple-red"><Unlink className="h-4 w-4" /> ยกเลิกการเชื่อม</button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {initial.lineConfig?.add_friend_url ? <a href={initial.lineConfig.add_friend_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white"><Link2 className="h-4 w-4" /> เพิ่มเพื่อน</a> : null}
              <button type="button" disabled={isPending || !initial.lineConfig?.is_enabled} onClick={startLink} className="rounded-lg bg-apple-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">สร้างรหัสเชื่อม</button>
            </div>
          )}
        </div>
        {linkCode ? (
          <div className="mt-4 rounded-lg bg-apple-bg p-4">
            <p className="text-sm text-apple-muted">ส่งข้อความด้านล่างไปยัง LINE Official Account ภายใน 15 นาที</p>
            <div className="mt-2 flex items-center gap-2"><code className="flex-1 rounded-lg bg-white px-4 py-3 text-center text-lg font-bold tracking-wider">LINK {linkCode.code}</code><button type="button" onClick={() => void navigator.clipboard.writeText(`LINK ${linkCode.code}`).then(() => toast.success("คัดลอกแล้ว"))} className="rounded-lg bg-white p-3 text-apple-blue"><Copy className="h-5 w-5" /></button></div>
          </div>
        ) : null}
      </div>

      <div className="divide-y divide-apple-line">
        <div className="grid grid-cols-[1fr_repeat(3,64px)] gap-2 bg-apple-bg px-5 py-3 text-center text-xs font-semibold text-apple-muted sm:px-6"><span className="text-left">เหตุการณ์</span><span>ในแอป</span><span>Email</span><span>LINE</span></div>
        {visibleRules.map((rule) => {
          const preference = preferenceFor(rule.event_type);
          return <div key={rule.event_type} className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-2 px-5 py-4 sm:px-6"><div className="min-w-0"><p className="text-sm font-medium">{rule.display_name}</p><p className="mt-1 line-clamp-2 text-xs text-apple-muted">{rule.description}</p></div>{(["in_app_enabled", "email_enabled", "line_enabled"] as const).map((channel) => <label key={channel} className="flex justify-center"><input type="checkbox" checked={preference[channel]} disabled={isPending || (channel === "line_enabled" && !linked)} onChange={() => toggle(rule.event_type, channel)} className="h-5 w-5 accent-apple-blue disabled:opacity-40" /></label>)}</div>;
        })}
      </div>
    </section>
  );
}
