// MOCK DATA ONLY — not clinically validated.
// Weights, red flags and priority hints are placeholders for development and must be
// reviewed (ideally by a clinician) before they are used for the evaluation in chapter 4.
// At runtime these values live in the DB and can be edited by an ADMIN (no hardcoding).

export type DeptKey = "MED" | "SURG" | "PED" | "ENT";

export const departments: { key: DeptKey; name: string; scopeOfCare: string }[] = [
  { key: "MED", name: "อายุรกรรม", scopeOfCare: "อาการทั่วไปของผู้ใหญ่ ไข้ ไอ ปวดท้องทั่วไป ท้องเสีย โรคเรื้อรัง" },
  { key: "SURG", name: "ศัลยกรรม", scopeOfCare: "บาดแผล ปวดท้องเฉพาะที่ ก้อนผิดปกติ" },
  { key: "PED", name: "กุมารเวชกรรม", scopeOfCare: "ผู้ป่วยเด็กอายุต่ำกว่า 18 ปี" },
  { key: "ENT", name: "หู คอ จมูก", scopeOfCare: "ปวดหู เจ็บคอ น้ำมูก เลือดกำเดาไหล" },
];

type SymptomSeed = {
  code: string;
  label: string;
  synonyms: string[];
  weights: Partial<Record<DeptKey, number>>;
  isRedFlag?: boolean;
  onsiteOnly?: boolean;
  priorityHint?: number;
};

export const symptomCodes: SymptomSeed[] = [
  // ── red flags: level 1, never queued ──
  { code: "chest_pain_severe", label: "เจ็บแน่นหน้าอกรุนแรง", synonyms: ["แน่นหน้าอก", "เจ็บหน้าอกร้าวไปแขน"], weights: { MED: 5 }, isRedFlag: true, onsiteOnly: true },
  { code: "dyspnea_severe", label: "หายใจลำบากมาก", synonyms: ["หอบเหนื่อย", "หายใจไม่ทัน", "พูดไม่เป็นประโยค"], weights: { MED: 5 }, isRedFlag: true, onsiteOnly: true },
  { code: "unconscious", label: "หมดสติหรือซึมลงมาก", synonyms: ["เป็นลม", "ปลุกไม่ตื่น", "ซึม"], weights: { MED: 5 }, isRedFlag: true, onsiteOnly: true },
  { code: "stroke_signs", label: "หน้าเบี้ยว แขนขาอ่อนแรงครึ่งซีก พูดไม่ชัด", synonyms: ["ปากเบี้ยว", "แขนขาอ่อนแรง", "พูดไม่ชัด"], weights: { MED: 5 }, isRedFlag: true, onsiteOnly: true },
  { code: "seizure", label: "ชัก", synonyms: ["ชักเกร็ง", "ตัวกระตุก"], weights: { MED: 5, PED: 3 }, isRedFlag: true, onsiteOnly: true },
  { code: "severe_bleeding", label: "เลือดออกมากไม่หยุด", synonyms: ["เลือดไหลไม่หยุด"], weights: { SURG: 5 }, isRedFlag: true, onsiteOnly: true },
  { code: "vomiting_blood", label: "อาเจียนเป็นเลือด", synonyms: ["อ้วกเป็นเลือด", "อาเจียนสีกาแฟ"], weights: { MED: 5 }, isRedFlag: true, onsiteOnly: true },

  // ── level 2 (orange) ──
  { code: "fever_high", label: "ไข้สูงเกิน 39 องศา", synonyms: ["ไข้สูง", "ตัวร้อนจัด"], weights: { MED: 4, PED: 2 }, onsiteOnly: true, priorityHint: 2 },
  { code: "abdominal_pain_severe", label: "ปวดท้องรุนแรง", synonyms: ["ปวดท้องมาก", "ปวดท้องจนเดินไม่ได้"], weights: { SURG: 5, MED: 3 }, onsiteOnly: true, priorityHint: 2 },
  { code: "wound_deep", label: "แผลลึกหรือแผลฉีกขาด", synonyms: ["แผลฉีก", "โดนมีดบาด", "แผลเปิด"], weights: { SURG: 6 }, onsiteOnly: true, priorityHint: 2 },

  // ── level 3 (yellow) ──
  { code: "abdominal_pain_rlq", label: "ปวดท้องด้านขวาล่าง", synonyms: ["ปวดท้องขวาล่าง", "ปวดท้องน้อยขวา"], weights: { SURG: 6, MED: 2 }, onsiteOnly: true, priorityHint: 3 },
  { code: "nosebleed", label: "เลือดกำเดาไหล", synonyms: ["เลือดออกจมูก"], weights: { ENT: 5 }, onsiteOnly: true, priorityHint: 3 },
  { code: "diarrhea_frequent", label: "ถ่ายเหลวหลายครั้ง อ่อนเพลีย", synonyms: ["ท้องเสียหนัก", "ถ่ายเป็นน้ำ"], weights: { MED: 5, PED: 1 }, onsiteOnly: true, priorityHint: 3 },

  // ── no hint (green) ──
  { code: "fever", label: "มีไข้", synonyms: ["ตัวร้อน", "ครั่นเนื้อครั่นตัว"], weights: { MED: 3, PED: 2 } },
  { code: "cough", label: "ไอ", synonyms: ["ไอแห้ง", "ไอมีเสมหะ"], weights: { MED: 3, ENT: 1, PED: 1 } },
  { code: "sore_throat", label: "เจ็บคอ", synonyms: ["คอแห้ง", "กลืนเจ็บ"], weights: { ENT: 4, MED: 2 } },
  { code: "runny_nose", label: "มีน้ำมูก", synonyms: ["คัดจมูก", "น้ำมูกไหล"], weights: { ENT: 3, MED: 1 } },
  { code: "ear_pain", label: "ปวดหู", synonyms: ["หูอื้อ", "มีน้ำไหลจากหู"], weights: { ENT: 6 }, onsiteOnly: true },
  { code: "headache", label: "ปวดศีรษะ", synonyms: ["ปวดหัว", "มึนหัว"], weights: { MED: 3 } },
  { code: "dizziness", label: "เวียนศีรษะ", synonyms: ["เวียนหัว", "บ้านหมุน"], weights: { MED: 3, ENT: 1 } },
  { code: "abdominal_pain_general", label: "ปวดท้องทั่วไป", synonyms: ["ปวดท้อง", "จุกท้อง", "แน่นท้อง"], weights: { MED: 4, SURG: 2 } },
  { code: "diarrhea", label: "ท้องเสีย", synonyms: ["ถ่ายเหลว"], weights: { MED: 4, PED: 1 } },
  { code: "vomiting", label: "คลื่นไส้อาเจียน", synonyms: ["อ้วก", "พะอืดพะอม"], weights: { MED: 3, PED: 1 } },
  { code: "wound_minor", label: "แผลถลอกหรือแผลเล็ก", synonyms: ["แผลถลอก", "หกล้ม"], weights: { SURG: 5 }, onsiteOnly: true },
  { code: "lump_mass", label: "คลำพบก้อน", synonyms: ["มีก้อน", "ก้อนบวม"], weights: { SURG: 5 }, onsiteOnly: true },
  { code: "rash", label: "ผื่นคัน", synonyms: ["ผื่นขึ้น", "ลมพิษ"], weights: { MED: 3, PED: 1 } },
  { code: "dysuria", label: "ปัสสาวะแสบขัด", synonyms: ["ฉี่แสบ", "ปัสสาวะบ่อย"], weights: { MED: 4 } },
  { code: "back_pain", label: "ปวดหลัง", synonyms: ["ปวดเอว"], weights: { MED: 2, SURG: 2 } },

  // ── chronic follow-up (level 5 when symptoms unchanged) ──
  { code: "chronic_followup", label: "ติดตามโรคประจำตัว/รับยาต่อเนื่อง", synonyms: ["มารับยา", "ยาหมด", "ตามนัดโรคเบาหวาน"], weights: { MED: 4 } },

  // ── patient attributes mapped from the basic questions ──
  { code: "age_0_5", label: "อายุ 0-5 ปี", synonyms: [], weights: { PED: 10 } },
  { code: "age_6_17", label: "อายุ 6-17 ปี", synonyms: [], weights: { PED: 8 } },
];

type Option = { label: string; symptomCode: string | null };
type QuestionSeed = {
  questionText: string;
  group: "basic" | "redflag" | "chief" | "chronic";
  order: number;
  options: Option[];
  // show only when an earlier answer produced this symptom code
  dependsOn?: { symptomCode: string };
};

export const questions: QuestionSeed[] = [
  {
    questionText: "ผู้ป่วยอายุเท่าไร",
    group: "basic",
    order: 1,
    options: [
      { label: "0-5 ปี", symptomCode: "age_0_5" },
      { label: "6-17 ปี", symptomCode: "age_6_17" },
      { label: "18-59 ปี", symptomCode: null },
      { label: "60 ปีขึ้นไป", symptomCode: null },
    ],
  },
  {
    // multi-select on the LIFF side
    questionText: "ตอนนี้มีอาการต่อไปนี้หรือไม่ (เลือกได้มากกว่า 1 ข้อ)",
    group: "redflag",
    order: 2,
    options: [
      { label: "เจ็บแน่นหน้าอกรุนแรง", symptomCode: "chest_pain_severe" },
      { label: "หายใจลำบากมาก", symptomCode: "dyspnea_severe" },
      { label: "ซึมลงหรือหมดสติ", symptomCode: "unconscious" },
      { label: "หน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด", symptomCode: "stroke_signs" },
      { label: "ชัก", symptomCode: "seizure" },
      { label: "เลือดออกมากไม่หยุด", symptomCode: "severe_bleeding" },
      { label: "อาเจียนเป็นเลือด", symptomCode: "vomiting_blood" },
      { label: "ไม่มีอาการเหล่านี้", symptomCode: null },
    ],
  },
  {
    questionText: "วันนี้มาด้วยอาการหลักอะไร",
    group: "chief",
    order: 3,
    options: [
      { label: "มีไข้", symptomCode: "fever" },
      { label: "ไอ", symptomCode: "cough" },
      { label: "เจ็บคอ / มีน้ำมูก", symptomCode: "sore_throat" },
      { label: "ปวดท้อง", symptomCode: "abdominal_pain_general" },
      { label: "ท้องเสีย", symptomCode: "diarrhea" },
      { label: "มีบาดแผล", symptomCode: "wound_minor" },
      { label: "ปวดหู", symptomCode: "ear_pain" },
      { label: "ปวดศีรษะ / เวียนศีรษะ", symptomCode: "headache" },
      { label: "ผื่นคัน", symptomCode: "rash" },
      { label: "ปัสสาวะแสบขัด", symptomCode: "dysuria" },
      { label: "มารับยาโรคประจำตัว", symptomCode: "chronic_followup" },
    ],
  },
  {
    questionText: "วัดไข้ได้เกิน 39 องศาหรือไม่",
    group: "chief",
    order: 4,
    dependsOn: { symptomCode: "fever" },
    options: [
      { label: "เกิน 39 องศา", symptomCode: "fever_high" },
      { label: "ไม่เกิน / ไม่ได้วัด", symptomCode: null },
    ],
  },
  {
    questionText: "ปวดท้องบริเวณไหน และปวดมากแค่ไหน",
    group: "chief",
    order: 5,
    dependsOn: { symptomCode: "abdominal_pain_general" },
    options: [
      { label: "ปวดท้องด้านขวาล่าง", symptomCode: "abdominal_pain_rlq" },
      { label: "ปวดรุนแรงจนเดินไม่ไหว", symptomCode: "abdominal_pain_severe" },
      { label: "ปวดทั่วไป พอทนได้", symptomCode: null },
    ],
  },
  {
    questionText: "ถ่ายเหลวกี่ครั้งใน 24 ชั่วโมง",
    group: "chief",
    order: 6,
    dependsOn: { symptomCode: "diarrhea" },
    options: [
      { label: "ตั้งแต่ 6 ครั้งขึ้นไป หรืออ่อนเพลียมาก", symptomCode: "diarrhea_frequent" },
      { label: "น้อยกว่า 6 ครั้ง", symptomCode: null },
    ],
  },
  {
    questionText: "ลักษณะของแผลเป็นแบบไหน",
    group: "chief",
    order: 7,
    dependsOn: { symptomCode: "wound_minor" },
    options: [
      { label: "แผลลึก ฉีกขาด หรือเห็นเนื้อข้างใน", symptomCode: "wound_deep" },
      { label: "แผลถลอกหรือแผลเล็ก", symptomCode: null },
    ],
  },
  {
    questionText: "อาการเปลี่ยนไปจากครั้งก่อนหรือไม่",
    group: "chronic",
    order: 8,
    dependsOn: { symptomCode: "chronic_followup" },
    // symptomChanged is sent to /triage as a flag, not as a symptom code
    options: [
      { label: "อาการเหมือนเดิม", symptomCode: null },
      { label: "มีอาการใหม่หรือแย่ลง", symptomCode: null },
    ],
  },
];

// Shift pattern per department, in Asia/Bangkok local hours.
// ENT only works mornings so the "no doctor on shift" branch can be tested in the afternoon.
export const doctors: { name: string; dept: DeptKey; startHour: number; endHour: number }[] = [
  { name: "แพทย์ทดสอบ อายุรกรรม 1", dept: "MED", startHour: 8, endHour: 16 },
  { name: "แพทย์ทดสอบ อายุรกรรม 2", dept: "MED", startHour: 8, endHour: 16 },
  { name: "แพทย์ทดสอบ ศัลยกรรม 1", dept: "SURG", startHour: 8, endHour: 16 },
  { name: "แพทย์ทดสอบ กุมารเวช 1", dept: "PED", startHour: 8, endHour: 16 },
  { name: "แพทย์ทดสอบ หู คอ จมูก 1", dept: "ENT", startHour: 8, endHour: 12 },
];
