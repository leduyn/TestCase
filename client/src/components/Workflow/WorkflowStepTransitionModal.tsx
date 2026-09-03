import React, { useState, useEffect, useMemo } from 'react';
import { taskApi, taskCustomFieldApi } from '../../services/workflowApi';
import { userApi } from '../../services/api';
import type { Task, ProcessStep, CustomFieldDefinition } from '../../types/workflow';
import type { User } from '../../types';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { evaluateVisibilityCondition } from './DynamicFormRenderer';
import {
  X,
  ArrowRight,
  Clock,
  UserCheck,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WorkflowStepTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  targetStep: ProcessStep | null;
  allSteps: ProcessStep[];
  onSuccess: () => void;
  /** Custom field values đang nhập dở trong tab Trường dữ liệu, sẽ được lưu cùng lúc chuyển bước */
  pendingCustomFields?: Record<string, any>;
}

export const WorkflowStepTransitionModal: React.FC<WorkflowStepTransitionModalProps> = ({
  isOpen,
  onClose,
  task,
  targetStep,
  allSteps,
  onSuccess,
  pendingCustomFields,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedExecutorIds, setSelectedExecutorIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string>('');
  const [changeDescription, setChangeDescription] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Fields State for the Current Step
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [loadingFields, setLoadingFields] = useState(false);
  const [isFieldsExpanded, setIsFieldsExpanded] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Tải danh sách user hệ thống
  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      userApi
        .getUsers()
        .then((res) => {
          setUsers(res.data || []);
        })
        .catch((err) => console.error('Lỗi tải danh sách người dùng:', err))
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen]);

  // Tải custom fields của task và kiểm tra các trường bắt buộc của bước hiện tại
  useEffect(() => {
    if (isOpen && task) {
      setLoadingFields(true);
      taskCustomFieldApi
        .getTaskCustomFields(task.id)
        .then((res) => {
          if (res.data && res.data.fields) {
            const defs = res.data.fields.map((f: any) => f.definition);
            setCustomFields(defs);

            const initialValues: Record<string, any> = {
              ...(res.data.valuesByKey || {}),
              ...(pendingCustomFields || {}),
            };
            setCustomFieldValues(initialValues);
          }
        })
        .catch((err) => {
          console.error('Lỗi tải custom fields cho modal chuyển bước:', err);
        })
        .finally(() => {
          setLoadingFields(false);
        });
    } else {
      setCustomFields([]);
      setCustomFieldValues({});
      setFieldErrors({});
    }
  }, [isOpen, task, pendingCustomFields]);

  // Cập nhật giá trị mặc định khi mở modal
  useEffect(() => {
    if (isOpen && task) {
      const activeTarget = targetStep || allSteps.find((s) => s.id !== task.currentStepId) || allSteps[0];
      const initialStepId = activeTarget ? activeTarget.id : '';
      setSelectedStepId(initialStepId);

      const stepObj = allSteps.find((s) => s.id === initialStepId);
      const defaultExecutors = (stepObj?.executorIds as string[]) || (task.executorIds as string[]) || [];
      setSelectedExecutorIds(defaultExecutors);

      // Tính deadline mặc định dựa vào timeLimitHours của bước đích
      const hours = stepObj?.timeLimitHours || 24;
      const defaultDate = new Date(Date.now() + hours * 3600 * 1000);
      setDeadline(defaultDate.toISOString().slice(0, 16));

      setChangeDescription('');
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, task, targetStep, allSteps]);

  // Khi người dùng đổi bước đích trong dropdown
  const handleStepChange = (newStepId: string) => {
    setSelectedStepId(newStepId);
    const stepObj = allSteps.find((s) => s.id === newStepId);
    if (stepObj) {
      if (stepObj.executorIds && (stepObj.executorIds as string[]).length > 0) {
        setSelectedExecutorIds(stepObj.executorIds as string[]);
      }
      const hours = stepObj.timeLimitHours || 24;
      const defaultDate = new Date(Date.now() + hours * 3600 * 1000);
      setDeadline(defaultDate.toISOString().slice(0, 16));
    }
  };

  const toggleExecutor = (userId: string) => {
    setSelectedExecutorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCustomFieldValueChange = (fieldKey: string, val: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldKey]: val,
    }));
    // Clear error for this field if filled
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
    setError(null);
  };

  // Lọc các fields áp dụng cho bước hiện tại (hoặc toàn bộ quy trình)
  const currentStepFields = useMemo(() => {
    if (!task) return [];
    return customFields.filter(
      (f) => f.stepId === null || f.stepId === undefined || f.stepId === task.currentStepId
    );
  }, [customFields, task]);

  // Kiểm tra danh sách các trường bắt buộc của bước hiện tại còn thiếu giá trị
  const missingRequiredFields = useMemo(() => {
    const missing: CustomFieldDefinition[] = [];
    currentStepFields.forEach((f) => {
      const isVisible = evaluateVisibilityCondition(f.visibilityCondition, customFieldValues);
      if (!isVisible) return;

      if (f.isRequired) {
        const val = customFieldValues[f.fieldKey];
        const isValueEmpty =
          val === null ||
          val === undefined ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);

        if (isValueEmpty) {
          missing.push(f);
        }
      }
    });
    return missing;
  }, [currentStepFields, customFieldValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    if (!selectedStepId) {
      setError('Vui lòng chọn bước đích cần chuyển đến');
      return;
    }

    // Validate các trường bắt buộc ở bước hiện tại
    const newErrors: Record<string, string> = {};
    for (const f of missingRequiredFields) {
      newErrors[f.fieldKey] = `Trường '${f.fieldLabel}' là bắt buộc`;
    }

    if (missingRequiredFields.length > 0) {
      setFieldErrors(newErrors);
      setError(
        `Không thể chuyển bước: Còn ${missingRequiredFields.length} trường thông tin bắt buộc của bước hiện tại chưa được điền!`
      );
      setIsFieldsExpanded(true);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setFieldErrors({});

      await taskApi.transitionStep(task.id, {
        targetStepId: selectedStepId,
        executorIds: selectedExecutorIds,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        changeDescription: changeDescription.trim() || undefined,
        customFields: customFieldValues,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi chuyển bước:', err);
      setError(err.response?.data?.message || err.message || 'Không thể chuyển bước nhiệm vụ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  const currentStep = task.currentStep || allSteps.find((s) => s.id === task.currentStepId);
  const activeSelectedStep = allSteps.find((s) => s.id === selectedStepId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Chuyển bước nhiệm vụ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm tra các trường dữ liệu bắt buộc và xác nhận thông tin trước khi chuyển bước
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Info Summary */}
          <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div className="text-xs text-slate-500 font-medium">Nhiệm vụ đang xử lý:</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
              {task.name}
            </div>

            {/* Stepper Preview */}
            <div className="pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-200">
                {currentStep ? `Bước ${currentStep.order}: ${currentStep.name}` : 'Bước hiện tại'}
              </span>
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="px-2.5 py-1 rounded-md bg-indigo-600 font-semibold text-white shadow-xs">
                {activeSelectedStep
                  ? `Bước ${activeSelectedStep.order}: ${activeSelectedStep.name}`
                  : 'Bước đích'}
              </span>
            </div>
          </div>

          {/* WARNING BANNER: Required Custom Fields Validation */}
          {missingRequiredFields.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Cảnh báo: Có {missingRequiredFields.length} trường bắt buộc chưa điền!</strong>
                <span>
                  Các trường: <em>{missingRequiredFields.map((f) => f.fieldLabel).join(', ')}</em> cần được nhập đầy đủ dữ liệu trước khi chuyển sang bước tiếp theo.
                </span>
              </div>
            </div>
          )}

          {/* Custom Fields of Current Step (Inline Form) */}
          {currentStepFields.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 p-3.5 space-y-3">
              <div
                onClick={() => setIsFieldsExpanded(!isFieldsExpanded)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Trường dữ liệu của Bước hiện tại ({currentStepFields.length})
                  </span>
                  {missingRequiredFields.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                      Thiếu {missingRequiredFields.length} trường bắt buộc
                    </span>
                  )}
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-600">
                  {isFieldsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {isFieldsExpanded && (
                <div className="pt-2 space-y-4 border-t border-slate-200/80 dark:border-slate-700/80">
                  {loadingFields ? (
                    <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      Đang tải trường dữ liệu...
                    </div>
                  ) : (
                    currentStepFields.map((field) => {
                      const isVisible = evaluateVisibilityCondition(
                        field.visibilityCondition,
                        customFieldValues
                      );
                      if (!isVisible) return null;

                      return (
                        <div key={field.id} className="space-y-1">
                          <DynamicFieldRenderer
                            field={field}
                            value={customFieldValues[field.fieldKey]}
                            onChange={(val) => handleCustomFieldValueChange(field.fieldKey, val)}
                            error={fieldErrors[field.fieldKey]}
                            users={users}
                            allValues={customFieldValues}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Target Step Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn bước đích chuyển đến <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedStepId}
              onChange={(e) => handleStepChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allSteps.map((step) => (
                <option key={step.id} value={step.id}>
                  Bước {step.order}: {step.name} ({step.timeLimitHours || 24}h định mức)
                </option>
              ))}
            </select>
          </div>

          {/* New Deadline */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Hạn hoàn thành bước mới (Deadline)
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Executors Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                Người thực thi phụ trách bước này
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                Đã chọn: {selectedExecutorIds.length} người
              </span>
            </label>

            {loadingUsers ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Đang tải danh sách người dùng...
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-1 divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => {
                  const isChecked = selectedExecutorIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleExecutor(user.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {user.fullName}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {user.email} • {user.role}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Change Description / Note */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Ghi chú / Lý do chuyển bước (Ghi nhận lịch sử Snapshot)
            </label>
            <textarea
              rows={2}
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
              placeholder="Nhập lý do chuyển bước, kết quả bàn giao hoặc hướng dẫn cho người phụ trách tiếp theo..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-all ${
                missingRequiredFields.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
              } disabled:opacity-50`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang chuyển bước...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Xác nhận chuyển bước
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
