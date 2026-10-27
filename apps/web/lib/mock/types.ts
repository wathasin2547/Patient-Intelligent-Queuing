// Front-end data model. Field names follow the ER diagram in the report
// (docs/thesis/images/er-diagram.png) so the mock store can later be swapped for
// real API calls without renaming anything. All timestamps are ISO strings in UTC.

export type Role = "STAFF" | "ADMIN" | "DOCTOR";
export type Level = 1 | 2 | 3 | 4 | 5;
export type QueueStatus = "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED";
export type AppointmentStatus = "SCHEDULED" | "ARRIVED" | "CANCELLED" | "MISSED";
export type DeliveryMethod = "PICKUP" | "SHIP";
export type DeliveryStatus = "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "COMPLETED";

// ── Service data (MongoDB, relations declared in Prisma) ──

export type Patient = {
  id: string;
  lineUserId: string;
  fullName: string;
  ageGroup: string; // "0-5" | "6-17" | "18-59" | "60+"
  gender: string;
  healthCoverage: string;
  isChronic: boolean;
  address: string | null;
  createdAt: string;
};

export type Department = {
  id: string;
  code: string; // queue-number prefix, e.g. "MED" (not in the ER yet — see SPEC note)
  name: string;
  scopeOfCare: string;
  /** fallback consultation length for the ETA until the doctor has finished cases today */
  defaultServiceMinutes: number;
  isActive: boolean;
};

// meetingUrl: the doctor's fixed room on an external video service, sent to online patients when called
export type Doctor = { id: string; name: string; departmentId: string; meetingUrl: string | null };

export type Shift = {
  id: string;
  doctorId: string;
  date: string; // Bangkok calendar date "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  status: "ACTIVE" | "CANCELLED";
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentTime: string;
  reason: string;
  status: AppointmentStatus;
  createdBy: string;
  createdAt: string;
};

export type Queue = {
  id: string;
  patientId: string;
  screeningId: string | null; // reference into MongoDB
  appointmentId: string | null;
  departmentId: string;
  doctorId: string | null;
  queueNumber: string;
  visitType: "ONSITE" | "ONLINE";
  priorityLevel: Level;
  status: QueueStatus;
  checkInTime: string;
  calledTime: string | null;
  finishedTime: string | null;
  editedBy: string | null;
  editedAt: string | null;
  /** set when a doctor referred the patient here from another queue on the same day */
  referredFromQueueId: string | null;
};

export type PrescriptionItem = { name: string; dosage: string; quantity: string };

export type Prescription = {
  id: string;
  queueId: string;
  items: PrescriptionItem[];
  daysSupply: number;
  issuedAt: string;
};

export type Delivery = {
  id: string;
  prescriptionId: string;
  method: DeliveryMethod;
  address: string | null;
  status: DeliveryStatus;
  updatedAt: string;
};

export type RefillSchedule = {
  id: string;
  patientId: string;
  prescriptionId: string;
  dueDate: string;
  remindedAt: string | null;
  status: "PENDING" | "SENT" | "CLOSED";
};

export type User = {
  id: string;
  username: string;
  role: Role;
  departmentId: string | null;
  doctorId: string | null; // set only for DOCTOR accounts: the doctor whose queue this login works
  isActive: boolean;
};

// ── Screening knowledge base and results (MongoDB) ──

export type QuestionOption = { label: string; symptomCode: string | null };

export type Question = {
  id: string;
  questionText: string;
  group: string;
  order: number;
  options: QuestionOption[];
  dependsOn: { symptomCode: string } | null;
  isActive: boolean;
};

export type SymptomCode = {
  id: string;
  code: string;
  label: string;
  synonyms: string[];
  departmentWeights: Record<string, number>; // departmentId -> weight
  isRedFlag: boolean;
  onsiteOnly: boolean;
  priorityHint: Level | null;
  isActive: boolean;
};

// Same shape the algorithm service returns in /triage (reason[])
export type ReasonItem = { code: string; weight: number; department: string };

export type Screening = {
  id: string;
  patientId: string;
  answers: { questionText: string; answer: string }[];
  freeTextInput: string | null;
  symptomCodes: string[];
  llmCodes: string[];
  llmStatus: "ok" | "skipped" | "failed";
  departmentScores: Record<string, number>; // departmentId -> score
  assignedDepartment: string | null; // what the algorithm picked (kept even if staff edits the queue)
  priorityLevel: Level;
  onlineEligible: boolean;
  isRedFlag: boolean;
  reason: ReasonItem[];
  createdAt: string;
};

// ── UI-only records (would be LINE pushes / audit logs in the real system) ──

export type Notification = {
  id: string;
  patientId: string;
  text: string;
  at: string;
};

export type CallEvent = {
  id: string;
  queueId: string;
  doctorId: string;
  /** HOLD = the top patient was busy in another queue, so the doctor called the next one */
  kind: "CALL" | "NO_SHOW" | "HOLD";
  at: string;
};

export type MockState = {
  version: number;
  clockOffsetMs: number; // simulated clock = Date.now() + offset
  sessionUserId: string | null;
  liffPatientId: string | null;
  departments: Department[];
  doctors: Doctor[];
  shifts: Shift[];
  patients: Patient[];
  appointments: Appointment[];
  screenings: Screening[];
  queues: Queue[];
  prescriptions: Prescription[];
  deliveries: Delivery[];
  refills: RefillSchedule[];
  symptomCodes: SymptomCode[];
  questions: Question[];
  users: User[];
  notifications: Notification[];
  callEvents: CallEvent[];
  acknowledgedRedFlags: string[]; // screening ids
  settings: Settings;
};

/** System settings editable by the admin (UC12), never hardcoded. */
export type Settings = {
  /** how many queues one patient may hold at once, one per department */
  maxActiveQueues: number;
};
