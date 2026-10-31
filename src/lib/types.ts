export type Role = "admin" | "staff";
export type Lang = "zh" | "en";

export interface Member {
  email: string; // 小写，同时是文件 ID
  name: string;
  role: Role;
  active: boolean;
  title?: string;
  skills?: string;
  phone?: string;
  lang?: Lang;
}

export type ServiceType = "brand" | "uniform" | "social" | "merch" | "graphic" | "photo";
export type UniformVariant = "readymade" | "custom";

export interface SocialCycle {
  month: string; // YYYY-MM
  posts: number;
  videos: number;
}

export interface SocialPlan {
  startMonth: string; // YYYY-MM
  endMonth: string | null; // null = 持续
  posts: number;
  videos: number;
  cycles: SocialCycle[];
}

export interface ProjectService {
  type: ServiceType;
  variant?: UniformVariant;
  stages: string[]; // "stage.xxx" 为预设阶段键，其余为自定义文字
  current: number; // 0..stages.length，等于 length 表示全部完成
  social?: SocialPlan;
}

export type ShippingOption = "vendorToPrinter" | "viaStudio" | "vendorToClient" | "other";

export interface OrderLine {
  style: string;
  color: string;
  sizes: Record<string, number>;
}

export interface Outsourcing {
  vendorName?: string;
  vendorContact?: string;
  orderDate?: string;
  vendorEta?: string;
  printerName?: string;
  printerContact?: string;
  printMethod?: string;
  printerEta?: string;
  shipping?: ShippingOption;
  shippingNote?: string;
  sizeColumns?: string[];
  lines?: OrderLine[];
}

export type ProjectStatus = "active" | "waiting" | "paused" | "done" | "cancelled";

export interface Project {
  id: string;
  name: string;
  client: string;
  budget?: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  ownerEmail: string;
  memberEmails: string[];
  status: ProjectStatus;
  services: ProjectService[];
  notes?: string;
  outsourcing?: Outsourcing;
  createdAt?: number;
  updatedAt?: number;
}

export type TaskStatus = "todo" | "doing" | "review" | "revise" | "done";
export type Priority = "high" | "medium" | "low";

export interface Subtask {
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  serviceType?: ServiceType;
  title: string;
  description?: string;
  assigneeEmails: string[];
  memberEmails: string[]; // 从项目复制，用于权限
  due: string; // YYYY-MM-DD
  priority: Priority;
  status: TaskStatus;
  subtasks: Subtask[];
  note?: string; // 备注
  reviewNote?: string; // 打回时的修改要点
  cycle?: string; // 社交媒体周期 YYYY-MM
  autoTitle?: { key: string; vars: Record<string, string | number> }; // 系统自动建立的任务，按界面语言显示
  createdAt?: number;
  updatedAt?: number;
}

export type EventType = "delivery" | "deadline" | "meeting" | "internal";

export interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD（含），多日活动
  allDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string;
  projectId?: string;
  attendeeEmails: string[];
  location?: string;
  source?: "app" | "google";
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type NotificationType =
  | "assigned"
  | "submitted"
  | "rejected"
  | "approved"
  | "dueSoon"
  | "overdue"
  | "eventChanged";

export interface AppNotification {
  id: string;
  toEmail: string;
  type: NotificationType;
  text: string; // 已组好的显示文字（中文 / 英文各一份）
  textEn: string;
  link: string;
  read: boolean;
  createdAt: number;
  fromEmail?: string;
}
