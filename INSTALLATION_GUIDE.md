# ติดตั้ง Plabin Task บน Supabase, GitHub และ Vercel

## 1. สร้าง Supabase

1. สร้าง Project ที่ Supabase และเลือก Region ใกล้ผู้ใช้ เช่น Singapore
2. ไปที่ `SQL Editor`
3. รันไฟล์ใน `supabase/migrations` ตามลำดับ ตั้งแต่ `001_initial_schema.sql` เป็นต้นไป
4. รัน `supabase/seed.sql`
5. ไปที่ `Authentication > Providers` และเปิด Email
6. ไปที่ `Project Settings > API` เพื่อเก็บ Project URL, anon key และ service role key

Migration เปิด RLS ทุกตารางใน `public`, จำกัด function ที่เป็น `security definer` และกำหนด `GRANT` ให้ role `authenticated` ไว้แล้ว ห้ามนำ service role key ไปใช้ใน Client Component

## 2. ตั้งค่า Local

สร้าง `.env.local` จาก `.env.example` แล้วใส่ค่าจริง:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

จากนั้นรัน:

```bash
npm ci
npm run dev
```

เปิด `http://localhost:3000/register` บัญชีแรกจะได้ Role `ADMIN`

`SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะ Server Action สำหรับเชิญ User จากหน้า Admin หากไม่ใช้ฟังก์ชันเชิญสมาชิก สามารถเว้นค่านี้ใน local ได้

## 3. ทดสอบสิทธิ์

สร้างอย่างน้อย 2 บัญชี แล้วตรวจ:

1. Owner สร้าง แก้ไข แชร์ Archive และลบ Task ได้
2. Viewer ดูและ Clone ได้ แต่แก้ Checklist ไม่ได้
3. Checker ดู Clone และติ๊ก Checklist ได้
4. Editor ดู Clone แก้ Task/Checklist และกดแจ้งทีมได้ แต่ Archive หรือลบไม่ได้
5. ผู้รับ Share เห็น popup notification เมื่อเข้า App
6. ปุ่มแจ้งทีมไม่ส่ง notification กลับหาผู้กด
7. User ทั่วไปเข้าเมนูจัดการ Category และ Users ไม่ได้

## 4. Push ไป GitHub

สร้าง repository เปล่าบน GitHub จากนั้นรันในโฟลเดอร์ `plabin-task`:

```bash
git init
git add .
git commit -m "Initial Plabin Task Supabase app"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/plabin-task.git
git push -u origin main
```

ไฟล์ `.env.local`, `.env` และ `.next` ถูกตัดออกด้วย `.gitignore`

## 5. Deploy ผ่าน Vercel

1. เข้า Vercel แล้วเลือก `Add New > Project`
2. Import repository `plabin-task` จาก GitHub
3. Framework Preset เลือก Next.js
4. เพิ่ม Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

5. ตั้ง `NEXT_PUBLIC_APP_URL` เป็น production URL เช่น `https://plabin-task.vercel.app`
6. กด Deploy

ทุกครั้งที่ push เข้า branch `main` Vercel จะ build และ deploy เวอร์ชันใหม่อัตโนมัติ

## 6. ตั้ง Redirect URL

ใน Supabase ไปที่ `Authentication > URL Configuration`:

- Site URL: URL production ของ Vercel
- Redirect URLs:

```text
http://localhost:3000/**
https://YOUR_DOMAIN.vercel.app/**
```

## 7. ตรวจ Production

```bash
npm run typecheck
npm run build
```

หลัง Deploy ให้ทดสอบ Login, Share, Notification, Role, Clone, Archive และ Checklist อีกครั้งด้วยบัญชี Admin/User คนละ Browser profile
