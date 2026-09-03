import React, { useState } from 'react';
import type { Task, Process, ProcessStep } from '../../types/workflow';
import { WorkflowKanbanColumn } from './WorkflowKanbanColumn';
import { WorkflowStepTransitionModal } from './WorkflowStepTransitionModal';
import { Layers } from 'lucide-react';

interface WorkflowKanbanBoardProps {
  activeProcess: Process | null;
  tasks: Task[];
  onRefresh: () => void;
}

export const WorkflowKanbanBoard: React.FC<WorkflowKanbanBoardProps> = ({
  activeProcess,
  tasks,
  onRefresh,
}) => {
  const [transitionModalState, setTransitionModalState] = useState<{
    isOpen: boolean;
    task: Task | null;
    targetStep: ProcessStep | null;
  }>({
    isOpen: false,
    task: null,
    targetStep: null,
  });

  const steps = (activeProcess?.steps || []).slice().sort((a, b) => a.order - b.order);

  const handleDropTaskToStep = (taskId: string, targetStep: ProcessStep) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Mở popup xác nhận chuyển bước theo đúng yêu cầu
    setTransitionModalState({
      isOpen: true,
      task,
      targetStep,
    });
  };

  const handleOpenTransitionModal = (task: Task, targetStep?: ProcessStep) => {
    setTransitionModalState({
      isOpen: true,
      task,
      targetStep: targetStep || null,
    });
  };

  if (!activeProcess || steps.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Chưa chọn quy trình hoặc quy trình chưa có bước thực thi
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Vui lòng chọn một quy trình cụ thể từ menu bên trái để hiển thị bảng Kanban theo các bước tuần tự.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Horizontal Scrollable Kanban Columns Container */}
      <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        <div className="flex items-start gap-4 min-w-max">
          {steps.map((step) => {
            // Lọc các nhiệm vụ đang ở bước này
            const stepTasks = tasks.filter((t) => {
              if (t.currentStepId) {
                return t.currentStepId === step.id;
              }
              // Nếu task chưa có currentStepId thì gán vào bước 1
              return step.order === 1;
            });

            return (
              <WorkflowKanbanColumn
                key={step.id}
                step={step}
                tasks={stepTasks}
                onDropTaskToStep={handleDropTaskToStep}
                onOpenTransitionModal={handleOpenTransitionModal}
              />
            );
          })}
        </div>
      </div>

      {/* Popup Modal xác nhận chuyển bước */}
      <WorkflowStepTransitionModal
        isOpen={transitionModalState.isOpen}
        onClose={() =>
          setTransitionModalState({
            isOpen: false,
            task: null,
            targetStep: null,
          })
        }
        task={transitionModalState.task}
        targetStep={transitionModalState.targetStep}
        allSteps={steps}
        onSuccess={onRefresh}
      />
    </div>
  );
};
