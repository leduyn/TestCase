import React, { useMemo, useState, useEffect } from 'react';
import {
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Server,
  Monitor,
} from 'lucide-react';
import type { TestCase, TestExecution, ExecutionStatus } from '../../types';
import { KanbanColumn } from './KanbanColumn';
import { RichTextEditor } from '../RichTextEditor';
import { executionApi, environmentApi } from '../../services/api';
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
const STATUS_INFO: Record<ExecutionStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  UNTESTED: { label: 'Chưa thực hiện', color: 'text-slate-700 dark:text-slate-200', bgColor: 'bg-slate-100 dark:bg-slate-700', borderColor: 'border-slate-300' },
  FAILED: { label: 'Failed', color: 'text-rose-700 dark:text-rose-300', bgColor: 'bg-rose-50 dark:bg-rose-950/60', borderColor: 'border-rose-300' },
  BLOCKED: { label: 'Blocked', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-950/60', borderColor: 'border-amber-300' },
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
  const [dropActualResult, setDropActualResult] = useState('');
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropServer, setDropServer] = useState(defaultServer);
  const [dropOs, setDropOs] = useState(defaultOs);
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
      title: 'Chưa thực hiện',
      icon: <Clock className="w-4 h-4 text-slate-500" />,
      theme: {
        headerBg: 'bg-slate-50/90 dark:bg-slate-900/80',
        borderTop: 'border-t-slate-400',
        badgeBg: 'bg-slate-100 dark:bg-slate-800',
        badgeText: 'text-slate-600 dark:text-slate-300',
        countBg: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
        highlightBorder: 'ring-slate-400 border-slate-400',
        highlightBg: 'bg-slate-100/60 dark:bg-slate-800/60',
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

  // Group test cases by status
  const groupedCases = useMemo(() => {
    const groups: Record<ExecutionStatus, TestCase[]> = {
      UNTESTED: [],
      FAILED: [],
      BLOCKED: [],
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

    return groups;
  }, [testCases]);

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

    // Open confirmation popup
    setDropConfirm({ testCase: tc, targetStatus, fromStatus: currentStatus });
    setDropActualResult('');
  };

  // Confirm the drop: submit actual result and change status
  const handleConfirmDrop = async () => {
    if (!dropConfirm) return;

    const { testCase: tc, targetStatus } = dropConfirm;
    const prevExecution = tc.latestExecution;
    const serverToUse = dropServer || prevExecution?.server || defaultServer;
    const osToUse = dropOs || prevExecution?.os || defaultOs;

    setDropSubmitting(true);

    // 1. Optimistic Update locally
    const optimisticExecution: TestExecution = {
      id: prevExecution?.id || `temp-${Date.now()}`,
      testCaseId: tc.id,
      executedById: user?.id,
      executedBy: user ? { fullName: user.fullName, email: user.email } : null,
      server: serverToUse,
      os: osToUse,
      status: targetStatus,
      actualResult: dropActualResult || prevExecution?.actualResult || null,
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
        status: targetStatus,
        server: serverToUse,
        os: osToUse,
        actualResult: dropActualResult || prevExecution?.actualResult || undefined,
        notes: prevExecution?.notes || undefined,
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
      setDropActualResult('');
      setDropServer(defaultServer);
      setDropOs(defaultOs);
    }
  };

  const handleCancelDrop = () => {
    setDropConfirm(null);
    setDropActualResult('');
    setDropServer(defaultServer);
    setDropOs(defaultOs);
  };

  return (
    <div className="w-full">
      {/* 4 Kanban Columns with responsive horizontal scrolling */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleCancelDrop}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Xác nhận chuyển trạng thái
              </h3>
              <button
                type="button"
                onClick={handleCancelDrop}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {/* TC info */}
              <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Kịch bản kiểm thử:</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{dropConfirm.testCase.testCaseCode}</span>
                  {dropConfirm.testCase.title}
                </p>
              </div>

              {/* Status transition visualization */}
              <div className="flex items-center justify-center gap-3 py-2">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${STATUS_INFO[dropConfirm.fromStatus].bgColor} ${STATUS_INFO[dropConfirm.fromStatus].color} ${STATUS_INFO[dropConfirm.fromStatus].borderColor}`}>
                  {STATUS_INFO[dropConfirm.fromStatus].label}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ring-2 ring-offset-1 ${STATUS_INFO[dropConfirm.targetStatus].bgColor} ${STATUS_INFO[dropConfirm.targetStatus].color} ${STATUS_INFO[dropConfirm.targetStatus].borderColor}`}>
                  {STATUS_INFO[dropConfirm.targetStatus].label}
                </div>
              </div>

              {/* Server / Environment & OS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Môi trường
                  </label>
                  <select
                    value={dropServer}
                    onChange={(e) => setDropServer(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  >
                    {dropServer && !availableServers.includes(dropServer) && (
                      <option value={dropServer}>{dropServer}</option>
                    )}
                    {availableServers.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Hệ điều hành
                  </label>
                  <select
                    value={dropOs}
                    onChange={(e) => setDropOs(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  >
                    {dropOs && !availableOsList.includes(dropOs) && (
                      <option value={dropOs}>{dropOs}</option>
                    )}
                    {availableOsList.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actual Result - Rich Text Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kết quả thực tế <span className="text-rose-500">*</span>
                </label>
                <RichTextEditor
                  value={dropActualResult}
                  onChange={setDropActualResult}
                  placeholder="Nhập kết quả thực tế khi kiểm thử kịch bản này..."
                  minHeight="140px"
                  isFailed={dropConfirm.targetStatus === 'FAILED'}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={handleCancelDrop}
                disabled={dropSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDrop}
                disabled={dropSubmitting || !dropActualResult.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {dropSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Xác nhận chuyển trạng thái</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
