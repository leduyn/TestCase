import { api } from './api';
import type {
  Proposal,
  ProposalType,
  FormTemplate,
  FormFieldDefinition,
  ProposalComment,
  ProposalFollower,
  ProposalHistory,
  ProposalNotification,
  ProposalAttachment,
  CreateProposalTypeDto,
  UpdateProposalTypeDto,
  CreateFormTemplateDto,
  UpdateFormTemplateDto,
  CreateFormFieldDto,
  CreateProposalDto,
  UpdateProposalDto,
  ProposalQueryFilter,
  ProposalListResponse,
  ProposalTypeListResponse,
  FormTemplateListResponse,
  ProposalsByTypeResponse,
  ProposalsByStatusResponse,
  ProposalsByApproverReportItem,
  ApprovalTimeStatsResponse,
  OverdueProposalsResponse,
} from '../types/proposal';

// ─── 1. Proposal Types API ────────────────────────────────────────────────

export const proposalTypeApi = {
  getTypes: (params?: {
    search?: string;
    isActive?: boolean;
    forCreation?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<ProposalTypeListResponse>('/proposal-types', { params }),

  getTypeById: (id: string) => api.get<ProposalType>(`/proposal-types/${id}`),

  createType: (data: CreateProposalTypeDto) =>
    api.post<{ message: string; proposalType: ProposalType }>('/proposal-types', data),

  updateType: (id: string, data: UpdateProposalTypeDto) =>
    api.put<{ message: string; proposalType: ProposalType }>(`/proposal-types/${id}`, data),

  toggleActive: (id: string) =>
    api.post<{ message: string; proposalType: ProposalType }>(`/proposal-types/${id}/toggle-active`),

  deleteType: (id: string) => api.delete<{ message: string }>(`/proposal-types/${id}`),
};

// ─── 2. Form Templates API ────────────────────────────────────────────────

export const formTemplateApi = {
  getTemplates: (params?: { search?: string; proposalTypeId?: string; page?: number; limit?: number }) =>
    api.get<FormTemplateListResponse>('/form-templates', { params }),

  getTemplateById: (id: string) => api.get<FormTemplate>(`/form-templates/${id}`),

  createTemplate: (data: CreateFormTemplateDto) =>
    api.post<{ message: string; template: FormTemplate }>('/form-templates', data),

  updateTemplate: (id: string, data: UpdateFormTemplateDto) =>
    api.put<{ message: string; template: FormTemplate }>(`/form-templates/${id}`, data),

  deleteTemplate: (id: string) => api.delete<{ message: string }>(`/form-templates/${id}`),

  duplicateTemplate: (id: string, name?: string) =>
    api.post<{ message: string; template: FormTemplate }>(`/form-templates/${id}/duplicate`, { name }),

  addField: (templateId: string, data: CreateFormFieldDto) =>
    api.post<{ message: string; field: FormFieldDefinition }>(`/form-templates/${templateId}/fields`, data),

  updateField: (fieldId: string, data: Partial<CreateFormFieldDto>) =>
    api.put<{ message: string; field: FormFieldDefinition }>(`/form-fields/${fieldId}`, data),

  deleteField: (fieldId: string) => api.delete<{ message: string }>(`/form-fields/${fieldId}`),

  reorderFields: (templateId: string, fieldOrders: { id: string; order: number }[]) =>
    api.post<{ message: string }>(`/form-templates/${templateId}/fields/reorder`, { fieldOrders }),
};

// ─── 3. Proposals API ─────────────────────────────────────────────────────

export const proposalApi = {
  getProposals: (params?: ProposalQueryFilter) =>
    api.get<ProposalListResponse>('/proposals', { params }),

  getProposalById: (id: string) => api.get<Proposal>(`/proposals/${id}`),

  createProposal: (data: CreateProposalDto) =>
    api.post<{ message: string; proposal: Proposal }>('/proposals', data),

  updateProposal: (id: string, data: UpdateProposalDto) =>
    api.put<{ message: string; proposal: Proposal }>(`/proposals/${id}`, data),

  deleteProposal: (id: string) => api.delete<{ message: string }>(`/proposals/${id}`),

  submitProposal: (id: string) =>
    api.post<{ message: string; proposal: Proposal }>(`/proposals/${id}/submit`),

  cancelProposal: (id: string, reason?: string) =>
    api.post<{ message: string; proposal: Proposal }>(`/proposals/${id}/cancel`, { reason }),

  approveProposal: (id: string, data?: { comment?: string; attachments?: any[] }) =>
    api.post<{ message: string; proposal: Proposal }>(`/proposals/${id}/approve`, data || {}),

  rejectProposal: (id: string, data: { comment: string; attachments?: any[] }) =>
    api.post<{ message: string; proposal: Proposal }>(`/proposals/${id}/reject`, data),

  startWorkflow: (id: string) =>
    api.post<{ message: string; proposal: Proposal }>(`/proposals/${id}/start-workflow`),

  getHistory: (id: string) => api.get<ProposalHistory[]>(`/proposals/${id}/history`),

  getComments: (id: string) => api.get<ProposalComment[]>(`/proposals/${id}/comments`),

  addComment: (id: string, data: { content: string; attachments?: any[] }) =>
    api.post<{ message: string; comment: ProposalComment }>(`/proposals/${id}/comments`, data),

  getFollowers: (id: string) => api.get<ProposalFollower[]>(`/proposals/${id}/followers`),

  addFollowers: (id: string, userIds: string[]) =>
    api.post<{ message: string; followers: ProposalFollower[] }>(`/proposals/${id}/followers`, { userIds }),

  removeFollower: (id: string, userId: string) =>
    api.delete<{ success: boolean; message: string }>(`/proposals/${id}/followers/${userId}`),
};

// ─── 4. My Proposals (User Dashboard) API ─────────────────────────────────

export const myProposalApi = {
  getMyProposals: (params?: ProposalQueryFilter) =>
    api.get<ProposalListResponse>('/my/proposals', { params }),

  getMyPendingApprovals: (params?: { search?: string; proposalTypeId?: string; priority?: string; page?: number; limit?: number }) =>
    api.get<ProposalListResponse>('/my/approvals', { params }),

  getMyApproved: (params?: { search?: string; proposalTypeId?: string; page?: number; limit?: number }) =>
    api.get<ProposalListResponse>('/my/approved', { params }),

  getMyRejected: (params?: { search?: string; proposalTypeId?: string; page?: number; limit?: number }) =>
    api.get<ProposalListResponse>('/my/rejected', { params }),

  getMyFollowing: (params?: ProposalQueryFilter) =>
    api.get<ProposalListResponse>('/my/following', { params }),
};

// ─── 5. Proposal Reports API ──────────────────────────────────────────────

export const proposalReportApi = {
  getByType: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ProposalsByTypeResponse>('/proposal-reports/proposals-by-type', { params }),

  getByStatus: (params?: { startDate?: string; endDate?: string; proposalTypeId?: string }) =>
    api.get<ProposalsByStatusResponse>('/proposal-reports/proposals-by-status', { params }),

  getByApprover: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ProposalsByApproverReportItem[]>('/proposal-reports/proposals-by-approver', { params }),

  getApprovalTimeStats: (params?: { proposalTypeId?: string }) =>
    api.get<ApprovalTimeStatsResponse>('/proposal-reports/approval-time', { params }),

  getOverdueProposals: () =>
    api.get<OverdueProposalsResponse>('/proposal-reports/overdue-proposals'),
};

// ─── 6. Proposal Notifications API ────────────────────────────────────────

export const proposalNotificationApi = {
  getNotifications: (params?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    api.get<{
      notifications: ProposalNotification[];
      total: number;
      page: number;
      limit: number;
    }>('/proposal-notifications', { params }),

  getUnreadCount: () =>
    api.get<{ unreadCount: number }>('/proposal-notifications/unread-count'),

  markAsRead: (id: string) =>
    api.put<{ message: string }>(`/proposal-notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<{ message: string }>('/proposal-notifications/read-all'),

  deleteNotification: (id: string) =>
    api.delete<{ message: string }>(`/proposal-notifications/${id}`),
};

// ─── 7. Proposal File Uploads API ─────────────────────────────────────────

export const proposalUploadApi = {
  uploadFiles: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    return api.post<{ message: string; files: ProposalAttachment[] }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getFileViewUrl: (storagePath: string) => {
    const token = localStorage.getItem('auth_token');
    return `/api/upload/view?storagePath=${encodeURIComponent(storagePath)}${
      token ? `&token=${encodeURIComponent(token)}` : ''
    }`;
  },
};

export const proposalServices = {
  type: proposalTypeApi,
  formTemplate: formTemplateApi,
  proposal: proposalApi,
  myProposal: myProposalApi,
  report: proposalReportApi,
  notification: proposalNotificationApi,
  upload: proposalUploadApi,
};

export default proposalServices;

