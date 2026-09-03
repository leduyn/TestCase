import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  workflowReportApi,
} from '../../services/workflowApi';
import type {
  TasksByStatusReport,
  TaskByProcessReportItem,
  TaskByExecutorReportItem,
  OverdueTaskReportItem,
} from '../../types/workflow';
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const WorkflowDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [statusReport, setStatusReport] = useState<TasksByStatusReport | null>(null);
  const [processReport, setProcessReport] = useState<TaskByProcessReportItem[]>([]);
  const [executorReport, setExecutorReport] = useState<TaskByExecutorReportItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTaskReportItem[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusRes, processRes, executorRes, overdueRes] = await Promise.all([
        workflowReportApi.getTasksByStatus(),
        workflowReportApi.getTasksByProcess(),
        workflowReportApi.getTasksByExecutor(),
        workflowReportApi.getOverdueTasks(),
      ]);

      setStatusReport(statusRes.data);
      setProcessReport(processRes.data);
      setExecutorReport(executorRes.data);
      setOverdueTasks(overdueRes.data);
    } catch (error) {
      console.error('Error fetching dashboard reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-500">Đang tải dữ liệu tổng quan quy trình...</p>
      </div>
    );
  }

  const byStatus = statusReport?.byStatus || {
    PENDING: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    OVERDUE: 0,
    CANCELLED: 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Quản lý Quy trình & Nhiệm vụ
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi tiến độ quy trình, nhiệm vụ, hạn xử lý và phân công công việc
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/workflow/processes"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm"
          >
            Quy trình
          </Link>
          <Link
            to="/workflow/tasks"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nhiệm vụ
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng nhiệm vụ
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
              {statusReport?.total || 0}
            </p>
            <Link
              to="/workflow/tasks"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              Xem danh sách <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Đang thực hiện
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {byStatus.IN_PROGRESS}
            </p>
            <Link
              to="/workflow/tasks?status=IN_PROGRESS"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              Xem đang xử lý <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-500 dark:text-rose-400">
              Quá hạn chót
            </p>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {byStatus.OVERDUE}
            </p>
            <Link
              to="/workflow/tasks?overdue=true"
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline mt-2"
            >
              Cần xử lý ngay <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Đã hoàn thành
            </p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {byStatus.COMPLETED}
            </p>
            <Link
              to="/workflow/tasks?status=COMPLETED"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
            >
              Xem lưu trữ <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Overdue Tasks Alert & Process Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Overdue Tasks Alert / Active Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue alert panel */}
          {overdueTasks.length > 0 && (
            <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <h3 className="font-semibold text-rose-900 dark:text-rose-200">
                    Cảnh báo nhiệm vụ quá hạn ({overdueTasks.length})
                  </h3>
                </div>
                <Link
                  to="/workflow/tasks?overdue=true"
                  className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline"
                >
                  Xem tất cả
                </Link>
              </div>

              <div className="space-y-2.5">
                {overdueTasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    to={`/workflow/tasks/${task.id}`}
                    className="block bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {task.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Quy trình: <span className="font-medium">{task.process?.name}</span> • Bước:{' '}
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {task.currentStep?.name}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded">
                          Quá hạn {task.overdueHours} giờ
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Hạn: {new Date(task.deadline).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Processes Completion Progress Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Tiến độ theo Quy trình
                </h3>
              </div>
              <Link
                to="/workflow/processes"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Quản lý quy trình
              </Link>
            </div>

            {processReport.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                Chưa có quy trình nào được tạo.
              </div>
            ) : (
              <div className="space-y-4">
                {processReport.map((proc) => (
                  <div
                    key={proc.processId}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Link
                          to={`/workflow/tasks?processId=${proc.processId}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {proc.processName}
                        </Link>
                        <p className="text-xs text-slate-400">
                          Quản lý: {proc.manager?.fullName || 'Chưa gán'} • Tổng: {proc.totalTasks} nhiệm vụ
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {proc.completionRate}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{
                          width: `${proc.totalTasks > 0 ? (proc.completed / proc.totalTasks) * 100 : 0}%`,
                        }}
                        title={`Hoàn thành: ${proc.completed}`}
                      />
                      <div
                        className="bg-blue-500 h-full transition-all duration-500"
                        style={{
                          width: `${proc.totalTasks > 0 ? (proc.inProgress / proc.totalTasks) * 100 : 0}%`,
                        }}
                        title={`Đang thực hiện: ${proc.inProgress}`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-500"
                        style={{
                          width: `${proc.totalTasks > 0 ? (proc.overdue / proc.totalTasks) * 100 : 0}%`,
                        }}
                        title={`Quá hạn: ${proc.overdue}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Xong: {proc.completed}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Đang làm: {proc.inProgress}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Quá hạn: {proc.overdue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Team workload & Quick Actions */}
        <div className="space-y-6">
          {/* Workload by executor */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-slate-900 dark:text-white">
                Khối lượng công việc theo Nhân sự
              </h3>
            </div>

            {executorReport.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Chưa có dữ liệu phân công công việc.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {executorReport.map((item) => (
                  <div key={item.user.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.user.fullName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{item.user.email}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.totalAssigned} việc
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                      <span>Hoàn thành: {item.completed}</span>
                      <span className="text-rose-600 dark:text-rose-400">Quá hạn: {item.overdue}</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {item.completionRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Info Box */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 shadow-lg shadow-indigo-500/20">
            <h4 className="font-bold text-base mb-2">Hệ thống Workflow Tự động</h4>
            <p className="text-xs text-indigo-100 leading-relaxed mb-4">
              Mỗi khi chuyển bước, hệ thống sẽ tự động tính toán hạn chót mới theo thời gian của từng bước và ghi lại snapshot lịch sử toàn diện.
            </p>
            <Link
              to="/workflow/tasks"
              className="inline-block w-full text-center py-2 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-colors"
            >
              Xem danh sách nhiệm vụ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
