import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { taskApi, processApi } from '../../services/workflowApi';
import type { Task, Process } from '../../types/workflow';
import { StatusBadge } from '../../components/Workflow/StatusBadge';
import { WorkflowSidebar } from '../../components/Workflow/WorkflowSidebar';
import { WorkflowKanbanBoard } from '../../components/Workflow/WorkflowKanbanBoard';
import { TaskCreateModal } from './TaskCreateModal';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  ArrowRight,
  Loader2,
  Calendar,
  CheckSquare,
  MessageSquare,
  FileText,
  Kanban,
  List,
  BarChart3,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';

export const TaskList: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [processFilter, setProcessFilter] = useState(searchParams.get('processId') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');
  const [sidebarFilterType, setSidebarFilterType] = useState<'ALL' | 'MY_TASKS' | 'MY_TODOS'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // View Mode: 'kanban' | 'list'
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    return (localStorage.getItem('workflow_task_view') as 'kanban' | 'list') || 'kanban';
  });

  const handleSetViewMode = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('workflow_task_view', mode);
  };

  const fetchProcesses = async () => {
    try {
      const res = await processApi.getProcesses({ limit: 100 });
      const items = res.data.items || [];
      setProcesses(items);

      // Nếu chưa có processFilter và có quy trình, mặc định chọn quy trình đầu tiên cho Kanban
      if (!processFilter && items.length > 0 && viewMode === 'kanban') {
        setProcessFilter(items[0].id);
      }
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  const fetchTasks = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const res = await taskApi.getTasks({
        search: search || undefined,
        processId: processFilter || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        executorId: sidebarFilterType === 'MY_TASKS' && user ? user.id : undefined,
        overdue: overdueOnly ? true : undefined,
        page: viewMode === 'list' ? page : 1,
        limit: viewMode === 'list' ? 15 : 100, // Kanban tải nhiều card hơn để hiển thị đầy đủ các cột
      });

      setTasks(res.data.items || []);
      setTotalPages(res.data.pagination.totalPages || 1);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  useEffect(() => {
    const qStatus = searchParams.get('status');
    const qProc = searchParams.get('processId');
    const qOverdue = searchParams.get('overdue') === 'true';

    if (qStatus) setStatusFilter(qStatus);
    if (qProc) setProcessFilter(qProc);
    if (qOverdue) setOverdueOnly(true);
  }, [searchParams]);

  useEffect(() => {
    fetchTasks();
  }, [page, statusFilter, processFilter, overdueOnly, sidebarFilterType, viewMode]);

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

  const handleSelectProcess = (procId: string) => {
    setProcessFilter(procId);
    setPage(1);

    const newParams: Record<string, string> = {};
    if (procId) newParams.processId = procId;
    if (statusFilter !== 'ALL') newParams.status = statusFilter;
    if (overdueOnly) newParams.overdue = 'true';
    setSearchParams(newParams);
  };

  const activeProcess = processes.find((p) => p.id === processFilter) || null;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-slate-50/50 dark:bg-slate-950">
      {/* Left Sidebar */}
      <WorkflowSidebar
        processes={processes}
        selectedProcessId={processFilter}
        onSelectProcess={handleSelectProcess}
        filterType={sidebarFilterType}
        onSelectFilterType={(type) => {
          setSidebarFilterType(type);
          setPage(1);
        }}
      />

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-5 overflow-x-hidden">
        {/* Top Header & View Switcher Toolbar (Style chuẩn Base Workflow) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Process Title & Badge */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                    {activeProcess ? activeProcess.name : 'Tất cả nhiệm vụ quy trình'}
                  </h1>
                  {activeProcess?.description && (
                    <span title={activeProcess.description} className="text-slate-400 hover:text-slate-600 cursor-help">
                      <Info className="w-4 h-4" />
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                    {tasks.length} nhiệm vụ
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {activeProcess?.description || 'Quản lý, điều phối và theo dõi tiến độ các nhiệm vụ theo quy trình'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => fetchTasks()}
                title="Làm mới dữ liệu"
                className="p-2 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo nhiệm vụ</span>
              </button>
            </div>
          </div>

          {/* View Switcher & Search & Filter Tabs */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* View Mode Tabs (Dạng bảng - Danh sách - Báo cáo) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
              <button
                onClick={() => handleSetViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Dạng bảng (Kanban)</span>
              </button>

              <button
                onClick={() => handleSetViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Danh sách</span>
              </button>

              <Link
                to="/workflow"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Báo cáo</span>
              </Link>
            </div>

            {/* Search & Quick Status Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <form onSubmit={handleSearchSubmit} className="w-full sm:w-64 relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm nhiệm vụ..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </form>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => handleTabChange('ALL', false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === 'ALL' && !overdueOnly
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => handleTabChange('IN_PROGRESS', false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === 'IN_PROGRESS' && !overdueOnly
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Đang làm
                </button>
                <button
                  onClick={() => handleTabChange('IN_PROGRESS', true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    overdueOnly
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                >
                  Quá hạn
                </button>
                <button
                  onClick={() => handleTabChange('COMPLETED', false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === 'COMPLETED'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Content */}
        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-500">Đang tải dữ liệu nhiệm vụ...</p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board View */
          <WorkflowKanbanBoard
            activeProcess={activeProcess}
            tasks={tasks}
            onRefresh={() => fetchTasks(true)}
          />
        ) : (
          /* Data Table List View */
          tasks.length === 0 ? (
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
                        task.status === 'IN_PROGRESS' && new Date(task.deadline).getTime() < Date.now();
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
          )
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
    </div>
  );
};
