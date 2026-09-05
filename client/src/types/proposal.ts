import type { User } from './index';

// ─── Enums & Base Types ───────────────────────────────────────────────────

export type ProposalStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ApprovalWorkflowType = 'PARALLEL' | 'SEQUENTIAL' | 'ANY_ONE';

export type ApprovalAction = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'CANCELLED';

export type ProposalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ProposalHistoryType =
  | 'CREATED'
  | 'SUBMITTED'
  | 'UPDATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'APPROVER_ADDED'
  | 'APPROVER_REMOVED'
  | 'WORKFLOW_STARTED'
  | 'FOLLOWER_ADDED'
  | 'FOLLOWER_REMOVED';

export type ProposalNotificationType =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REMINDER'
  | 'COMMENT'
  | 'WORKFLOW_STARTED'
  | 'FOLLOWER_ADDED';

// ─── Form Templates & Dynamic Fields ──────────────────────────────────────

export interface FormFieldDefinition {
  id: string;
  formTemplateId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldConfig: Record<string, any>;
  isRequired: boolean;
  defaultValue?: any;
  placeholder?: string | null;
  helpText?: string | null;
  order: number;
  isVisible: boolean;
  visibilityCondition?: any;
  validationRules?: any;
  sectionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string | null;
  proposalTypeId?: string | null;
  isDefault: boolean;
  formStructure?: {
    sections?: Array<{
      id: string;
      title: string;
      description?: string;
      fieldKeys?: string[];
    }>;
  } | null;
  fields?: FormFieldDefinition[];
  _count?: {
    fields?: number;
    selectedByProposalTypes?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Proposal Types ───────────────────────────────────────────────────────

export interface ProposalType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  defaultApproverIds: string[];
  isOptionalApprover: boolean;
  optionalApproverConfig?: {
    maxSelectable?: number;
    roleFilter?: string[];
    departmentFilter?: string[];
    allowDirectManager?: boolean;
  } | null;
  approvalWorkflow: ApprovalWorkflowType;
  deadlineHours: number;
  creatorIds?: string[];
  creatorRoles?: string[];
  creatorDepartments?: string[];
  useCustomForm: boolean;
  formTemplateId?: string | null;
  formTemplate?: FormTemplate | null;
  linkedProcessId?: string | null;
  linkedProcess?: { id: string; name: string } | null;
  autoStartWorkflow: boolean;
  isActive: boolean;
  allowDraft: boolean;
  allowCancel: boolean;
  allowEditAfterSubmit: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    proposals?: number;
  };
}

// ─── Attachments ──────────────────────────────────────────────────────────

export interface ProposalAttachment {
  name: string;
  originalName?: string;
  filename?: string;
  url?: string;
  storagePath?: string;
  storageType?: string;
  publicUrl?: string | null;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

// ─── Proposals & Approvals ────────────────────────────────────────────────

export interface ProposalApproval {
  id: string;
  proposalId: string;
  approverId: string;
  approver?: User;
  order: number;
  action: ApprovalAction;
  comment?: string | null;
  attachments?: ProposalAttachment[];
  decidedAt?: string | null;
  reminderSentAt?: string | null;
  reminderCount: number;
  createdAt: string;
}

export interface ProposalHistory {
  id: string;
  proposalId: string;
  version: number;
  changedById?: string | null;
  changedBy?: User | null;
  changeType: ProposalHistoryType;
  changeDescription?: string | null;
  snapshot?: any;
  createdAt: string;
}

export interface ProposalComment {
  id: string;
  proposalId: string;
  userId: string;
  user?: User;
  content: string;
  attachments?: ProposalAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProposalFollower {
  id: string;
  proposalId: string;
  userId: string;
  user?: User;
  addedById?: string | null;
  addedBy?: User | null;
  createdAt: string;
}

export interface ProposalNotification {
  id: string;
  proposalId: string;
  proposal?: {
    id: string;
    title: string;
    status: ProposalStatus;
    priority?: ProposalPriority;
    creator?: User;
  };
  recipientId: string;
  type: ProposalNotificationType;
  title: string;
  content: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface Proposal {
  id: string;
  proposalTypeId: string;
  proposalType?: ProposalType;
  title: string;
  content?: string | null;
  creatorId: string;
  creator?: User;
  formData?: Record<string, any> | null;
  defaultApprovers?: string[];
  optionalApprovers?: string[];
  directManagerId?: string | null;
  directManager?: User | null;
  approvalList?: Array<{
    id: string;
    approverId: string;
    order: number;
    action: ApprovalAction;
  }>;
  status: ProposalStatus;
  priority: ProposalPriority;
  deadline?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  completedAt?: string | null;
  linkedTaskId?: string | null;
  linkedTask?: {
    id: string;
    name: string;
    status: string;
    processId: string;
  } | null;
  attachments?: ProposalAttachment[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  approvals?: ProposalApproval[];
  comments?: ProposalComment[];
  histories?: ProposalHistory[];
  followers?: ProposalFollower[];
  isFollower?: boolean;
  currentUserApproval?: {
    canApprove: boolean;
    reason?: string;
    approvalId?: string;
    order?: number;
  };
  userApprovalId?: string;
  userApprovalOrder?: number;
  _count?: {
    comments?: number;
    followers?: number;
  };
}

// ─── API DTOs & Payload Types ─────────────────────────────────────────────

export interface CreateProposalTypeDto {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultApproverIds?: string[];
  isOptionalApprover?: boolean;
  optionalApproverConfig?: any;
  approvalWorkflow?: ApprovalWorkflowType;
  deadlineHours?: number;
  creatorIds?: string[];
  creatorRoles?: string[];
  creatorDepartments?: string[];
  useCustomForm?: boolean;
  formTemplateId?: string;
  linkedProcessId?: string;
  autoStartWorkflow?: boolean;
  isActive?: boolean;
  allowDraft?: boolean;
  allowCancel?: boolean;
  allowEditAfterSubmit?: boolean;
}

export interface UpdateProposalTypeDto extends Partial<CreateProposalTypeDto> {}

export interface CreateFormFieldDto {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldConfig?: any;
  isRequired?: boolean;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  order?: number;
  isVisible?: boolean;
  visibilityCondition?: any;
  validationRules?: any;
  sectionId?: string;
}

export interface CreateFormTemplateDto {
  name: string;
  description?: string;
  proposalTypeId?: string;
  isDefault?: boolean;
  formStructure?: any;
  fields?: CreateFormFieldDto[];
}

export interface UpdateFormTemplateDto {
  name?: string;
  description?: string;
  proposalTypeId?: string;
  isDefault?: boolean;
  formStructure?: any;
}

export interface CreateProposalDto {
  proposalTypeId: string;
  title: string;
  content?: string;
  formData?: Record<string, any>;
  optionalApprovers?: string[];
  directManagerId?: string;
  priority?: ProposalPriority;
  attachments?: any[];
  tags?: string[];
  isSubmit?: boolean;
}

export interface UpdateProposalDto {
  title?: string;
  content?: string;
  formData?: Record<string, any>;
  optionalApprovers?: string[];
  directManagerId?: string;
  priority?: ProposalPriority;
  attachments?: any[];
  tags?: string[];
}

export interface ProposalQueryFilter {
  status?: ProposalStatus;
  proposalTypeId?: string;
  priority?: ProposalPriority;
  creatorId?: string;
  approverId?: string;
  approverAction?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ProposalListResponse {
  proposals: Proposal[];
  total: number;
  page: number;
  limit: number;
}

export interface ProposalTypeListResponse {
  types: ProposalType[];
  total: number;
  page: number;
  limit: number;
}

export interface FormTemplateListResponse {
  templates: FormTemplate[];
  total: number;
  page: number;
  limit: number;
}

// ─── Reports & Analytics ──────────────────────────────────────────────────

export interface ProposalsByTypeReportItem {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  icon?: string | null;
  count: number;
  percentage: number;
}

export interface ProposalsByTypeResponse {
  total: number;
  byType: ProposalsByTypeReportItem[];
}

export interface ProposalsByStatusReportItem {
  status: ProposalStatus;
  count: number;
  percentage: number;
}

export interface ProposalsByStatusResponse {
  total: number;
  byStatus: ProposalsByStatusReportItem[];
}

export interface ProposalsByApproverReportItem {
  approver: User;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  avgResponseHours: number;
}

export interface ApprovalTimeStatsResponse {
  totalEvaluated: number;
  avgHours: number;
  minHours: number;
  maxHours: number;
}

export interface OverdueProposalsResponse {
  total: number;
  proposals: Proposal[];
}

// ─── UI Constants & Configuration Mappings ───────────────────────────────

export const PROPOSAL_STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  DRAFT: {
    label: 'Bản nháp',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700/60',
    borderColor: 'border-gray-300 dark:border-gray-600',
  },
  PENDING: {
    label: 'Chờ duyệt',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  IN_REVIEW: {
    label: 'Đang xem xét',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  APPROVED: {
    label: 'Đã phê duyệt',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Đã từ chối',
    color: 'text-rose-700 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  CANCELLED: {
    label: 'Đã hủy',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  EXPIRED: {
    label: 'Quá hạn',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
};

export const PROPOSAL_PRIORITY_CONFIG: Record<
  ProposalPriority,
  { label: string; color: string; bgColor: string }
> = {
  LOW: {
    label: 'Thấp',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  NORMAL: {
    label: 'Bình thường',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
  },
  HIGH: {
    label: 'Cao',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
  },
  URGENT: {
    label: 'Khẩn cấp',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
  },
};

export const APPROVAL_WORKFLOW_CONFIG: Record<
  ApprovalWorkflowType,
  { label: string; description: string }
> = {
  SEQUENTIAL: {
    label: 'Duyệt tuần tự',
    description: 'Người duyệt tiếp theo chỉ nhận được thông báo sau khi người trước đã chấp thuận.',
  },
  PARALLEL: {
    label: 'Duyệt song song',
    description: 'Tất cả người duyệt nhận được thông báo cùng lúc và tất cả đều phải chấp thuận.',
  },
  ANY_ONE: {
    label: 'Chỉ cần một người duyệt',
    description: 'Bất kỳ người duyệt nào chấp thuận thì đề xuất sẽ hoàn tất.',
  },
};

export const APPROVAL_ACTION_CONFIG: Record<
  ApprovalAction,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'Chờ duyệt',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
  },
  APPROVED: {
    label: 'Đã phê duyệt',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  REJECTED: {
    label: 'Từ chối',
    color: 'text-rose-700 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/40',
  },
  SKIPPED: {
    label: 'Bỏ qua',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  CANCELLED: {
    label: 'Hủy bỏ',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
};

export const PROPOSAL_HISTORY_LABELS: Record<ProposalHistoryType, string> = {
  CREATED: 'Tạo đề xuất',
  SUBMITTED: 'Gửi đề xuất phê duyệt',
  UPDATED: 'Chỉnh sửa nội dung đề xuất',
  APPROVED: 'Phê duyệt đề xuất',
  REJECTED: 'Từ chối đề xuất',
  CANCELLED: 'Hủy đề xuất',
  APPROVER_ADDED: 'Thêm người duyệt',
  APPROVER_REMOVED: 'Gỡ người duyệt',
  FOLLOWER_ADDED: 'Thêm người theo dõi',
  FOLLOWER_REMOVED: 'Gỡ người theo dõi',
  WORKFLOW_STARTED: 'Khởi chạy quy trình công việc',
};

