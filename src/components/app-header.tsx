"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, LogOut, Settings, Tags, Users } from "lucide-react";
import { toast } from "sonner";
import type { AppNotification, Profile } from "@/types/app";
import { logout } from "@/actions/auth-actions";
import { BrandLogo } from "@/components/brand-logo";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notification-actions";
import { initials, relativeThaiTime } from "@/lib/format";

export function AppHeader({
  user,
  notifications
}: {
  user: Profile;
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(notifications);
  const [open, setOpen] = useState(false);
  const [readingAll, setReadingAll] = useState(false);
  const unread = useMemo(() => rows.filter((item) => !item.is_read).length, [rows]);

  useEffect(() => setRows(notifications), [notifications]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  async function read(item: AppNotification) {
    const previousRows = rows;
    setOpen(false);
    if (item.task_id) router.push(`/?task=${item.task_id}`);
    if (!item.is_read) {
      setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)));
      const result = await markNotificationRead(item.id);
      if (!result.ok) {
        setRows(previousRows);
        toast.error(result.message);
        return;
      }
    }
  }

  async function readAll() {
    if (readingAll || unread === 0) return;
    const previousRows = rows;
    setReadingAll(true);
    setRows((current) => current.map((row) => ({ ...row, is_read: true })));
    const result = await markAllNotificationsRead();
    if (!result.ok) {
      setRows(previousRows);
      toast.error(result.message);
    }
    setReadingAll(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-apple-line bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-3" aria-label="ไปหน้า Dashboard">
          <BrandLogo priority />
          <span className="text-base font-semibold text-apple-text">Plabin Task</span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text"
            title="การแจ้งเตือน"
            aria-label={`การแจ้งเตือน ${unread} รายการที่ยังไม่ได้อ่าน`}
            aria-expanded={open}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-apple-red px-1 text-center text-[11px] font-bold leading-5 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>

          {open ? (
            <section className="absolute right-0 top-12 z-40 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
              <div className="flex h-14 items-center gap-2 border-b border-apple-line px-4">
                <h2 className="font-semibold text-apple-text">การแจ้งเตือน</h2>
                <span className="rounded-md bg-apple-bg px-2 py-1 text-xs font-semibold text-apple-muted">{unread} ยังไม่อ่าน</span>
              </div>
              <div className="max-h-[min(480px,70vh)] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <BellRing className="mx-auto h-6 w-6 text-apple-muted" />
                    <p className="mt-3 text-sm text-apple-muted">ยังไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  rows.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => void read(item)}
                      className={`block w-full border-b border-apple-line px-4 py-3 text-left last:border-0 hover:bg-apple-bg ${
                        item.is_read ? "bg-white" : "bg-apple-blue/5"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-apple-text">{item.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-apple-muted">{item.message}</span>
                          <span className="mt-1 block text-[11px] text-apple-muted">{relativeThaiTime(item.created_at)}</span>
                        </span>
                        {!item.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-apple-blue" /> : null}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-apple-line p-2">
                <button
                  type="button"
                  disabled={readingAll || unread === 0}
                  onClick={() => void readAll()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-apple-blue hover:bg-apple-bg disabled:text-apple-muted disabled:opacity-60"
                >
                  <CheckCheck className="h-4 w-4" />
                  {readingAll ? "กำลังบันทึก..." : "อ่านทั้งหมด"}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        {user.role === "ADMIN" ? (
          <>
            <Link className="hidden h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text sm:flex" href="/members" title="จัดการ Users" aria-label="จัดการ Users">
              <Users className="h-5 w-5" />
            </Link>
            <Link className="hidden h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text sm:flex" href="/categories" title="จัดการหมวดหมู่" aria-label="จัดการหมวดหมู่">
              <Tags className="h-5 w-5" />
            </Link>
            <Link className="hidden h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text sm:flex" href="/settings" title="ตั้งค่าระบบแจ้งเตือน" aria-label="ตั้งค่าระบบแจ้งเตือน">
              <Settings className="h-5 w-5" />
            </Link>
          </>
        ) : null}
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg bg-apple-bg py-1 pl-1 pr-3 hover:bg-black/5"
          title="โปรไฟล์ของฉัน"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-xs font-semibold text-apple-text">
            {user.avatar_url ? (
              <Image unoptimized fill sizes="36px" src={user.avatar_url} alt="" className="object-cover" />
            ) : (
              initials(user.display_name || user.email)
            )}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium text-apple-text md:block">{user.display_name || user.email}</span>
        </Link>
        <form action={logout}>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-muted hover:text-apple-red" title="ออกจากระบบ" aria-label="ออกจากระบบ">
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
