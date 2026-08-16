# ติดตั้ง Plabin Task บน Supabase, GitHub และ Vercel

## 1. สร้าง Supabase

1. สร้าง Project ที่ Supabase และเลือก Region ใกล้ผู้ใช้ เช่น Singapore
2. ไปที่ `SQL Editor`
3. รันไฟล์ใน `supabase/migrations` ตามลำดับ ตั้งแต่ `001_initial_schema.sql` เป็นต้นไป
4. รัน `supabase/seed.sql`
5. ไปที่ `Authentication > Providers` และเปิด Email
6. ไปที่ `Project Settings > API` เพื่อเก็บ Project URL, anon key และ service role key

Migration เปิด RLS ทุกตารางใน `public`, จำกัด function ที่เป็น `security definer` และกำหนด `GRANT` ให้ role `authenticated` ไว้แล้ว ห้ามนำ service role key ไปใช้ใน Client Component
หากใช้ระบบเปลี่ยนรหัสผ่านใน Production ให้ตั้ง Custom SMTP ที่ `Authentication > SMTP Settings` เพื่อให้ส่งอีเมลได้ตามปริมาณใช้งานจริง

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

## 4. ตั้งค่าระบบแจ้งเตือน Email และ LINE

Migration `20260815033952_notification_delivery_system.sql` เพิ่ม Supabase Queue, Vault, Cron, Event rules, Templates, Delivery log และ Due date ให้รัน migration นี้ก่อน deploy Edge Functions

Migration ครอบด้วย `begin`/`commit` และเปิด RLS ให้ตารางใหม่ทั้งหมดเอง หาก SQL Editor แสดงคำเตือนแบบ static ว่า query สร้างตารางโดยไม่มี RLS ให้ตรวจว่าใช้ไฟล์เวอร์ชันล่าสุด แล้วเลือก `Run without RLS` เพื่อไม่ให้ Dashboard แทรกคำสั่งเพิ่ม เพราะภายใน migration มี `enable row level security` และ policies ที่กำหนดสิทธิ์เฉพาะไว้แล้ว ห้ามใช้ไฟล์เวอร์ชันเก่าที่มีคำสั่ง `revoke all on all functions in schema vault` เนื่องจาก Hosted Supabase ไม่อนุญาตให้เปลี่ยนสิทธิ์ฟังก์ชันเข้ารหัสภายในของ Vault

ติดตั้ง Supabase CLI และเชื่อม project จากนั้น deploy Functions:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy notification-delivery-worker
supabase functions deploy line-webhook
supabase secrets set NOTIFICATION_CRON_SECRET=YOUR_LONG_RANDOM_SECRET
```

ตั้ง Webhook URL ใน LINE Developers Console เป็น:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook
```

จากนั้นเปิด Use webhook และกรอก LINE Channel ID, Channel access token, Channel secret, Basic ID และ Add friend URL ที่หน้า `Admin > Settings > LINE`

ตั้งค่า SMTP ที่หน้า `Admin > Settings > SMTP` โดย Password จะถูกบันทึกใน Supabase Vault และไม่ถูกส่งกลับมาที่ Browser หลังบันทึก

สร้าง secrets สำหรับ Cron ใน Supabase SQL Editor โดยแทนค่าตัวอย่างก่อนรัน:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'notification_project_url',
  'Plabin Task notification worker URL'
);

select vault.create_secret(
  'YOUR_LONG_RANDOM_SECRET',
  'notification_cron_secret',
  'Plabin Task notification worker authorization'
);
```

เรียก worker ทุก 1 นาทีด้วย Supabase Cron:

```sql
select cron.schedule(
  'plabin-notification-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notification_project_url') || '/functions/v1/notification-delivery-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notification_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

สมาชิกแต่ละคนต้องเข้า `โปรไฟล์ > การแจ้งเตือนของฉัน` เพิ่ม LINE Official Account สร้างรหัสเชื่อม และส่งข้อความ `LINK XXXXXXXX` ให้ Official Account ก่อนรับ LINE ส่วนตัว

ตรวจระบบด้วยปุ่ม `ส่งทดสอบ` ในหน้า SMTP/LINE และตรวจผลที่แท็บ Delivery log

## 5. Push ไป GitHub

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

## 6. Deploy ผ่าน Vercel

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

## 7. ตั้ง Redirect URL

ใน Supabase ไปที่ `Authentication > URL Configuration`:

- Site URL: URL production ของ Vercel
- Redirect URLs:

```text
http://localhost:3000/**
https://YOUR_DOMAIN.vercel.app/**
```

## 8. ตรวจ Production

```bash
npm run typecheck
npm run build
```

หลัง Deploy ให้ทดสอบ Login, Profile, อัปโหลดรูป, อีเมลเปลี่ยนรหัสผ่าน, Share, Notification, Role, Clone, Archive และ Checklist อีกครั้งด้วยบัญชี Admin/User คนละ Browser profile
