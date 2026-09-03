import React from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types/workflow';
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
  ArrowRight,
  User as UserIcon,
  Zap,
} from 'lucide-react';

interface WorkflowKanbanCardProps {
  task: Task;
  onOpenTransitionModal?: (task: Task) => void;
}

export const WorkflowKanbanCard: React.FC<WorkflowKanbanCardProps> = ({
  task,
  onOpenTransitionModal,
}) => {
  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';
  const isOverdue =
    task.status === 'IN_PROGRESS' && new Date(task.deadline).getTime() < Date.now();

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(task));
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Helper format deadline
  const formatDeadline = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Hôm nay ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  // Lấy tên người thực thi đầu tiên hoặc người tạo
  const executorName =
    task.createdBy?.fullName || 'Chưa gán';
  const initialLetter = executorName.charAt(0).toUpperCase();

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/60 transition-all cursor-grab active:cursor-grabbing relative space-y-2.5"
    >
      {/* Top row: Status/Tags */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        {task.process?.name && (
          <span className="font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
            {task.process.name}
          </span>
        )}
        {isOverdue && (
          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-[10px] shrink-0 border border-rose-200 dark:border-rose-800">
            Quá hạn
          </span>
        )}
        {isCompleted && (
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] shrink-0">
            Đã xong
          </span>
        )}
      </div>

      {/* Title */}
      <Link
        to={`/workflow/tasks/${task.id}`}
        className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-[13px] leading-snug line-clamp-2 block"
      >
        {task.name}
      </Link>

      {/* Description / Custom Fields snippet */}
      {(task.content || task.customFields) && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg">
          {task.content || JSON.stringify(task.customFields)}
        </p>
      )}

      {/* Metadata Counts (Todos, Comments, Files, Custom Fields) */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/70">
        {task.customFields && Object.keys(task.customFields).length > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium" title="Trường dữ liệu tùy chỉnh">
            <Zap className="w-3.5 h-3.5" />
            {Object.keys(task.customFields).length}
          </span>
        )}
        {task._count?.todos !== undefined && task._count.todos > 0 && (
          <span className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200" title="Việc con (Todos)">
            <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
            {task._count.todos}
          </span>
        )}
        {task._count?.comments !== undefined && task._count.comments > 0 && (
          <span className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200" title="Bình luận">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            {task._count.comments}
          </span>
        )}
        {Array.isArray(task.fileUploads) && task.fileUploads.length > 0 && (
          <span className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200" title="File đính kèm">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            {task.fileUploads.length}
          </span>
        )}
      </div>

      {/* Card Footer: User & Deadline & Quick Transition Button */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {/* User Avatar & Name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
            {initialLetter || <UserIcon className="w-3 h-3" />}
          </div>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
            {executorName}
          </span>
        </div>

        {/* Deadline Badge */}
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
              isOverdue
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                : isCompleted
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            title={`Hạn chót: ${new Date(task.deadline).toLocaleString('vi-VN')}`}
          >
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{formatDeadline(task.deadline)}</span>
          </div>

          {/* Quick Transition button */}
          {!isCompleted && !isCancelled && onOpenTransitionModal && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenTransitionModal(task);
              }}
              title="Chuyển bước nhiệm vụ"
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-md transition-all"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
