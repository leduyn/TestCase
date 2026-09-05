import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronRight,
  FileText,
  Loader2,
  Layers,
  RotateCw,
  Users,
} from 'lucide-react';
import type { Proposal, ProposalType } from '../../types/proposal';
import {
  PROPOSAL_STATUS_CONFIG,
  PROPOSAL_PRIORITY_CONFIG,
} from '../../types/proposal';
import { proposalApi, myProposalApi, proposalTypeApi } from '../../services/proposalApi';
import { useAuth } from '../../context/AuthContext';
import { ApprovalActionModal } from '../../components/Proposals/ApprovalActionModal';
import { onProposalUpdated, emitProposalUpdated } from '../../utils/proposalEvents';

type TabType = 'PENDING_ME' | 'MY_PROPOSALS' | 'MY_APPROVED' | 'MY_FOLLOWING' | 'ALL';

export const ProposalHub: React.FC = () => {
  const { user } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('PENDING_ME');

  // Proposals data & loading
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Proposal Types list for filtering
  const [proposalTypes, setProposalTypes] = useState<ProposalType[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');

  // KPI Counters
  const [kpiCounts, setKpiCounts] = useState({
    pendingMe: 0,
    myTotal: 0,
    myApproved: 0,
    myRejected: 0,
    myFollowing: 0,
  });

  // Quick Action Modal state
  const [quickActionProposal, setQuickActionProposal] = useState<Proposal | null>(null);
  const [quickActionType, setQuickActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');

  // Load KPI counts
  const fetchKpis = useCallback(async () => {
    try {
      const [pendingRes, myRes, approvedRes, rejectedRes, followingRes] = await Promise.all([
        myProposalApi.getMyPendingApprovals({ limit: 1 }),
        myProposalApi.getMyProposals({ limit: 1 }),
        myProposalApi.getMyApproved({ limit: 1 }),
        myProposalApi.getMyRejected({ limit: 1 }),
        myProposalApi.getMyFollowing({ limit: 1 }),
      ]);

      setKpiCounts({
        pendingMe: pendingRes.data.total || 0,
        myTotal: myRes.data.total || 0,
        myApproved: approvedRes.data.total || 0,
        myRejected: rejectedRes.data.total || 0,
        myFollowing: followingRes.data.total || 0,
      });
    } catch (err) {
      console.error('Error fetching KPI counts:', err);
    }
  }, []);

  // Fetch Proposals based on active tab and filters
  const fetchProposals = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      try {
        let res;
        const baseParams = {
          search: search.trim() || undefined,
          proposalTypeId: selectedTypeId || undefined,
          priority: selectedPriority as any,
          page,
          limit,
        };

        if (activeTab === 'PENDING_ME') {
          res = await myProposalApi.getMyPendingApprovals(baseParams);
        } else if (activeTab === 'MY_PROPOSALS') {
          res = await myProposalApi.getMyProposals({
            ...baseParams,
            status: selectedStatus as any,
          });
        } else if (activeTab === 'MY_APPROVED') {
          res = await myProposalApi.getMyApproved(baseParams);
        } else if (activeTab === 'MY_FOLLOWING') {
          res = await myProposalApi.getMyFollowing({
            ...baseParams,
            status: selectedStatus as any,
          });
        } else {
          // ALL
          res = await proposalApi.getProposals({
            ...baseParams,
            status: selectedStatus as any,
          });
        }

        setProposals(res.data.proposals || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        console.error('Error fetching proposals:', err);
      } finally {
        if (!isSilent) setLoading(false);
        else setRefreshing(false);
      }
    },
    [activeTab, search, selectedTypeId, selectedStatus, selectedPriority, page, limit]
  );

  const refreshAll = useCallback(
    async (isSilent = false) => {
      await Promise.all([fetchProposals(isSilent), fetchKpis()]);
    },
    [fetchProposals, fetchKpis]
  );

  // Fetch Proposal Types for dropdown
  useEffect(() => {
    proposalTypeApi
      .getTypes({ isActive: true })
      .then((res) => setProposalTypes(res.data.types || []))
      .catch((err) => console.error('Error fetching types:', err));

    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    fetchProposals(false);
  }, [fetchProposals]);

  // Subscribe to real-time sync events across tabs and within tab
  useEffect(() => {
    const unsubscribe = onProposalUpdated(() => {
      refreshAll(true);
    });
    return unsubscribe;
  }, [refreshAll]);

  // Refetch when focusing the window or tab becomes visible
  useEffect(() => {
    const handleFocus = () => {
      refreshAll(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAll(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAll]);

  // Handle Quick Decision Confirmation
  const handleConfirmDecision = async (comment: string, attachments?: any[]) => {
    if (!quickActionProposal) return;
    const targetId = quickActionProposal.id;
    try {
      if (quickActionType === 'APPROVED') {
        await proposalApi.approveProposal(targetId, { comment, attachments });
      } else {
        await proposalApi.rejectProposal(targetId, { comment, attachments });
      }
      setQuickActionProposal(null);
      await refreshAll(false);
      emitProposalUpdated(targetId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xử lý đề xuất');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Trung tâm Đề xuất & Phê duyệt
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quản lý các yêu cầu phê duyệt, theo dõi tiến trình duyệt đa cấp và tự động hóa quy trình
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshAll(false)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
              title="Làm mới danh sách và thống kê"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${refreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
              <Link
                to="/proposals/types"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                Cấu hình loại đề xuất
              </Link>
            )}

            <Link
              to="/proposals/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Tạo đề xuất mới
            </Link>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Pending My Approval */}
          <div
            onClick={() => {
              setActiveTab('PENDING_ME');
              setPage(1);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'PENDING_ME'
                ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Chờ tôi phê duyệt
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {kpiCounts.pendingMe}
              </span>
              {kpiCounts.pendingMe > 0 && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Cần xử lý
                </span>
              )}
            </div>
          </div>

          {/* Card 2: My Proposals */}
          <div
            onClick={() => {
              setActiveTab('MY_PROPOSALS');
              setPage(1);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'MY_PROPOSALS'
                ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-400/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Đề xuất tôi đã gửi
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {kpiCounts.myTotal}
              </span>
              <span className="text-[11px] text-slate-400">Tổng đề xuất</span>
            </div>
          </div>

          {/* Card 3: Approved */}
          <div
            onClick={() => {
              setActiveTab('MY_APPROVED');
              setPage(1);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'MY_APPROVED'
                ? 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tôi đã chấp thuận
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {kpiCounts.myApproved}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Đã phê duyệt
              </span>
            </div>
          </div>

          {/* Card 4: Rejected / Refused */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tôi đã từ chối
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {kpiCounts.myRejected}
              </span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                Không chấp thuận
              </span>
            </div>
          </div>

          {/* Card 5: My Following */}
          <div
            onClick={() => {
              setActiveTab('MY_FOLLOWING');
              setPage(1);
            }}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'MY_FOLLOWING'
                ? 'border-purple-400 dark:border-purple-600 ring-2 ring-purple-400/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Đang theo dõi
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {kpiCounts.myFollowing}
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                Theo dõi
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Search / Filter Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('PENDING_ME');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'PENDING_ME'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Cần tôi duyệt
                {kpiCounts.pendingMe > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-black">
                    {kpiCounts.pendingMe}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('MY_PROPOSALS');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'MY_PROPOSALS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Đề xuất tôi đã gửi
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('MY_APPROVED');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'MY_APPROVED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tôi đã duyệt
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('MY_FOLLOWING');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'MY_FOLLOWING'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Đang theo dõi
                {kpiCounts.myFollowing > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-purple-700 font-black">
                    {kpiCounts.myFollowing}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Tất cả đề xuất
              </button>
            </div>

            {/* Total proposals info */}
            <span className="text-xs text-slate-400 flex-shrink-0">
              Tổng cộng: <strong className="text-slate-700 dark:text-slate-300">{total}</strong> đề xuất
            </span>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tiêu đề, người tạo..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={selectedTypeId}
              onChange={(e) => {
                setSelectedTypeId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">-- Tất cả loại đề xuất --</option>
              {proposalTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">-- Mức ưu tiên --</option>
              <option value="LOW">Thấp</option>
              <option value="NORMAL">Bình thường</option>
              <option value="HIGH">Cao</option>
              <option value="URGENT">Khẩn cấp</option>
            </select>

            {/* Status Filter (Active for MY_PROPOSALS, MY_FOLLOWING & ALL) */}
            {(activeTab === 'MY_PROPOSALS' || activeTab === 'MY_FOLLOWING' || activeTab === 'ALL') && (
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="PENDING">Chờ phê duyệt</option>
                <option value="IN_REVIEW">Đang xem xét</option>
                <option value="APPROVED">Đã phê duyệt</option>
                <option value="REJECTED">Đã từ chối</option>
                <option value="CANCELLED">Đã hủy</option>
                <option value="EXPIRED">Quá hạn</option>
              </select>
            )}
          </div>
        </div>

        {/* Proposals List / Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">Đang tải danh sách đề xuất...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                Không có đề xuất nào
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                {activeTab === 'PENDING_ME'
                  ? 'Tuyệt vời! Bạn không có đề xuất nào đang chờ phê duyệt vào lúc này.'
                  : activeTab === 'MY_FOLLOWING'
                  ? 'Bạn chưa theo dõi đề xuất nào. Bạn có thể theo dõi đề xuất từ trang chi tiết của bất kỳ đề xuất nào.'
                  : 'Không tìm thấy đề xuất nào phù hợp với điều kiện tìm kiếm của bạn.'}
              </p>
              {activeTab === 'MY_PROPOSALS' && (
                <Link
                  to="/proposals/new"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  + Tạo đề xuất mới ngay
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 dark:bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Loại & Tiêu đề</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Ưu tiên</th>
                    <th className="py-3 px-4">Người tạo</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {proposals.map((p) => {
                    const statusCfg = PROPOSAL_STATUS_CONFIG[p.status] || PROPOSAL_STATUS_CONFIG.PENDING;
                    const priorityCfg = PROPOSAL_PRIORITY_CONFIG[p.priority] || PROPOSAL_PRIORITY_CONFIG.NORMAL;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Title & Type */}
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="flex items-start gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: p.proposalType?.color || '#3b82f6' }}
                            />
                            <div>
                              <Link
                                to={`/proposals/${p.id}`}
                                className="font-bold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                              >
                                {p.title}
                              </Link>
                              <span className="text-[10px] text-slate-400">
                                {p.proposalType?.name} ({p.proposalType?.code})
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.bgColor} ${statusCfg.color} ${statusCfg.borderColor}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md ${priorityCfg.bgColor} ${priorityCfg.color}`}
                          >
                            {priorityCfg.label}
                          </span>
                        </td>

                        {/* Creator */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                              {p.creator?.fullName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {p.creator?.fullName}
                            </span>
                          </div>
                        </td>

                        {/* Date / Deadline */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-400">
                          <p>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</p>
                          {p.deadline && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              Hạn: {new Date(p.deadline).toLocaleDateString('vi-VN')}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Quick Approve button if pending on current user */}
                            {activeTab === 'PENDING_ME' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickActionProposal(p);
                                    setQuickActionType('APPROVED');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-sm"
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickActionProposal(p);
                                    setQuickActionType('REJECTED');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-sm"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            <Link
                              to={`/proposals/${p.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Xem chi tiết"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Trang {page} / {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Approval Decision Modal */}
      {quickActionProposal && (
        <ApprovalActionModal
          isOpen={Boolean(quickActionProposal)}
          onClose={() => setQuickActionProposal(null)}
          proposalTitle={quickActionProposal.title}
          actionType={quickActionType}
          onConfirm={handleConfirmDecision}
        />
      )}
    </div>
  );
};
export default ProposalHub;
