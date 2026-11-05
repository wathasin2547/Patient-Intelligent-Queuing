import catalog from "../../../data/catalog.json";

export type DeptKey = "MED" | "SURG" | "PED" | "ENT" | "GEN";

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
  dependsOn?: { symptomCode: string };
};

type DoctorSeed = { name: string; dept: DeptKey; startHour: number; endHour: number };

export const departments = catalog.departments as DepartmentSeed[];
export const symptomCodes = catalog.symptomCodes as SymptomSeed[];
export const questions = catalog.questions as QuestionSeed[];
export const doctors = catalog.doctors as DoctorSeed[];
