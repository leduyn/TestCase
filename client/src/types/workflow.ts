import type { User } from './index';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export type TaskHistoryChangeType = 'CREATED' | 'UPDATED' | 'STEP_CHANGED' | 'FIELD_UPDATED' | 'COMPLETED' | 'CANCELLED';

export interface ProcessStep {
  id: string;
  processId: string;
  name: string;
  executorIds: string[];
  timeLimitHours: number;
  order: number;
  instructions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Process {
  id: string;
  name: string;
  description?: string | null;
  managerId: string;
  manager?: User;
  watcherIds: string[];
  steps?: ProcessStep[];
  tasks?: Task[];
  _count?: {
    steps?: number;
    tasks?: number;
  };
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  processId: string;
  process?: Process;
  name: string;
  content?: string | null;
  customFields?: Record<string, any> | null;
  currentStepId?: string | null;
  currentStep?: ProcessStep | null;
  executorIds: string[];
  watcherIds: string[];
  previousExecutorId?: string | null;
  previousExecutor?: User | null;
  startedAt: string;
  deadline: string;
  completedAt?: string | null;
  status: TaskStatus;
  fileUploads?: Array<{
    originalName: string;
    filename: string;
    storagePath: string;
    mimeType?: string;
    size?: number;
    publicUrl?: string;
  }>;
  createdBy?: User;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  todos?: Todo[];
  comments?: TaskComment[];
  histories?: TaskHistory[];
  _count?: {
    todos?: number;
    comments?: number;
    histories?: number;
  };
}

export interface Todo {
  id: string;
  taskId: string;
  description: string;
  executorId?: string | null;
  executor?: User | null;
  deadline?: string | null;
  watcherIds: string[];
  files: any[];
  isCompleted: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  content: string;
  files: Array<{
    originalName: string;
    filename: string;
    storagePath: string;
    mimeType?: string;
    size?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  version: number;
  changedById?: string | null;
  changedBy?: User | null;
  changeType: TaskHistoryChangeType;
  changeDescription?: string | null;
  snapshot: any;
  createdAt: string;
}

export interface TasksByStatusReport {
  total: number;
  byStatus: {
    PENDING: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    OVERDUE: number;
    CANCELLED: number;
  };
}

export interface TaskByProcessReportItem {
  processId: string;
  processName: string;
  manager?: User;
  totalTasks: number;
  completed: number;
  inProgress: number;
  overdue: number;
  cancelled: number;
  completionRate: number;
}

export interface TaskByExecutorReportItem {
  user: User;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

export interface OverdueTaskReportItem extends Task {
  overdueHours: number;
}

// ─── Custom Fields Types ───────────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'file'
  | 'multifile'
  | 'user'
  | 'multiuser'
  | 'email'
  | 'phone'
  | 'url'
  | 'rating'
  | 'slider'
  | 'color'
  | 'formula';

export interface CustomFieldDefinition {
  id: string;
  processId: string;
  stepId?: string | null;
  fieldKey: string;
  fieldLabel: string;
  fieldType: CustomFieldType | string;
  fieldConfig: Record<string, any>;
  isRequired: boolean;
  defaultValue?: any;
  placeholder?: string | null;
  helpText?: string | null;
  order: number;
  isVisible: boolean;
  visibilityCondition?: {
    field: string;
    operator: string;
    value: any;
  } | null;
  validationRules?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    pattern_message?: string;
    [key: string]: any;
  } | null;
  step?: {
    id: string;
    name: string;
    order: number;
  } | null;
  createdBy?: User | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskCustomFieldValue {
  id: string;
  taskId: string;
  fieldDefinitionId: string;
  fieldDefinition?: CustomFieldDefinition;
  value: any;
  stepId?: string | null;
  filledById?: string | null;
  filledBy?: User | null;
  filledAt: string;
  updatedById?: string | null;
  updatedBy?: User | null;
  updatedAt: string;
}

export interface TaskCustomFieldItem {
  definition: CustomFieldDefinition;
  value: any;
  savedValue: any;
  filledBy?: User | null;
  filledAt?: string | null;
  updatedBy?: User | null;
  updatedAt?: string | null;
  stepId?: string | null;
  isCurrentStep: boolean;
  isVisible: boolean;
}

export interface TaskCustomFieldsResponse {
  taskId: string;
  taskName: string;
  processId: string;
  currentStepId?: string | null;
  fields: TaskCustomFieldItem[];
  valuesByKey: Record<string, any>;
}

export interface SupportedFieldTypeMeta {
  type: string;
  label: string;
  category: 'text' | 'number' | 'date' | 'choice' | 'file' | 'user' | 'format' | 'advanced';
  icon: string;
}
