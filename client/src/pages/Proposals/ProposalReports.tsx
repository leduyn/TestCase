import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Users,
  RefreshCw,
  FileText,
  Layers,
  Timer,
  ChevronRight,
  Printer,
  ArrowLeft,
  Flame,
} from 'lucide-react';
import type {
  ProposalsByTypeResponse,
  ProposalsByStatusResponse,
  ProposalsByApproverReportItem,
  ApprovalTimeStatsResponse,
  OverdueProposalsResponse,
  ProposalType,
} from '../../types/proposal';
import { PROPOSAL_STATUS_CONFIG } from '../../types/proposal';
import { proposalReportApi, proposalTypeApi } from '../../services/proposalApi';

type DateRangePreset = 'all' | 'today' | '7d' | '30d' | 'this_month';

export const ProposalReports: React.FC = () => {
  // Filters
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');

  // Dropdown list
  const [proposalTypes, setProposalTypes] = useState<ProposalType[]>([]);

  // Report States
  const [loading, setLoading] = useState(true);
  const [byTypeData, setByTypeData] = useState<ProposalsByTypeResponse | null>(null);
  const [byStatusData, setByStatusData] = useState<ProposalsByStatusResponse | null>(null);
  const [approverData, setApproverData] = useState<ProposalsByApproverReportItem[]>([]);
  const [timeStats, setTimeStats] = useState<ApprovalTimeStatsResponse | null>(null);
  const [overdueData, setOverdueData] = useState<OverdueProposalsResponse | null>(null);

  // Active Tab for detail sections
  const [activeTab, setActiveTab] = useState<'overview' | 'approvers' | 'overdue'>('overview');

  // Calculate dates based on preset
  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Initial preset on mount
  useEffect(() => {
    handlePresetChange('30d');
  }, []);

  // Fetch proposal types
  useEffect(() => {
    proposalTypeApi
      .getTypes({ isActive: true })
      .then((res) => setProposalTypes(res.data.types || []))
      .catch((err) => console.error('Error fetching proposal types:', err));
  }, []);

  // Fetch all reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: { startDate?: string; endDate?: string; proposalTypeId?: string } = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (selectedTypeId) params.proposalTypeId = selectedTypeId;

      const [typeRes, statusRes, approverRes, timeRes, overdueRes] = await Promise.all([
        proposalReportApi.getByType({ startDate: params.startDate, endDate: params.endDate }),
        proposalReportApi.getByStatus(params),
        proposalReportApi.getByApprover({ startDate: params.startDate, endDate: params.endDate }),
        proposalReportApi.getApprovalTimeStats({ proposalTypeId: params.proposalTypeId }),
        proposalReportApi.getOverdueProposals(),
      ]);

      setByTypeData(typeRes.data);
      setByStatusData(statusRes.data);
      setApproverData(approverRes.data || []);
      setTimeStats(timeRes.data);
      setOverdueData(overdueRes.data);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedTypeId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Executive KPI summary calculations
  const totalProposals = byStatusData?.total || 0;
  const approvedCount =
    byStatusData?.byStatus.find((s) => s.status === 'APPROVED')?.count || 0;
  const rejectedCount =
    byStatusData?.byStatus.find((s) => s.status === 'REJECTED')?.count || 0;
  const pendingCount =
    byStatusData?.byStatus.find((s) => s.status === 'PENDING' || s.status === 'IN_REVIEW')
      ?.count || 0;
  const overdueCount = overdueData?.total || 0;

  const totalDecided = approvedCount + rejectedCount;
  const approvalRate = totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : 0;
  const avgResponseTimeHours = timeStats?.avgHours ? Number(timeStats.avgHours.toFixed(1)) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to="/proposals"
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Trung tâm Đề xuất
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Báo cáo & Thống kê Đề xuất
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phân tích dữ liệu phê duyệt, hiệu suất xử lý và giám sát đề xuất quá hạn
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchReports}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              In báo cáo
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Thời gian:
            </span>
            {[
              { key: 'today', label: 'Hôm nay' },
              { key: '7d', label: '7 ngày' },
              { key: '30d', label: '30 ngày' },
              { key: 'this_month', label: 'Tháng này' },
              { key: 'all', label: 'Tất cả' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePresetChange(p.key as DateRangePreset)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  datePreset === p.key
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers & Type Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('all');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
              <span>&rarr;</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('all');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            {/* Filter by Proposal Type */}
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">-- Tất cả loại đề xuất --</option>
              {proposalTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Proposals */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tổng số đề xuất
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {totalProposals}
              </span>
              <span className="text-[11px] text-slate-400">đề xuất</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Đang chờ: <strong className="text-amber-600">{pendingCount}</strong></span>
              <span>•</span>
              <span>Đã duyệt: <strong className="text-emerald-600">{approvedCount}</strong></span>
            </div>
          </div>

          {/* Card 2: Approval Rate */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tỷ lệ chấp thuận
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {approvalRate}%
              </span>
              <span className="text-[11px] text-slate-400">trên đã xử lý</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Chấp thuận: <strong className="text-emerald-600">{approvedCount}</strong></span>
              <span>•</span>
              <span>Từ chối: <strong className="text-rose-600">{rejectedCount}</strong></span>
            </div>
          </div>

          {/* Card 3: Avg Response Time */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Thời gian xử lý TB
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Timer className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {avgResponseTimeHours}
              </span>
              <span className="text-[11px] text-slate-400">giờ / đề xuất</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Nhanh nhất: <strong className="text-indigo-600">{timeStats?.minHours?.toFixed(1) || 0}h</strong></span>
              <span>•</span>
              <span>Chậm nhất: <strong className="text-slate-600">{timeStats?.maxHours?.toFixed(1) || 0}h</strong></span>
            </div>
          </div>

          {/* Card 4: Overdue Proposals */}
          <div
            onClick={() => setActiveTab('overdue')}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              overdueCount > 0
                ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Đề xuất quá hạn
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {overdueCount}
              </span>
              <span className="text-[11px] text-slate-400">đề xuất</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Vượt hạn chót xử lý</span>
              {overdueCount > 0 && (
                <span className="text-rose-600 font-bold flex items-center gap-0.5 hover:underline">
                  Xem ngay <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visual Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Status Breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Phân bố theo trạng thái
              </h3>
              <span className="text-xs text-slate-400">Tổng: {totalProposals}</span>
            </div>

            {/* Stacked Percentage Bar */}
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
              {byStatusData?.byStatus.map((item, idx) => {
                const cfg = PROPOSAL_STATUS_CONFIG[item.status] || PROPOSAL_STATUS_CONFIG.PENDING;
                let barColor = 'bg-slate-400';
                if (item.status === 'APPROVED') barColor = 'bg-emerald-500';
                if (item.status === 'REJECTED') barColor = 'bg-rose-500';
                if (item.status === 'PENDING') barColor = 'bg-amber-500';
                if (item.status === 'IN_REVIEW') barColor = 'bg-blue-500';
                if (item.status === 'DRAFT') barColor = 'bg-slate-400';
                if (item.status === 'CANCELLED') barColor = 'bg-slate-600';
                if (item.status === 'EXPIRED') barColor = 'bg-purple-500';

                return (
                  <div
                    key={idx}
                    className={`${barColor} transition-all relative group`}
                    style={{ width: `${item.percentage}%` }}
                    title={`${cfg.label}: ${item.count} (${item.percentage}%)`}
                  />
                );
              })}
            </div>

            {/* Status Legend & Counts Table */}
            <div className="space-y-2.5 text-xs">
              {byStatusData?.byStatus.map((item, idx) => {
                const cfg = PROPOSAL_STATUS_CONFIG[item.status] || PROPOSAL_STATUS_CONFIG.PENDING;
                let dotColor = 'bg-slate-400';
                if (item.status === 'APPROVED') dotColor = 'bg-emerald-500';
                if (item.status === 'REJECTED') dotColor = 'bg-rose-500';
                if (item.status === 'PENDING') dotColor = 'bg-amber-500';
                if (item.status === 'IN_REVIEW') dotColor = 'bg-blue-500';
                if (item.status === 'DRAFT') dotColor = 'bg-slate-400';
                if (item.status === 'CANCELLED') dotColor = 'bg-slate-600';
                if (item.status === 'EXPIRED') dotColor = 'bg-purple-500';

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.count}
                      </span>
                      <span className="text-[11px] text-slate-400 w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proposals by Type Breakdown (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Cơ cấu theo Loại đề xuất
              </h3>
              <span className="text-xs text-slate-400">
                {byTypeData?.byType.length || 0} danh mục
              </span>
            </div>

            {byTypeData?.byType && byTypeData.byType.length > 0 ? (
              <div className="space-y-3.5">
                {byTypeData.byType.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color || '#4f46e5' }}
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-white">{item.count}</strong>
                        <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color || '#4f46e5',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Không có dữ liệu loại đề xuất trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>

        {/* Detail Sections Tabs (Leaderboard & Overdue List) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Hiệu suất Người phê duyệt ({approverData.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'overdue'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Đề xuất Quá hạn ({overdueCount})
              {overdueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 font-bold">
                  {overdueCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Approver Performance Leaderboard */}
          {activeTab === 'overview' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Bảng theo dõi hiệu suất người duyệt
                  </h4>
                  <p className="text-xs text-slate-400">
                    Thống kê tỷ lệ giải quyết và thời gian phản hồi trung bình của từng người duyệt
                  </p>
                </div>
              </div>

              {approverData.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chưa có dữ liệu người phê duyệt trong phạm vi lọc
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Người phê duyệt</th>
                        <th className="py-3 px-4">Tổng lượt phân công</th>
                        <th className="py-3 px-4">Đã chấp thuận</th>
                        <th className="py-3 px-4">Đã từ chối</th>
                        <th className="py-3 px-4">Còn chờ xử lý</th>
                        <th className="py-3 px-4">Thời gian phản hồi TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {approverData.map((item, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                {item.approver?.fullName?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {item.approver?.fullName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {item.approver?.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                            {item.total}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {item.approved}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                              <XCircle className="w-3.5 h-3.5" />
                              {item.rejected}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              {item.pending}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                            {item.avgResponseHours > 0
                              ? `${item.avgResponseHours.toFixed(1)} giờ`
                              : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Overdue Proposals Table */}
          {activeTab === 'overdue' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Danh sách đề xuất đã quá hạn xử lý
                  </h4>
                  <p className="text-xs text-slate-400">
                    Cần đôn đốc người duyệt hoặc gia hạn thời gian giải quyết
                  </p>
                </div>
              </div>

              {!overdueData || overdueData.proposals.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Tuyệt vời! Hiện tại không có đề xuất nào bị quá hạn xử lý.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Loại & Tiêu đề</th>
                        <th className="py-3 px-4">Người tạo</th>
                        <th className="py-3 px-4">Hạn xử lý</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {overdueData.proposals.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 max-w-sm">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {p.title}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {p.proposalType?.name} ({p.proposalType?.code})
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {p.creator?.fullName}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-rose-600 font-bold">
                            {p.deadline
                              ? new Date(p.deadline).toLocaleString('vi-VN')
                              : 'Quá hạn'}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                              QUÁ HẠN
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Link
                              to={`/proposals/${p.id}`}
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-semibold"
                            >
                              Xem ngay &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalReports;
