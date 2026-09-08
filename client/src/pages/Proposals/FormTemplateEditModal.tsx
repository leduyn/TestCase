import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertCircle,
  Loader2,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ListFilter,
  CheckSquare,
  CircleDot,
  UploadCloud,
  User as UserIcon,
} from 'lucide-react';
import type { FormTemplate, FormFieldDefinition, ProposalType, CreateFormFieldDto } from '../../types/proposal';
import { formTemplateApi } from '../../services/proposalApi';

interface FormTemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: FormTemplate | null;
  onSuccess: (savedTemplate: FormTemplate) => void;
  proposalTypes?: ProposalType[];
}

interface FieldTypeConfig {
  type: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const FIELD_TYPE_OPTIONS: FieldTypeConfig[] = [
  { type: 'text', label: 'Văn bản (1 dòng)', icon: Type, description: 'Ô nhập text ngắn' },
  { type: 'textarea', label: 'Đoạn văn bản', icon: AlignLeft, description: 'Ô nhập nhiều dòng' },
  { type: 'number', label: 'Số liệu', icon: Hash, description: 'Số lượng, đơn giá, chỉ số' },
  { type: 'date', label: 'Ngày tháng', icon: Calendar, description: 'Chọn ngày cụ thể' },
  { type: 'select', label: 'Chọn 1 (Dropdown)', icon: ListFilter, description: 'Danh sách thả xuống' },
  { type: 'multiselect', label: 'Chọn nhiều mục', icon: CheckSquare, description: 'Chọn nhiều phương án' },
  { type: 'radio', label: 'Nút chọn (Radio)', icon: CircleDot, description: 'Nhóm nút chọn duy nhất' },
  { type: 'checkbox', label: 'Hộp kiểm (Đúng/Sai)', icon: CheckSquare, description: 'Tùy chọn Bật/Tắt' },
  { type: 'file', label: 'Tệp đính kèm', icon: UploadCloud, description: 'Upload file đính kèm' },
  { type: 'user', label: 'Chọn nhân sự', icon: UserIcon, description: 'Chọn người dùng từ hệ thống' },
];

export const FormTemplateEditModal: React.FC<FormTemplateEditModalProps> = ({
  isOpen,
  onClose,
  template,
  onSuccess,
  proposalTypes = [],
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [proposalTypeId, setProposalTypeId] = useState<string>('');
  const [isDefault, setIsDefault] = useState(false);
  const [fields, setFields] = useState<Array<CreateFormFieldDto & { id?: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field Editor Sub-Modal State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldHelpText, setFieldHelpText] = useState('');
  const [fieldOptions, setFieldOptions] = useState<Array<{ label: string; value: string }>>([
    { label: '', value: '' },
  ]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (template) {
        setName(template.name);
        setDescription(template.description || '');
        setProposalTypeId(template.proposalTypeId || '');
        setIsDefault(template.isDefault);

        // Fetch full template with fields if needed
        setFetchingDetail(true);
        formTemplateApi
          .getTemplateById(template.id)
          .then((res) => {
            const data = res.data;
            if (data.fields) {
              setFields(
                data.fields.map((f: FormFieldDefinition) => ({
                  id: f.id,
                  fieldKey: f.fieldKey,
                  fieldLabel: f.fieldLabel,
                  fieldType: f.fieldType,
                  fieldConfig: f.fieldConfig || {},
                  isRequired: f.isRequired,
                  defaultValue: f.defaultValue,
                  placeholder: f.placeholder || undefined,
                  helpText: f.helpText || undefined,
                  order: f.order,
                  isVisible: f.isVisible,
                }))
              );
            }
          })
          .catch((err) => {
            console.error('Error fetching template detail:', err);
            if (template.fields) {
              setFields(
                template.fields.map((f: FormFieldDefinition) => ({
                  id: f.id,
                  fieldKey: f.fieldKey,
                  fieldLabel: f.fieldLabel,
                  fieldType: f.fieldType,
                  fieldConfig: f.fieldConfig || {},
                  isRequired: f.isRequired,
                  defaultValue: f.defaultValue,
                  placeholder: f.placeholder || undefined,
                  helpText: f.helpText || undefined,
                  order: f.order,
                  isVisible: f.isVisible,
                }))
              );
            }
          })
          .finally(() => {
            setFetchingDetail(false);
          });
      } else {
        setName('');
        setDescription('');
        setProposalTypeId('');
        setIsDefault(false);
        setFields([
          {
            fieldKey: 'title_detail',
            fieldLabel: 'Tiêu đề chi tiết',
            fieldType: 'text',
            isRequired: true,
            placeholder: 'Nhập tiêu đề chi tiết...',
            order: 1,
            isVisible: true,
          },
          {
            fieldKey: 'reason',
            fieldLabel: 'Lý do & Mục đích',
            fieldType: 'textarea',
            isRequired: true,
            placeholder: 'Nêu rõ lý do hoặc mục đích của đề xuất...',
            order: 2,
            isVisible: true,
          },
        ]);
      }
    }
  }, [isOpen, template]);

  const openAddFieldModal = () => {
    setEditingFieldIndex(null);
    setFieldKey('');
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldPlaceholder('');
    setFieldHelpText('');
    setFieldOptions([{ label: '', value: '' }]);
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (index: number) => {
    const f = fields[index];
    setEditingFieldIndex(index);
    setFieldKey(f.fieldKey);
    setFieldLabel(f.fieldLabel);
    setFieldType(f.fieldType);
    setFieldRequired(f.isRequired ?? false);
    setFieldPlaceholder(f.placeholder || '');
    setFieldHelpText(f.helpText || '');

    const opts = f.fieldConfig?.options;
    if (Array.isArray(opts) && opts.length > 0) {
      setFieldOptions(
        opts.map((o: any) =>
          typeof o === 'string' ? { label: o, value: o } : { label: o.label || '', value: o.value || '' }
        )
      );
    } else {
      setFieldOptions([{ label: '', value: '' }]);
    }
    setIsFieldModalOpen(true);
  };

  const handleSaveField = () => {
    if (!fieldLabel.trim()) {
      alert('Vui lòng nhập nhãn hiển thị cho trường dữ liệu');
      return;
    }

    let finalKey = fieldKey.trim();
    if (!finalKey) {
      // Auto-generate key from label
      finalKey = fieldLabel
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }

    // Check duplicate key
    const duplicate = fields.some(
      (f, idx) => f.fieldKey === finalKey && (editingFieldIndex === null || idx !== editingFieldIndex)
    );
    if (duplicate) {
      alert(`Mã trường "${finalKey}" đã tồn tại. Vui lòng chọn mã khác.`);
      return;
    }

    const fieldConfig: Record<string, any> = {};
    if (['select', 'multiselect', 'radio'].includes(fieldType)) {
      const validOptions = fieldOptions
        .filter((o) => o.label.trim())
        .map((o) => ({
          label: o.label.trim(),
          value: o.value.trim() || o.label.trim(),
        }));
      fieldConfig.options = validOptions;
    }

    const newFieldData: CreateFormFieldDto & { id?: string } = {
      fieldKey: finalKey,
      fieldLabel: fieldLabel.trim(),
      fieldType,
      isRequired: fieldRequired,
      placeholder: fieldPlaceholder.trim() || undefined,
      helpText: fieldHelpText.trim() || undefined,
      fieldConfig,
      order: editingFieldIndex !== null ? fields[editingFieldIndex].order : fields.length + 1,
      isVisible: true,
    };

    if (editingFieldIndex !== null) {
      const updated = [...fields];
      newFieldData.id = updated[editingFieldIndex].id;
      updated[editingFieldIndex] = newFieldData;
      setFields(updated);
    } else {
      setFields([...fields, newFieldData]);
    }

    setIsFieldModalOpen(false);
  };

  const handleDeleteField = (index: number) => {
    if (confirm('Bạn có chắc muốn xóa trường dữ liệu này khỏi form?')) {
      const updated = fields.filter((_, idx) => idx !== index).map((f, i) => ({ ...f, order: i + 1 }));
      setFields(updated);
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // re-index order
    const reordered = updated.map((f, idx) => ({ ...f, order: idx + 1 }));
    setFields(reordered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên Form mẫu');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (template) {
        // Update template header
        const res = await formTemplateApi.updateTemplate(template.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          proposalTypeId: proposalTypeId || undefined,
          isDefault,
        });

        // If template already exists, sync fields sequentially
        for (const f of fields) {
          if (f.id) {
            await formTemplateApi.updateField(f.id, {
              fieldKey: f.fieldKey,
              fieldLabel: f.fieldLabel,
              fieldType: f.fieldType,
              fieldConfig: f.fieldConfig,
              isRequired: f.isRequired,
              placeholder: f.placeholder,
              helpText: f.helpText,
              order: f.order,
              isVisible: f.isVisible,
            });
          } else {
            await formTemplateApi.addField(template.id, f);
          }
        }

        onSuccess(res.data.template);
        onClose();
      } else {
        // Create new template with fields
        const res = await formTemplateApi.createTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          proposalTypeId: proposalTypeId || undefined,
          isDefault,
          fields,
        });

        onSuccess(res.data.template);
        onClose();
      }
    } catch (err: any) {
      console.error('Error saving form template:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu Form mẫu');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {template ? 'Chỉnh sửa Form mẫu' : 'Tạo mới Form mẫu đề xuất'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cấu hình các trường thông tin động thu thập từ người tạo đề xuất
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {fetchingDetail ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">Đang tải chi tiết form mẫu...</p>
            </div>
          ) : (
            <>
              {/* Thông tin chung */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  1. Thông tin Form mẫu
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tên Form mẫu <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Mẫu Đề xuất Nghỉ phép, Mẫu Mua sắm thiết bị..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Gắn với loại đề xuất cụ thể (Tùy chọn)
                    </label>
                    <select
                      value={proposalTypeId}
                      onChange={(e) => setProposalTypeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Dùng chung cho các loại đề xuất --</option>
                      {proposalTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name} ({pt.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Đặt làm Form mẫu mặc định
                      </span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Mô tả / Hướng dẫn điền
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mô tả mục đích hoặc hướng dẫn người tạo đề xuất hoàn thành form..."
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Danh sách trường dữ liệu */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      2. Danh sách trường dữ liệu ({fields.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Các trường mà người dùng sẽ nhập vào khi tạo đề xuất theo mẫu này
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddFieldModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm trường
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                    <Type className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Chưa có trường dữ liệu nào
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      Hãy thêm các trường để xây dựng form nhập liệu động cho đề xuất
                    </p>
                    <button
                      type="button"
                      onClick={openAddFieldModal}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/30"
                    >
                      + Thêm trường đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const typeConfig = FIELD_TYPE_OPTIONS.find((t) => t.type === field.fieldType);
                      const IconComponent = typeConfig?.icon || Type;

                      return (
                        <div
                          key={field.fieldKey + index}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveField(index, 'up')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 p-0.5"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === fields.length - 1}
                                onClick={() => handleMoveField(index, 'down')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 p-0.5"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                              <IconComponent className="w-4 h-4" />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                  {field.fieldLabel}
                                </span>
                                {field.isRequired && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold">
                                    Bắt buộc
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="font-mono text-[11px]">{field.fieldKey}</span>
                                <span>•</span>
                                <span>{typeConfig?.label || field.fieldType}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditFieldModal(index)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteField(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Xóa trường"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || fetchingDetail}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {template ? 'Cập nhật Form mẫu' : 'Tạo Form mẫu'}
            </button>
          </div>
        </form>
      </div>

      {/* Sub-Modal: Add/Edit Field */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {editingFieldIndex !== null ? 'Chỉnh sửa trường' : 'Thêm trường dữ liệu mới'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nhãn hiển thị (Label) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="VD: Số tiền đề xuất, Ngày bắt đầu..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã trường (Key)
                  </label>
                  <input
                    type="text"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    placeholder="Tự động sinh nếu để trống"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Loại trường <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Bắt buộc phải điền khi tạo đề xuất
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chữ gợi ý (Placeholder)
                </label>
                <input
                  type="text"
                  value={fieldPlaceholder}
                  onChange={(e) => setFieldPlaceholder(e.target.value)}
                  placeholder="Gợi ý nhập liệu mờ trong ô..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú trợ giúp (Help text)
                </label>
                <input
                  type="text"
                  value={fieldHelpText}
                  onChange={(e) => setFieldHelpText(e.target.value)}
                  placeholder="Hướng dẫn phụ hiển thị dưới trường..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Options cho kiểu Select, Multi-select, Radio */}
              {['select', 'multiselect', 'radio'].includes(fieldType) && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Danh sách tùy chọn lựa chọn:
                    </label>
                    <button
                      type="button"
                      onClick={() => setFieldOptions([...fieldOptions, { label: '', value: '' }])}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Thêm mục
                    </button>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {fieldOptions.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => {
                            const updated = [...fieldOptions];
                            updated[oIdx] = {
                              label: e.target.value,
                              value: opt.value || e.target.value,
                            };
                            setFieldOptions(updated);
                          }}
                          placeholder={`Lựa chọn #${oIdx + 1}`}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                        />
                        {fieldOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFieldOptions(fieldOptions.filter((_, idx) => idx !== oIdx))}
                            className="p-1 text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
              >
                Lưu trường
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
