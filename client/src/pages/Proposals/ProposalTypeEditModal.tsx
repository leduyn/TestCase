import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  FileText,
  Clock,
  Users,
  CheckCircle2,
  Workflow,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  ShoppingCart,
  Award,
  Briefcase,
  Laptop,
  Car,
  HeartPulse,
  Send,
  Sliders,
  Shield,
} from 'lucide-react';
import type {
  ProposalType,
  FormTemplate,
  CreateProposalTypeDto,
  ApprovalWorkflowType,
} from '../../types/proposal';
import type { User } from '../../types';
import { proposalTypeApi } from '../../services/proposalApi';
import { userApi } from '../../services/api';

interface ProposalTypeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalType: ProposalType | null;
  onSuccess: (savedType: ProposalType) => void;
  formTemplates: FormTemplate[];
  workflowProcesses?: Array<{ id: string; name: string }>;
}

const PRESET_ICONS = [
  { name: 'FileText', label: 'Tài liệu', icon: FileText },
  { name: 'Calendar', label: 'Nghỉ phép', icon: Calendar },
  { name: 'DollarSign', label: 'Tài chính', icon: DollarSign },
  { name: 'ShoppingCart', label: 'Mua sắm', icon: ShoppingCart },
  { name: 'Award', label: 'Khen thưởng', icon: Award },
  { name: 'Briefcase', label: 'Công tác', icon: Briefcase },
  { name: 'Laptop', label: 'Thiết bị IT', icon: Laptop },
  { name: 'Car', label: 'Phương tiện', icon: Car },
  { name: 'HeartPulse', label: 'Bảo hiểm', icon: HeartPulse },
  { name: 'Send', label: 'Đề nghị chung', icon: Send },
  { name: 'Layers', label: 'Quy trình', icon: Layers },
  { name: 'Shield', label: 'Bảo mật', icon: Shield },
];

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Emerald', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Violet', hex: '#8b5cf6', bg: 'bg-violet-500' },
  { name: 'Amber', hex: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Rose', hex: '#ef4444', bg: 'bg-rose-500' },
  { name: 'Cyan', hex: '#06b6d4', bg: 'bg-cyan-500' },
  { name: 'Indigo', hex: '#6366f1', bg: 'bg-indigo-500' },
  { name: 'Slate', hex: '#64748b', bg: 'bg-slate-500' },
];

export const ProposalTypeEditModal: React.FC<ProposalTypeEditModalProps> = ({
  isOpen,
  onClose,
  proposalType,
  onSuccess,
  formTemplates,
  workflowProcesses = [],
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'approval' | 'form' | 'settings'>('basic');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('FileText');
  const [color, setColor] = useState('#3b82f6');
  const [deadlineHours, setDeadlineHours] = useState(24);

  // Approval config
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflowType>('SEQUENTIAL');
  const [defaultApproverIds, setDefaultApproverIds] = useState<string[]>([]);
  const [isOptionalApprover, setIsOptionalApprover] = useState(false);
  const [maxSelectable, setMaxSelectable] = useState(2);
  const [allowDirectManager, setAllowDirectManager] = useState(true);

  // Form & Workflow Automation
  const [useCustomForm, setUseCustomForm] = useState(false);
  const [formTemplateId, setFormTemplateId] = useState<string>('');
  const [linkedProcessId, setLinkedProcessId] = useState<string>('');
  const [autoStartWorkflow, setAutoStartWorkflow] = useState(false);

  // Advanced settings
  const [allowDraft, setAllowDraft] = useState(true);
  const [allowCancel, setAllowCancel] = useState(true);
  const [allowEditAfterSubmit, setAllowEditAfterSubmit] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Fetch users for approver selection
  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      userApi
        .getUsers()
        .then((res) => setUsers(res.data))
        .catch((err) => console.error('Error fetching users:', err))
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen]);

  // Load existing proposal type data
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setActiveTab('basic');
      if (proposalType) {
        setName(proposalType.name);
        setCode(proposalType.code);
        setDescription(proposalType.description || '');
        setIcon(proposalType.icon || 'FileText');
        setColor(proposalType.color || '#3b82f6');
        setDeadlineHours(proposalType.deadlineHours || 24);

        setApprovalWorkflow(proposalType.approvalWorkflow || 'SEQUENTIAL');
        setDefaultApproverIds(proposalType.defaultApproverIds || []);
        setIsOptionalApprover(proposalType.isOptionalApprover || false);
        setMaxSelectable(proposalType.optionalApproverConfig?.maxSelectable || 2);
        setAllowDirectManager(proposalType.optionalApproverConfig?.allowDirectManager ?? true);

        setUseCustomForm(proposalType.useCustomForm || false);
        setFormTemplateId(proposalType.formTemplateId || '');
        setLinkedProcessId(proposalType.linkedProcessId || '');
        setAutoStartWorkflow(proposalType.autoStartWorkflow || false);

        setAllowDraft(proposalType.allowDraft ?? true);
        setAllowCancel(proposalType.allowCancel ?? true);
        setAllowEditAfterSubmit(proposalType.allowEditAfterSubmit ?? false);
        setIsActive(proposalType.isActive ?? true);
      } else {
        setName('');
        setCode('');
        setDescription('');
        setIcon('FileText');
        setColor('#3b82f6');
        setDeadlineHours(24);

        setApprovalWorkflow('SEQUENTIAL');
        setDefaultApproverIds([]);
        setIsOptionalApprover(false);
        setMaxSelectable(2);
        setAllowDirectManager(true);

        setUseCustomForm(false);
        setFormTemplateId('');
        setLinkedProcessId('');
        setAutoStartWorkflow(false);

        setAllowDraft(true);
        setAllowCancel(true);
        setAllowEditAfterSubmit(false);
        setIsActive(true);
      }
    }
  }, [isOpen, proposalType]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!proposalType && !code) {
      // Auto-suggest uppercase code slug
      const generatedCode = val
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setCode(generatedCode);
    }
  };

  const toggleApprover = (userId: string) => {
    setDefaultApproverIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Vui lòng nhập tên loại đề xuất');
      setActiveTab('basic');
      return;
    }

    if (!code.trim()) {
      setError('Vui lòng nhập mã loại đề xuất');
      setActiveTab('basic');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: CreateProposalTypeDto = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      icon,
      color,
      deadlineHours: Number(deadlineHours) || 24,
      approvalWorkflow,
      defaultApproverIds,
      isOptionalApprover,
      optionalApproverConfig: isOptionalApprover
        ? {
            maxSelectable: Number(maxSelectable) || 2,
            allowDirectManager,
          }
        : undefined,
      useCustomForm,
      formTemplateId: useCustomForm && formTemplateId ? formTemplateId : undefined,
      linkedProcessId: linkedProcessId || undefined,
      autoStartWorkflow,
      allowDraft,
      allowCancel,
      allowEditAfterSubmit,
      isActive,
    };

    try {
      if (proposalType) {
        const res = await proposalTypeApi.updateType(proposalType.id, payload);
        onSuccess(res.data.proposalType);
      } else {
        const res = await proposalTypeApi.createType(payload);
        onSuccess(res.data.proposalType);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving proposal type:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu loại đề xuất');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: color }}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {proposalType ? 'Chỉnh sửa loại đề xuất' : 'Tạo mới loại đề xuất'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thiết lập quy trình duyệt, mẫu form nhập liệu và tự động hóa
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

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'basic'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Thông tin chung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approval')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'approval'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Luồng phê duyệt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'form'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Workflow className="w-4 h-4" />
            Form mẫu & Quy trình
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Cài đặt
          </button>
        </div>

        {/* Tab Contents */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: THÔNG TIN CHUNG */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tên loại đề xuất <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="VD: Đề xuất nghỉ phép, Mua sắm trang thiết bị..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mã ký hiệu (Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: NGHI_PHEP"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mô tả loại đề xuất
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả phạm vi áp dụng, tiêu chí hoặc hướng dẫn tổng quát..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Icon & Color Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Biểu tượng đại diện
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_ICONS.map((item) => {
                      const IconItem = item.icon;
                      const isSelected = icon === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setIcon(item.name)}
                          title={item.label}
                          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          <IconItem className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Màu sắc nhận diện
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COLORS.map((c) => {
                      const isSelected = color === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setColor(c.hex)}
                          className={`h-10 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-indigo-500' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Thời hạn xử lý (Giờ)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={deadlineHours}
                    onChange={(e) => setDeadlineHours(Number(e.target.value))}
                    className="w-32 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2">
                    {[8, 24, 48, 72].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeadlineHours(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          deadlineHours === preset
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {preset}h
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Đề xuất sẽ tự động quá hạn hoặc gửi nhắc nhở nếu chưa được phê duyệt sau thời gian này.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: LUỒNG PHÊ DUYỆT */}
          {activeTab === 'approval' && (
            <div className="space-y-5">
              {/* Approval Workflow Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Kiểu luồng phê duyệt <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setApprovalWorkflow('SEQUENTIAL')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      approvalWorkflow === 'SEQUENTIAL'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Duyệt tuần tự</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                        Theo thứ tự
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Người duyệt tiếp theo chỉ duyệt sau khi cấp trước đã chấp thuận.
                    </p>
                  </div>

                  <div
                    onClick={() => setApprovalWorkflow('PARALLEL')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      approvalWorkflow === 'PARALLEL'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Duyệt song song</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                        Đồng thời
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tất cả người duyệt cùng nhận yêu cầu và tất cả đều phải chấp thuận.
                    </p>
                  </div>

                  <div
                    onClick={() => setApprovalWorkflow('ANY_ONE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      approvalWorkflow === 'ANY_ONE'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">1 người duyệt</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                        Bất kỳ ai
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Chỉ cần 1 trong các người duyệt chấp thuận là đề xuất hoàn tất.
                    </p>
                  </div>
                </div>
              </div>

              {/* Default Approvers Multi-Select */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Người phê duyệt cố định ({defaultApproverIds.length} người đã chọn)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {approvalWorkflow === 'SEQUENTIAL' ? 'Thứ tự click chọn sẽ là thứ tự duyệt' : 'Duyệt chung'}
                  </span>
                </div>

                {loadingUsers ? (
                  <div className="py-6 flex items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-xs">Đang tải danh sách nhân sự...</span>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/40 dark:bg-slate-950/40">
                    {users.map((u) => {
                      const isSelected = defaultApproverIds.includes(u.id);
                      const orderIndex = defaultApproverIds.indexOf(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleApprover(u.id)}
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

                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                                {approvalWorkflow === 'SEQUENTIAL' ? `Cấp ${orderIndex + 1}` : 'Đã chọn'}
                              </span>
                            )}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Optional Approvers Configuration */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Cho phép người tạo tự chọn thêm người duyệt
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Người gửi có thể bổ sung thêm người phê duyệt ngoài danh sách cố định khi gửi đề xuất
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOptionalApprover}
                      onChange={(e) => setIsOptionalApprover(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {isOptionalApprover && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Số lượng tối đa được chọn thêm
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={maxSelectable}
                        onChange={(e) => setMaxSelectable(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowDirectManager}
                          onChange={(e) => setAllowDirectManager(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          Cho phép chọn nhanh Quản lý trực tiếp
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FORM MẪU & WORKFLOW AUTOMATION */}
          {activeTab === 'form' && (
            <div className="space-y-5">
              {/* Form Template Selection */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Sử dụng Form mẫu nhập liệu động
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Khi bật, người tạo đề xuất sẽ điền thông tin vào các trường theo Form mẫu thay vì văn bản tự do
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomForm}
                      onChange={(e) => setUseCustomForm(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {useCustomForm && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Chọn Form mẫu liên kết <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formTemplateId}
                      onChange={(e) => setFormTemplateId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Chọn Form mẫu có sẵn --</option>
                      {formTemplates.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {ft.name} {ft.isDefault ? '(Mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Bạn có thể tạo hoặc sửa Form mẫu ở tab "Form mẫu động" ngoài màn hình quản lý.
                    </p>
                  </div>
                )}
              </div>

              {/* Workflow Process Linkage & Automation */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                  <Workflow className="w-4 h-4" />
                  Tự động hóa sang Module Quy trình (Workflow)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Khi đề xuất được duyệt đầy đủ, hệ thống có thể tự động tạo một Nhiệm vụ (Task) trong Quy trình công việc tương ứng.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Liên kết với Quy trình công việc
                  </label>
                  <select
                    value={linkedProcessId}
                    onChange={(e) => setLinkedProcessId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Không liên kết quy trình --</option>
                    {workflowProcesses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {linkedProcessId && (
                  <div className="flex items-center gap-2 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoStartWorkflow}
                        onChange={(e) => setAutoStartWorkflow(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Tự động khởi chạy nhiệm vụ ngay khi đề xuất đạt trạng thái ĐÃ PHÊ DUYỆT (APPROVED)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CÀI ĐẶT NÂNG CAO */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Cho phép lưu bản nháp (Draft)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Người tạo có thể lưu đề xuất tạm thời trước khi gửi chính thức
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowDraft}
                    onChange={(e) => setAllowDraft(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <div className="border-t border-slate-200 dark:border-slate-800" />

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Cho phép người tạo hủy đề xuất
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Người gửi có thể chủ động hủy khi đề xuất đang ở trạng thái chờ duyệt
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowCancel}
                    onChange={(e) => setAllowCancel(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <div className="border-t border-slate-200 dark:border-slate-800" />

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Cho phép chỉnh sửa sau khi gửi duyệt
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Người tạo có thể cập nhật nội dung đề xuất mà không cần gửi lại từ đầu
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowEditAfterSubmit}
                    onChange={(e) => setAllowEditAfterSubmit(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <div className="border-t border-slate-200 dark:border-slate-800" />

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Kích hoạt loại đề xuất (Active)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Nếu tắt, loại đề xuất này sẽ ẩn khỏi danh mục tạo mới của người dùng
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </div>
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
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {proposalType ? 'Cập nhật loại đề xuất' : 'Tạo loại đề xuất'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
