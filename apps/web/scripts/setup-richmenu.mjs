// รัน: node --env-file=.env scripts/setup-richmenu.mjs
// สร้าง Rich Menu ใหม่ อัปโหลดรูป แล้วตั้งเป็นเมนูเริ่มต้นของทุกคน
import { readFile } from "node:fs/promises";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env");

const auth = { Authorization: `Bearer ${token}` };

// 4 ช่อง แต่ละช่องกว้าง 1250 สูง 843
const cell = (col, row, label, text) => ({
  bounds: { x: col * 1250, y: row * 843, width: 1250, height: 843 },
  action: { type: "message", label, text },
});

const menu = {
  size: { width: 2500, height: 1686 },
  selected: true, // เปิดเมนูค้างไว้ตั้งแต่เข้าแชต
  name: "PIQ main menu",
  chatBarText: "เมนู",
  areas: [
    cell(0, 0, "รับคิว", "ตรวจ"),
    cell(1, 0, "สถานะคิว", "สถานะคิว"),
    cell(0, 1, "รับยา", "รับยา"),
    cell(1, 1, "ข้อมูลของฉัน", "ข้อมูลของฉัน"),
  ],
};

async function call(url, init, what) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${what} ล้มเหลว: ${res.status} ${await res.text()}`);
  return res;
}

// 1) สร้างเมนู
const created = await call(
  "https://api.line.me/v2/bot/richmenu",
  { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(menu) },
  "สร้างเมนู",
);
const { richMenuId } = await created.json();

// 2) อัปโหลดรูป
const image = await readFile(new URL("./richmenu.png", import.meta.url));
await call(
  `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
  { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: image },
  "อัปโหลดรูป",
);

// 3) ตั้งเป็นเมนูเริ่มต้น
await call(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth }, "ตั้งเป็นเมนูเริ่มต้น");

console.log("สำเร็จ richMenuId =", richMenuId);