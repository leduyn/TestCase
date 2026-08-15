import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Smartphone, Monitor, Globe } from 'lucide-react';
import type { ExecutionStatus } from '../types';

export const StatusBadge: React.FC<{ status?: ExecutionStatus | string | null; size?: 'sm' | 'md' }> = ({
  status = 'UNTESTED',
  size = 'sm',
}) => {
  const normalized = (status || 'UNTESTED').toUpperCase();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-3 py-1 text-sm font-semibold';

  if (normalized === 'PASSED') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        PASSED
      </span>
    );
  }

  if (normalized === 'FAILED') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-sm animate-pulse ${sizeClasses}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        FAILED
      </span>
    );
  }

  if (normalized === 'BLOCKED') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${sizeClasses}`}>
        <AlertCircle className="w-3.5 h-3.5" />
        BLOCKED
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 ${sizeClasses}`}>
      <Clock className="w-3.5 h-3.5" />
      CHƯA TEST
    </span>
  );
};

export const PlatformBadge: React.FC<{ platform?: string }> = ({ platform = 'App' }) => {
  const p = (platform || 'App').toUpperCase();

  if (p.includes('APP')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-medium">
        <Smartphone className="w-3 h-3" />
        App
      </span>
    );
  }

  if (p.includes('CMS')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-medium">
        <Monitor className="w-3 h-3" />
        CMS
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-medium">
      <Globe className="w-3 h-3" />
      {platform}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority?: string }> = ({ priority = 'Cao' }) => {
  const p = (priority || '').toLowerCase();

  if (p === 'cao' || p === 'high') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
        Cao
      </span>
    );
  }

  if (p === 'trung bình' || p === 'medium') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        Trung bình
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      Thấp
    </span>
  );
};

export const TestTypeBadge: React.FC<{ type?: string }> = ({ type = 'Luồng chuẩn' }) => {
  const t = (type || '').toLowerCase();

  if (t.includes('ngoại lệ') || t.includes('negative')) {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
        Ngoại lệ
      </span>
    );
  }

  if (t.includes('biên') || t.includes('boundary')) {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
        Giá trị biên
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      Luồng chuẩn
    </span>
  );
};
