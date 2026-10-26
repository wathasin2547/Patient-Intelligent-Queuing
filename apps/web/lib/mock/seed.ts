// MOCK DATA ONLY — every patient here is made up ("ผู้ป่วยทดสอบ NN"). No real records.
// Departments, symptom codes, questions and doctors come from code/data/catalog.json
// (same source as prisma/seed.ts), plus the general-practice department added on 2026-10-20.

import catalog from "../../../../data/catalog.json";
import { APPOINTMENT_LEVEL, NO_SHOW_MINUTES } from "./logic";
import { addDays, atBkk, bkkDate, MINUTE } from "./time";
import type {
  Appointment, Department, Doctor, Level, MockState, Patient, Prescription, Question, Queue,
  ReasonItem, Screening, Shift, SymptomCode, User,
} from "./types";

export const MOCK_VERSION = 4;
/** The demo always opens at 10:30 Bangkok time so doctors are on shift whenever you run it. */
export const DEMO_START = "10:30";

type DeptKey = "MED" | "SURG" | "PED" | "ENT" | "GEN";
const deptId = (k: string) => `dept_${k}`;

// Small deterministic RNG so every reset produces the same morning.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed(realNow: number): MockState {
  const today = bkkDate(realNow);
  const now = new Date(atBkk(today, DEMO_START)).getTime();
  const ago = (min: number) => new Date(now - min * MINUTE).toISOString();
  const at = (hhmm: string, day = today) => atBkk(day, hhmm);
  const rand = rng(20261021);

  // ── master data ──
  const departments: Department[] = [
    ...catalog.departments.map((d) => ({ id: deptId(d.key), code: d.key === "SURG" ? "SUR" : d.key, name: d.name, scopeOfCare: d.scopeOfCare, isActive: true })),
    { id: deptId("GEN"), code: "GEN", name: "เวชปฏิบัติทั่วไป", scopeOfCare: "อาการที่ยังจำแนกแผนกไม่ได้ หรือไม่ได้คะแนนจากแผนกใด", isActive: true },
  ];

  const doctors: Doctor[] = [];
  const doctorHours: Record<string, [number, number]> = {};
  const perDept: Record<string, number> = {};
  for (const d of [...catalog.doctors, { name: "แพทย์ทดสอบ เวชปฏิบัติ 1", dept: "GEN", startHour: 8, endHour: 16 }]) {
    perDept[d.dept] = (perDept[d.dept] ?? 0) + 1;
    const id = `doc_${d.dept}${perDept[d.dept]}`;
    doctors.push({ id, name: d.name, departmentId: deptId(d.dept) });
    doctorHours[id] = [d.startHour, d.endHour];
  }
  const doc = (k: DeptKey, n = 1) => `doc_${k}${n}`;

  const symptomCodes: SymptomCode[] = catalog.symptomCodes.map((c) => ({
    id: `sc_${c.code}`,
    code: c.code,
    label: c.label,
    synonyms: c.synonyms,
    departmentWeights: Object.fromEntries(Object.entries(c.weights).map(([k, w]) => [deptId(k), w])),
    isRedFlag: Boolean((c as { isRedFlag?: boolean }).isRedFlag),
    onsiteOnly: Boolean((c as { onsiteOnly?: boolean }).onsiteOnly),
    priorityHint: ((c as { priorityHint?: number }).priorityHint ?? null) as Level | null,
    isActive: true,
  }));

  const questions: Question[] = catalog.questions.map((q, i) => ({
    id: `qs_${i + 1}`,
    questionText: q.questionText,
    group: q.group,
    order: q.order,
    options: q.options,
    dependsOn: (q as { dependsOn?: { symptomCode: string } }).dependsOn ?? null,
    isActive: true,
  }));

  const users: User[] = [
    { id: "u_admin", username: "admin", role: "ADMIN", departmentId: null, isActive: true },
    { id: "u_staff_med", username: "staff.med", role: "STAFF", departmentId: deptId("MED"), isActive: true },
    { id: "u_staff_surg", username: "staff.surg", role: "STAFF", departmentId: deptId("SURG"), isActive: true },
    { id: "u_staff_old", username: "staff.old", role: "STAFF", departmentId: deptId("ENT"), isActive: false },
  ];

  // ── shifts: 7 days starting today ──
  const shifts: Shift[] = [];
  for (let day = 0; day < 7; day++) {
    const date = addDays(today, day);
    for (const d of doctors) {
      if (day === 3 && d.departmentId === deptId("SURG")) continue; // surgery off one day
      const [s, e] = doctorHours[d.id];
      shifts.push({
        id: `sh_${d.id}_${day}`,
        doctorId: d.id,
        date,
        startTime: at(`${String(s).padStart(2, "0")}:00`, date),
        endTime: at(`${String(e).padStart(2, "0")}:00`, date),
        status: day === 2 && d.id === doc("MED", 2) ? "CANCELLED" : "ACTIVE",
      });
    }
  }

  // ── patients / screenings / queues ──
  const patients: Patient[] = [];
  const screenings: Screening[] = [];
  const queues: Queue[] = [];
  const counter: Record<string, number> = {};
  const ages = ["18-59", "60+", "18-59", "6-17", "18-59", "0-5", "60+", "18-59"];

  function patient(n: number, extra: Partial<Patient> = {}): string {
    const id = `pt_${String(n).padStart(2, "0")}`;
    if (!patients.some((p) => p.id === id)) {
      patients.push({
        id,
        lineUserId: `U-mock-${String(n).padStart(2, "0")}`,
        fullName: `ผู้ป่วยทดสอบ ${String(n).padStart(2, "0")}`,
        ageGroup: ages[n % ages.length],
        gender: n % 2 ? "หญิง" : "ชาย",
        healthCoverage: ["บัตรทอง", "ประกันสังคม", "ข้าราชการ"][n % 3],
        isChronic: false,
        address: n % 4 === 0 ? `${n}/1 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10520` : null,
        createdAt: ago(60 * 24 * (n + 3)),
        ...extra,
      });
    }
    return id;
  }

  function number(k: DeptKey) {
    counter[k] = (counter[k] ?? 0) + 1;
    const code = departments.find((d) => d.id === deptId(k))!.code;
    return `${code}-${String(counter[k]).padStart(3, "0")}`;
  }

  function reasonFor(codes: string[], dept: string): ReasonItem[] {
    return codes
      .map((c) => ({ code: c, weight: symptomCodes.find((s) => s.code === c)?.departmentWeights[dept] ?? 0, department: dept }))
      .filter((r) => r.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }

  function scoresFor(codes: string[]) {
    const out: Record<string, number> = {};
    for (const c of codes) {
      for (const [d, w] of Object.entries(symptomCodes.find((s) => s.code === c)?.departmentWeights ?? {})) out[d] = (out[d] ?? 0) + w;
    }
    return out;
  }

  type Visit = {
    pt: number;
    dept: DeptKey;
    algoDept?: DeptKey; // set when staff already moved the patient
    doctor: string;
    level: Level;
    algoLevel?: Level;
    status: Queue["status"];
    checkIn: string;
    called?: string | null;
    finished?: string | null;
    answers: [string, string][];
    freeText?: string;
    closedCodes: string[];
    llmCodes?: string[];
    llmStatus?: Screening["llmStatus"];
    visitType?: Queue["visitType"];
    onlineEligible?: boolean;
    appointmentId?: string;
    edited?: boolean;
  };

  const AGE_FROM_ANSWER: Record<string, string> = { "0-5 ปี": "0-5", "6-17 ปี": "6-17", "18-59 ปี": "18-59", "60 ปีขึ้นไป": "60+" };

  function visit(v: Visit): Queue {
    const ageAnswer = v.answers.find(([question]) => question === "ผู้ป่วยอายุเท่าไร")?.[1];
    const pid = patient(v.pt, ageAnswer ? { ageGroup: AGE_FROM_ANSWER[ageAnswer] } : {});
    const codes = [...new Set([...v.closedCodes, ...(v.llmStatus === "ok" ? v.llmCodes ?? [] : [])])];
    const algo = deptId(v.algoDept ?? v.dept);
    let screeningId: string | null = null;
    if (!v.appointmentId) {
      screeningId = `scr_${screenings.length + 1}`;
      const scores = scoresFor(codes);
      screenings.push({
        id: screeningId,
        patientId: pid,
        answers: v.answers.map(([questionText, answer]) => ({ questionText, answer })),
        freeTextInput: v.freeText ?? null,
        symptomCodes: codes,
        llmCodes: v.llmCodes ?? [],
        llmStatus: v.llmStatus ?? (v.freeText ? "ok" : "skipped"),
        departmentScores: scores,
        assignedDepartment: algo,
        priorityLevel: v.algoLevel ?? v.level,
        onlineEligible: v.onlineEligible ?? false,
        isRedFlag: false,
        reason: Object.keys(scores).length ? reasonFor(codes, algo) : [],
        createdAt: new Date(new Date(v.checkIn).getTime() - 2 * MINUTE).toISOString(),
      });
    }
    const q: Queue = {
      id: `q_${queues.length + 1}`,
      patientId: pid,
      screeningId,
      appointmentId: v.appointmentId ?? null,
      departmentId: deptId(v.dept),
      doctorId: v.doctor,
      queueNumber: number(v.dept),
      visitType: v.visitType ?? "ONSITE",
      priorityLevel: v.level,
      status: v.status,
      checkInTime: v.checkIn,
      calledTime: v.called ?? null,
      finishedTime: v.finished ?? null,
      editedBy: v.edited ? "u_staff_med" : null,
      editedAt: v.edited ? new Date(new Date(v.checkIn).getTime() + 4 * MINUTE).toISOString() : null,
    };
    queues.push(q);
    return q;
  }

  // Finished visits from 08:00 so the dashboard has a morning to chart.
  const HISTORY: { dept: DeptKey; doctor: string; codes: string[]; chief: string }[] = [
    { dept: "MED", doctor: doc("MED", 1), codes: ["fever", "cough"], chief: "มีไข้" },
    { dept: "MED", doctor: doc("MED", 2), codes: ["headache"], chief: "ปวดศีรษะ / เวียนศีรษะ" },
    { dept: "MED", doctor: doc("MED", 1), codes: ["diarrhea"], chief: "ท้องเสีย" },
    { dept: "MED", doctor: doc("MED", 2), codes: ["dysuria"], chief: "ปัสสาวะแสบขัด" },
    { dept: "SURG", doctor: doc("SURG"), codes: ["wound_minor"], chief: "มีบาดแผล" },
    { dept: "PED", doctor: doc("PED"), codes: ["age_0_5", "fever"], chief: "มีไข้" },
    { dept: "ENT", doctor: doc("ENT"), codes: ["sore_throat", "runny_nose"], chief: "เจ็บคอ / มีน้ำมูก" },
    { dept: "MED", doctor: doc("MED", 1), codes: ["rash"], chief: "ผื่นคัน" },
    { dept: "ENT", doctor: doc("ENT"), codes: ["ear_pain"], chief: "ปวดหู" },
    { dept: "GEN", doctor: doc("GEN"), codes: [], chief: "อื่น ๆ" },
  ];
  const doctorFree: Record<string, number> = {};
  for (let i = 0; i < 26; i++) {
    const h = HISTORY[i % HISTORY.length];
    const checkIn = new Date(atBkk(today, "07:45")).getTime() + (i * 5 + rand() * 6) * MINUTE;
    const start = Math.max(checkIn + (6 + rand() * 18) * MINUTE, doctorFree[h.doctor] ?? new Date(atBkk(today, "08:00")).getTime());
    const end = start + (12 + rand() * 9) * MINUTE;
    if (end > now - 8 * MINUTE) continue;
    doctorFree[h.doctor] = end;
    const status: Queue["status"] = i === 11 ? "NO_SHOW" : i === 17 ? "CANCELLED" : "DONE";
    visit({
      pt: 30 + i, dept: h.dept, doctor: h.doctor, level: 4, status,
      checkIn: new Date(checkIn).toISOString(),
      called: status === "CANCELLED" ? null : new Date(start).toISOString(),
      finished: status === "CANCELLED" ? null : new Date(status === "NO_SHOW" ? start + NO_SHOW_MINUTES * MINUTE : end).toISOString(),
      answers: [["ผู้ป่วยอายุเท่าไร", "18-59 ปี"], ["วันนี้มาด้วยอาการหลักอะไร", h.chief]],
      closedCodes: h.codes,
    });
  }

  // Patients in the building right now (same scenarios as the earlier mockup).
  const Q_AGE = "ผู้ป่วยอายุเท่าไร";
  const Q_CHIEF = "วันนี้มาด้วยอาการหลักอะไร";
  visit({ pt: 12, dept: "MED", doctor: doc("MED", 1), level: 4, status: "IN_PROGRESS", checkIn: ago(38), called: ago(6),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "ไอ"]], closedCodes: ["cough"] });
  visit({ pt: 14, dept: "MED", doctor: doc("MED", 1), level: 3, status: "WAITING", checkIn: ago(12),
    answers: [[Q_AGE, "60 ปีขึ้นไป"], [Q_CHIEF, "ท้องเสีย"], ["ถ่ายเหลวกี่ครั้งใน 24 ชั่วโมง", "ตั้งแต่ 6 ครั้งขึ้นไป หรืออ่อนเพลียมาก"]],
    freeText: "ถ่ายเป็นน้ำตั้งแต่เมื่อคืน 8 รอบ หน้ามืดตอนลุกยืน", closedCodes: ["diarrhea", "diarrhea_frequent"], llmCodes: ["diarrhea_frequent", "dizziness"], llmStatus: "ok" });
  visit({ pt: 9, dept: "MED", doctor: doc("MED", 1), level: 4, status: "WAITING", checkIn: ago(95),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "ผื่นคัน"]], freeText: "ผื่นแดงคันตามแขนสองข้าง", closedCodes: ["rash"], llmCodes: ["rash"], llmStatus: "ok" });
  visit({ pt: 16, dept: "MED", doctor: doc("MED", 1), level: 5, status: "WAITING", checkIn: ago(4), visitType: "ONLINE", onlineEligible: true,
    answers: [[Q_AGE, "60 ปีขึ้นไป"], [Q_CHIEF, "มารับยาโรคประจำตัว"], ["อาการเปลี่ยนไปจากครั้งก่อนหรือไม่", "อาการเหมือนเดิม"]], closedCodes: ["chronic_followup"] });
  visit({ pt: 13, dept: "MED", doctor: doc("MED", 2), level: 2, status: "CALLED", checkIn: ago(9), called: ago(3),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "มีไข้"], ["วัดไข้ได้เกิน 39 องศาหรือไม่", "เกิน 39 องศา"]], closedCodes: ["fever", "fever_high"] });
  visit({ pt: 15, dept: "MED", doctor: doc("MED", 2), level: 4, status: "WAITING", checkIn: ago(25),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "ปวดศีรษะ / เวียนศีรษะ"]], closedCodes: ["headache"] });
  visit({ pt: 4, dept: "SURG", algoDept: "MED", doctor: doc("SURG"), level: 3, status: "IN_PROGRESS", checkIn: ago(30), called: ago(9), edited: true,
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "ปวดท้อง"], ["ปวดท้องบริเวณไหน และปวดมากแค่ไหน", "ปวดทั่วไป พอทนได้"]],
    freeText: "ปวดท้องขวาล่าง กดแล้วเจ็บ มีไข้ต่ำ ๆ", closedCodes: ["abdominal_pain_general"], llmCodes: ["abdominal_pain_rlq", "fever"], llmStatus: "ok" });
  visit({ pt: 5, dept: "SURG", doctor: doc("SURG"), level: 2, status: "WAITING", checkIn: ago(6),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "มีบาดแผล"], ["ลักษณะของแผลเป็นแบบไหน", "แผลลึก ฉีกขาด หรือเห็นเนื้อข้างใน"]],
    freeText: "โดนมีดบาดฝ่ามือ เลือดซึม", closedCodes: ["wound_minor", "wound_deep"], llmCodes: ["wound_deep"], llmStatus: "ok" });
  visit({ pt: 6, dept: "SURG", doctor: doc("SURG"), level: 4, status: "WAITING", checkIn: ago(41),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "มีบาดแผล"], ["ลักษณะของแผลเป็นแบบไหน", "แผลถลอกหรือแผลเล็ก"]], closedCodes: ["wound_minor"] });
  visit({ pt: 10, dept: "PED", doctor: doc("PED"), level: 4, status: "WAITING", checkIn: ago(18),
    answers: [[Q_AGE, "0-5 ปี"], [Q_CHIEF, "มีไข้"], ["วัดไข้ได้เกิน 39 องศาหรือไม่", "ไม่เกิน / ไม่ได้วัด"]],
    freeText: "ลูกตัวร้อน งอแง กินนมได้น้อยลง", closedCodes: ["age_0_5", "fever"], llmCodes: ["fever"], llmStatus: "ok" });
  visit({ pt: 17, dept: "PED", doctor: doc("PED"), level: 4, status: "WAITING", checkIn: ago(7),
    answers: [[Q_AGE, "6-17 ปี"], [Q_CHIEF, "ไอ"]], closedCodes: ["age_6_17", "cough"] });
  visit({ pt: 11, dept: "ENT", doctor: doc("ENT"), level: 4, status: "WAITING", checkIn: ago(33),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "เจ็บคอ / มีน้ำมูก"]], freeText: "เจ็บคอ กลืนลำบาก มีน้ำมูกใส",
    closedCodes: ["sore_throat"], llmCodes: ["sore_throat", "runny_nose"], llmStatus: "failed" });
  visit({ pt: 18, dept: "ENT", doctor: doc("ENT"), level: 3, status: "WAITING", checkIn: ago(15),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "อื่น ๆ"]], freeText: "เลือดกำเดาไหลซึม ๆ ตั้งแต่เช้า", closedCodes: [], llmCodes: ["nosebleed"], llmStatus: "ok" });
  visit({ pt: 19, dept: "GEN", doctor: doc("GEN"), level: 4, status: "WAITING", checkIn: ago(11),
    answers: [[Q_AGE, "18-59 ปี"], [Q_CHIEF, "อื่น ๆ"]], freeText: "รู้สึกไม่ค่อยสบาย อ่อนเพลีย", closedCodes: [], llmCodes: [], llmStatus: "ok" });

  // Red flag at 10:12 — screening only, no queue (UC04 exception 1).
  const redPid = patient(20, { ageGroup: "60+" });
  screenings.push({
    id: "scr_red_1", patientId: redPid,
    answers: [[Q_AGE, "60 ปีขึ้นไป"], ["ตอนนี้มีอาการต่อไปนี้หรือไม่ (เลือกได้มากกว่า 1 ข้อ)", "เจ็บแน่นหน้าอกรุนแรง"]].map(([questionText, answer]) => ({ questionText, answer })),
    freeTextInput: null, symptomCodes: ["chest_pain_severe"], llmCodes: [], llmStatus: "skipped",
    departmentScores: {}, assignedDepartment: null, priorityLevel: 1, onlineEligible: false, isRedFlag: true,
    reason: [], createdAt: ago(18),
  });

  // ── appointments (UC11) ──
  const appointments: Appointment[] = [];
  const appt = (pt: number, doctorId: string, time: string, reason: string, status: Appointment["status"], day = today): Appointment => {
    const a: Appointment = {
      id: `ap_${appointments.length + 1}`, patientId: patient(pt, { isChronic: true }), doctorId,
      appointmentTime: at(time, day), reason, status, createdBy: "u_staff_med", createdAt: ago(60 * 24 * 14),
    };
    appointments.push(a);
    return a;
  };
  appt(21, doc("MED", 1), "09:00", "ติดตามความดันโลหิต", "MISSED");
  const arrived = appt(1, doc("MED", 1), "10:40", "ติดตามเบาหวาน รับยาต่อเนื่อง", "ARRIVED");
  appt(22, doc("MED", 2), "10:45", "ติดตามความดันโลหิต", "SCHEDULED");
  appt(23, doc("MED", 1), "11:00", "ฟังผลตรวจเลือด", "SCHEDULED");
  appt(24, doc("SURG"), "11:15", "ตัดไหมแผลผ่าตัด", "SCHEDULED");
  appt(25, doc("PED"), "13:30", "ติดตามอาการหอบ", "SCHEDULED");
  appt(26, doc("ENT"), "09:30", "ติดตามอาการหูชั้นกลางอักเสบ", "SCHEDULED", addDays(today, 1));
  appt(22, doc("MED", 2), "14:00", "ติดตามความดันโลหิต", "SCHEDULED", addDays(today, 7));
  // pt_01 arrived early (10:20) for a 10:40 appointment → W counts from 10:40
  visit({ pt: 1, dept: "MED", doctor: doc("MED", 1), level: APPOINTMENT_LEVEL, status: "WAITING", checkIn: ago(10),
    answers: [], closedCodes: [], appointmentId: arrived.id });

  // pt_01 also saw a doctor yesterday and still has to choose how to get the medicine (UC06).
  const yesterday = addDays(today, -1);
  const yQueue: Queue = {
    id: "q_yesterday_1", patientId: "pt_01", screeningId: null, appointmentId: null, departmentId: deptId("MED"),
    doctorId: doc("MED", 2), queueNumber: "MED-021", visitType: "ONSITE", priorityLevel: 5, status: "DONE",
    checkInTime: at("13:05", yesterday), calledTime: at("13:30", yesterday), finishedTime: at("13:44", yesterday),
    editedBy: null, editedAt: null,
  };
  queues.push(yQueue);
  const prescriptions: Prescription[] = [{
    id: "rx_1", queueId: yQueue.id, daysSupply: 30, issuedAt: at("13:44", yesterday),
    items: [
      { name: "Metformin 500 mg", dosage: "1 เม็ด เช้า-เย็น หลังอาหาร", quantity: "60 เม็ด" },
      { name: "Amlodipine 5 mg", dosage: "1 เม็ด เช้า", quantity: "30 เม็ด" },
    ],
  }];

  return {
    version: MOCK_VERSION,
    clockOffsetMs: now - realNow,
    sessionUserId: null,
    liffPatientId: "pt_14",
    departments, doctors, shifts, patients, appointments, screenings, queues, prescriptions,
    deliveries: [],
    refills: [{ id: "rf_1", patientId: "pt_01", prescriptionId: "rx_1", dueDate: addDays(yesterday, 27), remindedAt: null, status: "PENDING" }],
    symptomCodes, questions, users,
    notifications: [
      { id: "n_seed_1", patientId: "pt_01", at: at("13:45", yesterday), text: "แพทย์สั่งจ่ายยาแล้ว กรุณาเลือกวิธีรับยา: รับที่โรงพยาบาล หรือจัดส่งถึงบ้าน" },
      { id: "n_seed_2", patientId: "pt_14", at: ago(12), text: `ได้รับคิวแล้ว หมายเลข ${queues.find((q) => q.patientId === "pt_14")?.queueNumber} แผนกอายุรกรรม` },
    ],
    callEvents: [],
    acknowledgedRedFlags: [],
  };
}
