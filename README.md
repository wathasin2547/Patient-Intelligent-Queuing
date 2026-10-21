# PIQ — Patient Intelligent Queuing

ระบบจัดการคิวผู้ป่วย walk-in ผ่าน LINE OA (ปริญญานิพนธ์ คณะเทคโนโลยีสารสนเทศ สจล.)

| โฟลเดอร์ | คืออะไร |
|---|---|
| `apps/web` | Next.js (App Router, TypeScript, Tailwind) — หน้าเจ้าหน้าที่ + LIFF + API + Prisma |
| `apps/algorithm` | Python FastAPI — อัลกอริทึมคัดกรอง (เรียกจาก Next.js เท่านั้น) |

ต้องมี Node.js 20+ และ Python 3.11+

## ตั้งค่าครั้งแรก

### Web + ฐานข้อมูล

```bash
cd apps/web
npm install
cp .env.example .env      # แล้วใส่ DATABASE_URL, SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD
npm run db:push           # สร้าง collection ตาม prisma/schema.prisma
npm run db:seed           # ใส่ข้อมูลสมมติ (ลบข้อมูลเดิมใน database piq ทั้งหมด)
npm run dev               # http://localhost:3000
```

### หน้าเว็บ (ตอนนี้ใช้ข้อมูลสมมติในเบราว์เซอร์ ยังไม่ต่อ DB)

`npm run dev` แล้วเปิด http://localhost:3000 จะเห็นลิงก์ทุกหน้าแยกตามผู้ใช้

| หน้า | Use case |
|---|---|
| `/login` | UC02 (บัญชีทดลอง `admin`, `staff.med`; `staff.old` = ถูกระงับ) |
| `/staff` | UC07 Dashboard (กราฟรายแผนก รายชั่วโมง ระดับสี + คิวของแพทย์แต่ละท่าน) |
| `/staff/queues` | UC10 จัดการคิว + UC13 ประวัติการเรียกคิว + ปุ่มจำลองผู้ป่วยรับคิวจาก LINE |
| `/staff/queues/[id]` | UC08 ตรวจสอบ/แก้ไขผลคัดกรอง + UC09 บันทึกผลการตรวจ |
| `/staff/schedule` | UC11 ตารางเวร + คิวนัดหมาย (ยืนยันมาถึง → เข้าคิว) |
| `/staff/master` | UC12 ข้อมูลพื้นฐาน (ADMIN) |
| `/liff`, `/liff/register`, `/liff/queue`, `/liff/medicine` | UC01, UC05, UC06 ฝั่งผู้ป่วย |
| `/display` | จอเรียกคิวหน้าห้องตรวจ (UC13) |

- ข้อมูลอยู่ใน `lib/mock/` (field ตรงกับ ER) เก็บใน localStorage — ปุ่ม "รีเซ็ตข้อมูล" ที่แถบบนคืนค่าเริ่มต้น
- เวลาเป็น **เวลาจำลอง** เริ่ม 10:30 น. เสมอ กด +5/+15 นาทีเพื่อดูผลของเวลารอ (aging) และการบันทึกว่าไม่มา
- กฎการจัดคิว/เรียกคิวอยู่ที่ `lib/mock/logic.ts` (ตรงกับ `apps/algorithm`) — ตอนต่อ DB ให้ย้ายไปฝั่ง API
  แล้วแทน `update(...)` ใน `lib/mock/store.tsx` ด้วยการเรียก `/api/*`

### Algorithm service

```bash
cd apps/algorithm
python -m venv .venv
.venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # ใส่ DATABASE_URL เดียวกับ apps/web
uvicorn main:app --reload --port 8000   # เอกสาร API: http://localhost:8000/docs
pytest                    # เทสไม่ต้องต่อ DB (ใช้ data/catalog.json)
python -m scripts.evaluate_vignettes    # วัดผลชุด vignettes (บทที่ 4)
python -m scripts.evaluate_ktas <path>.xlsx  # เทียบระดับความเร่งด่วนกับ KTAS (ไฟล์อยู่นอก repo)
python -m scripts.simulate_queue [--alpha|--load]  # จำลองเวลารอ: แบบเดิม vs PIQ ทีละกลไก
```

| Endpoint | ใช้ตอนไหน |
|---|---|
| `POST /triage` | Next.js ส่งคำตอบซักประวัติมา → ได้แผนก ระดับสี เหตุผล แพทย์ที่อยู่เวร และคะแนนคิว |
| `POST /queue/next` | แพทย์บันทึกผลตรวจ (DONE/NO_SHOW) → ได้คิวถัดไปตามสูตร aging ให้ Next.js เรียกอัตโนมัติ |

service นี้ **อ่าน DB อย่างเดียว** — การบันทึก screening/queue และแจ้ง LINE เป็นหน้าที่ของ Next.js

## ข้อมูลสมมติ (`data/`)

- `catalog.json` — แผนก รหัสอาการ น้ำหนัก คำถาม แพทย์ ใช้ทั้ง `npm run db:seed` และเทสฝั่ง Python
- `vignettes.json` — ชุดกรณีศึกษาจำลอง คำตอบที่คาดหวังเขียนจากมุมมองทางคลินิก ไม่ได้คำนวณจากน้ำหนัก
  **อย่าปรับน้ำหนักให้ตรง vignettes ทีละเคส** ไม่งั้นผลวัดในบทที่ 4 จะไม่มีความหมาย

## กฎสำคัญ

- ข้อมูลทดสอบเป็น **ข้อมูลสมมติเท่านั้น** ห้ามใส่ข้อมูลผู้ป่วยจริง
- ห้าม commit ไฟล์ `.env`
- ชื่อ collection/field ต้องตรงกับ ER diagram ในรายงาน — แก้ `schema.prisma` แล้วต้องแก้รายงานด้วย
- ใช้ Prisma 6 (Prisma 7 ยังไม่รองรับ MongoDB)
