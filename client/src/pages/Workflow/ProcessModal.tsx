import React, { useState, useEffect } from 'react';
import { processApi, customFieldApi } from '../../services/workflowApi';
import { userApi } from '../../services/api';
import type { Process } from '../../types/workflow';
import type { User } from '../../types';
import { CustomFieldList } from '../../components/Workflow/CustomFieldList';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Users,
  Loader2,
  Layers,
  Zap,
  Sparkles,
} from 'lucide-react';

interface ProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  process?: Process | null;
  initialTab?: 'info' | 'custom_fields';
}

interface StepFormItem {
  id?: string;
  name: string;
  executorIds: string[];
  timeLimitHours: number;
  instructions: string;
}

export const ProcessModal: React.FC<ProcessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  process,
  initialTab = 'info',
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'custom_fields'>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [steps, setSteps] = useState<StepFormItem[]>([
    { name: '', executorIds: [], timeLimitHours: 24, instructions: '' },
  ]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFieldsCount, setCustomFieldsCount] = useState<number>(0);

  const fetchFieldCount = async (procId: string) => {
    try {
      const res = await customFieldApi.getCustomFieldsByProcess(procId);
      if (Array.isArray(res.data)) {
        setCustomFieldsCount(res.data.length);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await userApi.getUsers();
        setUsers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };

    if (isOpen) {
      loadUsers();
      setActiveTab(initialTab);
      if (process) {
        setName(process.name);
        setDescription(process.description || '');
        setManagerId(process.managerId);
        if (process.steps && process.steps.length > 0) {
          setSteps(
            process.steps.map((s) => ({
              id: s.id,
              name: s.name,
              executorIds: s.executorIds || [],
              timeLimitHours: s.timeLimitHours || 24,
              instructions: s.instructions || '',
            }))
          );
        } else {
          setSteps([{ name: '', executorIds: [], timeLimitHours: 24, instructions: '' }]);
        }
        fetchFieldCount(process.id);
      } else {
        setName('');
        setDescription('');
        setManagerId('');
        setSteps([
          { name: 'Bước 1: Tiếp nhận & Phân tích', executorIds: [], timeLimitHours: 24, instructions: '' },
          { name: 'Bước 2: Xử lý & Thực thi', executorIds: [], timeLimitHours: 48, instructions: '' },
          { name: 'Bước 3: Phê duyệt & Nghiệm thu', executorIds: [], timeLimitHours: 24, instructions: '' },
        ]);
        setCustomFieldsCount(0);
      }
      setError(null);
    }
  }, [isOpen, process, initialTab]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        name: `Bước ${steps.length + 1}`,
        executorIds: [],
        timeLimitHours: 24,
        instructions: '',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      setError('Quy trình phải có ít nhất 1 bước thực thi');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    setSteps(newSteps);
  };

  const handleStepChange = (index: number, field: keyof StepFormItem, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleToggleExecutor = (stepIndex: number, userId: string) => {
    const step = steps[stepIndex];
    const exists = step.executorIds.includes(userId);
    const updated = exists
      ? step.executorIds.filter((id) => id !== userId)
      : [...step.executorIds, userId];
    handleStepChange(stepIndex, 'executorIds', updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên quy trình');
      return;
    }

    if (steps.some((s) => !s.name.trim())) {
      setError('Tất cả các bước phải có tên');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (process) {
        // Update process
        await processApi.updateProcess(process.id, {
          name,
          description,
          managerId: managerId || undefined,
        });

        // Update / create steps
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          if (step.id) {
            await processApi.updateStep(step.id, {
              name: step.name,
              executorIds: step.executorIds,
              timeLimitHours: Number(step.timeLimitHours) || 24,
              order: i + 1,
              instructions: step.instructions,
            });
          } else {
            await processApi.addStep(process.id, {
              name: step.name,
              executorIds: step.executorIds,
              timeLimitHours: Number(step.timeLimitHours) || 24,
              order: i + 1,
              instructions: step.instructions,
            });
          }
        }
      } else {
        // Create new process
        await processApi.createProcess({
          name,
          description,
          managerId: managerId || undefined,
          steps: steps.map((s, idx) => ({
            name: s.name,
            executorIds: s.executorIds,
            timeLimitHours: Number(s.timeLimitHours) || 24,
            order: idx + 1,
            instructions: s.instructions,
          })),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving process:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu quy trình');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {process ? `Chỉnh sửa Quy trình: ${process.name}` : 'Tạo Quy trình Mới'}
              </h2>
              <p className="text-xs text-slate-500">
                Cấu hình thông tin cơ bản, các bước thực thi tuần tự và các trường dữ liệu tùy chỉnh
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Thông tin & Các bước ({steps.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom_fields')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'custom_fields'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>2. Trường dữ liệu tùy chỉnh (Custom Fields)</span>
            {process && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px]">
                {customFieldsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Info & Steps */}
        {activeTab === 'info' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Tên quy trình <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Quy trình phê duyệt hợp đồng, Xử lý lỗi..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Người quản lý quy trình
                  </label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                  >
                    <option value="">-- Mặc định (Người tạo) --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Mô tả ngắn
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả mục đích và phạm vi quy trình"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Steps Builder */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Thiết lập các bước tuần tự (Steps)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nhiệm vụ sẽ lần lượt đi qua các bước từ trên xuống dưới
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm bước
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => handleStepChange(idx, 'name', e.target.value)}
                          placeholder={`Tên bước ${idx + 1}`}
                          className="font-medium text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, 'down')}
                          disabled={idx === steps.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          title="Xóa bước này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {/* Time limit */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Thời hạn bước (Số giờ)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={step.timeLimitHours}
                          onChange={(e) =>
                            handleStepChange(idx, 'timeLimitHours', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        />
                      </div>

                      {/* Instructions */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Hướng dẫn thực hiện
                        </label>
                        <input
                          type="text"
                          value={step.instructions}
                          onChange={(e) => handleStepChange(idx, 'instructions', e.target.value)}
                          placeholder="Ví dụ: Kiểm tra hợp đồng theo checklist..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        />
                      </div>
                    </div>

                    {/* Assigned default executors */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Người thực thi mặc định cho bước này:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {users.map((u) => {
                          const isSelected = step.executorIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleToggleExecutor(idx, u.id)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              {u.fullName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
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
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {process ? 'Lưu thay đổi' : 'Tạo quy trình'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Custom Fields Builder */}
        {activeTab === 'custom_fields' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {process ? (
              <CustomFieldList
                processId={process.id}
                steps={(process.steps as any) || []}
                onFieldsUpdated={() => fetchFieldCount(process.id)}
              />
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Tạo quy trình trước khi thêm các trường tùy chỉnh
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Để gán các trường dữ liệu tùy chỉnh vào quy trình hoặc từng bước cụ thể, vui lòng bấm nút "Tạo quy trình" bên dưới. Sau đó bạn có thể tự do thêm và quản lý 22 loại trường dữ liệu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tạo quy trình ngay
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
