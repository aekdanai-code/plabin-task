# Plabin Task

Plabin Task เวอร์ชัน Next.js + Supabase สำหรับ deploy ผ่าน GitHub และ Vercel โดยย้ายความสามารถจาก Google Apps Script เดิมมาไว้ใน Web App นี้

## ความสามารถ

- รายละเอียด Task แบบ Rich Text พร้อมหัวข้อ รายการ และลิงก์ โดยรองรับข้อความเดิม
- แกลเลอรี JPG/PNG/WebP สูงสุด 10 รูปต่อ Task และ 3 MB ต่อรูป พร้อมเรียงลำดับและดูภาพเต็ม
- Supabase Auth และ Role `Admin` / `User`
- Task, Category, Checklist แบบ Weight และ Progress อัตโนมัติ
- สถานะ `ที่ต้องทำ` สีน้ำเงิน, `กำลังดำเนินการ` สีส้ม, `เสร็จสิ้น` สีเขียว
- สีประจำ Category บน Task card
- Share ด้วยสิทธิ์ Viewer, Checker และ Editor
- เลือกผู้รับ Share จาก dropdown ที่แสดง Display Name และเลือกซ้ำไม่ได้
- Clone Task จาก card โดยเริ่ม Progress ใหม่และไม่คัดลอกผู้รับ Share
- Notification ภายใน App เมื่อได้รับ Share
- Notification ผ่าน SMTP Email และ LINE Official Account แบบรายบุคคล
- Admin เลือก Event/Channel และแก้ Template ได้ พร้อม Queue, Retry และ Delivery log
- Due date, แจ้งเตือนก่อนครบกำหนด และแจ้ง Task เกินกำหนด
- ปุ่ม `แจ้งทีม` ใน Task ที่มีผู้รับ Share โดยไม่แจ้งกลับหาผู้กด
- Search, filter, Archive/Restore และ sort เริ่มต้นด้วย `แก้ไขล่าสุด`
- เมนู Admin สำหรับจัดการ Category และ Users
- โปรไฟล์สมาชิก รูปโปรไฟล์ ข้อมูลติดต่อ และอีเมลแบบอ่านอย่างเดียว
- ส่งลิงก์เปลี่ยนรหัสผ่าน ดูวันที่เปลี่ยนล่าสุด และออกจากระบบทุกอุปกรณ์
- เก็บ Activity Log ในฐานข้อมูล แต่ไม่แสดงในหน้า Web App
- Row Level Security, explicit Data API grants และ server-only service role key

## เริ่มต้น

```bash
npm ci
cp .env.example .env.local
npm run dev
```

เปิด `http://localhost:3000`

## ฐานข้อมูล

รันไฟล์ตามลำดับใน Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_update_task_with_items.sql`
3. `supabase/migrations/003_notification_center_idempotency.sql`
4. `supabase/migrations/004_clone_task_idempotency.sql`
5. `supabase/migrations/005_user_profiles.sql`
6. `supabase/migrations/20260815033952_notification_delivery_system.sql`
7. `supabase/seed.sql`

ผู้ใช้คนแรกที่สมัครจะเป็น `ADMIN` อัตโนมัติ ผู้ใช้หลังจากนั้นเป็น `USER`

### นำเข้าข้อมูลจาก Task.xlsx

ไฟล์ `supabase/seed2.sql` ใช้สำหรับนำเข้าข้อมูลจริงที่แปลงจาก `Task.xlsx` ก่อนรันต้องสร้างผู้ใช้ทั้ง 4 อีเมลที่ระบุไว้ด้านบนของไฟล์ผ่าน Supabase Authentication จากนั้นจึงรัน `seed2.sql` ใน SQL Editor ได้โดยตรง ไฟล์เป็น transaction และรองรับการรันซ้ำ

## ตรวจสอบก่อน Deploy

```bash
npm run typecheck
npm run build
```

ดูขั้นตอน Supabase, GitHub และ Vercel แบบละเอียดใน [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)

สำหรับอัปเกรด Rich Text และแกลเลอรี ใช้ [TASK_GALLERY_DEPLOYMENT.md](./TASK_GALLERY_DEPLOYMENT.md) และ migration `20260918052407_task_rich_text_gallery.sql` ก่อน deploy โค้ดใหม่

ทดสอบ validation ด้วย Node.js 24: `node --experimental-strip-types --test tests/task-content.test.mjs`
