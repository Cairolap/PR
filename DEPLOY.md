# ขึ้น Cloudflare Workers

เว็บนี้ไม่มีระบบล็อกอินตามที่เลือกไว้: ผู้ที่มีลิงก์สามารถเพิ่ม แก้ไข หรือจัดเก็บข้อมูลได้ จึงไม่ควรใส่ข้อมูลที่เป็นความลับหรือแชร์ URL แบบสาธารณะวงกว้าง

## ติดตั้งและสร้างฐานข้อมูล

1. เปิด Terminal ในโฟลเดอร์นี้ แล้วติดตั้งเครื่องมือ:

   ```powershell
   npm install
   npx wrangler login
   ```

2. สร้าง D1 database:

   ```powershell
   npm run db:create
   ```

3. นำค่า `database_id` ที่คำสั่งแสดง ไปแทนข้อความ `REPLACE_WITH_YOUR_D1_DATABASE_ID` ใน `wrangler.jsonc`

4. สร้างตารางบน Cloudflare:

   ```powershell
   npm run db:migrate:remote
   ```

5. ตรวจสอบบนเครื่อง (ใช้ฐานข้อมูล D1 จำลอง) และ deploy:

   ```powershell
   npm run dev
   npm run deploy
   ```

Wrangler จะแสดง URL `workers.dev` หลัง deploy ซึ่งเปิดใช้งานได้ทันทีโดยไม่ต้องล็อกอิน

## การจัดเก็บข้อมูล

- ไม่มี API หรือปุ่มลบข้อมูล
- ปุ่ม **จัดเก็บ** จะซ่อนรายการจากหน้าหลัก โดยยังเก็บใน D1
- ปุ่ม **รายการที่เก็บ** ใช้เปิดดูและ **นำกลับ** สู่หน้าหลัก
- ไม่มี Cron หรืองานอัตโนมัติลบรายการอายุเกิน 2 ปี
