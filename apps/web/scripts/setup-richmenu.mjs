import { readFile } from "node:fs/promises";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env");

const auth = { Authorization: `Bearer ${token}` };
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
if (!liffId) throw new Error("ไม่พบ NEXT_PUBLIC_LIFF_ID ใน .env");

const image = await readFile(new URL("./richmenu.png", import.meta.url));
if (image.subarray(1, 4).toString() !== "PNG") throw new Error("richmenu ต้องเป็นไฟล์ PNG ชื่อ richmenu.png");
const W = image.readUInt32BE(16);
const H = image.readUInt32BE(20);
if (W < 800 || W > 2500 || H < 250 || W / H < 1.45) throw new Error(`ขนาดรูป ${W}x${H} ไม่ผ่านเงื่อนไขของ LINE`);

const X = [0, Math.round(W * 0.3353), Math.round(W * 0.6617), W];
const Y = [0, Math.round(H / 2), H];

const area = (c0, c1, r0, r1, action) => ({
  bounds: { x: X[c0], y: Y[r0], width: X[c1] - X[c0], height: Y[r1] - Y[r0] },
  action,
});
const say = (label, text) => ({ type: "message", label, text });
const open = (label, page) => ({ type: "uri", label, uri: `https://liff.line.me/${liffId}/${page}` });

const menu = {
  size: { width: W, height: H },
  selected: true,
  name: "PIQ main menu",
  chatBarText: "เมนู",
  areas: [
    area(0, 1, 0, 1, say("รับคิว", "รับคิว")),
    area(1, 2, 0, 1, open("สถานะคิว", "queue")),
    area(0, 1, 1, 2, open("ข้อมูลของฉัน", "register")),
    area(1, 2, 1, 2, open("รับยา", "medicine")),
    area(2, 3, 0, 2, open("ลงทะเบียน", "register")),
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

await call(
  `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
  { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: image },
  "อัปโหลดรูป",
);

await call(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth }, "ตั้งเป็นเมนูเริ่มต้น");

console.log("สำเร็จ richMenuId =", richMenuId, `ขนาดรูป ${W}x${H}`);