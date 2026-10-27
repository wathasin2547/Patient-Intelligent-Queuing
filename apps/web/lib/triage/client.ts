export type ClosedAnswer = { questionId: string; optionIndex: number };

export type TriageRequest = {
  patientId?: string;
  closedAnswers: ClosedAnswer[];
  freeText?: string;
  isChronicFollowUp?: boolean;
  symptomChanged?: boolean;
};

// Same fields as TriageResponse in apps/algorithm/main.py — reason and scores must reach the database (rule 3)
export type TriageResult = {
  symptomCodes: string[];
  llmCodes: string[];
  llmStatus: string;
  isRedFlag: boolean;
  redFlagCodes: string[];
  departmentScores: Record<string, number>;
  assignedDepartment: string | null;
  priorityLevel: number;
  onlineEligible: boolean;
  reason: { code: string; weight: number; department: string }[];
  doctorId: string | null;
  queueScore: number | null;
  noDoctorOnShift: boolean;
  nextShiftStart: string | null;
  warnings: string[];
};

export async function callTriage(body: TriageRequest): Promise<TriageResult> {
  const baseUrl = process.env.ALGORITHM_SERVICE_URL;
  if (!baseUrl) throw new Error("ALGORITHM_SERVICE_URL is not set");

  const res = await fetch(`${baseUrl}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000), // ไม่รอเกิน 8 วินาที
  });

  if (!res.ok) {
    throw new Error(`triage failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TriageResult;
}