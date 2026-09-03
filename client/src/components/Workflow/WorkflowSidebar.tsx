import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Process } from '../../types/workflow';
import {
  Search,
  CheckSquare,
  Clock,
  FolderKanban,
  GitPullRequest,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

interface WorkflowSidebarProps {
  processes: Process[];
  selectedProcessId: string;
  onSelectProcess: (processId: string) => void;
  filterType: 'ALL' | 'MY_TASKS' | 'MY_TODOS';
  onSelectFilterType: (filter: 'ALL' | 'MY_TASKS' | 'MY_TODOS') => void;
}

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  processes,
  selectedProcessId,
  onSelectProcess,
  filterType,
  onSelectFilterType,
}) => {
  const [quickSearch, setQuickSearch] = useState('');
  const [isProcessListOpen, setIsProcessListOpen] = useState(true);

  const filteredProcesses = processes.filter((p) =>
    p.name.toLowerCase().includes(quickSearch.toLowerCase())
  );

  return (
    <aside className="w-64 lg:w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-[calc(100vh-64px)]">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
            <GitPullRequest className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
              Base Workflow
            </h2>
            <p className="text-[11px] text-slate-400">Quản lý quy trình & nhiệm vụ</p>
          </div>
        </div>

        {/* Quick Search */}
        <div className="mt-3 relative">
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Tìm nhanh quy trình..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Navigation Links (QUAN TRỌNG) */}
      <div className="p-3 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          QUAN TRỌNG
        </div>

        <button
          onClick={() => {
            onSelectFilterType('MY_TASKS');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            filterType === 'MY_TASKS'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-blue-500" />
          <span className="flex-1 text-left">Nhiệm vụ của tôi</span>
        </button>

        <button
          onClick={() => {
            onSelectFilterType('MY_TODOS');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            filterType === 'MY_TODOS'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="flex-1 text-left">Công việc của tôi</span>
        </button>

        <Link
          to="/workflow/processes"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60 transition-colors"
        >
          <FolderKanban className="w-4 h-4 text-indigo-500" />
          <span className="flex-1 text-left">Quản lý quy trình</span>
        </Link>

        <button
          onClick={() => {
            onSelectFilterType('ALL');
            onSelectProcess('');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            filterType === 'ALL' && !selectedProcessId
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="flex-1 text-left">Tất cả nhiệm vụ</span>
        </button>
      </div>

      {/* Process List Section (DANH SÁCH QUY TRÌNH) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 border-t border-slate-100 dark:border-slate-800">
        <div
          onClick={() => setIsProcessListOpen(!isProcessListOpen)}
          className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
        >
          <span>QUY TRÌNH HOẠT ĐỘNG ({filteredProcesses.length})</span>
          {isProcessListOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>

        {isProcessListOpen && (
          <div className="space-y-0.5 pt-1">
            {filteredProcesses.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">
                Không tìm thấy quy trình nào
              </p>
            ) : (
              filteredProcesses.map((proc) => {
                const isSelected = selectedProcessId === proc.id;
                return (
                  <button
                    key={proc.id}
                    onClick={() => {
                      onSelectProcess(proc.id);
                      onSelectFilterType('ALL');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-white' : 'text-blue-500'
                      }`}
                    />
                    <span className="truncate flex-1" title={proc.name}>
                      {proc.name}
                    </span>
                    {proc.steps && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {proc.steps.length}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
