export type Role = "STAFF" | "ADMIN" | "DOCTOR";
export type Level = 1 | 2 | 3 | 4 | 5;
export type QueueStatus = "WAITING" | "CALLED" | "IN_PROGRESS" | "DONE" | "NO_SHOW" | "CANCELLED";
export type AppointmentStatus = "SCHEDULED" | "ARRIVED" | "CANCELLED" | "MISSED";
export type DeliveryMethod = "PICKUP" | "SHIP";
export type DeliveryStatus = "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "COMPLETED";

export type Patient = {
  id: string;
  lineUserId: string;
  fullName: string;
  ageGroup: string;
  age?: number | null;
  phoneNumber?: string | null;
  nationalId?: string | null;
  gender: string;
  healthCoverage: string;
  isChronic: boolean;
  address: string | null;
  createdAt: string;
};

export type Department = {
  id: string;
  code: string;
  name: string;
  scopeOfCare: string;
  defaultServiceMinutes: number;
  isActive: boolean;
};

export type Doctor = { id: string; name: string; departmentId: string; meetingUrl: string | null };

export type Shift = {
  id: string;
  doctorId: string;
  date: string;
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
  screeningId: string | null;
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
  doctorId: string | null;
  isActive: boolean;
  password?: string;
};

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
  departmentWeights: Record<string, number>;
  isRedFlag: boolean;
  onsiteOnly: boolean;
  priorityHint: Level | null;
  isActive: boolean;
};

export type ReasonItem = { code: string; weight: number; department: string };

export type Screening = {
  id: string;
  patientId: string;
  answers: { questionText: string; answer: string }[];
  freeTextInput: string | null;
  symptomCodes: string[];
  llmCodes: string[];
  llmStatus: "ok" | "skipped" | "failed";
  departmentScores: Record<string, number>;
  assignedDepartment: string | null;
  priorityLevel: Level;
  onlineEligible: boolean;
  isRedFlag: boolean;
  reason: ReasonItem[];
  createdAt: string;
};

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
  kind: "CALL" | "NO_SHOW" | "HOLD";
  at: string;
};

export type MockState = {
  version: number;
  clockOffsetMs: number;
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
  acknowledgedRedFlags: string[];
  settings: Settings;
};

export type Settings = {
  maxActiveQueues: number;
  ageBonusMinutes: number;
  chronicBonusMinutes: number;
  priorityAgeGroups: string[];
};
