import React, { useState } from 'react';
import type { Task, ProcessStep } from '../../types/workflow';
import { WorkflowKanbanCard } from './WorkflowKanbanCard';
import { Clock, Info, Users, AlertTriangle } from 'lucide-react';

interface WorkflowKanbanColumnProps {
  step: ProcessStep;
  tasks: Task[];
  onDropTaskToStep: (taskId: string, targetStep: ProcessStep) => void;
  onOpenTransitionModal: (task: Task, targetStep?: ProcessStep) => void;
}

export const WorkflowKanbanColumn: React.FC<WorkflowKanbanColumnProps> = ({
  step,
  tasks,
  onDropTaskToStep,
  onOpenTransitionModal,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDropTaskToStep(taskId, step);
    }
  };

  // Tính toán số lượng task và overdue
  const now = Date.now();
  const totalTasks = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.status === 'IN_PROGRESS' && new Date(t.deadline).getTime() < now
  ).length;

  const executorCount = Array.isArray(step.executorIds) ? step.executorIds.length : 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-80 sm:w-84 shrink-0 rounded-2xl border transition-all ${
        isDragOver
          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
          : 'bg-slate-100/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 rounded-t-2xl space-y-2 backdrop-blur-sm">
        {/* Title & Info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {step.order}
            </span>
            <h4
              className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate"
              title={step.name}
            >
              {step.name}
            </h4>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            {step.instructions && (
              <span title={step.instructions} className="cursor-help hover:text-slate-600 dark:hover:text-slate-200">
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
            {executorCount > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-500" title={`${executorCount} người thực thi định mức`}>
                <Users className="w-3 h-3" />
                {executorCount}
              </span>
            )}
          </div>
        </div>

        {/* Sub-stats (Total NV, Quá hạn, SLA hours) */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 font-medium">
            <span>
              {totalTasks} NV
            </span>
            {overdueCount > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} Q.hạn
              </span>
            )}
          </div>

          {step.timeLimitHours && (
            <div className="flex items-center gap-1 text-slate-400" title="Thời gian định mức xử lý">
              <Clock className="w-3 h-3" />
              <span>{step.timeLimitHours}.00h</span>
            </div>
          )}
        </div>
      </div>

      {/* Column Cards Container (Vertical Scrollable) */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
        {tasks.length === 0 ? (
          <div
            className={`h-28 rounded-xl border border-dashed flex flex-col items-center justify-center p-3 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-100/40 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-300 dark:border-slate-800 text-slate-400'
            }`}
          >
            <p className="text-xs">
              {isDragOver ? 'Thả để chuyển vào bước này' : 'Chưa có nhiệm vụ'}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <WorkflowKanbanCard
              key={task.id}
              task={task}
              onOpenTransitionModal={(t) => onOpenTransitionModal(t, step)}
            />
          ))
        )}
      </div>
    </div>
  );
};
