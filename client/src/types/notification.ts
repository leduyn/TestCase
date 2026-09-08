export type NotificationType =
  // Test Case & Test Execution
  | 'TESTCASE_UPDATED'
  | 'TESTCASE_REVIEWED'
  | 'EXECUTION_COMMENT'
  | 'EXECUTION_STATUS_CHANGED'
  | 'EXECUTION_ASSIGNED'
  // Task (Workflow)
  | 'TASK_COMMENT'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_STEP_CHANGED'
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  // Proposal
  | 'PROPOSAL_COMMENT'
  | 'PROPOSAL_SUBMITTED'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  | 'PROPOSAL_REMINDER'
  | 'PROPOSAL_WORKFLOW_STARTED'
  | 'PROPOSAL_FOLLOWER_ADDED';

export interface NotificationTestCase {
  id: string;
  testCaseCode: string;
  title: string;
  module?: string;
}

export interface NotificationExecution {
  id: string;
  status: string;
  server?: string | null;
  os?: string | null;
  executedAt?: string;
}

export interface NotificationTask {
  id: string;
  name: string;
  status: string;
  deadline?: string;
}

export interface NotificationProposal {
  id: string;
  title: string;
  status: string;
  priority?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  content: string;
  isRead: boolean;
  readAt?: string | null;
  testCaseId?: string | null;
  testCase?: NotificationTestCase | null;
  executionId?: string | null;
  execution?: NotificationExecution | null;
  taskId?: string | null;
  task?: NotificationTask | null;
  proposalId?: string | null;
  proposal?: NotificationProposal | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}
