"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, MessageCircle, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  startLineAccountLink,
  unlinkLineAccount
} from "@/actions/notification-settings-actions";
import type { UserNotificationChannel } from "@/types/app";

type OwnLineSettings = {
  channel: UserNotificationChannel | null;
  lineConfig: {
    is_enabled: boolean;
    official_account_name: string | null;
    official_account_basic_id: string | null;
    add_friend_url: string | null;
  } | null;
};

export function LineProfileSettings({ initial }: { initial: OwnLineSettings }) {
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const linked = initial.channel?.line_link_status === "LINKED";

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
        <h2 className="flex items-center gap-2 text-lg font-semibold text-apple-text"><MessageCircle className="h-5 w-5 text-[#06C755]" /> เชื่อมต่อ LINE</h2>
        <p className="mt-1 text-sm text-apple-muted">เชื่อมบัญชี LINE เพื่อรับข้อความจากระบบ โดยประเภทและช่องทางการแจ้งเตือนกำหนดโดย Admin สำหรับสมาชิกทุกคน</p>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="rounded-lg bg-[#06C755]/10 p-3 text-[#06C755]"><MessageCircle className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">LINE {initial.lineConfig?.official_account_name || initial.lineConfig?.official_account_basic_id || "Official Account"}</p>
            <p className="mt-1 text-sm text-apple-muted">สถานะ: {linked ? "เชื่อมต่อแล้ว" : initial.channel?.line_link_status === "PENDING" ? "รอเชื่อมต่อ" : initial.channel?.line_link_status === "BLOCKED" ? "บัญชีบล็อก Official Account กรุณาเพิ่มเพื่อนใหม่" : "ยังไม่เชื่อมต่อ"}</p>
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
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-apple-blue/5 px-4 py-3 text-xs leading-5 text-apple-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-apple-blue" />
          <p>ผู้ใช้สามารถจัดการเฉพาะการเชื่อมต่อ LINE ของตนเอง ไม่สามารถเปิดหรือปิด Event, Email, LINE หรือการแจ้งเตือนในแอปรายบุคคลได้</p>
        </div>
      </div>
    </section>
  );
}
