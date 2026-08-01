import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-apple-line bg-white p-8 shadow-panel">
        <div className="mb-4"><BrandLogo size={56} priority /></div>
        <p className="text-sm font-medium text-apple-muted">Plabin Task Management</p>
        <h1 className="mt-2 text-3xl font-semibold text-apple-text">สร้างบัญชีใหม่</h1>
        <p className="mt-2 text-sm leading-6 text-apple-muted">ผู้ใช้คนแรกจะได้สิทธิ์ Admin อัตโนมัติ หลังจากนั้น Admin สามารถเชิญสมาชิกเพิ่มได้</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-40 rounded-2xl bg-apple-bg" />}>
            <LoginForm mode="register" />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-apple-muted">
          มีบัญชีแล้ว?{" "}
          <Link className="font-medium text-apple-blue hover:underline" href="/login">
            เข้าสู่ระบบ
          </Link>
        </p>
      </section>
    </main>
  );
}
