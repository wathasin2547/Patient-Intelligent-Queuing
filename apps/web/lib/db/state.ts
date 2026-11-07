import { prisma } from "@/lib/prisma";
import { bkkDate } from "@/lib/mock/time";
import type { CallEvent, Level, MockState, Patient, QuestionOption, ReasonItem, Settings } from "@/lib/mock/types";
import { COVERAGE_OTHER } from "@/lib/patient-options";

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ["WAITING", "CALLED", "IN_PROGRESS"];
const DEFAULT_SETTINGS: Settings = { maxActiveQueues: 3, ageBonusMinutes: 30, chronicBonusMinutes: 15, priorityAgeGroups: ["60+"] };

type StoredAnswer = { questionId: string; optionIndex: number };

export async function loadState(): Promise<MockState> {
  const now = Date.now();
  const since = new Date(now - 14 * DAY);

  const [departments, doctors, shifts, patients, queues, users, setting, symptomCodes, questions, appointments, prescriptions, deliveries, refills, screenings] = await Promise.all([
    prisma.department.findMany(),
    prisma.doctor.findMany(),
    prisma.shift.findMany({ where: { startTime: { gte: new Date(now - 7 * DAY) } } }),
    prisma.patient.findMany(),
    prisma.queue.findMany({ where: { OR: [{ status: { in: ACTIVE } }, { checkInTime: { gte: since } }] } }),
    prisma.user.findMany(),
    prisma.systemSetting.findFirst(),
    prisma.symptomCode.findMany(),
    prisma.question.findMany({ orderBy: { order: "asc" } }),
    prisma.appointment.findMany({ where: { OR: [{ status: "SCHEDULED" }, { appointmentTime: { gte: since } }] } }),
    prisma.prescription.findMany({ where: { issuedAt: { gte: new Date(now - 90 * DAY) } } }),
    prisma.delivery.findMany(),
    prisma.refillSchedule.findMany(),
    prisma.screening.findMany({ where: { createdAt: { gte: since } } }),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));

  const callEvents: CallEvent[] = queues
    .flatMap((q): CallEvent[] => {
      const events: CallEvent[] = [];
      if (q.calledTime) events.push({ id: `call_${q.id}`, queueId: q.id, doctorId: q.doctorId ?? "", kind: "CALL", at: q.calledTime.toISOString() });
      if (q.status === "NO_SHOW" && q.finishedTime) events.push({ id: `noshow_${q.id}`, queueId: q.id, doctorId: q.doctorId ?? "", kind: "NO_SHOW", at: q.finishedTime.toISOString() });
      return events;
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: 0,
    clockOffsetMs: 0,
    sessionUserId: null,
    liffPatientId: null,
    departments: departments.map((d) => ({
      id: d.id,
      code: d.code ?? "Q",
      name: d.name,
      scopeOfCare: d.scopeOfCare ?? "",
      defaultServiceMinutes: d.defaultServiceMinutes,
      isActive: d.isActive,
    })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, departmentId: d.departmentId, meetingUrl: d.meetingUrl })),
    shifts: shifts.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      date: bkkDate(s.date.getTime()),
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      status: s.status as "ACTIVE" | "CANCELLED",
    })),
    patients: patients.map((p) => ({
      id: p.id,
      lineUserId: p.lineUserId,
      fullName: p.fullName ?? "(ยังไม่ลงทะเบียน)",
      ageGroup: p.ageGroup ?? "",
      age: p.age,
      phoneNumber: p.phoneNumber,
      nationalId: p.nationalId ? "x-xxxx-xxxxx-xx-" + p.nationalId.slice(-1) : null,
      gender: p.gender ?? "",
      healthCoverage: p.healthCoverage === COVERAGE_OTHER && p.healthCoverageOther ? `${COVERAGE_OTHER} (${p.healthCoverageOther})` : p.healthCoverage ?? "",
      drugAllergies: p.drugAllergies,
      religion: p.religion,
      isChronic: p.isChronic,
      address: p.address,
      createdAt: p.createdAt.toISOString(),
    })),
    queues: queues.map((q) => ({
      id: q.id,
      patientId: q.patientId,
      screeningId: q.screeningId,
      appointmentId: q.appointmentId,
      departmentId: q.departmentId,
      doctorId: q.doctorId,
      queueNumber: q.queueNumber,
      visitType: q.visitType as "ONSITE" | "ONLINE",
      priorityLevel: q.priorityLevel as Level,
      status: q.status as "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED",
      checkInTime: q.checkInTime.toISOString(),
      calledTime: q.calledTime ? q.calledTime.toISOString() : null,
      finishedTime: q.finishedTime ? q.finishedTime.toISOString() : null,
      editedBy: q.editedBy,
      editedAt: q.editedAt ? q.editedAt.toISOString() : null,
      referredFromQueueId: q.referredFromQueueId,
    })),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as "STAFF" | "ADMIN" | "DOCTOR",
      departmentId: u.departmentId,
      doctorId: u.doctorId,
      isActive: u.isActive,
    })),
    settings: setting
      ? {
          maxActiveQueues: setting.maxActiveQueues,
          ageBonusMinutes: setting.ageBonusMinutes,
          chronicBonusMinutes: setting.chronicBonusMinutes,
          priorityAgeGroups: setting.priorityAgeGroups,
        }
      : DEFAULT_SETTINGS,
    appointments: appointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      appointmentTime: a.appointmentTime.toISOString(),
      reason: a.reason,
      status: a.status as "SCHEDULED" | "ARRIVED" | "CANCELLED" | "MISSED",
      createdBy: a.createdBy,
      createdAt: a.createdAt.toISOString(),
    })),
    screenings: screenings.map((s) => ({
      id: s.id,
      patientId: s.patientId,
      answers: ((s.answers as StoredAnswer[] | null) ?? []).map((a) => {
        const q = questionById.get(a.questionId);
        const option = (q?.options as QuestionOption[] | undefined)?.[a.optionIndex];
        return { questionText: q?.questionText ?? "-", answer: option?.label ?? "-" };
      }),
      freeTextInput: s.freeTextInput,
      symptomCodes: s.symptomCodes,
      llmCodes: s.llmCodes,
      llmStatus: s.llmStatus as "ok" | "skipped" | "failed",
      departmentScores: (s.departmentScores ?? {}) as Record<string, number>,
      assignedDepartment: s.assignedDepartment,
      priorityLevel: s.priorityLevel as Level,
      onlineEligible: s.onlineEligible,
      isRedFlag: s.isRedFlag,
      reason: ((s.reason as { items?: ReasonItem[] } | null)?.items ?? []) as ReasonItem[],
      createdAt: s.createdAt.toISOString(),
    })),
    prescriptions: prescriptions.map((r) => ({
      id: r.id,
      queueId: r.queueId,
      items: r.items as { name: string; dosage: string; quantity: string }[],
      daysSupply: r.daysSupply,
      issuedAt: r.issuedAt.toISOString(),
    })),
    deliveries: deliveries.map((d) => ({
      id: d.id,
      prescriptionId: d.prescriptionId,
      method: d.method as "PICKUP" | "SHIP",
      address: d.address,
      status: d.status as "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "COMPLETED",
      updatedAt: d.updatedAt.toISOString(),
    })),
    refills: refills.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      prescriptionId: r.prescriptionId,
      dueDate: bkkDate(r.dueDate.getTime()),
      remindedAt: r.remindedAt ? r.remindedAt.toISOString() : null,
      status: r.status as "PENDING" | "SENT" | "CLOSED",
    })),
    symptomCodes: symptomCodes.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      synonyms: c.synonyms,
      departmentWeights: (c.departmentWeights ?? {}) as Record<string, number>,
      isRedFlag: c.isRedFlag,
      onsiteOnly: c.onsiteOnly,
      priorityHint: c.priorityHint as Level | null,
      isActive: c.isActive,
    })),
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      group: q.group,
      order: q.order,
      options: q.options as QuestionOption[],
      dependsOn: (q.dependsOn as { symptomCode: string } | null) ?? null,
      isActive: q.isActive,
    })),
    notifications: [],
    callEvents,
    acknowledgedRedFlags: [],
  };
}

export function stateForPatient(state: MockState, me: Patient | null): MockState {
  const anon = (id: string) => `anon_${id}`;
  const mine = (patientId: string) => me !== null && patientId === me.id;
  const hiddenQueues = state.queues.filter((q) => !mine(q.patientId));
  const risk = new Map(state.patients.map((p) => [p.id, p]));

  const others: Patient[] = hiddenQueues.map((q) => ({
    id: anon(q.id),
    lineUserId: "",
    fullName: "",
    ageGroup: risk.get(q.patientId)?.ageGroup ?? "",
    gender: "",
    healthCoverage: "",
    isChronic: risk.get(q.patientId)?.isChronic ?? false,
    address: null,
    createdAt: "",
  }));
  const myQueueIds = new Set(state.queues.filter((q) => mine(q.patientId)).map((q) => q.id));
  const myPrescriptions = state.prescriptions.filter((r) => myQueueIds.has(r.queueId));
  const myPrescriptionIds = new Set(myPrescriptions.map((r) => r.id));

  return {
    ...state,
    sessionUserId: null,
    liffPatientId: me?.id ?? null,
    users: [],
    patients: me ? [me, ...others] : others,
    queues: state.queues.map((q) =>
      mine(q.patientId)
        ? q
        : { ...q, patientId: anon(q.id), screeningId: null, queueNumber: "", editedBy: null, referredFromQueueId: null },
    ),
    appointments: state.appointments.map((a) => (mine(a.patientId) ? a : { ...a, patientId: "", reason: "", createdBy: "" })),
    screenings: state.screenings.filter((s) => mine(s.patientId)),
    prescriptions: myPrescriptions,
    deliveries: state.deliveries.filter((d) => myPrescriptionIds.has(d.prescriptionId)),
    refills: state.refills.filter((r) => mine(r.patientId)),
    symptomCodes: [],
    questions: [],
    callEvents: [],
  };
}

export function stateForDisplay(state: MockState): MockState {
  return {
    ...state,
    users: [],
    patients: [],
    appointments: [],
    screenings: [],
    prescriptions: [],
    deliveries: [],
    refills: [],
    symptomCodes: [],
    questions: [],
    queues: state.queues.map((q) => ({ ...q, patientId: "", screeningId: null, editedBy: null, referredFromQueueId: null })),
  };
}
