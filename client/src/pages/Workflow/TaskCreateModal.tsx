import React, { useState, useEffect } from 'react';
import { taskApi, processApi } from '../../services/workflowApi';
import { userApi } from '../../services/api';
import type { Process } from '../../types/workflow';
import type { User } from '../../types';
import { X, Loader2, Calendar, Users, FileText, Clock } from 'lucide-react';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskId?: string) => void;
  defaultProcessId?: string;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultProcessId,
}) => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState(defaultProcessId || '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');
  const [selectedExecutors, setSelectedExecutors] = useState<string[]>([]);
  const [selectedWatchers, setSelectedWatchers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [procRes, userRes] = await Promise.all([
          processApi.getProcesses({ limit: 100 }),
          userApi.getUsers(),
        ]);
        setProcesses(procRes.data.items || []);
        setUsers(Array.isArray(userRes.data) ? userRes.data : []);

        if (defaultProcessId) {
          setSelectedProcessId(defaultProcessId);
        } else if (procRes.data.items?.length > 0) {
          setSelectedProcessId(procRes.data.items[0].id);
        }
      } catch (err) {
        console.error('Error loading modal data:', err);
      }
    };

    if (isOpen) {
      loadInitial();
      setName('');
      setContent('');
      setCustomDeadline('');
      setSelectedExecutors([]);
      setSelectedWatchers([]);
      setError(null);
    }
  }, [isOpen, defaultProcessId]);

  // When process changes, load its first step's default executors
  useEffect(() => {
    if (selectedProcessId) {
      const selected = processes.find((p) => p.id === selectedProcessId);
      if (selected && selected.steps && selected.steps.length > 0) {
        const firstStep = selected.steps[0];
        setSelectedExecutors(firstStep.executorIds || []);
      }
    }
  }, [selectedProcessId, processes]);

  if (!isOpen) return null;

  const currentProcess = processes.find((p) => p.id === selectedProcessId);
  const firstStep = currentProcess?.steps?.[0];

  const handleToggleExecutor = (userId: string) => {
    setSelectedExecutors((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcessId) {
      setError('Vui lòng chọn quy trình');
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng nhập tên nhiệm vụ');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await taskApi.createTask({
        processId: selectedProcessId,
        name,
        content,
        executorIds: selectedExecutors,
        watcherIds: selectedWatchers,
        deadline: customDeadline ? new Date(customDeadline).toISOString() : undefined,
      });

      onSuccess(res.data.task.id);
      onClose();
    } catch (err: any) {
      console.error('Error creating task:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi khởi tạo nhiệm vụ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Khởi tạo Nhiệm vụ mới
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Process Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Chọn Quy trình áp dụng <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedProcessId}
              onChange={(e) => setSelectedProcessId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm font-medium"
              required
            >
              <option value="">-- Chọn quy trình --</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.steps?.length || 0} bước)
                </option>
              ))}
            </select>
            {firstStep && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Bước khởi đầu: "{firstStep.name}" (Hạn mặc định: {firstStep.timeLimitHours}h)
              </p>
            )}
          </div>

          {/* Task Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Tên nhiệm vụ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Xử lý hợp đồng công ty ABC, Sửa lỗi thanh toán..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              required
            />
          </div>

          {/* Task Content / Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Nội dung & Yêu cầu chi tiết
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Mô tả cụ thể mục tiêu, tài liệu tham khảo và lưu ý khi thực hiện..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm resize-none"
            />
          </div>

          {/* Custom Deadline Override */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Hạn chót tùy chỉnh (Để trống sẽ tự tính theo giờ của bước đầu)
            </label>
            <input
              type="datetime-local"
              value={customDeadline}
              onChange={(e) => setCustomDeadline(e.target.value)}
              className="w-full sm:w-72 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Assigned Executors for first step */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Người thực thi bước 1:
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              {users.map((u) => {
                const isSelected = selectedExecutors.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggleExecutor(u.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {u.fullName} ({u.role})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || !selectedProcessId}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Khởi tạo nhiệm vụ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
