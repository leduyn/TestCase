import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Workflow,
  ToggleLeft,
  ToggleRight,
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
  Shield,
  ListOrdered,
} from 'lucide-react';
import type { ProposalType, FormTemplate } from '../../types/proposal';
import { proposalTypeApi, formTemplateApi } from '../../services/proposalApi';
import { processApi } from '../../services/workflowApi';
import { ProposalTypeEditModal } from './ProposalTypeEditModal';
import { FormTemplateEditModal } from './FormTemplateEditModal';

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

export const ProposalTypesManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'types' | 'templates'>('types');

  // Proposal Types state
  const [proposalTypes, setProposalTypes] = useState<ProposalType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Form Templates state
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Workflow Processes for linking
  const [workflowProcesses, setWorkflowProcesses] = useState<Array<{ id: string; name: string }>>([]);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ProposalType | null>(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);

  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showBanner = (text: string, type: 'success' | 'error' = 'success') => {
    setBannerMessage({ text, type });
    setTimeout(() => {
      setBannerMessage(null);
    }, 4000);
  };

  // Fetch Proposal Types
  const fetchProposalTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await proposalTypeApi.getTypes();
      setProposalTypes(res.data.types || []);
    } catch (err) {
      console.error('Error fetching proposal types:', err);
      showBanner('Lỗi khi tải danh sách loại đề xuất', 'error');
    } finally {
      setLoadingTypes(false);
    }
  };

  // Fetch Form Templates
  const fetchFormTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await formTemplateApi.getTemplates();
      setFormTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Error fetching form templates:', err);
      showBanner('Lỗi khi tải danh sách Form mẫu', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Fetch Workflow Processes
  const fetchProcesses = async () => {
    try {
      const res = await processApi.getProcesses({ limit: 100 });
      setWorkflowProcesses(
        (res.data.items || []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }))
      );
    } catch (err) {
      console.error('Error fetching processes:', err);
    }
  };

  useEffect(() => {
    fetchProposalTypes();
    fetchFormTemplates();
    fetchProcesses();
  }, []);

  // Filtered Proposal Types
  const filteredTypes = useMemo(() => {
    return proposalTypes.filter((pt) => {
      const matchSearch =
        pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pt.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pt.description && pt.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? pt.isActive
          : !pt.isActive;

      return matchSearch && matchStatus;
    });
  }, [proposalTypes, searchTerm, statusFilter]);

  // Filtered Form Templates
  const filteredTemplates = useMemo(() => {
    return formTemplates.filter((ft) => {
      return (
        ft.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ft.description && ft.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [formTemplates, searchTerm]);

  // Proposal Type Actions
  const handleToggleActiveType = async (type: ProposalType) => {
    try {
      const res = await proposalTypeApi.toggleActive(type.id);
      setProposalTypes((prev) =>
        prev.map((item) => (item.id === type.id ? res.data.proposalType : item))
      );
      showBanner(res.data.message || 'Cập nhật trạng thái thành công');
    } catch (err: any) {
      console.error('Error toggling proposal type active status:', err);
      showBanner(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  const handleDeleteType = async (type: ProposalType) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa loại đề xuất "${type.name}" (${type.code})?`)) {
      return;
    }

    try {
      await proposalTypeApi.deleteType(type.id);
      setProposalTypes((prev) => prev.filter((item) => item.id !== type.id));
      showBanner('Đã xóa loại đề xuất thành công');
    } catch (err: any) {
      console.error('Error deleting proposal type:', err);
      showBanner(err.response?.data?.message || 'Lỗi khi xóa loại đề xuất', 'error');
    }
  };

  // Form Template Actions
  const handleDeleteTemplate = async (template: FormTemplate) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa Form mẫu "${template.name}"?`)) {
      return;
    }

    try {
      await formTemplateApi.deleteTemplate(template.id);
      setFormTemplates((prev) => prev.filter((item) => item.id !== template.id));
      showBanner('Đã xóa Form mẫu thành công');
    } catch (err: any) {
      console.error('Error deleting form template:', err);
      showBanner(err.response?.data?.message || 'Lỗi khi xóa Form mẫu', 'error');
    }
  };

  const handleDuplicateTemplate = async (template: FormTemplate) => {
    try {
      const res = await formTemplateApi.duplicateTemplate(template.id, `${template.name} (Bản sao)`);
      setFormTemplates((prev) => [res.data.template, ...prev]);
      showBanner('Đã nhân bản Form mẫu thành công');
    } catch (err: any) {
      console.error('Error duplicating form template:', err);
      showBanner(err.response?.data?.message || 'Lỗi khi nhân bản Form mẫu', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-8">
      {/* Toast Notification Banner */}
      {bannerMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-200 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {bannerMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{bannerMessage.text}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Cấu hình Loại đề xuất & Form mẫu
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quản lý danh mục loại đề xuất, luồng phê duyệt tuần tự/song song và các mẫu form động thu thập thông tin
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'types' ? (
              <button
                onClick={() => {
                  setEditingType(null);
                  setIsTypeModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Thêm loại đề xuất
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setIsTemplateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Tạo Form mẫu mới
              </button>
            )}
          </div>
        </div>

        {/* Tab switcher and Search / Filter Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('types')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'types'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              Loại đề xuất ({proposalTypes.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'templates'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Form mẫu động ({formTemplates.length})
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'types' ? 'Tìm theo tên, mã...' : 'Tìm theo tên form...'}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {activeTab === 'types' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Đã tạm dừng</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB 1: DANH SÁCH LOẠI ĐỀ XUẤT */}
        {activeTab === 'types' && (
          <div>
            {loadingTypes ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm">Đang tải danh sách loại đề xuất...</p>
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Chưa tìm thấy loại đề xuất phù hợp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                  Bạn có thể thay đổi bộ lọc tìm kiếm hoặc tạo mới một loại đề xuất để người dùng bắt đầu gửi yêu cầu phê duyệt.
                </p>
                <button
                  onClick={() => {
                    setEditingType(null);
                    setIsTypeModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md hover:bg-indigo-700 transition-colors"
                >
                  + Thêm loại đề xuất ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTypes.map((type) => {
                  const IconComponent = (type.icon && ICON_MAP[type.icon]) || FileText;

                  return (
                    <div
                      key={type.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between group ${
                        type.isActive
                          ? 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                          : 'border-slate-200 dark:border-slate-800/60 opacity-60 bg-slate-50/50 dark:bg-slate-950/30'
                      }`}
                    >
                      {/* Top bar: Icon, Code, Toggle */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                              style={{ backgroundColor: type.color || '#3b82f6' }}
                            >
                              <IconComponent className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {type.code}
                              </span>
                              <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">
                                {type.name}
                              </h3>
                            </div>
                          </div>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleActiveType(type)}
                            title={type.isActive ? 'Đang hoạt động (Click để tắt)' : 'Đã tắt (Click để bật)'}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            {type.isActive ? (
                              <ToggleRight className="w-6 h-6 text-indigo-600" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-slate-400" />
                            )}
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                          {type.description || 'Không có mô tả chi tiết'}
                        </p>

                        {/* Metadata badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          {/* Approval workflow badge */}
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold ${
                              type.approvalWorkflow === 'SEQUENTIAL'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : type.approvalWorkflow === 'PARALLEL'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <ListOrdered className="w-3.5 h-3.5" />
                            {type.approvalWorkflow === 'SEQUENTIAL'
                              ? 'Duyệt tuần tự'
                              : type.approvalWorkflow === 'PARALLEL'
                              ? 'Duyệt song song'
                              : '1 người duyệt'}
                          </span>

                          {/* Deadline badge */}
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            {type.deadlineHours}h
                          </span>

                          {/* Form template badge */}
                          {type.useCustomForm && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400">
                              <FileText className="w-3.5 h-3.5" />
                              Form động
                            </span>
                          )}

                          {/* Linked process badge */}
                          {type.linkedProcessId && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                              <Workflow className="w-3.5 h-3.5" />
                              {type.autoStartWorkflow ? 'Tự khởi chạy Task' : 'Quy trình'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Approvers Count & Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>{type.defaultApproverIds?.length || 0} người duyệt cố định</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingType(type);
                              setIsTypeModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteType(type)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Xóa loại đề xuất"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUẢN LÝ FORM MẪU ĐỘNG */}
        {activeTab === 'templates' && (
          <div>
            {loadingTemplates ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm">Đang tải danh sách Form mẫu...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Chưa có Form mẫu nào
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                  Tạo Form mẫu để định nghĩa các trường nhập liệu chuyên biệt cho từng loại đề xuất như nghỉ phép, mua sắm, thanh toán...
                </p>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setIsTemplateModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md hover:bg-indigo-700 transition-colors"
                >
                  + Tạo Form mẫu đầu tiên
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                              {template.name}
                            </h3>
                            {template.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold">
                                Mặc định
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                        {template.description || 'Không có mô tả cho Form mẫu này'}
                      </p>

                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {template._count?.fields || 0} trường dữ liệu
                        </span>
                        {template._count?.selectedByProposalTypes ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                            {template._count.selectedByProposalTypes} loại đề xuất sử dụng
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span className="text-[11px] text-slate-400">
                        {new Date(template.createdAt).toLocaleDateString('vi-VN')}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateTemplate(template)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Nhân bản mẫu"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsTemplateModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Chỉnh sửa form & cấu hình trường"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(template)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Xóa Form mẫu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Proposal Type Edit Modal */}
      {isTypeModalOpen && (
        <ProposalTypeEditModal
          isOpen={isTypeModalOpen}
          onClose={() => setIsTypeModalOpen(false)}
          proposalType={editingType}
          onSuccess={() => {
            fetchProposalTypes();
            showBanner(editingType ? 'Cập nhật loại đề xuất thành công' : 'Tạo mới loại đề xuất thành công');
          }}
          formTemplates={formTemplates}
          workflowProcesses={workflowProcesses}
        />
      )}

      {/* Form Template Edit Modal */}
      {isTemplateModalOpen && (
        <FormTemplateEditModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          template={editingTemplate}
          onSuccess={() => {
            fetchFormTemplates();
            showBanner(editingTemplate ? 'Cập nhật Form mẫu thành công' : 'Tạo mới Form mẫu thành công');
          }}
          proposalTypes={proposalTypes}
        />
      )}
    </div>
  );
};
export default ProposalTypesManagement;
