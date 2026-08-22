export type Role = 'ADMIN' | 'TESTER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status?: string;
  createdAt?: string;
  lastLogin?: string;
}

export type ExecutionStatus = 'PASSED' | 'FAILED' | 'BLOCKED' | 'UNTESTED';

export interface TestExecutionImage {
  id: string;
  executionId: string;
  filename: string;
  storagePath: string;
  storageType: string;
  mimeType: string;
  fileSize: number;
  publicUrl?: string | null;
  uploadedAt: string;
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  executedById?: string | null;
  executedBy?: {
    fullName: string;
    email: string;
  } | null;
  server?: string | null;
  os?: string | null;
  status: ExecutionStatus;
  actualResult?: string | null;
  evaluation?: string | null;
  notes?: string | null;
  images?: TestExecutionImage[];
  executedAt: string;
  updatedAt?: string;
}

export interface TestCase {
  id: string;
  testSuiteId: string;
  testCaseCode: string;
  module: string;
  platform: string; // App, CMS, Web
  title: string;
  testType: string; // Luồng chuẩn, Luồng ngoại lệ, Giá trị biên
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string; // Cao, Trung bình, Thấp
  orderIndex: number;
  createdAt: string;
  latestExecution?: TestExecution | null;
  executions?: TestExecution[];
}

export interface TestSuiteStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  untested: number;
  passRate: number;
}

export interface TestSuite {
  id: string;
  name: string;
  moduleName: string;
  summary?: string | null;
  assumptions?: string | null;
  filename?: string | null;
  createdAt: string;
  updatedAt?: string;
  stats?: TestSuiteStats;
}

export interface AIProviderInfo {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  defaultBaseUrl?: string;
  requiresBaseUrl: boolean;
}

export interface AIConfig {
  id: string;
  provider: string;
  modelName: string;
  apiKey?: string;
  baseUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EnvironmentSettings {
  servers: string[];
  osList: string[];
}

export interface GenerationResult {
  moduleName: string;
  summary?: string;
  assumptions?: string;
  testCases: {
    testCaseCode?: string;
    module: string;
    platform?: string;
    title: string;
    testType?: string;
    preconditions?: string;
    steps?: string | string[];
    expectedResult?: string;
    priority?: string;
  }[];
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  role: Role;
  permissionId: string;
  permission: Permission;
  grantedAt: string;
  grantedById?: string;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  permission: Permission;
  effect: 'ALLOW' | 'DENY';
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
}

export interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

export interface UserPermissionsResponse {
  role: Role;
  rolePermissions: string[];
  userPermissions: Array<{
    permissionKey: string;
    effect: 'ALLOW' | 'DENY';
    resourceType?: string;
    resourceId?: string;
  }>;
}

export interface UserTestStat {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  status?: string;
  lastLogin?: string | null;
  totalTestCases: number;
  untested: number;
  passed: number;
  failed: number;
  blocked: number;
  testedCount: number;
  passRate: number;
  completionRate: number;
}

export interface UserTestStatsResponse {
  canViewAll: boolean;
  totalTestCases: number;
  userStats: UserTestStat[];
}

export interface StorageConfig {
  provider: 'local' | 'smb' | 'ftp' | 'google_drive';
  maxFilesPerExecution: number;
  maxFileSizeMB: number;
  local: {
    uploadPath: string;
  };
  smb: {
    host: string;
    share: string;
    username: string;
    password?: string;
    domain: string;
    remotePath: string;
  };
  ftp: {
    host: string;
    port: number;
    username: string;
    password?: string;
    remotePath: string;
    secure: boolean;
  };
  googleDrive: {
    authType: 'service_account' | 'oauth2';
    folderId: string;
    credentials?: any;
    oauth2?: {
      clientId: string;
      clientSecret?: string;
      refreshToken?: string;
    };
  };
}


