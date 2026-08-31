import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { taskApi, processApi } from '../../services/workflowApi';
import type { Task, Process } from '../../types/workflow';
import { StatusBadge } from '../../components/Workflow/StatusBadge';
import { TaskCreateModal } from './TaskCreateModal';
import {
  Plus,
  Search,
  ArrowRight,
  Loader2,
  Calendar,
  CheckSquare,
  MessageSquare,
  FileText,
} from 'lucide-react';

export const TaskList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [processFilter, setProcessFilter] = useState(searchParams.get('processId') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchProcesses = async () => {
    try {
      const res = await processApi.getProcesses({ limit: 100 });
      setProcesses(res.data.items || []);
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await taskApi.getTasks({
        search,
        processId: processFilter || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        overdue: overdueOnly ? true : undefined,
        page,
        limit: 15,
      });

      setTasks(res.data.items || []);
      setTotalPages(res.data.pagination.totalPages || 1);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  useEffect(() => {
    // Read from search params
    const qStatus = searchParams.get('status');
    const qProc = searchParams.get('processId');
    const qOverdue = searchParams.get('overdue') === 'true';

    if (qStatus) setStatusFilter(qStatus);
    if (qProc) setProcessFilter(qProc);
    if (qOverdue) setOverdueOnly(true);
  }, [searchParams]);

  useEffect(() => {
    fetchTasks();
  }, [page, statusFilter, processFilter, overdueOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTasks();
  };

  const handleTabChange = (status: string, overdue: boolean = false) => {
    setStatusFilter(status);
    setOverdueOnly(overdue);
    setPage(1);

    const newParams: Record<string, string> = {};
    if (processFilter) newParams.processId = processFilter;
    if (status !== 'ALL') newParams.status = status;
    if (overdue) newParams.overdue = 'true';
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/workflow" className="hover:text-blue-600">
              Tổng quan
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">Nhiệm vụ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Danh sách Nhiệm vụ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý, theo dõi tiến độ và xử lý các nhiệm vụ theo từng bước quy trình
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Khởi tạo nhiệm vụ mới
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            onClick={() => handleTabChange('ALL', false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'ALL' && !overdueOnly
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => handleTabChange('IN_PROGRESS', false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'IN_PROGRESS' && !overdueOnly
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Đang thực hiện
          </button>
          <button
            onClick={() => handleTabChange('IN_PROGRESS', true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              overdueOnly
                ? 'bg-rose-600 text-white'
                : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Quá hạn chót
          </button>
          <button
            onClick={() => handleTabChange('COMPLETED', false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Đã hoàn thành
          </button>
          <button
            onClick={() => handleTabChange('CANCELLED', false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === 'CANCELLED'
                ? 'bg-slate-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Đã hủy
          </button>
        </div>

        {/* Search and Process Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, nội dung nhiệm vụ..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={processFilter}
              onChange={(e) => {
                setProcessFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-60 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">-- Tất cả Quy trình --</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task List Table */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Đang tải danh sách nhiệm vụ...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Không tìm thấy nhiệm vụ nào</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Thử thay đổi bộ lọc hoặc khởi tạo một nhiệm vụ mới để bắt đầu quy trình làm việc.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Khởi tạo nhiệm vụ
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Nhiệm vụ</th>
                  <th className="px-6 py-3.5">Quy trình & Bước hiện tại</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Hạn chót</th>
                  <th className="px-6 py-3.5">Tiến độ con</th>
                  <th className="px-6 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => {
                  const isOverdue =
                    task.status === 'IN_PROGRESS' && new Date(task.deadline) < new Date();
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/workflow/tasks/${task.id}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block max-w-sm truncate"
                        >
                          {task.name}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          Tạo bởi: {task.createdBy?.fullName || 'Hệ thống'} •{' '}
                          {new Date(task.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300 block text-xs">
                          {task.process?.name}
                        </span>
                        {task.currentStep && (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                            Bước {task.currentStep.order}: {task.currentStep.name}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={isOverdue ? 'OVERDUE' : task.status} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                            {new Date(task.deadline).toLocaleString('vi-VN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1" title="Đầu việc con (Todos)">
                            <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                            {task._count?.todos || 0}
                          </span>
                          <span className="flex items-center gap-1" title="Bình luận (Comments)">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            {task._count?.comments || 0}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/workflow/tasks/${task.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                        >
                          Xử lý <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Trang {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Trước
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(taskId) => {
          fetchTasks();
          if (taskId) {
            window.location.href = `/workflow/tasks/${taskId}`;
          }
        }}
      />
    </div>
  );
};
