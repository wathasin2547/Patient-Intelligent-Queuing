// Mock drug list for the prescription picker (UC09). Names and default directions only:
// stock and dispensing are out of scope. Demo values, not a clinical reference —
// a real deployment would load the hospital's own formulary.

export type Drug = {
  name: string;
  unit: string;
  dosage: string;
  /** units per day for a regular dose; null = as needed, so quantity is fixedQty */
  perDay: number | null;
  fixedQty?: number;
  /** department codes that see this drug among the suggestions */
  depts: string[];
  keywords?: string;
};

export const FORMULARY: Drug[] = [
  { name: "Paracetamol 500 mg", unit: "เม็ด", dosage: "1-2 เม็ด ทุก 4-6 ชม. เวลาปวดหรือมีไข้", perDay: null, fixedQty: 20, depts: ["GEN", "MED", "ENT", "SURG"], keywords: "พารา ไข้ ปวด" },
  { name: "Paracetamol syrup 120 mg/5 ml", unit: "ขวด", dosage: "ตามน้ำหนักตัว ทุก 4-6 ชม. เวลามีไข้", perDay: null, fixedQty: 1, depts: ["PED"], keywords: "พารา น้ำ เด็ก ไข้" },
  { name: "Chlorpheniramine 4 mg", unit: "เม็ด", dosage: "1 เม็ด วันละ 3 ครั้ง หลังอาหาร", perDay: 3, depts: ["GEN", "MED", "ENT"], keywords: "CPM แพ้ น้ำมูก" },
  { name: "Loratadine 10 mg", unit: "เม็ด", dosage: "1 เม็ด วันละ 1 ครั้ง", perDay: 1, depts: ["ENT", "MED"], keywords: "แพ้ น้ำมูก จาม" },
  { name: "Dextromethorphan 15 mg", unit: "เม็ด", dosage: "1 เม็ด วันละ 3 ครั้ง หลังอาหาร", perDay: 3, depts: ["GEN", "MED"], keywords: "ไอ แก้ไอ" },
  { name: "Ambroxol 30 mg", unit: "เม็ด", dosage: "1 เม็ด วันละ 3 ครั้ง หลังอาหาร", perDay: 3, depts: ["GEN", "MED", "ENT"], keywords: "เสมหะ ละลายเสมหะ" },
  { name: "Amoxicillin 500 mg", unit: "แคปซูล", dosage: "1 แคปซูล วันละ 3 ครั้ง หลังอาหาร", perDay: 3, depts: ["GEN", "ENT", "MED"], keywords: "ฆ่าเชื้อ ยาปฏิชีวนะ" },
  { name: "Omeprazole 20 mg", unit: "แคปซูล", dosage: "1 แคปซูล ก่อนอาหารเช้า 30 นาที", perDay: 1, depts: ["MED", "GEN"], keywords: "กระเพาะ ลดกรด" },
  { name: "Domperidone 10 mg", unit: "เม็ด", dosage: "1 เม็ด ก่อนอาหาร 3 มื้อ", perDay: 3, depts: ["MED", "GEN"], keywords: "คลื่นไส้ อาเจียน" },
  { name: "ORS", unit: "ซอง", dosage: "1 ซอง ละลายน้ำ 250 มล. จิบเมื่อถ่ายเหลว", perDay: null, fixedQty: 10, depts: ["GEN", "MED", "PED"], keywords: "เกลือแร่ ท้องเสีย" },
  { name: "Ibuprofen 400 mg", unit: "เม็ด", dosage: "1 เม็ด วันละ 3 ครั้ง หลังอาหารทันที", perDay: 3, depts: ["SURG", "MED"], keywords: "ปวด อักเสบ" },
  { name: "Tramadol 50 mg", unit: "แคปซูล", dosage: "1 แคปซูล ทุก 8 ชม. เวลาปวด", perDay: null, fixedQty: 10, depts: ["SURG"], keywords: "ปวดมาก" },
  { name: "Dicloxacillin 250 mg", unit: "แคปซูล", dosage: "2 แคปซูล วันละ 4 ครั้ง ก่อนอาหาร", perDay: 8, depts: ["SURG"], keywords: "ฆ่าเชื้อ แผล" },
  { name: "Diclofenac gel", unit: "หลอด", dosage: "ทาบริเวณที่ปวด วันละ 3 ครั้ง", perDay: null, fixedQty: 1, depts: ["SURG"], keywords: "ทา ปวด" },
  { name: "Povidone-iodine solution", unit: "ขวด", dosage: "ทำแผลวันละ 1-2 ครั้ง", perDay: null, fixedQty: 1, depts: ["SURG"], keywords: "ทำแผล เบตาดีน" },
  { name: "Metformin 500 mg", unit: "เม็ด", dosage: "1 เม็ด เช้า-เย็น หลังอาหาร", perDay: 2, depts: ["MED"], keywords: "เบาหวาน" },
  { name: "Amlodipine 5 mg", unit: "เม็ด", dosage: "1 เม็ด เช้า", perDay: 1, depts: ["MED"], keywords: "ความดัน" },
  { name: "Losartan 50 mg", unit: "เม็ด", dosage: "1 เม็ด เช้า", perDay: 1, depts: ["MED"], keywords: "ความดัน" },
  { name: "Simvastatin 20 mg", unit: "เม็ด", dosage: "1 เม็ด ก่อนนอน", perDay: 1, depts: ["MED"], keywords: "ไขมัน" },
  { name: "Salbutamol inhaler", unit: "หลอด", dosage: "พ่น 2 ครั้ง เวลาหอบ", perDay: null, fixedQty: 1, depts: ["PED", "MED"], keywords: "หอบ พ่น" },
  { name: "Fluticasone nasal spray", unit: "ขวด", dosage: "พ่นจมูกข้างละ 2 ครั้ง วันละ 1 ครั้ง", perDay: null, fixedQty: 1, depts: ["ENT"], keywords: "พ่นจมูก ภูมิแพ้" },
];

/** Common directions offered while typing, so a custom drug rarely needs a full sentence. */
export const SIG_PRESETS = [
  "1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า",
  "1 เม็ด เช้า-เย็น หลังอาหาร",
  "1 เม็ด วันละ 3 ครั้ง หลังอาหาร",
  "1 เม็ด ก่อนนอน",
  "1 เม็ด ทุก 4-6 ชม. เวลาปวดหรือมีไข้",
  "1 แคปซูล วันละ 3 ครั้ง หลังอาหาร",
];

export const DAY_PRESETS = [3, 5, 7, 14, 30];

export function findDrug(name: string) {
  return FORMULARY.find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
}

/** Quantity that covers the supply: regular doses scale with the days, as-needed ones do not. */
export function quantityFor(drug: Drug, days: number) {
  return `${drug.perDay ? drug.perDay * Math.max(days, 1) : drug.fixedQty ?? 1} ${drug.unit}`;
}

export function searchDrugs(query: string, exclude: Set<string>, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FORMULARY.filter((d) => !exclude.has(d.name) && `${d.name} ${d.keywords ?? ""}`.toLowerCase().includes(q)).slice(0, limit);
}
