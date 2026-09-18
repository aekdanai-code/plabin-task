# อัปเกรด Task Rich Text + Gallery

ไฟล์แอปอยู่ในโฟลเดอร์ `plabin-task` และเชื่อม GitHub repository `https://github.com/aekdanai-code/plabin-task` แล้ว

## สถานะการตรวจสอบ

- TypeScript และ production build ผ่าน
- ชุดทดสอบ validation ผ่าน: ขนาด 3 MB, ชนิดไฟล์, ข้อความเดิม, Rich Text, ลิงก์ที่ไม่ปลอดภัย และขนาด/ความลึกของเอกสาร
- สร้าง schema จาก migration ใหม่ใน PostgreSQL ชั่วคราวสำเร็จ
- ทดสอบฐานข้อมูลในเครื่องผ่าน: RLS ของ Owner/Viewer/Editor/บุคคลภายนอก, ขนาดและชนิดไฟล์, การบันทึกแบบ transaction, ลำดับรูป, การลองซ้ำ, ข้อมูลล้าสมัย, ยกเลิก และลบรูป
- ทดสอบคอมโพเนนต์จริงผ่าน Chrome ด้วยรูปจำลอง: Tiptap, การแสดง Rich Text, thumbnails, Modal, ก่อนหน้า/ถัดไป/Esc, ปฏิเสธรูปเกิน 3 MB, เลือก/นำรูปออก และหน้าจอมือถือ
- ยังต้องทดสอบการอัปโหลดครบวงจรกับ Supabase จริงหลังติดตั้ง migration
- ยังไม่ได้ commit, push, apply migration บน Supabase จริง หรือ deploy

## 1. อัปโหลดโค้ดขึ้น GitHub เป็น branch สำหรับตรวจงาน

เปิด Terminal แล้วรัน:

```bash
cd "/Users/loftster/Mac HD/CodexApps/Task/plabin-task"
git switch -c feat/task-gallery-richtext
git status --short
git add next.config.ts package.json package-lock.json src tests README.md TASK_GALLERY_DEPLOYMENT.md supabase/migrations/20260918052407_task_rich_text_gallery.sql
git diff --cached --stat
git commit -m "feat: add task rich text and image gallery with 3 MB limit"
git push -u origin feat/task-gallery-richtext
```

ถ้ามี branch ชื่อนี้แล้ว ให้ใช้ `git switch feat/task-gallery-richtext` แทนการสร้างใหม่

เปิด repository บน GitHub เลือก **Compare & pull request** และเลือก branch ปลายทางที่ใช้ Production ของโปรเจกต์ ตรวจ diff ก่อน merge ไม่ต้อง `git init` หรือเพิ่ม remote ใหม่ และไม่เพิ่ม `.env.local` เข้า Git

ถ้าเชื่อม Vercel ไว้แล้ว การ push branch ที่ไม่ใช่ Production อาจสร้าง Preview deployment โดยอัตโนมัติ ให้ปรับ Supabase ให้พร้อมก่อนทดสอบ Preview เวอร์ชันใหม่

## 2. เพิ่ม schema และ Storage ใน Supabase

โค้ดใหม่นี้ต้องใช้ migration ใหม่ก่อนใช้งานจริง ไม่ต้องสร้าง bucket หรือตารางด้วยมือแยกต่างหาก

1. เปิด `https://supabase.com/dashboard/project/imlhrjnrspzzfnncdrht/sql/new`
2. เปิดไฟล์ `supabase/migrations/20260918052407_task_rich_text_gallery.sql` จากโปรเจกต์
3. คัดลอกเนื้อหาทั้งไฟล์ ตั้งแต่ `begin;` จนถึง `commit;` รวม comment ด้านบนได้
4. วางใน **SQL Editor** แล้วกด **Run** ครั้งเดียว ถ้าเกิดข้อผิดพลาด ให้เก็บข้อความ error และแก้สาเหตุก่อนรันซ้ำ
5. ตรวจด้วย SQL ต่อไปนี้:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
  and column_name = 'description_richtext';

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'task-images';

select tablename, rowsecurity
from pg_tables where schemaname = 'public' and tablename = 'task_images';

select policyname, cmd
from pg_policies
where schemaname = 'storage' and policyname like 'task_image_objects_%';
```

ผลที่ต้องได้: คอลัมน์ `description_richtext` ชนิด `jsonb`, bucket `task-images` เป็น **private** (`public = false`), `file_size_limit = 3145728`, รองรับ JPEG/PNG/WebP และตาราง `task_images` เปิด RLS

Migration นี้ใช้ schema เดิมของแอป รวมถึง `private.mutation_requests`, `create_task_with_items`, `update_task_with_items` และคอลัมน์ `due_at`/`due_timezone` ซึ่งพบในโปรเจกต์ที่เชื่อมอยู่แล้ว

รายการ migration ในเครื่องและ Supabase เดิมมีบางรายการไม่ตรงกัน จึงไม่ควรใช้ `supabase db push` ทั้งโฟลเดอร์โดยยังไม่ตรวจประวัติ การรัน SQL Editor ไม่บันทึก migration history อัตโนมัติ ก่อนใช้ CLI ในอนาคตต้องปรับประวัติให้ตรงกับ schema ที่ใช้จริงตามเอกสาร Supabase ไม่ต้องรัน migrations เก่าซ้ำเพื่อติดตั้งฟีเจอร์นี้

## 3. ทดสอบก่อน Merge / Deploy Production

ใช้ Node.js 24 แล้วรัน:

```bash
npm ci
npm run typecheck
node --experimental-strip-types --test tests/task-content.test.mjs
npm run build
npm run dev
```

เปิดแอปและตรวจ:

1. สร้าง Task พร้อม Rich Text และรูป 2–3 รูป จากนั้นโหลดหน้าใหม่และตรวจว่าเนื้อหา/ลำดับรูปยังอยู่
2. ไฟล์ขนาด 3 MB อัปโหลดได้ และเกิน 3 MB ถูกปฏิเสธ ไฟล์ที่ 11 ต้องเพิ่มไม่ได้
3. ภาพย่อทุกภาพอยู่ใต้รายละเอียด กดแล้วเปิดภาพเต็ม เลื่อนก่อนหน้า/ถัดไปและปิดด้วย Esc ได้
4. แก้ไขแล้วนำรูปออก แต่กดยกเลิก รูปเดิมต้องยังอยู่ เมื่อนำออกแล้วบันทึกสำเร็จจึงหาย
5. ทดสอบด้วยผู้รับแชร์ Viewer และ Checker: ดูรูปได้ แต่เพิ่ม/ลบรูปหรือแก้รายละเอียดไม่ได้ ส่วน Editor ทำได้
6. สมาชิกที่ไม่ได้รับแชร์เปิด URL รูปโดยตรงไม่ได้ และเมื่อยกเลิกแชร์แล้วคำขอโหลดรูปใหม่ต้องถูกปฏิเสธ
7. จำลองอัปโหลดล้มเหลว แล้วลองใหม่ ข้อความในฟอร์มต้องอยู่ครบและไม่สร้าง Task ซ้ำ
8. ตรวจบนมือถือว่ากริดภาพและ Modal ไม่ล้นหน้าจอ

## 4. เผยแพร่เวอร์ชันใหม่

หลังทดสอบครบ ให้ merge Pull Request เข้า Production branch ของ repository ถ้าโปรเจกต์เชื่อม Vercel แล้ว ระบบจะ build/deploy ตาม branch ที่ตั้งไว้ ตรวจให้ deployment เป็น **Ready** ก่อนเปิดเว็บจริงทดสอบอีกครั้ง

GitHub เก็บโค้ด, Supabase เก็บฐานข้อมูลและไฟล์รูป, ส่วน Vercel รันแอป Next.js การ push GitHub อย่างเดียวไม่ได้รัน SQL migration ให้ Supabase

ฟีเจอร์นี้ใช้ Supabase URL/anon key และ session เดิม ไม่ต้องเพิ่ม service role key เพื่ออัปโหลดรูป

## พฤติกรรมที่ควรรู้

- รูปใหม่จะอัปโหลดเมื่อกดบันทึก ถ้าอัปโหลดไม่ครบจะไม่เปลี่ยน Task
- รายละเอียด, วันครบกำหนด, Checklist, รายชื่อแชร์ และลำดับรูปบันทึกใน transaction เดียว
- เมื่อมีคนแก้ Task ระหว่างเปิดฟอร์ม ระบบจะให้เปิดข้อมูลใหม่ก่อนบันทึกเพื่อไม่เขียนทับงานของคนอื่น
- การนำรูปออกมีผลเมื่อบันทึกสำเร็จ จากนั้นจึงล้างไฟล์ใน Storage ถ้าล้างไฟล์ล้มเหลวจะมีข้อความแจ้ง แต่รูปนั้นไม่แสดงใน Task แล้ว
- การปิดแท็บกะทันหันอาจเหลือไฟล์ staging ที่ยังไม่ผูก Task; ยังไม่มีงาน cleanup ตามเวลา ควรเพิ่มก่อนใช้งานในปริมาณมาก
- การ Clone Task เดิมยังคัดลอกข้อความธรรมดาและ Checklist ไม่คัดลอกแกลเลอรีหรือรูปแบบ Rich Text

เอกสารอ้างอิง: [GitHub Pull Requests](https://docs.github.com/en/pull-requests/get-started/pull-request-quickstart), [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Vercel Git deployments](https://vercel.com/docs/git)
