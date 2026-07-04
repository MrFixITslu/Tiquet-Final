export type JobStatus =
  | "request"
  | "estimation"
  | "in-progress"
  | "review"
  | "invoiced"
  | "completed"
  | "paid";

export const COLUMNS: { id: JobStatus; label: string; color: string }[] = [
  {
    id: "request",
    label: "Incoming Request",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "estimation",
    label: "Estimation",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    id: "in-progress",
    label: "In Progress",
    color: "bg-purple-100 text-purple-700",
  },
  { id: "review", label: "Review", color: "bg-orange-100 text-orange-700" },
  { id: "invoiced", label: "Invoiced", color: "bg-indigo-100 text-indigo-700" },
  { id: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { id: "paid", label: "Paid", color: "bg-emerald-100 text-emerald-700" },
];

export interface ActivityLogEntry {
  id: string;
  action: string;
  timestamp: string;
  user: string;
}

export interface JobNote {
  id: string;
  text: string;
  timestamp: string;
  user: string;
}

export interface JobMessage {
  id: string;
  job_id: string;
  sender: string;
  content: string;
  timestamp: string;
}

export interface JobLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Deliverable {
  id: string;
  title: string;
  type: "digital" | "physical";
  // Digital
  fileUrl?: string; // e.g. AWS S3 link or Vercel Blob
  // Physical
  deliveryMethod?: "pickup" | "delivery";
  deliveryFee?: number;
  trackingInfo?: string;
}

export type WorkerType = "salary" | "hourly" | "bi-weekly";

export interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number;
  hourlyRate?: number;
  hoursWorked?: number;
  workerType: WorkerType;
  paymentMethod: "Bank Transfer" | "Check" | "PayPal";
  status: "active" | "inactive";
  isCheckedIn?: boolean;
  lastCheckIn?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  status: "pending" | "paid";
}

export interface TimeLog {
  id: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
  description?: string;
  status: JobStatus;
}

export interface Job {
  id: string;
  title: string;
  client: string;
  description: string;
  status: JobStatus;
  createdAt: string;
  dueDate?: string;
  amount?: number;
  priority: "low" | "medium" | "high";
  invoiceNotes?: string;
  assignedTo?: string;
  clientEmail?: string;
  secureToken?: string;
  tags?: string[];
  activityLog?: ActivityLogEntry[];
  notes?: JobNote[];
  timeLogs?: TimeLog[];
  messages?: JobMessage[];
  depositPaid?: boolean;
  quoteApproved?: number;
  lineItems?: JobLineItem[];
  deliverables?: Deliverable[];
  timerStartedAt?: string | null;
  stageAssignments?: Partial<Record<JobStatus, string>>;
}

export type PagePermission = "dashboard" | "jobs" | "payroll" | "invoices" | "users" | "files" | "new-request";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: PagePermission[];
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
  jobId?: string;
}
