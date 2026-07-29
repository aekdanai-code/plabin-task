"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, LogOut, Settings, Users, X } from "lucide-react";
import type { AppNotification, Profile } from "@/types/app";
import { logout } from "@/actions/auth-actions";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notification-actions";
import { initials, relativeThaiTime } from "@/lib/format";

export function AppHeader({ user, notifications }: { user: Profile; notifications: AppNotification[] }) {
  const [rows, setRows] = useState(notifications);
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<AppNotification | null>(null);
  const [, startTransition] = useTransition();
  const unread = useMemo(() => rows.filter((item) => !item.is_read).length, [rows]);

  useEffect(() => {
    const firstUnread = notifications.find((item) => !item.is_read);
    if (firstUnread) setPopup(firstUnread);
  }, [notifications]);

  function read(item: AppNotification) {
    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)));
    setPopup(null);
    startTransition(async () => {
      await markNotificationRead(item.id);
    });
  }

  function readAll() {
    setRows((current) => current.map((row) => ({ ...row, is_read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-apple-line bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" className="mr-auto flex items-center gap-3" aria-label="ไปหน้า Dashboard">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-blue font-semibold text-white">P</span>
            <span className="text-base font-semibold text-apple-text">Plabin Task</span>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text"
              title="การแจ้งเตือน"
              aria-label={`การแจ้งเตือน ${unread} รายการที่ยังไม่ได้อ่าน`}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-apple-red px-1 text-center text-[11px] font-bold leading-5 text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
            {open ? (
              <section className="absolute right-0 top-12 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
                <div className="flex items-center justify-between border-b border-apple-line px-4 py-3">
                  <h2 className="font-semibold text-apple-text">การแจ้งเตือน</h2>
                  <button type="button" onClick={readAll} className="flex items-center gap-1 text-xs font-semibold text-apple-blue">
                    <CheckCheck className="h-4 w-4" /> อ่านทั้งหมด
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {rows.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-apple-muted">ยังไม่มีการแจ้งเตือน</p>
                  ) : (
                    rows.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => read(item)}
                        className={`block w-full border-b border-apple-line px-4 py-3 text-left last:border-0 ${
                          item.is_read ? "bg-white" : "bg-apple-blue/5"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-apple-text">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-apple-muted">{item.message}</span>
                        <span className="mt-1 block text-[11px] text-apple-muted">{relativeThaiTime(item.created_at)}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ) : null}
          </div>

          {user.role === "ADMIN" ? (
            <>
              <Link className="hidden h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text sm:flex" href="/members" title="จัดการ Users" aria-label="จัดการ Users">
                <Users className="h-5 w-5" />
              </Link>
              <Link className="hidden h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-text sm:flex" href="/settings" title="จัดการหมวดหมู่" aria-label="จัดการหมวดหมู่">
                <Settings className="h-5 w-5" />
              </Link>
            </>
          ) : null}
          <div className="flex items-center gap-2 rounded-lg bg-apple-bg py-1 pl-1 pr-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-xs font-semibold text-apple-text">
              {initials(user.display_name || user.email)}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium text-apple-text md:block">{user.display_name || user.email}</span>
          </div>
          <form action={logout}>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-muted hover:text-apple-red" title="ออกจากระบบ" aria-label="ออกจากระบบ">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </header>

      {popup ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
          <section className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-panel">
            <button
              type="button"
              onClick={() => read(popup)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-apple-bg"
              title="ปิด"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
            <Bell className="h-7 w-7 text-apple-blue" />
            <h2 className="mt-4 pr-8 text-xl font-semibold text-apple-text">{popup.title}</h2>
            <p className="mt-2 text-sm leading-6 text-apple-muted">{popup.message}</p>
            <button type="button" onClick={() => read(popup)} className="mt-5 w-full rounded-lg bg-apple-blue px-4 py-3 text-sm font-semibold text-white">
              รับทราบ
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
