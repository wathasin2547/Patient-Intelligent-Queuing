// MOCK DATA for the UI mockup only — no real patients. Names are placeholders.
// Department / doctor / symptom names match code/data/catalog.json.

export type Level = 1 | 2 | 3 | 4 | 5;
export type QueueStatus = "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED";

export type Reason = { code: string; label: string; weight: number };

export type MockQueue = {
  id: string;
  queueNumber: string;
  patientName: string;
  ageGroup: string;
  department: string;
  doctor: string;
  level: Level;
  status: QueueStatus;
  waitingMinutes: number;
  visitType: "ONSITE" | "ONLINE";
  freeText: string;
  closedAnswers: string[];
  symptomCodes: string[];
  llmCodes: string[];
  llmStatus: "ok" | "skipped" | "failed";
  departmentScores: Record<string, number>;
  reason: Reason[];
  edited?: boolean;
  originalDepartment?: string; // set when staff changed the department
};

export const BASE: Record<number, number> = { 2: 1000, 3: 600, 4: 300, 5: 200 };
export const ALPHA = 2;
export const score = (q: Pick<MockQueue, "level" | "waitingMinutes">) =>
  BASE[q.level] + ALPHA * q.waitingMinutes;

export const departments = ["อายุรกรรม", "ศัลยกรรม", "กุมารเวชกรรม", "หู คอ จมูก"];

export const doctors = [
  { name: "แพทย์ทดสอบ อายุรกรรม 1", department: "อายุรกรรม", shift: "08:00–16:00" },
  { name: "แพทย์ทดสอบ อายุรกรรม 2", department: "อายุรกรรม", shift: "08:00–16:00" },
  { name: "แพทย์ทดสอบ ศัลยกรรม 1", department: "ศัลยกรรม", shift: "08:00–16:00" },
  { name: "แพทย์ทดสอบ กุมารเวช 1", department: "กุมารเวชกรรม", shift: "08:00–16:00" },
  { name: "แพทย์ทดสอบ หู คอ จมูก 1", department: "หู คอ จมูก", shift: "08:00–12:00" },
];

const q = (o: Partial<MockQueue> & Pick<MockQueue, "id" | "queueNumber" | "department" | "doctor" | "level" | "status" | "waitingMinutes">): MockQueue => ({
  patientName: `ผู้ป่วยทดสอบ ${o.queueNumber}`,
  ageGroup: "18-59 ปี",
  visitType: "ONSITE",
  freeText: "",
  closedAnswers: [],
  symptomCodes: [],
  llmCodes: [],
  llmStatus: "skipped",
  departmentScores: {},
  reason: [],
  ...o,
});

export const queues: MockQueue[] = [
  q({ id: "q1", queueNumber: "MED-012", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 1", level: 4, status: "IN_PROGRESS", waitingMinutes: 0,
      closedAnswers: ["อาการหลัก: ไอ"], symptomCodes: ["cough"], departmentScores: { อายุรกรรม: 3, "หู คอ จมูก": 1, กุมารเวชกรรม: 1 },
      reason: [{ code: "cough", label: "ไอ", weight: 3 }] }),
  q({ id: "q2", queueNumber: "MED-014", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 1", level: 3, status: "WAITING", waitingMinutes: 12,
      ageGroup: "60 ปีขึ้นไป", closedAnswers: ["อาการหลัก: ท้องเสีย", "ถ่ายเหลว ≥ 6 ครั้ง หรืออ่อนเพลียมาก"],
      freeText: "ถ่ายเป็นน้ำตั้งแต่เมื่อคืน 8 รอบ หน้ามืดตอนลุกยืน", llmCodes: ["diarrhea_frequent", "dizziness"], llmStatus: "ok",
      symptomCodes: ["diarrhea", "diarrhea_frequent", "dizziness"], departmentScores: { อายุรกรรม: 12, กุมารเวชกรรม: 2, "หู คอ จมูก": 1 },
      reason: [{ code: "diarrhea_frequent", label: "ถ่ายเหลวหลายครั้ง อ่อนเพลีย", weight: 5 }, { code: "diarrhea", label: "ท้องเสีย", weight: 4 }, { code: "dizziness", label: "เวียนศีรษะ", weight: 3 }] }),
  q({ id: "q3", queueNumber: "MED-009", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 1", level: 4, status: "WAITING", waitingMinutes: 165,
      closedAnswers: ["อาการหลัก: ผื่นคัน"], freeText: "ผื่นแดงคันตามแขนสองข้าง", llmCodes: ["rash"], llmStatus: "ok",
      symptomCodes: ["rash"], departmentScores: { อายุรกรรม: 3, กุมารเวชกรรม: 1 }, reason: [{ code: "rash", label: "ผื่นคัน", weight: 3 }] }),
  q({ id: "q4", queueNumber: "MED-016", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 1", level: 5, status: "WAITING", waitingMinutes: 4, visitType: "ONLINE",
      ageGroup: "60 ปีขึ้นไป", closedAnswers: ["อาการหลัก: มารับยาโรคประจำตัว", "อาการเหมือนเดิม"],
      symptomCodes: ["chronic_followup"], departmentScores: { อายุรกรรม: 4 }, reason: [{ code: "chronic_followup", label: "ติดตามโรคประจำตัว/รับยาต่อเนื่อง", weight: 4 }] }),
  q({ id: "q5", queueNumber: "MED-013", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 2", level: 2, status: "CALLED", waitingMinutes: 3,
      closedAnswers: ["อาการหลัก: มีไข้", "ไข้เกิน 39 องศา"], symptomCodes: ["fever", "fever_high"], departmentScores: { อายุรกรรม: 7, กุมารเวชกรรม: 4 },
      reason: [{ code: "fever_high", label: "ไข้สูงเกิน 39 องศา", weight: 4 }, { code: "fever", label: "มีไข้", weight: 3 }] }),
  q({ id: "q6", queueNumber: "MED-015", department: "อายุรกรรม", doctor: "แพทย์ทดสอบ อายุรกรรม 2", level: 4, status: "WAITING", waitingMinutes: 25,
      closedAnswers: ["อาการหลัก: ปวดศีรษะ / เวียนศีรษะ"], symptomCodes: ["headache"], departmentScores: { อายุรกรรม: 3 },
      reason: [{ code: "headache", label: "ปวดศีรษะ", weight: 3 }] }),
  q({ id: "q7", queueNumber: "SUR-004", department: "ศัลยกรรม", doctor: "แพทย์ทดสอบ ศัลยกรรม 1", level: 3, status: "IN_PROGRESS", waitingMinutes: 0,
      closedAnswers: ["อาการหลัก: ปวดท้อง", "ปวดท้องด้านขวาล่าง"], freeText: "ปวดท้องขวาล่าง กดแล้วเจ็บ มีไข้ต่ำ ๆ",
      llmCodes: ["abdominal_pain_rlq", "fever"], llmStatus: "ok", symptomCodes: ["abdominal_pain_general", "abdominal_pain_rlq", "fever"],
      // algorithm picked อายุรกรรม (9 vs 8); staff moved the case to ศัลยกรรม
      departmentScores: { อายุรกรรม: 9, ศัลยกรรม: 8, กุมารเวชกรรม: 2 }, originalDepartment: "อายุรกรรม", edited: true,
      reason: [{ code: "abdominal_pain_general", label: "ปวดท้องทั่วไป", weight: 4 }, { code: "fever", label: "มีไข้", weight: 3 }, { code: "abdominal_pain_rlq", label: "ปวดท้องด้านขวาล่าง", weight: 2 }] }),
  q({ id: "q8", queueNumber: "SUR-005", department: "ศัลยกรรม", doctor: "แพทย์ทดสอบ ศัลยกรรม 1", level: 2, status: "WAITING", waitingMinutes: 6,
      closedAnswers: ["อาการหลัก: มีบาดแผล", "แผลลึก ฉีกขาด"], freeText: "โดนมีดบาดฝ่ามือ เลือดซึม", llmCodes: ["wound_deep"], llmStatus: "ok",
      symptomCodes: ["wound_minor", "wound_deep"], departmentScores: { ศัลยกรรม: 11 },
      reason: [{ code: "wound_deep", label: "แผลลึกหรือแผลฉีกขาด", weight: 6 }, { code: "wound_minor", label: "แผลถลอกหรือแผลเล็ก", weight: 5 }] }),
  q({ id: "q9", queueNumber: "SUR-006", department: "ศัลยกรรม", doctor: "แพทย์ทดสอบ ศัลยกรรม 1", level: 4, status: "WAITING", waitingMinutes: 41,
      closedAnswers: ["อาการหลัก: มีบาดแผล", "แผลถลอกหรือแผลเล็ก"], symptomCodes: ["wound_minor"], departmentScores: { ศัลยกรรม: 5 },
      reason: [{ code: "wound_minor", label: "แผลถลอกหรือแผลเล็ก", weight: 5 }] }),
  q({ id: "q10", queueNumber: "PED-003", department: "กุมารเวชกรรม", doctor: "แพทย์ทดสอบ กุมารเวช 1", level: 4, status: "WAITING", waitingMinutes: 18,
      ageGroup: "0-5 ปี", closedAnswers: ["อายุ 0-5 ปี", "อาการหลัก: มีไข้"], freeText: "ลูกตัวร้อน งอแง กินนมได้น้อยลง", llmCodes: ["fever"], llmStatus: "ok",
      symptomCodes: ["age_0_5", "fever"], departmentScores: { กุมารเวชกรรม: 12, อายุรกรรม: 3 },
      reason: [{ code: "age_0_5", label: "อายุ 0-5 ปี", weight: 10 }, { code: "fever", label: "มีไข้", weight: 2 }] }),
  q({ id: "q11", queueNumber: "ENT-002", department: "หู คอ จมูก", doctor: "แพทย์ทดสอบ หู คอ จมูก 1", level: 4, status: "WAITING", waitingMinutes: 33,
      closedAnswers: ["อาการหลัก: เจ็บคอ / มีน้ำมูก"], freeText: "เจ็บคอ กลืนลำบาก มีน้ำมูกใส", llmCodes: ["sore_throat", "runny_nose"], llmStatus: "failed",
      symptomCodes: ["sore_throat"], departmentScores: { "หู คอ จมูก": 4, อายุรกรรม: 2 },
      reason: [{ code: "sore_throat", label: "เจ็บคอ", weight: 4 }] }),
];

export const emergencies = [
  { id: "e1", time: "10:42", ageGroup: "60 ปีขึ้นไป", codes: ["เจ็บแน่นหน้าอกรุนแรง"], acknowledged: false },
];

export const questions = [
  { text: "ผู้ป่วยอายุเท่าไร", options: ["0-5 ปี", "6-17 ปี", "18-59 ปี", "60 ปีขึ้นไป"], multi: false },
  {
    text: "ตอนนี้มีอาการต่อไปนี้หรือไม่ (เลือกได้มากกว่า 1 ข้อ)",
    options: ["เจ็บแน่นหน้าอกรุนแรง", "หายใจลำบากมาก", "ซึมลงหรือหมดสติ", "หน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัด", "ชัก", "เลือดออกมากไม่หยุด", "อาเจียนเป็นเลือด", "ไม่มีอาการเหล่านี้"],
    multi: true,
  },
  {
    text: "วันนี้มาด้วยอาการหลักอะไร",
    options: ["มีไข้", "ไอ", "เจ็บคอ / มีน้ำมูก", "ปวดท้อง", "ท้องเสีย", "มีบาดแผล", "ปวดหู", "ปวดศีรษะ / เวียนศีรษะ", "ผื่นคัน", "ปัสสาวะแสบขัด", "มารับยาโรคประจำตัว"],
    multi: false,
  },
  { text: "ปวดท้องบริเวณไหน และปวดมากแค่ไหน", options: ["ปวดท้องด้านขวาล่าง", "ปวดรุนแรงจนเดินไม่ไหว", "ปวดทั่วไป พอทนได้"], multi: false },
];
