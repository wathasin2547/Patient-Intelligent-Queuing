// MOCK DATA ONLY — not clinically validated.
// The data itself lives in code/data/catalog.json so the seed and the Python tests
// use exactly the same catalog. Weights, red flags and priority hints are placeholders
// and must be reviewed (ideally by a clinician) before the chapter 4 evaluation.
// At runtime these values live in the DB and can be edited by an ADMIN (no hardcoding).

import catalog from "../../../data/catalog.json";

export type DeptKey = "MED" | "SURG" | "PED" | "ENT";

type DepartmentSeed = { key: DeptKey; name: string; scopeOfCare: string };

type SymptomSeed = {
  code: string;
  label: string;
  synonyms: string[];
  weights: Partial<Record<DeptKey, number>>;
  isRedFlag?: boolean;
  onsiteOnly?: boolean;
  priorityHint?: number;
};

type QuestionSeed = {
  questionText: string;
  group: "basic" | "redflag" | "chief" | "chronic";
  order: number;
  options: { label: string; symptomCode: string | null }[];
  // show only when an earlier answer produced this symptom code
  dependsOn?: { symptomCode: string };
};

// Shift hours are Asia/Bangkok local time.
type DoctorSeed = { name: string; dept: DeptKey; startHour: number; endHour: number };

export const departments = catalog.departments as DepartmentSeed[];
export const symptomCodes = catalog.symptomCodes as SymptomSeed[];
export const questions = catalog.questions as QuestionSeed[];
export const doctors = catalog.doctors as DoctorSeed[];
