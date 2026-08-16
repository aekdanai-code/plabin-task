"use client";

import { useMemo, useState, useTransition } from "react";
import { MailPlus, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { deactivateMember, inviteMember, reactivateMember, updateMember } from "@/actions/member-actions";
import type { MemberWithLineStatus } from "@/types/app";
import { formatThaiDate, initials } from "@/lib/format";

export function MemberManagement({ members, currentUserId }: { members: MemberWithLineStatus[]; currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return members;
    return members.filter((member) => `${member.email} ${member.display_name ?? ""}`.toLowerCase().includes(clean));
  }, [members, query]);

  function invite(formData: FormData) {
    startTransition(async () => {
      const result = await inviteMember(String(formData.get("email") ?? ""));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function changeRole(member: MemberWithLineStatus, role: "ADMIN" | "USER") {
    startTransition(async () => {
      const result = await updateMember(member.id, { role });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function toggleActive(member: MemberWithLineStatus) {
    startTransition(async () => {
      const result = member.is_active ? await deactivateMember(member.id) : await reactivateMember(member.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-apple bg-white p-5 shadow-soft">
        <form action={invite} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium text-apple-text">เชิญสมาชิกด้วยอีเมล</span>
            <input required name="email" type="email" className="mt-2 w-full rounded-2xl border border-apple-line px-4 py-3 text-sm focus:border-apple-blue" placeholder="member@example.com" />
          </label>
          <button disabled={isPending} className="self-end rounded-full bg-apple-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            <MailPlus className="mr-2 inline h-4 w-4" /> ส่งคำเชิญ
          </button>
        </form>
      </section>
      <section className="rounded-apple bg-white p-5 shadow-soft">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-full bg-apple-bg py-3 pl-11 pr-4 text-sm" placeholder="ค้นหาสมาชิก" />
        </div>
        <div className="divide-y divide-apple-line/70">
          {filtered.map((member) => (
            <div key={member.id} className="grid gap-3 py-4 md:grid-cols-[1fr_140px_140px_140px] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-apple-bg text-sm font-semibold text-apple-text">
                  {initials(member.display_name || member.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-apple-text">{member.display_name || member.email}</p>
                  <p className="truncate text-sm text-apple-muted">{member.email}</p>
                  <LineConnectionBadge member={member} />
                </div>
              </div>
              <select
                value={member.role}
                disabled={isPending || member.id === currentUserId}
                onChange={(event) => changeRole(member, event.target.value as "ADMIN" | "USER")}
                className="rounded-lg bg-apple-bg px-4 py-2 text-sm disabled:opacity-60"
              >
                <option value="ADMIN">Admin</option>
                <option value="USER">User</option>
              </select>
              <button
                onClick={() => toggleActive(member)}
                disabled={isPending || member.id === currentUserId}
                className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${member.is_active ? "bg-apple-green/15 text-apple-green" : "bg-apple-red/15 text-apple-red"}`}
              >
                {member.is_active ? "Active" : "Inactive"}
              </button>
              <time className="text-sm text-apple-muted" title={formatThaiDate(member.created_at)}>
                {formatThaiDate(member.created_at)}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LineConnectionBadge({ member }: { member: MemberWithLineStatus }) {
  const status = member.line_link_status;
  const presentation = status === "LINKED"
    ? { label: "เชื่อม LINE แล้ว", className: "bg-[#06C755]/10 text-[#049b43]" }
    : status === "PENDING"
      ? { label: "รอเชื่อม LINE", className: "bg-amber-50 text-amber-700" }
      : status === "BLOCKED"
        ? { label: "LINE ถูกบล็อก", className: "bg-apple-red/10 text-apple-red" }
        : { label: "ยังไม่เชื่อม LINE", className: "bg-apple-bg text-apple-muted" };

  return (
    <span
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${presentation.className}`}
      title={status === "LINKED" && member.line_linked_at ? `เชื่อมเมื่อ ${formatThaiDate(member.line_linked_at)}` : presentation.label}
    >
      <MessageCircle className={`h-3.5 w-3.5 ${status === "LINKED" ? "fill-current" : ""}`} />
      {presentation.label}
    </span>
  );
}
