import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { processApi } from '../../services/workflowApi';
import type { Process } from '../../types/workflow';
import { ProcessModal } from './ProcessModal';
import {
  Layers,
  Plus,
  Search,
  Trash2,
  Edit2,
  Clock,
  ArrowRight,
  Loader2,
  User as UserIcon,
  Zap,
} from 'lucide-react';

export const ProcessList: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'custom_fields'>('info');
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      const res = await processApi.getProcesses({ search, page, limit: 12 });
      setProcesses(res.data.items || []);
    } catch (error) {
      console.error('Error fetching processes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProcesses();
  };

  const handleCreate = () => {
    setSelectedProcess(null);
    setModalTab('info');
    setIsModalOpen(true);
  };

  const handleEdit = (proc: Process, tab: 'info' | 'custom_fields' = 'info') => {
    setSelectedProcess(proc);
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa quy trình "${name}"?`)) return;

    try {
      await processApi.deleteProcess(id);
      fetchProcesses();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi khi xóa quy trình');
    }
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
            <span className="text-slate-800 dark:text-slate-200 font-medium">Quy trình</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Danh sách Quy trình nghiệp vụ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Định nghĩa các mẫu quy trình, các bước tuần tự và các trường dữ liệu tùy chỉnh cho nhiệm vụ
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo quy trình mới
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="w-full sm:w-96 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên quy trình, mô tả..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </form>

        <div className="text-xs text-slate-500">
          Tổng cộng: <span className="font-semibold text-slate-900 dark:text-white">{processes.length}</span> quy trình
        </div>
      </div>

      {/* Process Cards Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500">Đang tải danh sách quy trình...</p>
        </div>
      ) : processes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chưa có quy trình nào</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Tạo quy trình đầu tiên của bạn để chuẩn hóa các bước thực thi công việc và nhiệm vụ.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Tạo quy trình ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processes.map((proc) => (
            <div
              key={proc.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {proc.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(proc, 'custom_fields')}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Quản lý trường tùy chỉnh (Custom Fields)"
                    >
                      <Zap className="w-4 h-4 text-amber-500" />
                    </button>
                    <button
                      onClick={() => handleEdit(proc, 'info')}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Chỉnh sửa quy trình"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(proc.id, proc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Xóa quy trình"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2">
                  {proc.description || 'Chưa có mô tả cho quy trình này.'}
                </p>

                {/* Steps List Preview */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Các bước thực thi ({proc.steps?.length || 0}):
                  </p>
                  <div className="space-y-1">
                    {proc.steps?.slice(0, 3).map((step, idx) => (
                      <div
                        key={step.id}
                        className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300"
                      >
                        <span className="truncate">
                          {idx + 1}. {step.name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 shrink-0 ml-2">
                          <Clock className="w-3 h-3" /> {step.timeLimitHours}h
                        </span>
                      </div>
                    ))}
                    {(proc.steps?.length || 0) > 3 && (
                      <p className="text-[11px] text-slate-400 pl-2">
                        + {(proc.steps?.length || 0) - 3} bước nữa...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5 truncate">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    Quản lý: {proc.manager?.fullName || proc.createdBy?.fullName || 'Hệ thống'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleEdit(proc, 'custom_fields')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Zap className="w-3 h-3 text-amber-500" /> Custom Fields
                  </button>
                  <Link
                    to={`/workflow/tasks?processId=${proc.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                  >
                    Nhiệm vụ ({proc._count?.tasks || 0}) <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <ProcessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProcesses}
        process={selectedProcess}
        initialTab={modalTab}
      />
    </div>
  );
};
