import React, { useState } from 'react';
import type { TestCase, TestExecution, ExecutionStatus } from '../../types';
import { TestCaseKanbanCard } from './TestCaseKanbanCard';

interface KanbanColumnProps {
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
  onQuickStatusChange: (tc: TestCase, newStatus: ExecutionStatus) => void;
  onOpenEvidenceModal?: (tc: TestCase) => void;
  getEvidenceStats?: (tc: TestCase) => { totalImages: number; totalMilestones: number; testers: string[] };
  onDropCard: (testCaseId: string, targetStatus: ExecutionStatus) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  title,
  icon,
  theme,
  testCases,
  canExecuteTestCase,
  canUpdateTestCase,
  canDeleteTestCase,
  onOpenDrawer,
  onEditTestCase,
  onDuplicateTestCase,
  onDeleteTestCase,
  onQuickStatusChange,
  onOpenEvidenceModal,
  getEvidenceStats,
  onDropCard,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only deactivate dragOver if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const testCaseId = e.dataTransfer.getData('text/plain');
    if (testCaseId) {
      onDropCard(testCaseId, status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-2xl border transition-all duration-200 min-w-[280px] sm:min-w-[300px] flex-1 max-w-full ${
        isDragOver
          ? `ring-2 ${theme.highlightBorder} ${theme.highlightBg} scale-[1.01]`
          : 'bg-slate-100/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
      }`}
    >
      {/* Column Header (Sticky) */}
      <div className={`p-3.5 rounded-t-2xl border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 border-t-4 ${theme.borderTop} ${theme.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-white/80 dark:bg-slate-800 shadow-xs">
            {icon}
          </span>
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 tracking-wide">
            {title}
          </span>
        </div>
        <span
          className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-full ${theme.countBg}`}
          title={`${testCases.length} Test Case trong cột ${title}`}
        >
          {testCases.length}
        </span>
      </div>

      {/* Cards Scrollable Body */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[450px]">
        {testCases.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs text-slate-400 font-medium">Chưa có Test Case nào</p>
            {canExecuteTestCase && (
              <p className="text-[11px] text-slate-400 mt-1">
                Kéo thả kịch bản vào đây để đổi trạng thái
              </p>
            )}
          </div>
        ) : (
          testCases.map((tc) => (
            <TestCaseKanbanCard
              key={tc.id}
              testCase={tc}
              canExecuteTestCase={canExecuteTestCase}
              canUpdateTestCase={canUpdateTestCase}
              canDeleteTestCase={canDeleteTestCase}
              onOpenDrawer={onOpenDrawer}
              onEditTestCase={onEditTestCase}
              onDuplicateTestCase={onDuplicateTestCase}
              onDeleteTestCase={onDeleteTestCase}
              onQuickStatusChange={onQuickStatusChange}
              onOpenEvidenceModal={onOpenEvidenceModal}
              evidenceStats={getEvidenceStats ? getEvidenceStats(tc) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};
