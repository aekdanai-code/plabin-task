import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-apple-line bg-white p-8 shadow-panel">
        <h1 className="text-3xl font-semibold text-apple-text">ลืมรหัสผ่าน</h1>
        <p className="mt-3 text-sm leading-6 text-apple-muted">
          เปิด Supabase Dashboard แล้วใช้เมนู Authentication เพื่อส่งลิงก์ reset password ให้ผู้ใช้ หรือเพิ่ม flow นี้ต่อได้จาก Supabase Auth API
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-apple-blue px-5 py-3 text-sm font-semibold text-white" href="/login">
          กลับไป Login
        </Link>
      </section>
    </main>
  );
}
