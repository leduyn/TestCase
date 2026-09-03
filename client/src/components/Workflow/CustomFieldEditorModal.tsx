import React, { useState, useEffect, useMemo } from 'react';
import type { CustomFieldDefinition, ProcessStep, CustomFieldType } from '../../types/workflow';
import { customFieldApi } from '../../services/workflowApi';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  Type,
  AlignLeft,
  FileCode,
  Hash,
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
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
} from 'lucide-react';

interface CustomFieldEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (field: CustomFieldDefinition) => void;
  processId: string;
  steps: ProcessStep[];
  field?: CustomFieldDefinition | null;
  existingFields?: CustomFieldDefinition[];
}

interface FieldTypeOption {
  type: CustomFieldType;
  label: string;
  category: 'text' | 'number' | 'choice' | 'file' | 'user' | 'format' | 'advanced';
  icon: React.ElementType;
  description: string;
}

const FIELD_TYPES: FieldTypeOption[] = [
  // Text
  { type: 'text', label: 'Văn bản (1 dòng)', category: 'text', icon: Type, description: 'Ô nhập văn bản ngắn như Tiêu đề, Mã định danh...' },
  { type: 'textarea', label: 'Đoạn văn (RichText)', category: 'text', icon: AlignLeft, description: 'Trình soạn thảo văn bản phong phú (in đậm, nghiêng, màu sắc, danh sách, ảnh...)' },
  { type: 'richtext', label: 'Trình soạn thảo nâng cao', category: 'text', icon: FileCode, description: 'Soạn thảo văn bản định dạng in đậm, nghiêng, danh sách, markdown' },
  
  // Number & Date
  { type: 'number', label: 'Số liệu (Number)', category: 'number', icon: Hash, description: 'Nhập số lượng, đơn giá, phần trăm có đơn vị tính' },
  { type: 'date', label: 'Ngày tháng (Date)', category: 'number', icon: Calendar, description: 'Chọn ngày thực hiện, ngày hết hạn' },
  { type: 'datetime', label: 'Ngày & Giờ (DateTime)', category: 'number', icon: Clock, description: 'Chọn ngày và thời gian cụ thể' },
  
  // Choice
  { type: 'select', label: 'Chọn 1 (Dropdown Select)', category: 'choice', icon: ListFilter, description: 'Hộp chọn thả xuống chọn 1 giá trị' },
  { type: 'multiselect', label: 'Chọn nhiều (Multi-select)', category: 'choice', icon: CheckSquare, description: 'Chọn nhiều giá trị từ danh sách tùy chọn' },
  { type: 'radio', label: 'Nút Radio (Chọn 1)', category: 'choice', icon: CircleDot, description: 'Nhóm nút radio chọn duy nhất 1 mục' },
  { type: 'checkbox', label: 'Hộp kiểm (Checkbox list)', category: 'choice', icon: CheckSquare, description: 'Danh sách checkbox chọn nhiều mục' },
  { type: 'toggle', label: 'Bật / Tắt (Toggle switch)', category: 'choice', icon: ToggleLeft, description: 'Công tắc bật/tắt giá trị Đúng / Sai' },
  
  // File
  { type: 'file', label: 'Tệp đính kèm (1 tệp)', category: 'file', icon: UploadCloud, description: 'Tải lên 1 tệp tin tài liệu hoặc hình ảnh' },
  { type: 'multifile', label: 'Nhiều tệp đính kèm', category: 'file', icon: UploadCloud, description: 'Tải lên danh sách nhiều tệp tin tài liệu' },
  
  // User
  { type: 'user', label: 'Người dùng (1 người)', category: 'user', icon: User, description: 'Chọn 1 thành viên từ danh sách nhân sự hệ thống' },
  { type: 'multiuser', label: 'Nhiều người dùng', category: 'user', icon: Users, description: 'Chọn nhiều thành viên phối hợp từ hệ thống' },
  
  // Format
  { type: 'email', label: 'Địa chỉ Email', category: 'format', icon: Mail, description: 'Ô nhập email có tự động kiểm tra định dạng' },
  { type: 'phone', label: 'Số điện thoại', category: 'format', icon: Phone, description: 'Ô nhập số điện thoại liên hệ' },
  { type: 'url', label: 'Liên kết Website (URL)', category: 'format', icon: Globe, description: 'Nhập đường dẫn trang web hoặc tài liệu ngoài' },
  { type: 'rating', label: 'Đánh giá sao ⭐', category: 'format', icon: Star, description: 'Chọn mức đánh giá 1 đến 5 hoặc 10 sao' },
  { type: 'slider', label: 'Thanh trượt (Slider)', category: 'format', icon: Sliders, description: 'Kéo thanh trượt điều chỉnh giá trị số trực quan' },
  { type: 'color', label: 'Bảng chọn màu (Color)', category: 'format', icon: Palette, description: 'Bảng chọn mã màu nhận diện hex' },
  
  // Advanced
  { type: 'formula', label: 'Công thức tính toán (Formula)', category: 'advanced', icon: Calculator, description: 'Tự động tính giá trị dựa trên các trường số khác' },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'Tất cả (22)' },
  { key: 'text', label: 'Văn bản' },
  { key: 'number', label: 'Số & Ngày' },
  { key: 'choice', label: 'Lựa chọn' },
  { key: 'file', label: 'Tệp tin' },
  { key: 'user', label: 'Người dùng' },
  { key: 'format', label: 'Định dạng' },
  { key: 'advanced', label: 'Nâng cao' },
];

export const CustomFieldEditorModal: React.FC<CustomFieldEditorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  processId,
  steps,
  field,
  existingFields = [],
}) => {
  // Form State
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [stepId, setStepId] = useState<string>('');
  const [isRequired, setIsRequired] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [placeholder, setPlaceholder] = useState('');
  const [helpText, setHelpText] = useState('');
  const [defaultValue, setDefaultValue] = useState<any>('');

  // Category filter in type picker
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Config State
  const [options, setOptions] = useState<Array<{ label: string; value: string; color?: string }>>([
    { label: 'Tùy chọn 1', value: 'option_1' },
    { label: 'Tùy chọn 2', value: 'option_2' },
  ]);
  const [numMin, setNumMin] = useState<string>('');
  const [numMax, setNumMax] = useState<string>('');
  const [numStep, setNumStep] = useState<string>('1');
  const [numUnit, setNumUnit] = useState<string>('');
  const [acceptedTypes, setAcceptedTypes] = useState<string>('.pdf,.doc,.docx,.xlsx,.png,.jpg');
  const [maxSizeMb, setMaxSizeMb] = useState<number>(10);
  const [maxFiles, setMaxFiles] = useState<number>(5);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [maxStars, setMaxStars] = useState<number>(5);
  const [formulaExpression, setFormulaExpression] = useState<string>('');

  // Visibility Condition
  const [hasCondition, setHasCondition] = useState(false);
  const [conditionField, setConditionField] = useState('');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('');

  // Validation Rules
  const [hasValidationRules, setHasValidationRules] = useState(false);
  const [minLength, setMinLength] = useState<string>('');
  const [maxLength, setMaxLength] = useState<string>('');
  const [patternRegex, setPatternRegex] = useState<string>('');
  const [patternMessage, setPatternMessage] = useState<string>('');

  // Section collapsibles
  const [isConditionExpanded, setIsConditionExpanded] = useState(false);
  const [isValidationExpanded, setIsValidationExpanded] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewValue, setPreviewValue] = useState<any>(null);

  // Auto-slug generation for fieldKey
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s_]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  };

  useEffect(() => {
    if (!isOpen) return;

    if (field) {
      // Edit mode
      setFieldType((field.fieldType as CustomFieldType) || 'text');
      setFieldLabel(field.fieldLabel || '');
      setFieldKey(field.fieldKey || '');
      setIsKeyManuallyEdited(true);
      setStepId(field.stepId || '');
      setIsRequired(!!field.isRequired);
      setIsVisible(field.isVisible !== false);
      setPlaceholder(field.placeholder || '');
      setHelpText(field.helpText || '');
      setDefaultValue(field.defaultValue ?? '');

      const cfg = field.fieldConfig || {};
      if (Array.isArray(cfg.options)) {
        setOptions(cfg.options);
      }
      setNumMin(cfg.min !== undefined ? String(cfg.min) : '');
      setNumMax(cfg.max !== undefined ? String(cfg.max) : '');
      setNumStep(cfg.step !== undefined ? String(cfg.step) : '1');
      setNumUnit(cfg.unit || '');
      setAcceptedTypes(cfg.accepted_types || '.pdf,.doc,.docx,.xlsx,.png,.jpg');
      setMaxSizeMb(cfg.max_size_mb || 10);
      setMaxFiles(cfg.max_files || 5);
      setRoleFilter(Array.isArray(cfg.role_filter) ? cfg.role_filter : []);
      setMaxStars(cfg.max_stars || 5);
      setFormulaExpression(cfg.formula_expression || '');

      // Condition
      if (field.visibilityCondition && field.visibilityCondition.field) {
        setHasCondition(true);
        setConditionField(field.visibilityCondition.field);
        setConditionOperator(field.visibilityCondition.operator || 'equals');
        setConditionValue(String(field.visibilityCondition.value ?? ''));
        setIsConditionExpanded(true);
      } else {
        setHasCondition(false);
        setConditionField('');
        setConditionOperator('equals');
        setConditionValue('');
      }

      // Validation
      if (field.validationRules && Object.keys(field.validationRules).length > 0) {
        setHasValidationRules(true);
        setMinLength(field.validationRules.min_length !== undefined ? String(field.validationRules.min_length) : '');
        setMaxLength(field.validationRules.max_length !== undefined ? String(field.validationRules.max_length) : '');
        setPatternRegex(field.validationRules.pattern || '');
        setPatternMessage(field.validationRules.pattern_message || '');
        setIsValidationExpanded(true);
      } else {
        setHasValidationRules(false);
        setMinLength('');
        setMaxLength('');
        setPatternRegex('');
        setPatternMessage('');
      }
    } else {
      // Create mode
      setFieldType('text');
      setFieldLabel('');
      setFieldKey('');
      setIsKeyManuallyEdited(false);
      setStepId('');
      setIsRequired(false);
      setIsVisible(true);
      setPlaceholder('');
      setHelpText('');
      setDefaultValue('');
      setOptions([
        { label: 'Tùy chọn 1', value: 'option_1' },
        { label: 'Tùy chọn 2', value: 'option_2' },
      ]);
      setNumMin('');
      setNumMax('');
      setNumStep('1');
      setNumUnit('');
      setAcceptedTypes('.pdf,.doc,.docx,.xlsx,.png,.jpg');
      setMaxSizeMb(10);
      setMaxFiles(5);
      setRoleFilter([]);
      setMaxStars(5);
      setFormulaExpression('');
      setHasCondition(false);
      setConditionField('');
      setConditionOperator('equals');
      setConditionValue('');
      setHasValidationRules(false);
      setMinLength('');
      setMaxLength('');
      setPatternRegex('');
      setPatternMessage('');
      setIsConditionExpanded(false);
      setIsValidationExpanded(false);
    }
    setError(null);
    setPreviewValue(null);
  }, [isOpen, field]);

  const handleLabelChange = (newLabel: string) => {
    setFieldLabel(newLabel);
    if (!isKeyManuallyEdited && !field) {
      setFieldKey(generateSlug(newLabel));
    }
  };

  // Option handlers for choice types
  const handleAddOption = () => {
    const nextIdx = options.length + 1;
    setOptions([...options, { label: `Tùy chọn ${nextIdx}`, value: `option_${nextIdx}` }]);
  };

  const handleUpdateOption = (index: number, key: 'label' | 'value' | 'color', val: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [key]: val };
    if (key === 'label' && !field) {
      updated[index].value = generateSlug(val);
    }
    setOptions(updated);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const filteredFieldTypes = useMemo(() => {
    if (selectedCategory === 'all') return FIELD_TYPES;
    return FIELD_TYPES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const otherFields = useMemo(() => {
    return existingFields.filter((f) => (field ? f.id !== field.id : true));
  }, [existingFields, field]);

  const numericOtherFields = useMemo(() => {
    return otherFields.filter((f) => ['number', 'slider', 'rating'].includes(f.fieldType));
  }, [otherFields]);

  // Construct Field definition for live preview
  const constructedFieldDefinition = useMemo<CustomFieldDefinition>(() => {
    const fieldConfig: Record<string, any> = {};

    if (['select', 'multiselect', 'radio', 'checkbox'].includes(fieldType)) {
      fieldConfig.options = options;
    }
    if (fieldType === 'number' || fieldType === 'slider') {
      if (numMin !== '') fieldConfig.min = Number(numMin);
      if (numMax !== '') fieldConfig.max = Number(numMax);
      if (numStep !== '') fieldConfig.step = Number(numStep);
      if (numUnit.trim()) fieldConfig.unit = numUnit.trim();
    }
    if (fieldType === 'file' || fieldType === 'multifile') {
      fieldConfig.accepted_types = acceptedTypes;
      fieldConfig.max_size_mb = Number(maxSizeMb) || 10;
      if (fieldType === 'multifile') {
        fieldConfig.max_files = Number(maxFiles) || 5;
      }
    }
    if (fieldType === 'user' || fieldType === 'multiuser') {
      if (roleFilter.length > 0) fieldConfig.role_filter = roleFilter;
    }
    if (fieldType === 'rating') {
      fieldConfig.max_stars = Number(maxStars) || 5;
    }
    if (fieldType === 'formula') {
      fieldConfig.formula_expression = formulaExpression;
    }

    const visibilityCondition = hasCondition && conditionField
      ? { field: conditionField, operator: conditionOperator, value: conditionValue }
      : null;

    const validationRules: Record<string, any> = {};
    if (hasValidationRules) {
      if (minLength !== '') validationRules.min_length = Number(minLength);
      if (maxLength !== '') validationRules.max_length = Number(maxLength);
      if (patternRegex.trim()) validationRules.pattern = patternRegex.trim();
      if (patternMessage.trim()) validationRules.pattern_message = patternMessage.trim();
    }

    return {
      id: field?.id || 'preview_id',
      processId,
      stepId: stepId || null,
      fieldKey: fieldKey || 'field_key',
      fieldLabel: fieldLabel || 'Tên trường dữ liệu',
      fieldType,
      fieldConfig,
      isRequired,
      defaultValue: defaultValue || undefined,
      placeholder: placeholder || null,
      helpText: helpText || null,
      order: field?.order || 0,
      isVisible,
      visibilityCondition,
      validationRules: Object.keys(validationRules).length > 0 ? validationRules : null,
    };
  }, [
    field,
    processId,
    stepId,
    fieldKey,
    fieldLabel,
    fieldType,
    options,
    numMin,
    numMax,
    numStep,
    numUnit,
    acceptedTypes,
    maxSizeMb,
    maxFiles,
    roleFilter,
    maxStars,
    formulaExpression,
    isRequired,
    defaultValue,
    placeholder,
    helpText,
    isVisible,
    hasCondition,
    conditionField,
    conditionOperator,
    conditionValue,
    hasValidationRules,
    minLength,
    maxLength,
    patternRegex,
    patternMessage,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) {
      setError('Vui lòng nhập tên hiển thị của trường');
      return;
    }

    if (!fieldKey.trim()) {
      setError('Vui lòng nhập mã trường (fieldKey)');
      return;
    }

    const keyRegex = /^[a-z0-9_]+$/;
    if (!keyRegex.test(fieldKey.trim())) {
      setError('Mã trường chỉ được chứa chữ cái thường, số và dấu gạch dưới (ví dụ: contract_value)');
      return;
    }

    // Check duplicate key in client if new
    if (!field && existingFields.some((f) => f.fieldKey.toLowerCase() === fieldKey.trim().toLowerCase())) {
      setError(`Mã trường "${fieldKey}" đã tồn tại trong quy trình này! Vui lòng chọn mã khác.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const fieldData = {
        stepId: stepId || null,
        fieldKey: fieldKey.trim(),
        fieldLabel: fieldLabel.trim(),
        fieldType,
        fieldConfig: constructedFieldDefinition.fieldConfig,
        isRequired,
        defaultValue: defaultValue || undefined,
        placeholder: placeholder.trim() || null,
        helpText: helpText.trim() || null,
        isVisible,
        visibilityCondition: constructedFieldDefinition.visibilityCondition,
        validationRules: constructedFieldDefinition.validationRules,
      };

      if (field) {
        // Update
        const res = await customFieldApi.updateCustomField(field.id, fieldData);
        onSuccess(res.data.field);
      } else {
        // Create
        const res = await customFieldApi.createCustomField(processId, fieldData);
        onSuccess(res.data.field);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving custom field:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu trường dữ liệu tùy chỉnh');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {field ? 'Chỉnh sửa Trường Tùy chỉnh' : 'Thêm Trường Dữ liệu Tùy chỉnh (Custom Field)'}
              </h2>
              <p className="text-xs text-slate-500">
                Định nghĩa các ô nhập liệu động theo từng bước trong quy trình
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-sm text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. FIELD TYPE SELECTOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                1. Chọn loại trường dữ liệu (22 loại) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-md scrollbar-none">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedCategory(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === tab.key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              {filteredFieldTypes.map((item) => {
                const IconComponent = item.icon;
                const isSelected = fieldType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setFieldType(item.type)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BASIC FIELD INFORMATION */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2. Thông tin cơ bản
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên hiển thị (Label) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="Ví dụ: Giá trị hợp đồng, CV ứng viên..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    Mã trường (Key) <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">Dùng trong công thức & code</span>
                </label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => {
                    setIsKeyManuallyEdited(true);
                    setFieldKey(e.target.value);
                  }}
                  placeholder="contract_value"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gán vào bước thực hiện (Step)
                </label>
                <select
                  value={stepId}
                  onChange={(e) => setStepId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                >
                  <option value="">✨ Toàn bộ quy trình (Global Field)</option>
                  {steps.map((s, idx) => (
                    <option key={s.id || idx} value={s.id}>
                      Bước {idx + 1}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gợi ý nhập liệu (Placeholder)
                </label>
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Ví dụ: Nhập vào số tiền VNĐ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hướng dẫn thực hiện (Help Text)
              </label>
              <input
                type="text"
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Ví dụ: Giá trị sau thuế VAT, đối chiếu với hóa đơn tài chính đính kèm"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
              />
            </div>

            {/* Checkboxes: Required & Visible */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Bắt buộc nhập khi hoàn thành bước (Required)
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Hiển thị trường này trên Form
                </span>
              </label>
            </div>
          </div>

          {/* 3. DYNAMIC CONFIGURATION ACCORDING TO FIELD TYPE */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              3. Cấu hình chi tiết cho kiểu "{FIELD_TYPES.find((f) => f.type === fieldType)?.label}"
            </label>

            {/* Options manager (select, multiselect, radio, checkbox) */}
            {['select', 'multiselect', 'radio', 'checkbox'].includes(fieldType) && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Danh sách các Tùy chọn (Options)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm lựa chọn
                  </button>
                </div>

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => handleUpdateOption(idx, 'label', e.target.value)}
                        placeholder={`Tên tùy chọn ${idx + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={opt.value}
                        onChange={(e) => handleUpdateOption(idx, 'value', e.target.value)}
                        placeholder="Mã giá trị (value)"
                        className="w-1/3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 1}
                        className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Number & Slider config */}
            {(fieldType === 'number' || fieldType === 'slider') && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Giá trị nhỏ nhất (Min)
                  </label>
                  <input
                    type="number"
                    value={numMin}
                    onChange={(e) => setNumMin(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Giá trị lớn nhất (Max)
                  </label>
                  <input
                    type="number"
                    value={numMax}
                    onChange={(e) => setNumMax(e.target.value)}
                    placeholder="100"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Bước nhảy (Step)
                  </label>
                  <input
                    type="number"
                    value={numStep}
                    onChange={(e) => setNumStep(e.target.value)}
                    placeholder="1"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Đơn vị tính (Unit)
                  </label>
                  <input
                    type="text"
                    value={numUnit}
                    onChange={(e) => setNumUnit(e.target.value)}
                    placeholder="VNĐ, %, Kg, Giờ..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            {/* File & Multifile config */}
            {(fieldType === 'file' || fieldType === 'multifile') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Định dạng cho phép (Cách nhau bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={acceptedTypes}
                    onChange={(e) => setAcceptedTypes(e.target.value)}
                    placeholder=".pdf,.doc,.docx,.xlsx,.png,.jpg"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dung lượng tối đa (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxSizeMb}
                    onChange={(e) => setMaxSizeMb(Number(e.target.value) || 10)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                {fieldType === 'multifile' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Số lượng tệp tối đa
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxFiles}
                      onChange={(e) => setMaxFiles(Number(e.target.value) || 5)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rating config */}
            {fieldType === 'rating' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Số lượng sao tối đa
                </label>
                <div className="flex gap-3">
                  {[3, 5, 10].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMaxStars(count)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        maxStars === count
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {count} sao ⭐
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User role filter config */}
            {(fieldType === 'user' || fieldType === 'multiuser') && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Lọc theo vai trò người dùng (Tùy chọn):
                </label>
                <div className="flex gap-2">
                  {['ADMIN', 'MANAGER', 'USER'].map((r) => {
                    const isChecked = roleFilter.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setRoleFilter(roleFilter.filter((x) => x !== r));
                          } else {
                            setRoleFilter([...roleFilter, r]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formula Expression Builder */}
            {fieldType === 'formula' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Biểu thức tính toán (Formula Expression) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formulaExpression}
                    onChange={(e) => setFormulaExpression(e.target.value)}
                    placeholder="Ví dụ: price * quantity * (1 - discount / 100)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hỗ trợ các phép toán cơ bản: +, -, *, /, (, ) và tên các trường số liệu.
                  </p>
                </div>

                {numericOtherFields.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Nhấn vào tên trường số để chèn nhanh vào công thức:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {numericOtherFields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() =>
                            setFormulaExpression((prev) => (prev ? `${prev} ${f.fieldKey}` : f.fieldKey))
                          }
                          className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-mono hover:bg-indigo-100"
                        >
                          +{f.fieldKey} ({f.fieldLabel})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. VISIBILITY CONDITION (ADVANCED) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsConditionExpanded(!isConditionExpanded)}
              className="flex items-center justify-between w-full text-left py-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <span className="flex items-center gap-2">
                4. Điều kiện hiển thị nâng cao (Conditional Visibility)
                {hasCondition && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] lowercase">
                    đang bật
                  </span>
                )}
              </span>
              {isConditionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isConditionExpanded && (
              <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCondition}
                    onChange={(e) => setHasCondition(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Chỉ hiển thị trường này khi thỏa mãn điều kiện
                  </span>
                </label>

                {hasCondition && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Khi trường (Field)
                      </label>
                      <select
                        value={conditionField}
                        onChange={(e) => setConditionField(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value="">-- Chọn trường so sánh --</option>
                        {otherFields.map((f) => (
                          <option key={f.id} value={f.fieldKey}>
                            {f.fieldLabel} ({f.fieldKey})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Toán tử so sánh (Operator)
                      </label>
                      <select
                        value={conditionOperator}
                        onChange={(e) => setConditionOperator(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value="equals">Bằng (=)</option>
                        <option value="not_equals">Khác (!=)</option>
                        <option value="contains">Chứa chuỗi</option>
                        <option value="not_contains">Không chứa chuỗi</option>
                        <option value="greater_than">Lớn hơn (&gt;)</option>
                        <option value="less_than">Nhỏ hơn (&lt;)</option>
                        <option value="is_empty">Rỗng (chưa điền)</option>
                        <option value="is_not_empty">Đã điền giá trị</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Giá trị so sánh (Target Value)
                      </label>
                      <input
                        type="text"
                        value={conditionValue}
                        onChange={(e) => setConditionValue(e.target.value)}
                        placeholder="Ví dụ: true, yes, reject..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. VALIDATION RULES */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsValidationExpanded(!isValidationExpanded)}
              className="flex items-center justify-between w-full text-left py-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <span className="flex items-center gap-2">
                5. Quy tắc kiểm tra tính hợp lệ (Validation Rules)
                {hasValidationRules && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 text-[10px] lowercase">
                    đang bật
                  </span>
                )}
              </span>
              {isValidationExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isValidationExpanded && (
              <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasValidationRules}
                    onChange={(e) => setHasValidationRules(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Bật quy tắc kiểm tra nâng cao
                  </span>
                </label>

                {hasValidationRules && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Độ dài tối thiểu (Ký tự)
                      </label>
                      <input
                        type="number"
                        value={minLength}
                        onChange={(e) => setMinLength(e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Độ dài tối đa (Ký tự)
                      </label>
                      <input
                        type="number"
                        value={maxLength}
                        onChange={(e) => setMaxLength(e.target.value)}
                        placeholder="255"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Biểu thức chính quy (Regex Pattern)
                      </label>
                      <input
                        type="text"
                        value={patternRegex}
                        onChange={(e) => setPatternRegex(e.target.value)}
                        placeholder="^[A-Z0-9_-]+$"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Thông báo lỗi tùy chỉnh khi sai định dạng
                      </label>
                      <input
                        type="text"
                        value={patternMessage}
                        onChange={(e) => setPatternMessage(e.target.value)}
                        placeholder="Vui lòng nhập đúng định dạng mã quy định"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. LIVE PREVIEW BOX */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xem trước ô nhập liệu (Live Preview)</span>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs">
              <DynamicFieldRenderer
                field={constructedFieldDefinition}
                value={previewValue}
                onChange={(val) => setPreviewValue(val)}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {field ? 'Lưu thay đổi' : 'Tạo trường dữ liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
