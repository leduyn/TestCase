import { api } from './api';
import type {
  Process,
  ProcessStep,
  Task,
  Todo,
  TaskComment,
  TaskHistory,
  TasksByStatusReport,
  TaskByProcessReportItem,
  TaskByExecutorReportItem,
  OverdueTaskReportItem,
  CustomFieldDefinition,
  TaskCustomFieldsResponse,
  SupportedFieldTypeMeta,
} from '../types/workflow';

// ─── Process API ────────────────────────────────────────────────────────────

export const processApi = {
  getProcesses: (params?: { search?: string; managerId?: string; page?: number; limit?: number }) =>
    api.get<{ items: Process[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/processes',
      { params }
    ),

  getProcessById: (id: string) => api.get<Process>(`/processes/${id}`),

  createProcess: (data: {
    name: string;
    description?: string;
    managerId?: string;
    watcherIds?: string[];
    steps?: Array<{
      name: string;
      executorIds?: string[];
      timeLimitHours?: number;
      order?: number;
      instructions?: string;
    }>;
  }) => api.post<{ message: string; process: Process }>('/processes', data),

  updateProcess: (
    id: string,
    data: {
      name?: string;
      description?: string;
      managerId?: string;
      watcherIds?: string[];
    }
  ) => api.put<{ message: string; process: Process }>(`/processes/${id}`, data),

  deleteProcess: (id: string) => api.delete<{ message: string }>(`/processes/${id}`),

  addStep: (
    processId: string,
    data: {
      name: string;
      executorIds?: string[];
      timeLimitHours?: number;
      order?: number;
      instructions?: string;
    }
  ) => api.post<{ message: string; step: ProcessStep }>(`/processes/${processId}/steps`, data),

  updateStep: (
    stepId: string,
    data: {
      name?: string;
      executorIds?: string[];
      timeLimitHours?: number;
      order?: number;
      instructions?: string;
    }
  ) => api.put<{ message: string; step: ProcessStep }>(`/processes/steps/${stepId}`, data),

  deleteStep: (stepId: string) => api.delete<{ message: string }>(`/processes/steps/${stepId}`),
};

// ─── Task API ───────────────────────────────────────────────────────────────

export const taskApi = {
  getTasks: (params?: {
    search?: string;
    processId?: string;
    status?: string;
    executorId?: string;
    createdById?: string;
    overdue?: boolean;
    page?: number;
    limit?: number;
  }) =>
    api.get<{ items: Task[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/tasks',
      { params }
    ),

  getTaskById: (id: string) => api.get<Task>(`/tasks/${id}`),

  createTask: (data: {
    processId: string;
    name: string;
    content?: string;
    customFields?: Record<string, any>;
    executorIds?: string[];
    watcherIds?: string[];
    deadline?: string;
    fileUploads?: any[];
  }) => api.post<{ message: string; task: Task }>('/tasks', data),

  updateTask: (
    id: string,
    data: {
      name?: string;
      content?: string;
      customFields?: Record<string, any>;
      executorIds?: string[];
      watcherIds?: string[];
      deadline?: string;
      fileUploads?: any[];
      status?: string;
      changeDescription?: string;
    }
  ) => api.put<{ message: string; task: Task }>(`/tasks/${id}`, data),

  transitionStep: (
    id: string,
    data?: {
      targetStepId?: string;
      executorIds?: string[];
      deadline?: string;
      changeDescription?: string;
      customFields?: Record<string, any>;
    }
  ) => api.post<{ message: string; task: Task }>(`/tasks/${id}/transition`, data || {}),

  completeTask: (id: string, description?: string) =>
    api.post<{ message: string; task: Task }>(`/tasks/${id}/complete`, { description }),

  cancelTask: (id: string, reason?: string) =>
    api.post<{ message: string; task: Task }>(`/tasks/${id}/cancel`, { reason }),

  getTaskHistory: (id: string) => api.get<TaskHistory[]>(`/tasks/${id}/history`),

  getTaskHistoryVersion: (id: string, version: number) =>
    api.get<TaskHistory>(`/tasks/${id}/history/${version}`),
};

// ─── Todo API ───────────────────────────────────────────────────────────────

export const todoApi = {
  getTodos: (taskId: string) => api.get<Todo[]>(`/tasks/${taskId}/todos`),

  createTodo: (
    taskId: string,
    data: {
      description: string;
      executorId?: string;
      deadline?: string;
      watcherIds?: string[];
      files?: any[];
    }
  ) => api.post<{ message: string; todo: Todo }>(`/tasks/${taskId}/todos`, data),

  updateTodo: (
    todoId: string,
    data: {
      description?: string;
      executorId?: string;
      deadline?: string;
      watcherIds?: string[];
      files?: any[];
      isCompleted?: boolean;
    }
  ) => api.put<{ message: string; todo: Todo }>(`/todos/${todoId}`, data),

  deleteTodo: (todoId: string) => api.delete<{ message: string }>(`/todos/${todoId}`),

  toggleTodo: (todoId: string) => api.put<{ message: string; todo: Todo }>(`/todos/${todoId}/toggle`),
};

// ─── Comment API ────────────────────────────────────────────────────────────

export const commentApi = {
  getComments: (taskId: string) => api.get<TaskComment[]>(`/tasks/${taskId}/comments`),

  createComment: (taskId: string, data: { content: string; files?: any[] }) =>
    api.post<{ message: string; comment: TaskComment }>(`/tasks/${taskId}/comments`, data),

  updateComment: (commentId: string, data: { content?: string; files?: any[] }) =>
    api.put<{ message: string; comment: TaskComment }>(`/comments/${commentId}`, data),

  deleteComment: (commentId: string) => api.delete<{ message: string }>(`/comments/${commentId}`),
};

// ─── Upload API ─────────────────────────────────────────────────────────────

export const workflowUploadApi = {
  uploadFiles: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    return api.post<{ message: string; files: any[] }>('/workflow/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getFileViewUrl: (storagePath: string) => {
    const token = localStorage.getItem('auth_token');
    return `/api/workflow/upload/view?storagePath=${encodeURIComponent(storagePath)}${
      token ? `&token=${encodeURIComponent(token)}` : ''
    }`;
  },
};

// ─── Reports API ────────────────────────────────────────────────────────────

export const workflowReportApi = {
  getTasksByStatus: () => api.get<TasksByStatusReport>('/reports/tasks-by-status'),
  getTasksByProcess: () => api.get<TaskByProcessReportItem[]>('/reports/tasks-by-process'),
  getTasksByExecutor: () => api.get<TaskByExecutorReportItem[]>('/reports/tasks-by-executor'),
  getOverdueTasks: () => api.get<OverdueTaskReportItem[]>('/reports/overdue-tasks'),
};

// ─── Custom Fields Management API ──────────────────────────────────────────

export const customFieldApi = {
  getSupportedTypes: () => api.get<SupportedFieldTypeMeta[]>('/custom-fields/types'),

  getCustomFieldsByProcess: (processId: string, stepId?: string) =>
    api.get<CustomFieldDefinition[]>(`/processes/${processId}/custom-fields`, {
      params: { stepId },
    }),

  getCustomFieldById: (id: string) => api.get<CustomFieldDefinition>(`/custom-fields/${id}`),

  createCustomField: (
    processId: string,
    data: {
      stepId?: string | null;
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      fieldConfig?: Record<string, any>;
      isRequired?: boolean;
      defaultValue?: any;
      placeholder?: string | null;
      helpText?: string | null;
      order?: number;
      isVisible?: boolean;
      visibilityCondition?: any;
      validationRules?: any;
    }
  ) =>
    api.post<{ message: string; field: CustomFieldDefinition }>(
      `/processes/${processId}/custom-fields`,
      data
    ),

  updateCustomField: (
    id: string,
    data: {
      stepId?: string | null;
      fieldLabel?: string;
      fieldConfig?: Record<string, any>;
      isRequired?: boolean;
      defaultValue?: any;
      placeholder?: string | null;
      helpText?: string | null;
      order?: number;
      isVisible?: boolean;
      visibilityCondition?: any;
      validationRules?: any;
    }
  ) =>
    api.put<{ message: string; field: CustomFieldDefinition }>(`/custom-fields/${id}`, data),

  deleteCustomField: (id: string) =>
    api.delete<{ message: string }>(`/custom-fields/${id}`),

  reorderCustomFields: (processId: string, fieldOrders: Array<{ id: string; order: number }>) =>
    api.post<{ message: string }>(`/processes/${processId}/custom-fields/reorder`, { fieldOrders }),

  duplicateCustomField: (id: string) =>
    api.post<{ message: string; field: CustomFieldDefinition }>(`/custom-fields/${id}/duplicate`),

  validateConfig: (fieldType: string, fieldConfig: any) =>
    api.post<{ isValid: boolean; error?: string }>('/custom-fields/validate-config', {
      fieldType,
      fieldConfig,
    }),
};

// ─── Task Custom Fields API ────────────────────────────────────────────────

export const taskCustomFieldApi = {
  getTaskCustomFields: (taskId: string, stepId?: string) =>
    api.get<TaskCustomFieldsResponse>(`/tasks/${taskId}/custom-fields`, {
      params: { stepId },
    }),

  saveTaskCustomFields: (
    taskId: string,
    data: {
      fields?: Array<{ fieldDefinitionId?: string; fieldKey?: string; value: any; stepId?: string }>;
      values?: Record<string, any>;
    }
  ) =>
    api.put<{ message: string; success: boolean; values: Record<string, any> }>(
      `/tasks/${taskId}/custom-fields`,
      data
    ),

  validateTaskCustomFields: (
    taskId: string,
    data: {
      fields?: Array<{ fieldDefinitionId?: string; fieldKey?: string; value: any }>;
      values?: Record<string, any>;
    }
  ) =>
    api.post<{ isValid: boolean; errors: Array<{ fieldKey: string; fieldLabel: string; error: string }> }>(
      `/tasks/${taskId}/custom-fields/validate`,
      data
    ),

  getTaskCustomFieldHistory: (taskId: string) =>
    api.get<Array<{ id: string; version: number; changeDescription: string; changedBy: any; createdAt: string; snapshot: any }>>(
      `/tasks/${taskId}/custom-fields/history`
    ),
};
