import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-apple-line bg-white p-8 shadow-panel">
        <div className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-apple-blue text-2xl font-semibold text-white">
            P
          </div>
          <p className="text-sm font-medium text-apple-muted">Plabin Task Management</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-apple-text">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm leading-6 text-apple-muted">จัดการงาน แชร์ความคืบหน้า และติดตาม Checklist ของทีมในที่เดียว</p>
        </div>
        <Suspense fallback={<div className="h-40 rounded-2xl bg-apple-bg" />}>
          <LoginForm mode="login" />
        </Suspense>
        <p className="mt-6 text-center text-sm text-apple-muted">
          ยังไม่มีบัญชี?{" "}
          <Link className="font-medium text-apple-blue hover:underline" href="/register">
            สมัครใช้งาน
          </Link>
        </p>
      </section>
    </main>
  );
}
