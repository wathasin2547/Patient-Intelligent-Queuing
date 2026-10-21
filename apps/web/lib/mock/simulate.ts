// Demo only: builds a screening result the way the Python service would (red flag → S_d → level),
// so the queue page can show what happens after UC04 hands a patient to UC10.
// The real decision is made by apps/algorithm — do not grow this into a second implementation.

import type { Level, MockState, Screening } from "./types";

export const PRESETS: { label: string; answers: [string, string][]; freeText?: string; codes: string[] }[] = [
  { label: "ไข้ ไอ (ผู้ใหญ่)", answers: [["วันนี้มาด้วยอาการหลักอะไร", "มีไข้"]], freeText: "ไข้ ไอมีเสมหะ 2 วัน", codes: ["fever", "cough"] },
  { label: "แผลลึกที่มือ", answers: [["วันนี้มาด้วยอาการหลักอะไร", "มีบาดแผล"], ["ลักษณะของแผลเป็นแบบไหน", "แผลลึก ฉีกขาด หรือเห็นเนื้อข้างใน"]], codes: ["wound_minor", "wound_deep"] },
  { label: "เด็กเล็กมีไข้", answers: [["ผู้ป่วยอายุเท่าไร", "0-5 ปี"], ["วันนี้มาด้วยอาการหลักอะไร", "มีไข้"]], codes: ["age_0_5", "fever"] },
  { label: "ปวดหู", answers: [["วันนี้มาด้วยอาการหลักอะไร", "ปวดหู"]], codes: ["ear_pain"] },
  { label: "อาการไม่ชัดเจน", answers: [["วันนี้มาด้วยอาการหลักอะไร", "อื่น ๆ"]], freeText: "รู้สึกไม่สบายตัว", codes: [] },
  { label: "เจ็บแน่นหน้าอก (ฉุกเฉิน)", answers: [["ตอนนี้มีอาการต่อไปนี้หรือไม่ (เลือกได้มากกว่า 1 ข้อ)", "เจ็บแน่นหน้าอกรุนแรง"]], codes: ["chest_pain_severe"] },
];

export function simulateScreening(s: MockState, preset: (typeof PRESETS)[number]): Omit<Screening, "id" | "patientId" | "createdAt"> {
  const catalog = new Map(s.symptomCodes.filter((c) => c.isActive).map((c) => [c.code, c]));
  const codes = preset.codes.filter((c) => catalog.has(c));
  const base = {
    answers: preset.answers.map(([questionText, answer]) => ({ questionText, answer })),
    freeTextInput: preset.freeText ?? null,
    symptomCodes: codes,
    llmCodes: [],
    llmStatus: (preset.freeText ? "ok" : "skipped") as Screening["llmStatus"],
  };
  if (codes.some((c) => catalog.get(c)!.isRedFlag)) {
    return { ...base, departmentScores: {}, assignedDepartment: null, priorityLevel: 1, onlineEligible: false, isRedFlag: true, reason: [] };
  }
  const scores: Record<string, number> = {};
  for (const c of codes) for (const [d, w] of Object.entries(catalog.get(c)!.departmentWeights)) scores[d] = (scores[d] ?? 0) + w;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "dept_GEN";
  const hints = codes.map((c) => catalog.get(c)!.priorityHint).filter((h): h is Level => h !== null);
  return {
    ...base,
    departmentScores: scores,
    assignedDepartment: best,
    priorityLevel: hints.length ? (Math.min(...hints) as Level) : 4,
    onlineEligible: false,
    isRedFlag: false,
    reason: codes
      .map((c) => ({ code: c, weight: catalog.get(c)!.departmentWeights[best] ?? 0, department: best }))
      .filter((r) => r.weight > 0)
      .sort((a, b) => b.weight - a.weight),
  };
}
