import type { AppNotification } from '../types/notification';

export interface NotificationMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  url: string;
}

/**
 * Trả về thông tin meta, màu sắc và đường dẫn điều hướng của thông báo
 */
export function getNotificationMeta(notification: AppNotification): NotificationMeta {
  const { type, testCaseId, executionId, taskId, proposalId } = notification;

  const effectiveTestCaseId = testCaseId || notification.testCase?.id;
  const effectiveExecutionId = executionId || notification.execution?.id;

  // Helper: tạo URL deep-link đến trang chi tiết Test Case, có thể kèm executionId
  const testCaseUrl = (withExecution = false): string => {
    if (effectiveTestCaseId) {
      const base = `/testcases/${effectiveTestCaseId}`;
      if (withExecution && effectiveExecutionId) {
        return `${base}?executionId=${effectiveExecutionId}`;
      }
      return base;
    }
    return '/testcase-management';
  };

  switch (type) {
    // 1. Test Case & Test Execution
    case 'TESTCASE_UPDATED':
      return {
        label: 'Cập nhật Test Case',
        badgeBg: 'bg-sky-100 dark:bg-sky-950/60',
        badgeText: 'text-sky-700 dark:text-sky-300',
        dotColor: 'bg-sky-500',
        url: testCaseUrl(false),
      };

    case 'TESTCASE_REVIEWED':
      return {
        label: 'Kiểm duyệt Test Case',
        badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
        badgeText: 'text-purple-700 dark:text-purple-300',
        dotColor: 'bg-purple-500',
        url: testCaseUrl(false),
      };

    case 'EXECUTION_STATUS_CHANGED':
      return {
        label: 'Kết quả kiểm thử',
        badgeBg: 'bg-rose-100 dark:bg-rose-950/60',
        badgeText: 'text-rose-700 dark:text-rose-300',
        dotColor: 'bg-rose-500',
        url: testCaseUrl(true),
      };

    case 'EXECUTION_ASSIGNED':
      return {
        label: 'Bàn giao kiểm thử',
        badgeBg: 'bg-teal-100 dark:bg-teal-950/60',
        badgeText: 'text-teal-700 dark:text-teal-300',
        dotColor: 'bg-teal-500',
        url: testCaseUrl(true),
      };

    case 'EXECUTION_COMMENT':
      return {
        label: 'Bình luận kiểm thử',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        dotColor: 'bg-emerald-500',
        url: testCaseUrl(true),
      };

    // 2. Task (Workflow)
    case 'TASK_COMMENT':
      return {
        label: 'Bình luận nhiệm vụ',
        badgeBg: 'bg-indigo-100 dark:bg-indigo-950/60',
        badgeText: 'text-indigo-700 dark:text-indigo-300',
        dotColor: 'bg-indigo-500',
        url: taskId ? `/workflow?taskId=${taskId}` : '/workflow',
      };

    case 'TASK_STATUS_CHANGED':
    case 'TASK_STEP_CHANGED':
    case 'TASK_ASSIGNED':
    case 'TASK_OVERDUE':
      return {
        label: 'Tiến độ nhiệm vụ',
        badgeBg: 'bg-blue-100 dark:bg-blue-950/60',
        badgeText: 'text-blue-700 dark:text-blue-300',
        dotColor: 'bg-blue-500',
        url: taskId ? `/workflow?taskId=${taskId}` : '/workflow',
      };

    // 3. Proposal (Đề xuất)
    case 'PROPOSAL_COMMENT':
      return {
        label: 'Bình luận đề xuất',
        badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
        badgeText: 'text-amber-700 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        url: proposalId ? `/proposals/${proposalId}` : '/proposals',
      };

    case 'PROPOSAL_SUBMITTED':
    case 'PROPOSAL_APPROVED':
    case 'PROPOSAL_REJECTED':
    case 'PROPOSAL_REMINDER':
    case 'PROPOSAL_WORKFLOW_STARTED':
    case 'PROPOSAL_FOLLOWER_ADDED':
    default:
      return {
        label: 'Thông báo đề xuất',
        badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
        badgeText: 'text-amber-700 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        url: proposalId ? `/proposals/${proposalId}` : '/proposals',
      };
  }
}

/**
 * Định dạng thời gian hiển thị tương đối theo tiếng Việt
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return 'Vừa xong';
  }
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  if (diffDays === 1) {
    return `Hôm qua lúc ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
