import axios from 'axios';
import type {
  User,
  TestSuite,
  TestCase,
  TestExecution,
  AIProviderInfo,
  AIConfig,
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
    api.post<{ message: string; token: string; user: User }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ message: string; token: string; user: User }>('/auth/login', data),
  getMe: () => api.get<{ user: User }>('/auth/me'),
};

// AI API
export const aiApi = {
  getProviders: () => api.get<{ providers: AIProviderInfo[] }>('/ai/providers'),
  getConfigs: () => api.get<{ configs: AIConfig[] }>('/ai/configs'),
  saveConfig: (data: {
    provider: string;
    apiKey: string;
    modelName?: string;
    baseUrl?: string;
    isActive?: boolean;
  }) => api.post<{ message: string; configId: string }>('/ai/configs', data),
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
  getSuites: () => api.get<{ suites: TestSuite[] }>('/testcases/suites'),
  getSuiteById: (id: string) =>
    api.get<{ suite: TestSuite; testCases: TestCase[] }>(`/testcases/suites/${id}`),
  updateTestCase: (id: string, data: Partial<TestCase>) =>
    api.put<{ message: string; testCase: TestCase }>(`/testcases/${id}`, data),
  deleteTestCase: (id: string) => api.delete<{ message: string }>(`/testcases/${id}`),
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
    }
  ) =>
    api.post<{ message: string; execution: TestExecution }>(
      `/executions/${testCaseId}/execute`,
      data
    ),
  getHistory: (testCaseId: string) =>
    api.get<{ history: TestExecution[] }>(`/executions/${testCaseId}/history`),
};

// Export API
export const exportApi = {
  getExcelDownloadUrl: (suiteId: string) => `${API_BASE_URL}/export/${suiteId}/excel`,
};

// Environment Settings API
export const environmentApi = {
  getEnvironments: () =>
    api.get<{ servers: string[]; osList: string[] }>('/settings/environments'),
  saveEnvironments: (data: { servers: string[]; osList: string[] }) =>
    api.post<{ message: string; servers: string[]; osList: string[] }>(
      '/settings/environments',
      data
    ),
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
  getUser: (id: string) => api.get<User>(`/users/${id}`),
  createUser: (data: { email: string; password: string; fullName: string; role: string }) =>
    api.post<User>('/users', data),
  updateUser: (id: string, data: { fullName?: string; role?: string; status?: string }) =>
    api.put<User>(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
  toggleStatus: (id: string) => api.post<{ message: string; user: User }>(`/users/${id}/toggle-status`),
};

