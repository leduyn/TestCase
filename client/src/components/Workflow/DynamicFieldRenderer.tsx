import React, { useState, useRef } from 'react';
import type { CustomFieldDefinition } from '../../types/workflow';
import type { User } from '../../types';
import { workflowUploadApi } from '../../services/workflowApi';
import { RichTextEditor } from '../RichTextEditor';
import {
  Upload,
  File as FileIcon,
  X,
  Star,
  ExternalLink,
  Mail,
  Phone,
  Link as LinkIcon,
  User as UserIcon,
  Calculator,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export interface DynamicFieldRendererProps {
  field: CustomFieldDefinition;
  value: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  users?: User[];
  allValues?: Record<string, any>;
  showFieldKey?: boolean;
}

export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  error,
  users = [],
  allValues: _allValues = {},
  showFieldKey = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = (field.fieldConfig as any) || {};
  const rules = (field.validationRules as any) || {};
  const isEditable = !disabled && !readOnly && field.fieldType !== 'formula';

  const handleChange = (newVal: any) => {
    if (onChange && isEditable) {
      onChange(newVal);
    }
  };

  // ─── File Upload Handlers ──────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMulti: boolean) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate client size limit
    if (config.max_size_mb) {
      const maxBytes = Number(config.max_size_mb) * 1024 * 1024;
      const oversized = files.some((f) => f.size > maxBytes);
      if (oversized) {
        alert(`Tệp đính kèm vượt quá dung lượng cho phép (${config.max_size_mb} MB)`);
        return;
      }
    }

    try {
      setUploading(true);
      const res = await workflowUploadApi.uploadFiles(files);
      const uploaded = res.data.files;

      if (isMulti) {
        const existing = Array.isArray(value) ? value : [];
        const merged = [...existing, ...uploaded];
        if (config.max_files && merged.length > Number(config.max_files)) {
          alert(`Số lượng tệp tối đa cho phép là ${config.max_files}`);
          return;
        }
        handleChange(merged);
      } else {
        handleChange(uploaded[0] || null);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      alert(err.response?.data?.message || 'Lỗi khi tải tệp lên');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (indexToRemove?: number) => {
    if (!isEditable) return;
    if (indexToRemove !== undefined && Array.isArray(value)) {
      const updated = value.filter((_, idx) => idx !== indexToRemove);
      handleChange(updated);
    } else {
      handleChange(null);
    }
  };

  const handleRichTextImageUpload = async (file: File): Promise<string> => {
    const res = await workflowUploadApi.uploadFiles([file]);
    if (res.data.files && res.data.files[0]) {
      const uploaded = res.data.files[0];
      return uploaded.publicUrl || workflowUploadApi.getFileViewUrl(uploaded.storagePath);
    }
    throw new Error('Không thể tải ảnh lên');
  };

  // ─── Field Type Renderers ──────────────────────────────────────────────────

  const renderFieldInput = () => {
    switch (field.fieldType) {
      // 1. Text Input (1 dòng)
      case 'text':
        return (
          <div className="relative">
            <input
              type="text"
              value={value ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || 'Nhập văn bản...'}
              disabled={!isEditable}
              maxLength={rules.max_length || config.max_length}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
            {rules.max_length && (
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">
                {(value || '').length}/{rules.max_length}
              </span>
            )}
          </div>
        );

      // 2. Textarea (Đoạn văn sử dụng RichTextEditor)
      case 'textarea':
      // 3. Rich Text / Markdown
      case 'richtext':
        if (!isEditable) {
          return (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 overflow-x-auto min-h-[60px]">
              {value ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: String(value) }}
                />
              ) : (
                <span className="text-slate-400 italic text-xs">Chưa có nội dung</span>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-1">
            <RichTextEditor
              value={value ?? ''}
              onChange={(val) => handleChange(val)}
              placeholder={field.placeholder || 'Nhập nội dung đoạn văn chi tiết...'}
              minHeight={config.min_height || (field.fieldType === 'textarea' ? '150px' : '200px')}
              onUploadImage={handleRichTextImageUpload}
            />
          </div>
        );

      // 4. Number
      case 'number':
        return (
          <div className="relative flex items-center">
            <input
              type="number"
              value={value ?? ''}
              onChange={(e) => handleChange(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={field.placeholder || '0'}
              min={config.min}
              max={config.max}
              step={config.step || 'any'}
              disabled={!isEditable}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                config.unit ? 'pr-16' : ''
              } ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
            {config.unit && (
              <span className="absolute right-3 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg pointer-events-none">
                {config.unit}
              </span>
            )}
          </div>
        );

      // 5. Date
      case 'date':
        return (
          <div className="relative">
            <input
              type="date"
              value={value ? String(value).substring(0, 10) : ''}
              onChange={(e) => handleChange(e.target.value || null)}
              min={config.min_date}
              max={config.max_date}
              disabled={!isEditable}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
          </div>
        );

      // 6. DateTime
      case 'datetime':
        return (
          <div className="relative">
            <input
              type="datetime-local"
              value={value ? String(value).substring(0, 16) : ''}
              onChange={(e) => handleChange(e.target.value || null)}
              min={config.min_date}
              max={config.max_date}
              disabled={!isEditable}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
          </div>
        );

      // 7. Select (Dropdown 1 giá trị)
      case 'select': {
        const options: Array<{ label: string; value: string }> = config.options || [];
        return (
          <select
            value={value ?? ''}
            onChange={(e) => handleChange(e.target.value === '' ? null : e.target.value)}
            disabled={!isEditable}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
            } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
          >
            <option value="">{field.placeholder || '-- Chọn một tùy chọn --'}</option>
            {options.map((opt, i) => (
              <option key={i} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      // 8. MultiSelect (Chọn nhiều)
      case 'multiselect': {
        const options: Array<{ label: string; value: string }> = config.options || [];
        const selectedList: string[] = Array.isArray(value) ? value : [];

        const toggleOption = (optVal: string) => {
          if (!isEditable) return;
          if (selectedList.includes(optVal)) {
            handleChange(selectedList.filter((v) => v !== optVal));
          } else {
            handleChange([...selectedList, optVal]);
          }
        };

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[44px]">
              {selectedList.length === 0 && (
                <span className="text-xs text-slate-400 self-center px-1">
                  Chưa có mục nào được chọn
                </span>
              )}
              {selectedList.map((val) => {
                const opt = options.find((o) => o.value === val);
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800"
                  >
                    {opt?.label || val}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => toggleOption(val)}
                        className="hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>

            {isEditable && options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {options.map((opt) => {
                  const isSelected = selectedList.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleOption(opt.value)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      // 9. Radio Group
      case 'radio': {
        const options: Array<{ label: string; value: string }> = config.options || [];
        const isHorizontal = config.layout !== 'vertical';

        return (
          <div className={`flex ${isHorizontal ? 'flex-wrap gap-3' : 'flex-col gap-2'}`}>
            {options.map((opt) => {
              const isChecked = String(value) === String(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } ${!isEditable ? 'pointer-events-none opacity-80' : ''}`}
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={opt.value}
                    checked={isChecked}
                    onChange={() => handleChange(opt.value)}
                    disabled={!isEditable}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        );
      }

      // 10. Checkbox Group
      case 'checkbox': {
        const options: Array<{ label: string; value: string }> = config.options || [];
        const checkedList: string[] = Array.isArray(value) ? value : [];

        const toggleCheckbox = (optVal: string) => {
          if (!isEditable) return;
          if (checkedList.includes(optVal)) {
            handleChange(checkedList.filter((v) => v !== optVal));
          } else {
            handleChange([...checkedList, optVal]);
          }
        };

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options.map((opt) => {
              const isChecked = checkedList.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } ${!isEditable ? 'pointer-events-none opacity-80' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheckbox(opt.value)}
                    disabled={!isEditable}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        );
      }

      // 11. Toggle Switch (Boolean)
      case 'toggle': {
        const isChecked = Boolean(value);
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isChecked}
              onClick={() => handleChange(!isChecked)}
              disabled={!isEditable}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                isChecked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              } ${!isEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isChecked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isChecked ? 'Bật (Đạt yêu cầu / Đồng ý)' : 'Tắt (Chưa kích hoạt)'}
            </span>
          </div>
        );
      }

      // 12. Single File Upload
      case 'file': {
        const fileObj = value && typeof value === 'object' ? value : null;
        return (
          <div className="space-y-2">
            {fileObj ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {fileObj.originalName || fileObj.filename || 'Tệp đính kèm'}
                    </p>
                    {fileObj.size && (
                      <p className="text-[10px] text-slate-400">
                        {(fileObj.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {fileObj.storagePath && (
                    <a
                      href={workflowUploadApi.getFileViewUrl(fileObj.storagePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Xem/Tải tệp"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile()}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Xóa tệp"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : isEditable ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => handleFileUpload(e, false)}
                  accept={config.accepted_types ? config.accepted_types.map((t: string) => `.${t}`).join(',') : undefined}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Đang tải tệp lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Tải lên 1 tệp đính kèm ({config.accepted_types?.join(', ') || 'Tất cả'})</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Chưa có tệp đính kèm</span>
            )}
          </div>
        );
      }

      // 13. Multi File Upload
      case 'multifile': {
        const fileList: any[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {fileList.length > 0 && (
              <div className="space-y-1.5">
                {fileList.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 text-blue-600 shrink-0" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {f.originalName || f.filename || `Tệp ${idx + 1}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.storagePath && (
                        <a
                          href={workflowUploadApi.getFileViewUrl(f.storagePath)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isEditable && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e, true)}
                  accept={config.accepted_types ? config.accepted_types.map((t: string) => `.${t}`).join(',') : undefined}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Thêm tệp đính kèm ({fileList.length}/{config.max_files || '∞'})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      }

      // 14. Single User Selector
      case 'user': {
        const filteredUsers = config.role_filter
          ? users.filter((u) => config.role_filter.includes(u.role))
          : users;

        return (
          <select
            value={value ?? ''}
            onChange={(e) => handleChange(e.target.value === '' ? null : e.target.value)}
            disabled={!isEditable}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
            } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
          >
            <option value="">{field.placeholder || '-- Chọn Người dùng --'}</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName || u.email} ({u.role})
              </option>
            ))}
          </select>
        );
      }

      // 15. Multi User Selector
      case 'multiuser': {
        const selectedUserIds: string[] = Array.isArray(value) ? value : [];
        const filteredUsers = config.role_filter
          ? users.filter((u) => config.role_filter.includes(u.role))
          : users;

        const toggleUser = (userId: string) => {
          if (!isEditable) return;
          if (selectedUserIds.includes(userId)) {
            handleChange(selectedUserIds.filter((id) => id !== userId));
          } else {
            handleChange([...selectedUserIds, userId]);
          }
        };

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[44px]">
              {selectedUserIds.length === 0 && (
                <span className="text-xs text-slate-400 self-center px-1">Chưa chọn người dùng nào</span>
              )}
              {selectedUserIds.map((userId) => {
                const u = users.find((item) => item.id === userId);
                return (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800"
                  >
                    <UserIcon className="w-3 h-3" />
                    {u?.fullName || u?.email || userId}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => toggleUser(userId)}
                        className="hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>

            {isEditable && filteredUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {u.fullName || u.email}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      // 16. Email
      case 'email':
        return (
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="email"
              value={value ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || 'example@company.com'}
              disabled={!isEditable}
              className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
          </div>
        );

      // 17. Phone
      case 'phone':
        return (
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="tel"
              value={value ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || '0987654321'}
              disabled={!isEditable}
              className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
          </div>
        );

      // 18. URL
      case 'url':
        return (
          <div className="relative flex items-center">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="url"
              value={value ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || 'https://example.com'}
              disabled={!isEditable}
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-blue-500'
              } ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : ''}`}
            />
            {value && (
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="absolute right-3 text-blue-600 hover:text-blue-700"
                title="Mở liên kết"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        );

      // 19. Rating (Sao ⭐)
      case 'rating': {
        const rating = Number(value) || 0;
        const maxStars = config.max_stars || 5;

        return (
          <div className="flex items-center gap-1.5 py-1">
            {Array.from({ length: maxStars }).map((_, i) => {
              const starIndex = i + 1;
              const isFilled = starIndex <= rating;

              return (
                <button
                  key={starIndex}
                  type="button"
                  onClick={() => handleChange(starIndex === rating ? 0 : starIndex)}
                  disabled={!isEditable}
                  className={`p-1 rounded-lg transition-transform ${
                    isEditable ? 'hover:scale-125' : 'cursor-default'
                  }`}
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      isFilled
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                </button>
              );
            })}
            <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              {rating > 0 ? `${rating} / ${maxStars} sao` : 'Chưa đánh giá'}
            </span>
          </div>
        );
      }

      // 20. Slider (Thanh trượt)
      case 'slider': {
        const min = config.min !== undefined ? Number(config.min) : 0;
        const max = config.max !== undefined ? Number(config.max) : 100;
        const step = config.step !== undefined ? Number(config.step) : 1;
        const currentVal = value !== undefined && value !== null ? Number(value) : min;

        return (
          <div className="space-y-2 py-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>{min} {config.unit}</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-bold">
                {currentVal} {config.unit}
              </span>
              <span>{max} {config.unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={currentVal}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={!isEditable}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        );
      }

      // 21. Color Picker
      case 'color': {
        const colorVal = value || config.default_color || '#3b82f6';
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorVal}
              onChange={(e) => handleChange(e.target.value)}
              disabled={!isEditable}
              className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              value={colorVal}
              onChange={(e) => handleChange(e.target.value)}
              disabled={!isEditable}
              placeholder="#000000"
              className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold uppercase"
            />
            <div
              className="w-6 h-6 rounded-lg shadow-sm border border-slate-200"
              style={{ backgroundColor: colorVal }}
            />
          </div>
        );
      }

      // 22. Formula (Tự động tính toán)
      case 'formula': {
        return (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  Tự động tính toán
                </p>
                {config.expression && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {config.expression}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                {value !== null && value !== undefined ? value.toLocaleString?.() ?? value : '—'}
              </span>
            </div>
          </div>
        );
      }

      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={!isEditable}
            className="w-full px-3.5 py-2.5 rounded-xl border text-sm"
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {field.fieldLabel}
          {field.isRequired && !readOnly && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {showFieldKey && <span className="text-[10px] font-mono text-slate-400">{field.fieldKey}</span>}
      </div>

      {field.helpText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          {field.helpText}
        </p>
      )}

      {renderFieldInput()}

      {error && (
        <div className="flex items-center gap-1 text-xs text-rose-500 font-medium pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
