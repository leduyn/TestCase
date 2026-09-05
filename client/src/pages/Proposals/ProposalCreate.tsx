import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Users,
  FileText,
  UploadCloud,
  Send,
  Save,
  Check,
  Search,
  ChevronRight,
  Shield,
  Layers,
  Calendar,
  DollarSign,
  ShoppingCart,
  Award,
  Briefcase,
  Laptop,
  Car,
  HeartPulse,
  UserCheck,
  Trash2,
  Loader2,
  Tag,
} from 'lucide-react';
import type {
  ProposalType,
  FormTemplate,
  ProposalPriority,
  ProposalAttachment,
  CreateProposalDto,
} from '../../types/proposal';
import type { User } from '../../types';
import {
  PROPOSAL_PRIORITY_CONFIG,
  APPROVAL_WORKFLOW_CONFIG,
} from '../../types/proposal';
import { proposalTypeApi, formTemplateApi, proposalApi, proposalUploadApi } from '../../services/proposalApi';
import { userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DynamicProposalForm } from '../../components/Proposals/DynamicProposalForm';

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Calendar,
  DollarSign,
  ShoppingCart,
  Award,
  Briefcase,
  Laptop,
  Car,
  HeartPulse,
  Send,
  Layers,
  Shield,
};

type Step = 'TYPE' | 'FORM' | 'APPROVERS' | 'REVIEW';

export const ProposalCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<Step>('TYPE');

  // Proposal Types & Templates state
  const [proposalTypes, setProposalTypes] = useState<ProposalType[]>([]);
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Users for approver selection
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Search in type selection
  const [typeSearch, setTypeSearch] = useState('');

  // Form input state
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<ProposalPriority>('NORMAL');
  const [content, setContent] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Optional Approvers state
  const [selectedOptionalApproverIds, setSelectedOptionalApproverIds] = useState<string[]>([]);

  // Attachments state
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Proposal Types and Directory of Users
  useEffect(() => {
    const initData = async () => {
      setLoadingTypes(true);
      try {
        const [typesRes, usersRes] = await Promise.all([
          proposalTypeApi.getTypes({ isActive: true, forCreation: true }),
          userApi.getDirectory().catch(() => userApi.getUsers()),
        ]);

        const activeTypes = typesRes.data.types || [];
        setProposalTypes(activeTypes);
        setAllUsers(Array.isArray(usersRes.data) ? usersRes.data : []);

        // If query param typeId is provided, auto-select
        const queryTypeId = searchParams.get('typeId');
        if (queryTypeId) {
          const match = activeTypes.find((t) => t.id === queryTypeId);
          if (match) {
            handleSelectType(match);
          }
        }
      } catch (err) {
        console.error('Error initializing proposal create page:', err);
        setErrorMessage('Lỗi khi tải danh mục loại đề xuất');
      } finally {
        setLoadingTypes(false);
      }
    };

    initData();
  }, [searchParams]);

  // Handle selecting a Proposal Type
  const handleSelectType = async (type: ProposalType) => {
    setSelectedType(type);
    setFormTemplate(null);
    setFormData({});
    setFormErrors({});
    setSelectedOptionalApproverIds([]);

    if (type.useCustomForm && type.formTemplateId) {
      setLoadingTemplate(true);
      try {
        const res = await formTemplateApi.getTemplateById(type.formTemplateId);
        setFormTemplate(res.data);
      } catch (err) {
        console.error('Error fetching form template:', err);
      } finally {
        setLoadingTemplate(false);
      }
    }

    setCurrentStep('FORM');
  };

  // Filtered proposal types for Step 1
  const filteredTypes = useMemo(() => {
    if (!typeSearch.trim()) return proposalTypes;
    const term = typeSearch.toLowerCase();
    return proposalTypes.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.code.toLowerCase().includes(term) ||
        (t.description && t.description.toLowerCase().includes(term))
    );
  }, [proposalTypes, typeSearch]);

  // User map for fast lookup
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach((u) => map.set(u.id, u));
    return map;
  }, [allUsers]);

  // Direct manager of current user
  const directManager = useMemo(() => {
    if (user?.manager) return user.manager;
    if (user?.managerId) return userMap.get(user.managerId);
    return null;
  }, [user, userMap]);

  // Fixed Default Approvers list
  const defaultApprovers = useMemo(() => {
    if (!selectedType?.defaultApproverIds) return [];
    return selectedType.defaultApproverIds
      .map((id) => userMap.get(id))
      .filter((u): u is User => Boolean(u));
  }, [selectedType, userMap]);

  // Handle Dynamic Form Data Change
  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    if (formErrors[fieldKey]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      const res = await proposalUploadApi.uploadFiles(files);
      const uploaded = res.data.files.map((f) => ({
        name: f.originalName || f.name || 'File đính kèm',
        originalName: f.originalName,
        url: f.publicUrl || f.url || '',
        storagePath: f.storagePath,
        size: f.size,
        mimeType: f.mimeType,
      }));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      console.error('File upload error:', err);
      alert(err.response?.data?.message || 'Lỗi khi upload tệp đính kèm');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Tags Handler
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tToRemove: string) => {
    setTags(tags.filter((t) => t !== tToRemove));
  };

  // Optional Approver Selection Toggle
  const toggleOptionalApprover = (userId: string) => {
    const max = selectedType?.optionalApproverConfig?.maxSelectable || 3;
    setSelectedOptionalApproverIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= max) {
        alert(`Bạn chỉ được chọn tối đa ${max} người duyệt bổ sung.`);
        return prev;
      }
      return [...prev, userId];
    });
  };

  // Validate Step 2 (Form inputs)
  const validateFormStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Vui lòng nhập tiêu đề đề xuất';
    }

    // Validate dynamic fields if useCustomForm
    if (selectedType?.useCustomForm && formTemplate?.fields) {
      for (const field of formTemplate.fields) {
        if (field.isRequired) {
          const val = formData[field.fieldKey];
          if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
            errors[field.fieldKey] = `Trường "${field.fieldLabel}" là bắt buộc`;
          }
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGoToApprovers = () => {
    if (!validateFormStep()) return;
    setCurrentStep('APPROVERS');
  };

  const handleGoToReview = () => {
    setCurrentStep('REVIEW');
  };

  // Final Submit Handler
  const handleFinalSubmit = async (isSubmit: boolean) => {
    if (!selectedType) return;
    if (!validateFormStep()) {
      setCurrentStep('FORM');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: CreateProposalDto = {
      proposalTypeId: selectedType.id,
      title: title.trim(),
      content: content.trim() || undefined,
      formData: selectedType.useCustomForm ? formData : undefined,
      optionalApprovers: selectedOptionalApproverIds,
      directManagerId: directManager && selectedOptionalApproverIds.includes(directManager.id) ? directManager.id : undefined,
      priority,
      attachments,
      tags,
      isSubmit,
    };

    try {
      const res = await proposalApi.createProposal(payload);
      const createdProposal = res.data.proposal;
      // Navigate to proposals dashboard or detail
      navigate(`/proposals/${createdProposal.id}?created=true`);
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Lỗi khi gửi đề xuất');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentStep === 'REVIEW') setCurrentStep('APPROVERS');
              else if (currentStep === 'APPROVERS') setCurrentStep('FORM');
              else if (currentStep === 'FORM') setCurrentStep('TYPE');
              else navigate('/proposals');
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 'TYPE' ? 'Quay lại danh sách' : 'Bước trước'}
          </button>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {[
              { key: 'TYPE', label: '1. Chọn loại' },
              { key: 'FORM', label: '2. Nhập thông tin' },
              { key: 'APPROVERS', label: '3. Người duyệt' },
              { key: 'REVIEW', label: '4. Xem lại & Gửi' },
            ].map((stepItem, idx) => {
              const isCurrent = currentStep === stepItem.key;
              const isPassed =
                (stepItem.key === 'TYPE' && currentStep !== 'TYPE') ||
                (stepItem.key === 'FORM' && (currentStep === 'APPROVERS' || currentStep === 'REVIEW')) ||
                (stepItem.key === 'APPROVERS' && currentStep === 'REVIEW');

              return (
                <React.Fragment key={stepItem.key}>
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-700">•</span>}
                  <span
                    className={`${
                      isCurrent
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : isPassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {stepItem.label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── STEP 1: CHỌN LOẠI ĐỀ XUẤT ────────────────────────────────────── */}
        {currentStep === 'TYPE' && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Chọn Loại đề xuất cần tạo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lựa chọn đúng loại đề xuất để áp dụng đúng biểu mẫu và quy trình phê duyệt phù hợp
              </p>
            </div>

            {/* Search */}
            <div className="max-w-md mx-auto relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên hoặc mã loại đề xuất..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>

            {loadingTypes ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm">Đang tải danh mục loại đề xuất...</p>
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <Layers className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Chưa có loại đề xuất nào khả dụng
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Vui lòng liên hệ Quản trị viên hoặc tạo mới loại đề xuất trong mục Cài đặt.
                </p>
                <Link
                  to="/proposals/types"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Đến trang Cấu hình loại đề xuất &rarr;
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTypes.map((type) => {
                  const IconComp = (type.icon && ICON_MAP[type.icon]) || FileText;

                  return (
                    <div
                      key={type.id}
                      onClick={() => handleSelectType(type)}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: type.color || '#3b82f6' }}
                          >
                            <IconComp className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {type.code}
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1.5">
                          {type.name}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                          {type.description || 'Chưa có mô tả chi tiết'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {type.deadlineHours}h
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                          Chọn <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2: NHẬP THÔNG TIN ĐỀ XUẤT ─────────────────────────────── */}
        {currentStep === 'FORM' && selectedType && (
          <div className="space-y-6">
            {/* Selected Type Header Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: selectedType.color || '#3b82f6' }}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {selectedType.code}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedType.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Thời hạn xử lý: {selectedType.deadlineHours} giờ • Quy trình:{' '}
                    {APPROVAL_WORKFLOW_CONFIG[selectedType.approvalWorkflow]?.label}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep('TYPE')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Đổi loại đề xuất
              </button>
            </div>

            {/* Basic Info Box */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Thông tin chung đề xuất
              </h4>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tiêu đề đề xuất <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (formErrors.title) {
                      setFormErrors((prev) => ({ ...prev, title: '' }));
                    }
                  }}
                  placeholder="VD: Đề xuất xin nghỉ phép từ ngày 10/09 đến 12/09..."
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none transition-all ${
                    formErrors.title
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
                {formErrors.title && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.title}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mức độ ưu tiên
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as ProposalPriority[]).map((p) => {
                    const cfg = PROPOSAL_PRIORITY_CONFIG[p];
                    const isSelected = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          isSelected
                            ? `${cfg.bgColor} ${cfg.color} border-current ring-2 ring-indigo-500/20 shadow-sm`
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dynamic Form Template Renderer */}
            {selectedType.useCustomForm && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Biểu mẫu chi tiết ({formTemplate?.name || 'Form động'})
                  </h4>
                </div>

                {loadingTemplate ? (
                  <div className="py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Đang tải cấu trúc form nhập liệu...</span>
                  </div>
                ) : (
                  <DynamicProposalForm
                    formTemplate={formTemplate}
                    values={formData}
                    onChange={handleFieldChange}
                    errors={formErrors}
                    users={allUsers}
                  />
                )}
              </div>
            )}

            {/* Standard Content / Additional Notes */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                Nội dung đề xuất / Ghi chú bổ sung
              </h4>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung thuyết minh hoặc các lưu ý kèm theo cho người duyệt..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Attachments Upload */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-indigo-500" />
                  Tệp đính kèm ({attachments.length})
                </h4>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-semibold transition-colors">
                  <UploadCloud className="w-3.5 h-3.5" />
                  {uploadingFiles ? 'Đang tải lên...' : 'Thêm tệp'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                    className="hidden"
                  />
                </label>
              </div>

              {attachments.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400">
                    Kéo thả hoặc nhấn "Thêm tệp" để đính kèm hóa đơn, phiếu yêu cầu hoặc tài liệu minh chứng
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attachments.map((file, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                        {file.size && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(fIdx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags (Optional) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                Thẻ phân loại (Tags)
              </h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Nhập thẻ rồi nhấn Enter..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Thêm thẻ
                </button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium"
                    >
                      #{t}
                      <button type="button" onClick={() => handleRemoveTag(t)}>
                        <Trash2 className="w-3 h-3 text-indigo-400 hover:text-rose-500" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep('TYPE')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleGoToApprovers}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                Tiếp tục: Người duyệt &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: NGƯỜI PHÊ DUYỆT ──────────────────────────────────────── */}
        {currentStep === 'APPROVERS' && selectedType && (
          <div className="space-y-6">
            {/* Fixed Approvers List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Người phê duyệt cố định ({defaultApprovers.length})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Được cấu hình mặc định theo quy trình{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {APPROVAL_WORKFLOW_CONFIG[selectedType.approvalWorkflow]?.label}
                    </span>
                  </p>
                </div>
              </div>

              {defaultApprovers.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
                  Loại đề xuất này chưa cấu hình người duyệt cố định.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {defaultApprovers.map((approver, aIdx) => (
                    <div
                      key={approver.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                          {approver.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {approver.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400">{approver.email}</p>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        {selectedType.approvalWorkflow === 'SEQUENTIAL'
                          ? `Cấp duyệt ${aIdx + 1}`
                          : 'Đồng phê duyệt'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Approvers Selection (If allowed) */}
            {selectedType.isOptionalApprover && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-500" />
                      Chọn thêm người phê duyệt ({selectedOptionalApproverIds.length}/
                      {selectedType.optionalApproverConfig?.maxSelectable || 3})
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Bạn có thể chọn thêm người kiểm tra hoặc cấp quản lý liên quan
                    </p>
                  </div>
                </div>

                {/* Quick Select Direct Manager */}
                {selectedType.optionalApproverConfig?.allowDirectManager && directManager && (
                  <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        {directManager.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {directManager.fullName}
                          </p>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold">
                            Quản lý trực tiếp của bạn
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{directManager.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleOptionalApprover(directManager.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedOptionalApproverIds.includes(directManager.id)
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
                      }`}
                    >
                      {selectedOptionalApproverIds.includes(directManager.id) ? '✓ Đã chọn' : '+ Chọn duyệt'}
                    </button>
                  </div>
                )}

                {/* Other Users Directory List */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/40">
                  {allUsers
                    .filter((u) => u.id !== user?.id && !selectedType.defaultApproverIds?.includes(u.id))
                    .map((u) => {
                      const isSelected = selectedOptionalApproverIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleOptionalApprover(u.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {u.fullName}
                              </p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep('FORM')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleGoToReview}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                Tiếp tục: Xem lại & Gửi &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: XEM LẠI & GỬI PHÊ DUYỆT ─────────────────────────────── */}
        {currentStep === 'REVIEW' && selectedType && (
          <div className="space-y-6">
            {/* Overview Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: selectedType.color || '#3b82f6' }}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-slate-400">
                      Loại đề xuất: {selectedType.name} ({selectedType.code})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                      PROPOSAL_PRIORITY_CONFIG[priority].bgColor
                    } ${PROPOSAL_PRIORITY_CONFIG[priority].color}`}
                  >
                    Ưu tiên: {PROPOSAL_PRIORITY_CONFIG[priority].label}
                  </span>
                </div>
              </div>

              {/* General details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-950/40 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Người đề xuất:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {user?.fullName || user?.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Kiểu phê duyệt:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {APPROVAL_WORKFLOW_CONFIG[selectedType.approvalWorkflow]?.label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Thời hạn xử lý:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {selectedType.deadlineHours} giờ
                  </span>
                </div>
              </div>

              {/* Dynamic Form Summary Table */}
              {selectedType.useCustomForm && formTemplate && formTemplate.fields && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Dữ liệu theo biểu mẫu ({formTemplate.name}):
                  </h5>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {formTemplate.fields.map((f) => {
                      const val = formData[f.fieldKey];
                      return (
                        <div key={f.fieldKey} className="grid grid-cols-3 p-3 text-xs">
                          <span className="text-slate-500 font-medium">{f.fieldLabel}:</span>
                          <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200 break-words">
                            {val !== undefined && val !== null && val !== ''
                              ? typeof val === 'object'
                                ? JSON.stringify(val)
                                : String(val)
                              : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content description */}
              {content && (
                <div className="space-y-1 pt-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nội dung chi tiết:
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl whitespace-pre-line border border-slate-200 dark:border-slate-800">
                    {content}
                  </p>
                </div>
              )}

              {/* Approvers Sequence Preview */}
              <div className="space-y-2 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lộ trình phê duyệt dự kiến:
                </h5>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {user?.fullName} (Bạn)
                      </p>
                      <p className="text-[10px] text-slate-400">Khởi tạo đề xuất</p>
                    </div>
                  </div>

                  {/* Combined Approvers */}
                  {[...defaultApprovers, ...selectedOptionalApproverIds.map((id) => userMap.get(id)).filter(Boolean)].map(
                    (appr, idx) => (
                      <div key={appr!.id} className="flex items-center gap-3 pl-0.5">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                          {idx + 2}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {appr!.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {selectedType.approvalWorkflow === 'SEQUENTIAL'
                              ? `Cấp duyệt ${idx + 1}`
                              : 'Đồng phê duyệt'}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep('APPROVERS')}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Quay lại
              </button>

              <div className="flex items-center gap-3">
                {selectedType.allowDraft && (
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit(false)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-all"
                  >
                    <Save className="w-4 h-4 text-slate-500" />
                    Lưu bản nháp
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleFinalSubmit(true)}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Gửi phê duyệt ngay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ProposalCreate;
