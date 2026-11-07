import { readFile } from "node:fs/promises";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env");

const auth = { Authorization: `Bearer ${token}` };
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
if (!liffId) throw new Error("ไม่พบ NEXT_PUBLIC_LIFF_ID ใน .env");

const cell = (col, row, label, text) => ({
  bounds: { x: col * 1250, y: row * 843, width: 1250, height: 843 },
  action: { type: "message", label, text },
});

const link = (col, row, label, page) => ({
  bounds: { x: col * 1250, y: row * 843, width: 1250, height: 843 },
  action: { type: "uri", label, uri: `https://liff.line.me/${liffId}/${page}` },
});

const menu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "PIQ main menu",
  chatBarText: "เมนู",
  areas: [
    cell(0, 0, "รับคิว", "รับคิว"),
    link(1, 0, "สถานะคิว", "queue"),
    link(0, 1, "รับยา", "medicine"),
    link(1, 1, "ข้อมูลของฉัน", "register"),
  ],
};

async function call(url, init, what) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${what} ล้มเหลว: ${res.status} ${await res.text()}`);
  return res;
}

const created = await call(
  "https://api.line.me/v2/bot/richmenu",
  { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(menu) },
  "สร้างเมนู",
);
const { richMenuId } = await created.json();

const image = await readFile(new URL("./richmenu.png", import.meta.url));
await call(
  `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
  { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: image },
  "อัปโหลดรูป",
);

await call(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth }, "ตั้งเป็นเมนูเริ่มต้น");

console.log("สำเร็จ richMenuId =", richMenuId);