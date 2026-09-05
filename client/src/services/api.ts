import axios from 'axios';
import type {
  User,
  TestSuite,
  TestCase,
  TestExecution,
  TestExecutionImage,
  TestExecutionHistory,
  TestExecutionWatcher,
  TestExecutionComment,
  ExecutionCommentAttachment,
  TestCaseReviewStatus,
  StorageConfig,
  AIProviderInfo,
  AIConfig,
  Permission,
  UserPermissionsResponse,
  UserTestStatsResponse,
  SuiteDetailResponse,
  ReviewTestCaseItem,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to catch 503 SETUP_REQUIRED and redirect to /setup
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 503 &&
      error.response.data?.status === 'SETUP_REQUIRED'
    ) {
      if (!window.location.pathname.startsWith('/setup')) {
        window.location.href = '/setup';
      }
    }
    return Promise.reject(error);
  }
);

// Setup API
export const setupApi = {
  getStatus: () =>
    api.get<{ status: 'READY' | 'SETUP_REQUIRED'; message: string }>('/setup/status'),
  testConnection: (data: {
    host: string;
    port: number;
    user: string;
    password?: string;
  }) =>
    api.post<{
      connected: boolean;
      message: string;
      serverVersion?: string;
      databases?: string[];
      warning?: string;
    }>('/setup/test-connection', data),
  createDatabase: (data: {
    host: string;
    port: number;
    user: string;
    password?: string;
    dbName: string;
  }) =>
    api.post<{ success: boolean; message: string }>('/setup/create-database', data),
  initialize: (data: {
    host: string;
    port: number;
    user: string;
    password?: string;
    dbName: string;
    createNew?: boolean;
    adminEmail: string;
    adminPassword: string;
    adminFullName: string;
  }) =>
    api.post<{
      success: boolean;
      message: string;
      steps: Array<{ step: string; status: string; message: string }>;
    }>('/setup/initialize', data),
};

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; fullName: string }) =>
    api.post<{ message: string; token?: string; user?: User }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ message: string; token: string; user: User }>('/auth/login', data),
  getMe: () => api.get<{ user: User }>('/auth/me'),
};

// AI API
export const aiApi = {
  getProviders: () => api.get<{ providers: AIProviderInfo[] }>('/ai/providers'),
  getModels: (provider: string, apiKey?: string, baseUrl?: string) =>
    api.get<{ models: any[] }>(`/ai/models/${provider}`, { params: { apiKey, baseUrl } }),
  getConfigs: () => api.get<{ configs: AIConfig[] }>('/ai/configs'),
  saveConfig: (data: {
    provider: string;
    apiKey: string;
    modelName?: string;
    baseUrl?: string;
    isActive?: boolean;
  }) => api.post<{ message: string; configId: string }>('/ai/configs', data),
  updateConfig: (
    id: string,
    data: {
      provider?: string;
      apiKey?: string;
      modelName?: string;
      baseUrl?: string;
      isActive?: boolean;
    }
  ) => api.put<{ message: string; config: AIConfig }>(`/ai/configs/${id}`, data),
  deleteConfig: (id: string) => api.delete<{ message: string }>(`/ai/configs/${id}`),
  toggleActive: (id: string) =>
    api.post<{ message: string; config: AIConfig }>(`/ai/configs/${id}/toggle-active`),
  getSystemPrompt: () => api.get<{ prompt: string }>('/settings/system-prompt'),
  updateSystemPrompt: (prompt: string) => api.put<{ message: string }>('/settings/system-prompt', { prompt }),
};

// TestCases API
export const testCaseApi = {
  generate: (formData: FormData) =>
    api.post<{
      message: string;
      testSuite: TestSuite;
      testCases: TestCase[];
    }>('/testcases/generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createTestCase: (data: Partial<TestCase> & { testSuiteId: string }) =>
    api.post<{ message: string; testCase: TestCase }>('/testcases', data),
  reviewTestCase: (id: string) =>
    api.patch<{
      message: string;
      testCase: { id: string; reviewStatus: TestCaseReviewStatus; reviewedById: string | null; reviewedAt: string | null };
    }>(`/testcases/${id}/review`),
  listForReview: () => api.get<{ testCases: ReviewTestCaseItem[] }>('/testcases/review'),
  bulkReview: (ids: string[]) =>
    api.post<{ message: string; updatedCount: number }>('/testcases/review-bulk', { ids }),
  getSuites: () => api.get<{ suites: TestSuite[] }>('/testcases/suites'),
  getSuiteById: (id: string) =>
    api.get<SuiteDetailResponse>(`/testcases/suites/${id}`),
  takeTestCases: (id: string, data?: { module?: string; testCaseIds?: string[] }) =>
    api.post<{ message: string; created: number; testCaseIds: string[] }>(
      `/testcases/suites/${id}/provision`,
      data || {}
    ),
  updateTestCase: (id: string, data: Partial<TestCase>) =>
    api.put<{ message: string; testCase: TestCase }>(`/testcases/${id}`, data),
  deleteTestCase: (id: string) => api.delete<{ message: string }>(`/testcases/${id}`),
  getTestCase: (id: string) =>
    api.get<{ testCase: TestCase }>(`/testcases/${id}`),
  importPreview: (formData: FormData) =>
    api.post<{
      sheetName: string;
      headers: string[];
      sampleRows: Record<string, string>[];
      suggestedMapping: Record<string, string>;
    }>('/testcases/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importTestCases: (formData: FormData) =>
    api.post<{
      message: string;
      testSuite: TestSuite;
      importedCount: number;
      skippedCount: number;
      skipped: Array<{ row: number; reason: string }>;
      testCases: TestCase[];
    }>('/testcases/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importJson: (data: any) =>
    api.post<{
      message: string;
      testSuite: TestSuite;
      importedCount: number;
      skippedCount: number;
      skipped: Array<{ row: number; reason: string }>;
      testCases: TestCase[];
    }>('/testcases/import/json', data),
  getUserExecutionStats: () =>
    api.get<UserTestStatsResponse>('/testcases/stats/user-executions'),
};

// Execution API
export const executionApi = {
  executeTestCase: (
    testCaseId: string,
    data: {
      server?: string;
      os?: string;
      status: string;
      actualResult?: string;
      evaluation?: string;
      notes?: string;
      executedById?: string;
      viewerIds?: string[];
      imageIds?: string[];
    }
  ) =>
    api.post<{ message: string; execution: TestExecution }>(
      `/executions/${testCaseId}/execute`,
      data
    ),
  updateExecution: (
    executionId: string,
    data: {
      server?: string;
      os?: string;
      status: string;
      actualResult?: string;
      evaluation?: string;
      notes?: string;
      executedById?: string;
      viewerIds?: string[];
      imageIds?: string[];
    }
  ) =>
    api.put<{ message: string; execution: TestExecution }>(
      `/executions/${executionId}`,
      data
    ),
  getHistory: (testCaseId: string) =>
    api.get<{ history: TestExecution[] }>(`/executions/${testCaseId}/history`),
  getSnapshots: (executionId: string) =>
    api.get<{ snapshots: TestExecutionHistory[] }>(
      `/executions/${executionId}/snapshots`
    ),
  getWatcherUsers: () =>
    api.get<{ users: { id: string; fullName: string; email: string }[] }>(
      `/executions/watcher-users`
    ),
  setWatchers: (executionId: string, userIds: string[]) =>
    api.patch<{ message: string; watchers: TestExecutionWatcher[] }>(
      `/executions/${executionId}/watchers`,
      { userIds }
    ),
};

// Execution Comment API
export const executionCommentApi = {
  getComments: (executionId: string) =>
    api.get<{ comments: TestExecutionComment[] }>(`/executions/${executionId}/comments`),
  addComment: (
    executionId: string,
    data: {
      content: string;
      attachments?: ExecutionCommentAttachment[];
    }
  ) =>
    api.post<{ message: string; comment: TestExecutionComment }>(
      `/executions/${executionId}/comments`,
      data
    ),
  deleteComment: (executionId: string, commentId: string) =>
    api.delete<{ message: string }>(`/executions/${executionId}/comments/${commentId}`),
};

// Execution Upload API (workflow/general upload endpoint)
export const executionUploadApi = {
  uploadFiles: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    return api.post<{
      message: string;
      files: {
        originalName: string;
        filename: string;
        storagePath: string;
        storageType: string;
        publicUrl: string | null;
        mimeType: string;
        size: number;
        uploadedAt: string;
      }[];
    }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFileViewUrl: (storagePath: string, filename?: string, isDownload?: boolean) => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const params = new URLSearchParams();
    const cleanPath = storagePath.replace(/^(\/|\\)?uploads(\/|\\)/i, '').replace(/^(\/|\\)+/, '');
    params.set('storagePath', cleanPath);
    if (filename) params.set('filename', filename);
    if (isDownload) params.set('download', 'true');
    if (token) params.set('token', token);
    const base = API_BASE_URL.replace(/\/$/, '');
    return `${base}/upload/view?${params.toString()}`;
  },
};

// Export API
export const exportApi = {
  getExcelDownloadUrl: (suiteId: string) => `${API_BASE_URL}/export/${suiteId}/excel`,
  getResultsExcelDownloadUrl: (suiteId: string) => `${API_BASE_URL}/export/${suiteId}/excel/results`,
  downloadResultsExcel: async (suiteId: string, filename?: string) => {
    const response = await api.get(`/export/${suiteId}/excel/results`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `TestCase_Results_${suiteId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// Environment Settings API
export const environmentApi = {
  getEnvironments: () =>
    api.get<{ servers: string[]; osList: string[]; defaultServer?: string; defaultOs?: string }>(
      '/settings/environments'
    ),
  saveEnvironments: (data: {
    servers: string[];
    osList: string[];
    defaultServer?: string;
    defaultOs?: string;
  }) =>
    api.post<{
      message: string;
      servers: string[];
      osList: string[];
      defaultServer?: string;
      defaultOs?: string;
    }>('/settings/environments', data),
};

// --- User Management API ---

export interface UserTableRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  lastLogin?: string;
  actions: React.ReactNode;
}

export const userApi = {
  getUsers: () => api.get<User[]>('/users'),
  getDirectory: () => api.get<User[]>('/users/directory'),
  getUser: (id: string) => api.get<User>(`/users/${id}`),
  createUser: (data: { email: string; password: string; fullName: string; role: string }) =>
    api.post<User>('/users', data),
  updateUser: (id: string, data: { fullName?: string; role?: string; status?: string }) =>
    api.put<User>(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
  toggleStatus: (id: string) => api.post<{ message: string; user: User }>(`/users/${id}/toggle-status`),
};

// Permission API
export const permissionApi = {
  getAll: () => api.get<{ permissions: Permission[] }>('/permissions/permissions'),
  getByCategory: () => api.get<{ categories: Record<string, Permission[]> }>('/permissions/permissions/categories'),
  getRolePermissions: (role: string) => api.get<{ role: string; permissions: Permission[] }>(`/permissions/roles/${role}/permissions`),
  updateRolePermissions: (role: string, permissionKeys: string[]) => api.put<{ role: string; permissions: Permission[]; message: string }>(`/permissions/roles/${role}/permissions`, { permissionKeys }),
  getMyPermissions: () => api.get<UserPermissionsResponse>('/permissions/users/me/permissions'),
  getUserPermissions: (id: string) => api.get<UserPermissionsResponse>(`/permissions/users/${id}/permissions`),
  grantUserPermission: (id: string, data: { permissionKey: string; effect: 'ALLOW' | 'DENY'; resourceType?: string; resourceId?: string }) => api.post(`/permissions/users/${id}/permissions`, data),
  revokeUserPermission: (id: string, permissionKey: string, resourceType?: string, resourceId?: string) => api.delete(`/permissions/users/${id}/permissions/${permissionKey}`, { params: { resourceType, resourceId } }),
  getUsersByPermission: (permissionKey: string) =>
    api.get<{ users: { id: string; fullName: string; email: string }[] }>(`/permissions/users/by-permission?permission=${encodeURIComponent(permissionKey)}`),
};

// API phân công xử lý trạng thái thực thi (thay thế quyền execution:set-*)
export const statusHandlerApi = {
  // Danh sách user được gán xử lý một trạng thái
  getHandlers: (status: string) =>
    api.get<{ status: string; users: { id: string; fullName: string; email: string }[] }>(
      `/execution-status-handlers/${status}`
    ),
  // Các trạng thái mà user hiện tại được gán xử lý
  getMyStatuses: () =>
    api.get<{ statuses: string[] }>(`/execution-status-handlers/me/statuses`),
  // Gán user xử lý một trạng thái
  assign: (status: string, userId: string) =>
    api.post<{ message: string; status: string; user: { id: string; fullName: string; email: string } }>(
      `/execution-status-handlers`,
      { status, userId }
    ),
  // Gỡ user khỏi xử lý một trạng thái
  remove: (status: string, userId: string) =>
    api.delete<{ message: string; status: string; userId: string }>(
      `/execution-status-handlers/${status}/${userId}`
    ),
};

// TestSuites API
export const suiteApi = {
  getSuites: () => api.get<{ suites: TestSuite[] }>('/testcases/suites'),
  getSuiteById: (id: string) =>
    api.get<SuiteDetailResponse>(`/testcases/suites/${id}`),
  updateTestSuite: (id: string, data: { name: string; moduleName: string; summary?: string; assumptions?: string }) =>
    api.put<{ message: string; testSuite: TestSuite }>(`/testcases/suites/${id}`, data),
  deleteTestSuite: (id: string) => api.delete<{ message: string }>(`/testcases/suites/${id}`),
};

// Upload API for Test Execution Images
export const uploadApi = {
  uploadImages: (executionId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post<{
      message: string;
      images: TestExecutionImage[];
      currentCount: number;
      maxFiles: number;
    }>(`/uploads/executions/${executionId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getExecutionImages: (executionId: string) =>
    api.get<{
      images: TestExecutionImage[];
      maxFiles: number;
      maxFileSizeMB: number;
    }>(`/uploads/executions/${executionId}/images`),
  getTestCaseImages: (testCaseId: string) =>
    api.get<{
      images: TestExecutionImage[];
      maxFiles: number;
      maxFileSizeMB: number;
    }>(`/uploads/testcases/${testCaseId}/images`),
  deleteImage: (imageId: string) =>
    api.delete<{ message: string }>(`/uploads/images/${imageId}`),
  getImageUrl: (imageId: string) => {
    const token = localStorage.getItem('auth_token');
    const base = `${API_BASE_URL}/uploads/images/${imageId}/view`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
  getThumbnailUrl: (imageId: string) => {
    const token = localStorage.getItem('auth_token');
    const base = `${API_BASE_URL}/uploads/images/${imageId}/thumbnail`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
};

// Storage Settings API
export const storageApi = {
  getConfig: () => api.get<{ config: StorageConfig }>('/settings/storage'),
  saveConfig: (data: Partial<StorageConfig>) =>
    api.post<{ message: string; provider: string }>('/settings/storage', data),
  testConnection: (data: Partial<StorageConfig>) =>
    api.post<{ success: boolean; message: string }>('/settings/storage/test', data),
};

