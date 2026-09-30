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

### Algorithm service

```bash
cd apps/algorithm
python -m venv .venv
.venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
pytest
```

## กฎสำคัญ

- ข้อมูลทดสอบเป็น **ข้อมูลสมมติเท่านั้น** ห้ามใส่ข้อมูลผู้ป่วยจริง
- ห้าม commit ไฟล์ `.env`
- ชื่อ collection/field ต้องตรงกับ ER diagram ในรายงาน — แก้ `schema.prisma` แล้วต้องแก้รายงานด้วย
- ใช้ Prisma 6 (Prisma 7 ยังไม่รองรับ MongoDB)
