import React, { useState, useEffect, useMemo } from 'react';
import type { CustomFieldDefinition, ProcessStep, CustomFieldType } from '../../types/workflow';
import { customFieldApi } from '../../services/workflowApi';
import { CustomFieldEditorModal } from './CustomFieldEditorModal';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Copy,
  ArrowUp,
  ArrowDown,
  Loader2,
  Layers,
  Hash,
  Type,
  AlignLeft,
  FileCode,
  Calendar,
  Clock,
  ListFilter,
  CheckSquare,
  CircleDot,
  ToggleLeft,
  UploadCloud,
  User,
  Users,
  Mail,
  Phone,
  Globe,
  Star,
  Sliders,
  Palette,
  Calculator,
  EyeOff,
  Zap,
} from 'lucide-react';

interface CustomFieldListProps {
  processId: string;
  steps: ProcessStep[];
  onFieldsUpdated?: () => void;
  readOnly?: boolean;
}

export const CustomFieldList: React.FC<CustomFieldListProps> = ({
  processId,
  steps,
  onFieldsUpdated,
  readOnly = false,
}) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStepFilter, setSelectedStepFilter] = useState<string>('ALL');

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchFields = async () => {
    if (!processId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await customFieldApi.getCustomFieldsByProcess(processId);
      const items = Array.isArray(res.data) ? res.data : [];
      // Sort by order asc
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      setFields(items);
    } catch (err: any) {
      console.error('Error fetching custom fields:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách trường dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [processId]);

  const handleCreate = () => {
    setEditingField(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setIsEditorOpen(true);
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa trường "${field.fieldLabel}" (${field.fieldKey})? Dữ liệu đã nhập trên các nhiệm vụ liên quan có thể bị ảnh hưởng.`
      )
    ) {
      return;
    }

    try {
      setActionLoadingId(field.id);
      await customFieldApi.deleteCustomField(field.id);
      await fetchFields();
      if (onFieldsUpdated) onFieldsUpdated();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa trường tùy chỉnh');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (field: CustomFieldDefinition) => {
    try {
      setActionLoadingId(field.id);
      await customFieldApi.duplicateCustomField(field.id);
      await fetchFields();
      if (onFieldsUpdated) onFieldsUpdated();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi nhân bản trường tùy chỉnh');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= filteredFields.length) return;

    const currentList = [...fields];
    // Find absolute indices in full list
    const item1 = filteredFields[index];
    const item2 = filteredFields[targetIdx];
    const idx1 = currentList.findIndex((f) => f.id === item1.id);
    const idx2 = currentList.findIndex((f) => f.id === item2.id);

    if (idx1 === -1 || idx2 === -1) return;

    // Swap order property
    const tempOrder = currentList[idx1].order;
    currentList[idx1].order = currentList[idx2].order;
    currentList[idx2].order = tempOrder;

    // Local swap
    const temp = currentList[idx1];
    currentList[idx1] = currentList[idx2];
    currentList[idx2] = temp;

    currentList.sort((a, b) => a.order - b.order);
    setFields(currentList);

    try {
      const fieldOrders = currentList.map((f, i) => ({ id: f.id, order: i + 1 }));
      await customFieldApi.reorderCustomFields(processId, fieldOrders);
      if (onFieldsUpdated) onFieldsUpdated();
    } catch (err) {
      console.error('Reorder error:', err);
      fetchFields();
    }
  };

  const handleEditorSuccess = () => {
    fetchFields();
    if (onFieldsUpdated) onFieldsUpdated();
  };

  // Step lookup map
  const stepMap = useMemo(() => {
    const map = new Map<string, ProcessStep>();
    steps.forEach((s) => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [steps]);

  // Filtered List
  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      // Step filter
      if (selectedStepFilter === 'GLOBAL' && f.stepId) return false;
      if (selectedStepFilter !== 'ALL' && selectedStepFilter !== 'GLOBAL' && f.stepId !== selectedStepFilter) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const label = (f.fieldLabel || '').toLowerCase();
        const key = (f.fieldKey || '').toLowerCase();
        const type = (f.fieldType || '').toLowerCase();
        return label.includes(q) || key.includes(q) || type.includes(q);
      }

      return true;
    });
  }, [fields, selectedStepFilter, search]);

  const getFieldTypeMeta = (type: string | CustomFieldType) => {
    switch (type) {
      case 'text':
        return { icon: Type, label: 'Văn bản (1 dòng)', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800' };
      case 'textarea':
        return { icon: AlignLeft, label: 'Đoạn văn', color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800' };
      case 'richtext':
        return { icon: FileCode, label: 'RichText', color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800' };
      case 'number':
        return { icon: Hash, label: 'Số liệu', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' };
      case 'date':
        return { icon: Calendar, label: 'Ngày tháng', color: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800' };
      case 'datetime':
        return { icon: Clock, label: 'Ngày & Giờ', color: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800' };
      case 'select':
        return { icon: ListFilter, label: 'Chọn 1 (Select)', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800' };
      case 'multiselect':
        return { icon: CheckSquare, label: 'Chọn nhiều', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800' };
      case 'radio':
        return { icon: CircleDot, label: 'Radio', color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800' };
      case 'checkbox':
        return { icon: CheckSquare, label: 'Checkbox', color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800' };
      case 'toggle':
        return { icon: ToggleLeft, label: 'Bật / Tắt', color: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800' };
      case 'file':
        return { icon: UploadCloud, label: '1 Tệp tin', color: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800' };
      case 'multifile':
        return { icon: UploadCloud, label: 'Nhiều tệp tin', color: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800' };
      case 'user':
        return { icon: User, label: '1 Người dùng', color: 'text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800' };
      case 'multiuser':
        return { icon: Users, label: 'Nhiều người dùng', color: 'text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800' };
      case 'email':
        return { icon: Mail, label: 'Email', color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' };
      case 'phone':
        return { icon: Phone, label: 'Điện thoại', color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' };
      case 'url':
        return { icon: Globe, label: 'URL', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800' };
      case 'rating':
        return { icon: Star, label: 'Đánh giá sao', color: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800' };
      case 'slider':
        return { icon: Sliders, label: 'Thanh trượt', color: 'text-lime-600 bg-lime-50 border-lime-200 dark:bg-lime-950/50 dark:text-lime-400 dark:border-lime-800' };
      case 'color':
        return { icon: Palette, label: 'Màu sắc', color: 'text-pink-600 bg-pink-50 border-pink-200 dark:bg-pink-950/50 dark:text-pink-400 dark:border-pink-800' };
      case 'formula':
        return { icon: Calculator, label: 'Công thức', color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-400 dark:border-fuchsia-800' };
      default:
        return { icon: Type, label: type, color: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Step Filter Dropdown */}
          <div className="relative min-w-[180px]">
            <select
              value={selectedStepFilter}
              onChange={(e) => setSelectedStepFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              <option value="ALL">Tất cả các bước ({fields.length})</option>
              <option value="GLOBAL">✨ Toàn bộ quy trình (Global) ({fields.filter((f) => !f.stepId).length})</option>
              {steps.map((s, idx) => (
                <option key={s.id || idx} value={s.id}>
                  Bước {idx + 1}: {s.name} ({fields.filter((f) => f.stepId === s.id).length})
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, mã trường..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-500/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm trường dữ liệu
          </button>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <p className="text-xs">Đang tải danh sách trường dữ liệu...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchFields} className="underline font-semibold hover:opacity-80">
            Thử lại
          </button>
        </div>
      ) : filteredFields.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {search.trim() || selectedStepFilter !== 'ALL'
                ? 'Không tìm thấy trường dữ liệu phù hợp'
                : 'Chưa có trường dữ liệu tùy chỉnh nào'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
              {search.trim() || selectedStepFilter !== 'ALL'
                ? 'Thử thay đổi bộ lọc bước hoặc từ khóa tìm kiếm'
                : 'Thêm các trường dữ liệu tùy chỉnh (22 loại) để thu thập thông tin khi thực hiện các bước trong quy trình.'}
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo trường đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFields.map((f, idx) => {
            const typeMeta = getFieldTypeMeta(f.fieldType);
            const IconComp = typeMeta.icon;
            const assignedStep = f.stepId ? stepMap.get(f.stepId) : null;
            const isActing = actionLoadingId === f.id;

            return (
              <div
                key={f.id}
                className={`p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isActing ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Order handle / icon */}
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${typeMeta.color}`}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {f.fieldLabel}
                      </span>
                      <code className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                        {f.fieldKey}
                      </code>

                      {/* Type Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeMeta.color}`}
                      >
                        {typeMeta.label}
                      </span>

                      {/* Required Badge */}
                      {f.isRequired && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900">
                          Bắt buộc
                        </span>
                      )}

                      {/* Visibility Status */}
                      {!f.isVisible && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Đang ẩn
                        </span>
                      )}
                    </div>

                    {/* Step tag & config summary */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {assignedStep ? (
                          <span>
                            Bước: <strong className="text-slate-800 dark:text-slate-200">{assignedStep.name}</strong>
                          </span>
                        ) : (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            ✨ Áp dụng cho Toàn bộ quy trình
                          </span>
                        )}
                      </span>

                      {/* Options / Unit / Formula extra tags */}
                      {f.fieldConfig?.options && Array.isArray(f.fieldConfig.options) && (
                        <span className="text-[11px] text-slate-400">
                          • {f.fieldConfig.options.length} tùy chọn
                        </span>
                      )}
                      {f.fieldConfig?.unit && (
                        <span className="text-[11px] text-slate-400">
                          • Đơn vị: {f.fieldConfig.unit}
                        </span>
                      )}
                      {f.fieldConfig?.formula_expression && (
                        <span className="text-[11px] text-fuchsia-600 dark:text-fuchsia-400 font-mono">
                          • f(x) = {f.fieldConfig.formula_expression}
                        </span>
                      )}
                      {f.visibilityCondition && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          • Có điều kiện hiển thị
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    {/* Move order up/down */}
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Di chuyển lên"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === filteredFields.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Di chuyển xuống"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-slate-200 dark:border-slate-700 mx-1" />

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => handleDuplicate(f)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Nhân bản trường này"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleEdit(f)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Chỉnh sửa cấu hình"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      className="p-1 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Xóa trường này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Field Editor Modal */}
      <CustomFieldEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleEditorSuccess}
        processId={processId}
        steps={steps}
        field={editingField}
        existingFields={fields}
      />
    </div>
  );
};
