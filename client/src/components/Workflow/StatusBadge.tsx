import React from 'react';
import type { TaskStatus } from '../../types/workflow';
import { Clock, CheckCircle2, AlertTriangle, XCircle, PlayCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
}) => {
  switch (status) {
    case 'IN_PROGRESS':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${className}`}
        >
          {showIcon && <PlayCircle className="w-3.5 h-3.5 text-blue-500 animate-pulse" />}
          Đang thực hiện
        </span>
      );
    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          Hoàn thành
        </span>
      );
    case 'OVERDUE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse ${className}`}
        >
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
          Quá hạn
        </span>
      );
    case 'CANCELLED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 ${className}`}
        >
          {showIcon && <XCircle className="w-3.5 h-3.5 text-slate-500" />}
          Đã hủy
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ${className}`}
        >
          {showIcon && <Clock className="w-3.5 h-3.5 text-amber-500" />}
          Chờ xử lý
        </span>
      );
  }
};
