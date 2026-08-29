import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  ArrowLeft,
  Server,
  Monitor,
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { TestCase, TestExecution, ExecutionStatus } from '../../types';
import { PlatformBadge, PriorityBadge, TestTypeBadge } from '../Badge';

interface TestCaseKanbanCardProps {
  testCase: TestCase;
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
  onQuickStatusChange: (tc: TestCase, newStatus: ExecutionStatus) => void;
  onOpenEvidenceModal?: (tc: TestCase) => void;
  evidenceStats?: { totalImages: number; totalMilestones: number; testers: string[] };
  onDragStart?: (e: React.DragEvent, tc: TestCase) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export const TestCaseKanbanCard: React.FC<TestCaseKanbanCardProps> = ({
  testCase,
  canExecuteTestCase,
  canUpdateTestCase,
  canDeleteTestCase,
  onOpenDrawer,
  onEditTestCase,
  onDuplicateTestCase,
  onDeleteTestCase,
  onQuickStatusChange,
  onOpenEvidenceModal,
  evidenceStats,
  onDragStart,
  onDragEnd,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStatusSubmenuOpen, setIsStatusSubmenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const exec = testCase.latestExecution;
  const currentStatus: ExecutionStatus = (exec?.status || 'UNTESTED').toUpperCase() as ExecutionStatus;
  const isFailed = currentStatus === 'FAILED';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setIsStatusSubmenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', testCase.id);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) {
      onDragStart(e, testCase);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const testerName = exec?.executedBy?.fullName || exec?.executedBy?.email;
  const beforeName = exec?.beforeExecutedBy?.fullName || exec?.beforeExecutedBy?.email;
  const updateTime = exec?.executedAt
    ? new Date(exec.executedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      draggable={canExecuteTestCase}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onOpenDrawer(testCase, false)}
      className={`group relative bg-white dark:bg-slate-800/90 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
        isDragging
          ? 'opacity-40 scale-95 border-dashed border-blue-500'
          : isFailed
          ? 'border-rose-200 dark:border-rose-900/60 hover:border-rose-400 bg-rose-50/30 dark:bg-rose-950/20'
          : 'border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500/80 hover:-translate-y-0.5'
      } ${isMenuOpen ? 'z-[60]' : ''}`}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Header: TC Code, Badges, Quick Action Menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
              {testCase.testCaseCode}
            </span>
            <PlatformBadge platform={testCase.platform} />
            <PriorityBadge priority={testCase.priority} />
            {testCase.testType && <TestTypeBadge type={testCase.testType} />}
          </div>

          {/* Action Menu button */}
          <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Thao tác"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-[9999] text-xs text-slate-700 dark:text-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenDrawer(testCase, true, null, true);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
                >
                  <Play className="w-3.5 h-3.5 text-blue-500" />
                  <span>Xem chi tiết / Chạy</span>
                </button>

                {/* Quick Status Submenu */}
                {canExecuteTestCase && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatusSubmenuOpen((prev) => !prev)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Đổi trạng thái</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>

                    {isStatusSubmenuOpen && (
                      <div className="pl-6 py-1 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-700/60 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onQuickStatusChange(testCase, 'UNTESTED');
                          }}
                          className="w-full px-2 py-1 text-left flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Chưa test</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onQuickStatusChange(testCase, 'RETEST');
                          }}
                          className="w-full px-2 py-1 text-left flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Test lại</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onQuickStatusChange(testCase, 'PASSED');
                          }}
                          className="w-full px-2 py-1 text-left flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Passed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onQuickStatusChange(testCase, 'FAILED');
                          }}
                          className="w-full px-2 py-1 text-left flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onQuickStatusChange(testCase, 'BLOCKED');
                          }}
                          className="w-full px-2 py-1 text-left flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Blocked</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-slate-100 dark:bg-slate-700/60 my-1" />

                {canUpdateTestCase && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onEditTestCase(testCase);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Chỉnh sửa kịch bản</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDuplicateTestCase(testCase);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Nhân bản (Duplicate)</span>
                    </button>
                  </>
                )}

                {canDeleteTestCase && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDeleteTestCase(testCase);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Test Case</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {testCase.title}
        </h4>

        {/* Metadata info */}
        <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">Chức năng:</span>
            <span className="truncate">{testCase.module}</span>
          </div>

          {(exec?.server || exec?.os) && (
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400">
              {exec?.server && (
                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                  <Server className="w-2.5 h-2.5" />
                  <span>{exec.server}</span>
                </span>
              )}
              {exec?.os && (
                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <Monitor className="w-2.5 h-2.5" />
                  <span>{exec.os}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Evidence button if available */}
        {evidenceStats && evidenceStats.totalImages > 0 && (
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onOpenEvidenceModal && onOpenEvidenceModal(testCase)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200/60 dark:border-blue-800/60 transition-colors shadow-sm"
              title={`Tổng ${evidenceStats.totalImages} ảnh từ ${evidenceStats.totalMilestones} mốc kiểm thử`}
            >
              <ImageIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>{evidenceStats.totalImages} file minh chứng</span>
            </button>
          </div>
        )}

        {/* Footer: Tester name, previous handler & Update Time */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 text-[10px] text-slate-400">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 truncate max-w-[150px]" title={testerName || 'Chưa test'}>
              <User className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="truncate">{testerName || 'Chưa test'}</span>
            </div>
            {updateTime && (
              <div className="flex items-center gap-1 shrink-0 font-mono text-slate-400" title={`Cập nhật: ${updateTime}`}>
                <Clock className="w-2.5 h-2.5" />
                <span>{updateTime}</span>
              </div>
            )}
          </div>
          {beforeName && (
            <div className="flex items-center gap-1 truncate max-w-full" title={`Tiếp nhận từ: ${beforeName}`}>
              <ArrowLeft className="w-3 h-3 shrink-0 text-amber-500" />
              <span className="truncate">Tiếp nhận từ: {beforeName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
