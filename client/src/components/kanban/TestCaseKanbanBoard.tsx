import React, { useMemo, useState, useEffect } from 'react';
import {
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type { TestCase, TestExecution, ExecutionStatus } from '../../types';
import { KanbanColumn } from './KanbanColumn';
import { DropConfirmModal } from './DropConfirmModal';
import { executionApi, environmentApi, statusHandlerApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface TestCaseKanbanBoardProps {
  testCases: TestCase[];
  canExecuteTestCase: boolean;
  canUpdateTestCase: boolean;
  canDeleteTestCase: boolean;
  onOpenDrawer: (
    tc: TestCase,
    editMode?: boolean,
    initialExec?: TestExecution | null,
    isNewExecution?: boolean
  ) => void;
  onEditTestCase: (tc: TestCase) => void;
  onDuplicateTestCase: (tc: TestCase) => void;
  onDeleteTestCase: (tc: TestCase) => void;
  onSaveExecution: (updatedTestCase: TestCase) => void;
  onOpenEvidenceModal?: (tc: TestCase) => void;
  getEvidenceStats?: (tc: TestCase) => { totalImages: number; totalMilestones: number; testers: string[] };
  defaultServer?: string;
  defaultOs?: string;
}

interface ColumnConfig {
  status: ExecutionStatus;
  title: string;
  icon: React.ReactNode;
  theme: {
    headerBg: string;
    borderTop: string;
    badgeBg: string;
    badgeText: string;
    countBg: string;
    highlightBorder: string;
    highlightBg: string;
  };
}

// Status display info
export const STATUS_INFO: Record<ExecutionStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  UNTESTED: { label: 'Chưa test', color: 'text-sky-700 dark:text-sky-300', bgColor: 'bg-sky-50 dark:bg-sky-950/60', borderColor: 'border-sky-300' },
  FAILED: { label: 'Failed', color: 'text-rose-700 dark:text-rose-300', bgColor: 'bg-rose-50 dark:bg-rose-950/60', borderColor: 'border-rose-300' },
  BLOCKED: { label: 'Blocked', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-950/60', borderColor: 'border-amber-300' },
  RETEST: { label: 'Test lại', color: 'text-purple-700 dark:text-purple-300', bgColor: 'bg-purple-50 dark:bg-purple-950/60', borderColor: 'border-purple-300' },
  PASSED: { label: 'Passed', color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-950/60', borderColor: 'border-emerald-300' },
};

export const TestCaseKanbanBoard: React.FC<TestCaseKanbanBoardProps> = ({
  testCases,
  canExecuteTestCase,
  canUpdateTestCase,
  canDeleteTestCase,
  onOpenDrawer,
  onEditTestCase,
  onDuplicateTestCase,
  onDeleteTestCase,
  onSaveExecution,
  onOpenEvidenceModal,
  getEvidenceStats,
  defaultServer = 'STAGING',
  defaultOs = 'Windows 11',
}) => {
  const { user } = useAuth();

  // Drag & Drop Confirmation Modal state
  const [dropConfirm, setDropConfirm] = useState<{
    testCase: TestCase;
    targetStatus: ExecutionStatus;
    fromStatus: ExecutionStatus;
  } | null>(null);
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropServer, setDropServer] = useState(defaultServer);
  const [dropOs, setDropOs] = useState(defaultOs);
  // Người xử lý bước tiếp theo (ghi đè executedById) – chỉ user có execution:set-<status>
  const [dropHandlerId, setDropHandlerId] = useState('');
  const [dropEligibleHandlers, setDropEligibleHandlers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [dropLoadingHandlers, setDropLoadingHandlers] = useState(false);
  const [availableServers, setAvailableServers] = useState<string[]>(['DEV', 'STAGING', 'UAT', 'PRODUCTION']);
  const [availableOsList, setAvailableOsList] = useState<string[]>([
    'Windows 11',
    'Windows 10',
    'macOS Sonoma',
    'macOS Sequoia',
    'Android 14',
    'Android 15',
    'iOS 17.5',
    'iOS 18',
    'Ubuntu 22.04',
  ]);

  const columnsConfig: ColumnConfig[] = [
    {
      status: 'UNTESTED',
      title: 'Chưa test',
      icon: <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      theme: {
        headerBg: 'bg-sky-50/60 dark:bg-sky-950/40',
        borderTop: 'border-t-sky-500',
        badgeBg: 'bg-sky-100 dark:bg-sky-950/60',
        badgeText: 'text-sky-700 dark:text-sky-300',
        countBg: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300',
        highlightBorder: 'ring-sky-400 border-sky-400',
        highlightBg: 'bg-sky-50/60 dark:bg-sky-950/40',
      },
    },
    {
      status: 'FAILED',
      title: 'Failed',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
      theme: {
        headerBg: 'bg-rose-50/60 dark:bg-rose-950/40',
        borderTop: 'border-t-rose-500',
        badgeBg: 'bg-rose-100 dark:bg-rose-950/60',
        badgeText: 'text-rose-700 dark:text-rose-300',
        countBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
        highlightBorder: 'ring-rose-400 border-rose-400',
        highlightBg: 'bg-rose-50/60 dark:bg-rose-950/40',
      },
    },
    {
      status: 'BLOCKED',
      title: 'Blocked',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      theme: {
        headerBg: 'bg-amber-50/60 dark:bg-amber-950/40',
        borderTop: 'border-t-amber-500',
        badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
        badgeText: 'text-amber-700 dark:text-amber-300',
        countBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
        highlightBorder: 'ring-amber-400 border-amber-400',
        highlightBg: 'bg-amber-50/60 dark:bg-amber-950/40',
      },
    },
    {
      status: 'RETEST',
      title: 'Test lại',
      icon: <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      theme: {
        headerBg: 'bg-purple-50/60 dark:bg-purple-950/40',
        borderTop: 'border-t-purple-500',
        badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
        badgeText: 'text-purple-700 dark:text-purple-300',
        countBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
        highlightBorder: 'ring-purple-400 border-purple-400',
        highlightBg: 'bg-purple-50/60 dark:bg-purple-950/40',
      },
    },
    {
      status: 'PASSED',
      title: 'Passed',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      theme: {
        headerBg: 'bg-emerald-50/60 dark:bg-emerald-950/40',
        borderTop: 'border-t-emerald-500',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        countBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
        highlightBorder: 'ring-emerald-400 border-emerald-400',
        highlightBg: 'bg-emerald-50/60 dark:bg-emerald-950/40',
      },
    },
  ];

  // Mặc định cột "Chưa test" chỉ hiển thị các test case do người dùng hiện tại tạo/thực thi
  // (ẩn test case của người khác hoặc chưa được sinh execution cho người dùng).
  const [showAllUntested, setShowAllUntested] = useState(false);

  // Group test cases by status
  const groupedCases = useMemo(() => {
    const groups: Record<ExecutionStatus, TestCase[]> = {
      UNTESTED: [],
      FAILED: [],
      BLOCKED: [],
      RETEST: [],
      PASSED: [],
    };

    testCases.forEach((tc) => {
      const status = (tc.latestExecution?.status || 'UNTESTED').toUpperCase() as ExecutionStatus;
      if (groups[status]) {
        groups[status].push(tc);
      } else {
        groups['UNTESTED'].push(tc);
      }
    });

    // Lọc cột Chưa test: mặc định chỉ hiển thị test case của người dùng hiện tại
    if (!showAllUntested && user?.id) {
      groups['UNTESTED'] = groups['UNTESTED'].filter((tc) => {
        const ex = tc.latestExecution;
        return ex?.createdById === user.id || ex?.executedById === user.id;
      });
    }

    return groups;
  }, [testCases, showAllUntested, user?.id]);

  useEffect(() => {
    if (defaultServer) setDropServer(defaultServer);
  }, [defaultServer]);

  useEffect(() => {
    if (defaultOs) setDropOs(defaultOs);
  }, [defaultOs]);

  // Load environment settings (servers & OS list)
  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        const res = await environmentApi.getEnvironments();
        if (res.data.servers && res.data.servers.length > 0) {
          setAvailableServers(res.data.servers);
        }
        if (res.data.osList && res.data.osList.length > 0) {
          setAvailableOsList(res.data.osList);
        }
        if (res.data.defaultServer && !dropConfirm) {
          setDropServer(res.data.defaultServer);
        }
        if (res.data.defaultOs && !dropConfirm) {
          setDropOs(res.data.defaultOs);
        }
      } catch (err) {
        console.warn('Could not load environment settings, using defaults:', err);
      }
    };
    loadEnvironments();
  }, []);

  // Handle status update from quick menu (direct, no popup)
  const handleQuickStatusChange = async (tc: TestCase, newStatus: ExecutionStatus) => {
    const currentStatus = (tc.latestExecution?.status || 'UNTESTED').toUpperCase();
    if (currentStatus === newStatus) return;

    const prevExecution = tc.latestExecution;
    const serverToUse = prevExecution?.server || defaultServer;
    const osToUse = prevExecution?.os || defaultOs;

    // 1. Optimistic Update locally
    const optimisticExecution: TestExecution = {
      id: prevExecution?.id || `temp-${Date.now()}`,
      testCaseId: tc.id,
      executedById: user?.id,
      executedBy: user ? { fullName: user.fullName, email: user.email } : null,
      server: serverToUse,
      os: osToUse,
      status: newStatus,
      actualResult: prevExecution?.actualResult || null,
      evaluation: prevExecution?.evaluation || null,
      notes: prevExecution?.notes || null,
      executedAt: new Date().toISOString(),
    };

    onSaveExecution({
      ...tc,
      latestExecution: optimisticExecution,
    });

    // 2. Call backend API
    try {
      const res = await executionApi.executeTestCase(tc.id, {
        status: newStatus,
        server: serverToUse,
        os: osToUse,
        actualResult: prevExecution?.actualResult || undefined,
        notes: prevExecution?.notes || undefined,
      });

      // Update with exact server execution record
      onSaveExecution({
        ...tc,
        latestExecution: res.data.execution,
      });
    } catch (err: any) {
      console.error('Error updating execution status via Kanban:', err);
      // Rollback
      onSaveExecution({
        ...tc,
        latestExecution: prevExecution || null,
      });
      alert(`Lỗi khi chuyển trạng thái Test Case: ${err.response?.data?.message || err.message}`);
    }
  };

  // Handle Drag & Drop: show confirmation popup instead of direct update
  const handleDropCard = (testCaseId: string, targetStatus: ExecutionStatus) => {
    const tc = testCases.find((c) => c.id === testCaseId);
    if (!tc) return;

    const currentStatus = (tc.latestExecution?.status || 'UNTESTED').toUpperCase() as ExecutionStatus;
    if (currentStatus === targetStatus) return;

    const prevExecution = tc.latestExecution;

    // Initialize server/OS from latest execution or defaults
    setDropServer(prevExecution?.server || defaultServer);
    setDropOs(prevExecution?.os || defaultOs);

    // Tải danh sách người xử lý hợp lệ cho bước tiếp theo (được gán xử lý targetStatus)
    setDropLoadingHandlers(true);
    statusHandlerApi
      .getHandlers(targetStatus)
      .then((res) => setDropEligibleHandlers(res.data.users || []))
      .catch(() => setDropEligibleHandlers([]))
      .finally(() => setDropLoadingHandlers(false));
    // Mặc định người thực thi bước tiếp theo: người thực thi trước đây (before_executed_id)
    // hoặc người tạo thực thi (created_by_id), nếu không có thì là người đang kéo thả.
    const defaultHandlerId =
      prevExecution?.beforeExecutedBy?.id || prevExecution?.createdBy?.id || user?.id || '';
    setDropHandlerId(defaultHandlerId);

    // Open confirmation popup
    setDropConfirm({ testCase: tc, targetStatus, fromStatus: currentStatus });
  };

  // Confirm the drop: submit actual result and change status
  const handleConfirmDrop = async (values: {
    actualResult: string;
    handlerId: string;
    server: string;
    os: string;
    viewerIds: string[];
  }) => {
    if (!dropConfirm) return;

    const { testCase: tc, targetStatus } = dropConfirm;
    const prevExecution = tc.latestExecution;
    const serverToUse = values.server || prevExecution?.server || defaultServer;
    const osToUse = values.os || prevExecution?.os || defaultOs;

    setDropSubmitting(true);

    // 1. Optimistic Update locally
    const optimisticExecution: TestExecution = {
      id: prevExecution?.id || `temp-${Date.now()}`,
      testCaseId: tc.id,
      executedAt: prevExecution?.executedAt || new Date().toISOString(),
      executedById: values.handlerId || user?.id || null,
      executedBy: user ? { fullName: user.fullName, email: user.email } : null,
      server: serverToUse,
      os: osToUse,
      status: targetStatus,
      actualResult: values.actualResult || prevExecution?.actualResult || null,
      evaluation: prevExecution?.evaluation || null,
      notes: prevExecution?.notes || undefined,
    };

    onSaveExecution({
      ...tc,
      latestExecution: optimisticExecution,
    });

    // 2. Call backend API
    try {
      const res = await executionApi.executeTestCase(tc.id, {
        status: targetStatus,
        server: serverToUse,
        os: osToUse,
        actualResult: values.actualResult || prevExecution?.actualResult || undefined,
        notes: prevExecution?.notes || undefined,
        executedById: values.handlerId || undefined,
        viewerIds: values.viewerIds,
      });

      onSaveExecution({
        ...tc,
        latestExecution: res.data.execution,
      });
    } catch (err: any) {
      console.error('Error updating execution status via Kanban drop:', err);
      // Rollback
      onSaveExecution({
        ...tc,
        latestExecution: prevExecution || null,
      });
      alert(`Lỗi khi chuyển trạng thái Test Case: ${err.response?.data?.message || err.message}`);
    } finally {
      setDropSubmitting(false);
      setDropConfirm(null);
      setDropServer(defaultServer);
      setDropOs(defaultOs);
      setDropHandlerId('');
      setDropEligibleHandlers([]);
    }
  };

  const handleCancelDrop = () => {
    setDropConfirm(null);
    setDropServer(defaultServer);
    setDropOs(defaultOs);
    setDropHandlerId('');
    setDropEligibleHandlers([]);
  };

  return (
    <div className="w-full">
      {/* Bộ lọc cột Chưa test */}
      <div className="flex items-center justify-end mb-3">
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllUntested}
            onChange={(e) => setShowAllUntested(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          Hiện cả test case chưa test của người khác
        </label>
      </div>

      {/* 5 Kanban Columns with responsive horizontal scrolling */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columnsConfig.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            icon={col.icon}
            theme={col.theme}
            testCases={groupedCases[col.status] || []}
            canExecuteTestCase={canExecuteTestCase}
            canUpdateTestCase={canUpdateTestCase}
            canDeleteTestCase={canDeleteTestCase}
            onOpenDrawer={onOpenDrawer}
            onEditTestCase={onEditTestCase}
            onDuplicateTestCase={onDuplicateTestCase}
            onDeleteTestCase={onDeleteTestCase}
            onQuickStatusChange={handleQuickStatusChange}
            onOpenEvidenceModal={onOpenEvidenceModal}
            getEvidenceStats={getEvidenceStats}
            onDropCard={handleDropCard}
          />
        ))}
      </div>

      {/* Drag & Drop Confirmation Modal */}
      {dropConfirm && (
        <DropConfirmModal
          confirm={dropConfirm}
          prevExecution={dropConfirm.testCase.latestExecution}
          eligibleHandlers={dropEligibleHandlers}
          loadingHandlers={dropLoadingHandlers}
          currentUser={user}
          server={dropServer}
          onServerChange={setDropServer}
          os={dropOs}
          onOsChange={setDropOs}
          handlerId={dropHandlerId}
          onHandlerChange={setDropHandlerId}
          availableServers={availableServers}
          availableOsList={availableOsList}
          submitting={dropSubmitting}
          onConfirm={handleConfirmDrop}
          onCancel={handleCancelDrop}
        />
      )}
    </div>
  );
};
