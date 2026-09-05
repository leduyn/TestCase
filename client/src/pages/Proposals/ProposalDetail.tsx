import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  Send,
  Workflow,
  Download,
  ExternalLink,
  History,
  MessageSquare,
  Paperclip,
  Loader2,
  Trash2,
  Layers,
  Calendar,
  DollarSign,
  ShoppingCart,
  Award,
  Briefcase,
  Laptop,
  Car,
  HeartPulse,
  Shield,
  RotateCw,
  Bell,
  BellOff,
} from 'lucide-react';
import type { Proposal } from '../../types/proposal';
import {
  PROPOSAL_STATUS_CONFIG,
  PROPOSAL_PRIORITY_CONFIG,
  PROPOSAL_HISTORY_LABELS,
} from '../../types/proposal';
import { proposalApi, proposalUploadApi } from '../../services/proposalApi';
import { useAuth } from '../../context/AuthContext';
import { ApprovalTimeline } from '../../components/Proposals/ApprovalTimeline';
import { ApprovalActionModal } from '../../components/Proposals/ApprovalActionModal';
import { ProposalCommentsSection } from '../../components/Proposals/ProposalCommentsSection';
import { DynamicProposalForm } from '../../components/Proposals/DynamicProposalForm';
import { ProposalFollowersCard } from '../../components/Proposals/ProposalFollowersCard';
import { onProposalUpdated, emitProposalUpdated } from '../../utils/proposalEvents';

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

export const ProposalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Approval Modal State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionDecision, setActionDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');

  // Active Tab for Left Column (Comments vs History)
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');

  // Fetch Proposal Details
  const fetchProposal = useCallback(async (isSilent = false) => {
    if (!id) return;
    if (!isSilent) setRefreshing(true);
    try {
      const res = await proposalApi.getProposalById(id);
      setProposal(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching proposal detail:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || 'Không thể tải chi tiết đề xuất');
      }
    } finally {
      setLoading(false);
      if (!isSilent) setRefreshing(false);
    }
  }, [id]);

  // Initial fetch and on route / location.state change
  useEffect(() => {
    fetchProposal(false);
  }, [fetchProposal, location.key, location.state]);

  // Subscribe to real-time events (same-tab and cross-tab)
  useEffect(() => {
    const unsubscribe = onProposalUpdated((targetProposalId) => {
      if (!targetProposalId || targetProposalId === id) {
        fetchProposal(true);
      }
    });
    return unsubscribe;
  }, [fetchProposal, id]);

  // Re-fetch when user switches back to this tab/window
  useEffect(() => {
    const handleFocus = () => {
      fetchProposal(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProposal(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProposal]);

  // Auto-polling every 10s while proposal is waiting for approval
  useEffect(() => {
    if (!proposal || !['PENDING', 'IN_REVIEW'].includes(proposal.status)) {
      return;
    }
    const timer = setInterval(() => {
      fetchProposal(true);
    }, 10000);

    return () => clearInterval(timer);
  }, [proposal?.status, fetchProposal]);

  // Handle Approve / Reject via Modal
  const handleConfirmDecision = async (comment: string, attachments?: any[]) => {
    if (!id) return;
    if (actionDecision === 'APPROVED') {
      await proposalApi.approveProposal(id, { comment, attachments });
    } else {
      await proposalApi.rejectProposal(id, { comment, attachments });
    }
    await fetchProposal(false);
    emitProposalUpdated(id);
  };

  // Handle Submit Proposal (From DRAFT)
  const handleSubmitProposal = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await proposalApi.submitProposal(id);
      await fetchProposal(false);
      emitProposalUpdated(id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi duyệt đề xuất');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Proposal
  const handleCancelProposal = async () => {
    if (!id) return;
    const reason = prompt('Vui lòng nhập lý do bạn muốn hủy đề xuất này:');
    if (reason === null) return;

    setActionLoading(true);
    try {
      await proposalApi.cancelProposal(id, reason.trim() || undefined);
      await fetchProposal(false);
      emitProposalUpdated(id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy đề xuất');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Draft
  const handleDeleteDraft = async () => {
    if (!id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản nháp đề xuất này không?')) return;
    setActionLoading(true);
    try {
      await proposalApi.deleteProposal(id);
      emitProposalUpdated(id);
      navigate('/proposals');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa bản nháp');
      setActionLoading(false);
    }
  };

  // Handle Start Workflow manually
  const handleStartWorkflow = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await proposalApi.startWorkflow(id);
      alert('Đã khởi chạy quy trình công việc thành công!');
      await fetchProposal(false);
      emitProposalUpdated(id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi khởi chạy quy trình');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Toggle Follow / Unfollow from Topbar
  const [followLoading, setFollowLoading] = useState(false);
  const handleToggleQuickFollow = async () => {
    if (!proposal || !user || followLoading) return;
    setFollowLoading(true);
    try {
      if (proposal.isFollower) {
        await proposalApi.removeFollower(proposal.id, user.id);
      } else {
        await proposalApi.addFollowers(proposal.id, [user.id]);
      }
      await fetchProposal(true);
      emitProposalUpdated(proposal.id);
    } catch (err: any) {
      console.error('Error toggling quick follow:', err);
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái theo dõi');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Đang tải thông tin chi tiết đề xuất...</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-900 dark:text-white">Không tìm thấy đề xuất</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'Đề xuất này có thể đã bị xóa hoặc bạn không có quyền xem'}</p>
          <button
            onClick={() => navigate('/proposals')}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Quay lại danh sách đề xuất
          </button>
        </div>
      </div>
    );
  }

  const isCreator = user?.id === proposal.creatorId;
  const canApprove = proposal.currentUserApproval?.canApprove;
  const statusCfg = PROPOSAL_STATUS_CONFIG[proposal.status];
  const priorityCfg = PROPOSAL_PRIORITY_CONFIG[proposal.priority];
  const IconComp = (proposal.proposalType?.icon && ICON_MAP[proposal.proposalType.icon]) || FileText;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Actions Topbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/proposals')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách đề xuất
          </button>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Creator Actions: Submit Draft or Delete Draft */}
            {isCreator && proposal.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  onClick={handleSubmitProposal}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Gửi duyệt ngay
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDraft}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa nháp
                </button>
              </>
            )}

            {/* Approver Decision Actions */}
            {canApprove && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActionDecision('APPROVED');
                    setIsActionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Phê duyệt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionDecision('REJECTED');
                    setIsActionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  Từ chối
                </button>
              </>
            )}

            {/* Creator Cancel Proposal */}
            {isCreator &&
              proposal.proposalType?.allowCancel &&
              ['PENDING', 'IN_REVIEW'].includes(proposal.status) && (
                <button
                  type="button"
                  onClick={handleCancelProposal}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors"
                >
                  Hủy đề xuất
                </button>
              )}

            {/* Workflow Automation Button */}
            {proposal.status === 'APPROVED' && proposal.proposalType?.linkedProcessId && (
              <>
                {proposal.linkedTaskId ? (
                  <Link
                    to={`/workflow/tasks/${proposal.linkedTaskId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
                  >
                    <Workflow className="w-4 h-4" />
                    Xem nhiệm vụ quy trình &rarr;
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartWorkflow}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md transition-all"
                  >
                    <Workflow className="w-4 h-4" />
                    Khởi chạy quy trình
                  </button>
                )}
              </>
            )}

            {/* Quick Follow / Unfollow Button */}
            {user && (
              <button
                type="button"
                onClick={handleToggleQuickFollow}
                disabled={followLoading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
                  proposal.isFollower
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300'
                }`}
                title={proposal.isFollower ? 'Nhấn để hủy theo dõi đề xuất này' : 'Nhấn để theo dõi và nhận thông báo đề xuất này'}
              >
                {followLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : proposal.isFollower ? (
                  <Bell className="w-3.5 h-3.5 fill-current text-amber-500 dark:text-amber-400" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{proposal.isFollower ? 'Đang theo dõi' : 'Theo dõi'}</span>
              </button>
            )}

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => fetchProposal(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
              title="Làm mới thông tin đề xuất"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${refreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span>{refreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* Hero Proposal Title Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
              style={{ backgroundColor: proposal.proposalType?.color || '#3b82f6' }}
            >
              <IconComp className="w-6 h-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {proposal.proposalType?.code || 'PROPOSAL'}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {proposal.proposalType?.name}
                </span>
              </div>

              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                {proposal.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                <span>
                  Khởi tạo bởi{' '}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {proposal.creator?.fullName}
                  </strong>
                </span>
                <span>•</span>
                <span>{new Date(proposal.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          </div>

          {/* Badges Column */}
          <div className="flex md:flex-col items-end gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusCfg.bgColor} ${statusCfg.color} ${statusCfg.borderColor}`}
            >
              {statusCfg.label}
            </span>

            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg ${priorityCfg.bgColor} ${priorityCfg.color}`}
            >
              Ưu tiên: {priorityCfg.label}
            </span>
          </div>
        </div>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Data, Content, Attachments & Tabs (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Dynamic Form Data Renderer */}
            {proposal.formData && Object.keys(proposal.formData).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Dữ liệu theo biểu mẫu ({proposal.proposalType?.formTemplate?.name || 'Biểu mẫu'})
                </h4>

                <DynamicProposalForm
                  formTemplate={proposal.proposalType?.formTemplate}
                  values={proposal.formData}
                  onChange={() => {}}
                  readOnly={true}
                />
              </div>
            )}

            {/* Additional Content Note */}
            {proposal.content && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Nội dung thuyết minh / Ghi chú
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {proposal.content}
                </p>
              </div>
            )}

            {/* Attachments Section */}
            {proposal.attachments && proposal.attachments.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-500" />
                  Tệp đính kèm ({proposal.attachments.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {proposal.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={
                        file.storagePath
                          ? proposalUploadApi.getFileViewUrl(file.storagePath)
                          : file.url || '#'
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-900 transition-all text-xs group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 flex-shrink-0">
                        <Download className="w-3.5 h-3.5" />
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tabbed Section: Comments & History */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'comments'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Bình luận & Trao đổi ({proposal.comments?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'history'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Nhật ký lịch sử ({proposal.histories?.length || 0})
                </button>
              </div>

              {activeTab === 'comments' ? (
                <ProposalCommentsSection
                  proposalId={proposal.id}
                  comments={proposal.comments || []}
                  onCommentAdded={fetchProposal}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Lịch sử thay đổi đề xuất
                  </h4>
                  {proposal.histories && proposal.histories.length > 0 ? (
                    <div className="space-y-3 relative pl-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {proposal.histories.map((h) => (
                        <div key={h.id} className="relative text-xs">
                          <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                          <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                            <span>
                              {PROPOSAL_HISTORY_LABELS[h.changeType] || h.changeType}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(h.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {h.changeDescription || 'Không có mô tả chi tiết'}
                          </p>
                          {h.changedBy && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Bởi: {h.changedBy.fullName} ({h.changedBy.email})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">Chưa có bản ghi lịch sử nào</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Approval Progress & Metadata Widgets (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Approval Steps Timeline Widget */}
            <ApprovalTimeline proposal={proposal} currentUserId={user?.id} />

            {/* Creator Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Thông tin người đề xuất
              </h4>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {proposal.creator?.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                    {proposal.creator?.fullName}
                  </h5>
                  <p className="text-xs text-slate-400">{proposal.creator?.email}</p>
                  {proposal.creator?.department && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      Phòng ban: {proposal.creator.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Proposal Followers Card */}
            <ProposalFollowersCard
              proposalId={proposal.id}
              creatorId={proposal.creatorId}
              followers={proposal.followers || []}
              isFollower={proposal.isFollower}
              onFollowersChanged={() => fetchProposal(true)}
            />

            {/* Deadline & Response Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Thời hạn & Tiến độ
              </h4>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Thời hạn quy định:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {proposal.proposalType?.deadlineHours || 24} giờ
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Gửi lúc:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {proposal.submittedAt
                    ? new Date(proposal.submittedAt).toLocaleString('vi-VN')
                    : 'Chưa gửi'}
                </span>
              </div>
              {proposal.deadline && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Hạn xử lý:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(proposal.deadline).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
            </div>

            {/* Linked Workflow Process / Task Card */}
            {proposal.proposalType?.linkedProcess && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <Workflow className="w-4 h-4" />
                  Quy trình công việc liên kết
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  {proposal.proposalType.linkedProcess.name}
                </p>

                {proposal.linkedTask && (
                  <div className="pt-2">
                    <Link
                      to={`/workflow/tasks/${proposal.linkedTask.id}`}
                      className="block p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold text-center hover:bg-indigo-100"
                    >
                      Nhiệm vụ: {proposal.linkedTask.name} &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Action Modal (Approve / Reject) */}
      {isActionModalOpen && (
        <ApprovalActionModal
          isOpen={isActionModalOpen}
          onClose={() => setIsActionModalOpen(false)}
          proposalTitle={proposal.title}
          actionType={actionDecision}
          onConfirm={handleConfirmDecision}
        />
      )}
    </div>
  );
};
export default ProposalDetail;
