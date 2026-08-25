import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
  Plus,
  RefreshCw,
  FolderKanban,
  Download,
  Users,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  UserCheck,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { testCaseApi, exportApi } from '../services/api';
import type { TestSuite, UserTestStat } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export const Dashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canGenerate = hasPermission('testcase:generate');
  const canImport = hasPermission('testcase:import');
  const canExport = hasPermission('testcase:export');
  const canReadSuite = hasPermission('testsuite:read');
  const canViewStats = hasAnyPermission([
    'dashboard:user-stats:read',
    'dashboard:user-stats:read-all',
  ]);

  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);

  // User test execution stats state
  const [userStats, setUserStats] = useState<UserTestStat[]>([]);
  const [canViewAllStats, setCanViewAllStats] = useState(false);
  const [loadingUserStats, setLoadingUserStats] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'TESTER'>('ALL');

  const fetchSuites = async () => {
    setLoading(true);
    try {
      const res = await testCaseApi.getSuites();
      setSuites(res.data.suites || []);
    } catch (err: any) {
      console.error('Error fetching suites:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    setLoadingUserStats(true);
    try {
      const res = await testCaseApi.getUserExecutionStats();
      setUserStats(res.data.userStats || []);
      setCanViewAllStats(res.data.canViewAll ?? false);
    } catch (err: any) {
      console.error('Error fetching user execution stats:', err);
    } finally {
      setLoadingUserStats(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchSuites(), fetchUserStats()]);
  };

  useEffect(() => {
    fetchSuites();
    fetchUserStats();
  }, []);

  // Aggregated stats
  const totalSuites = suites.length;
  const totalCases = suites.reduce((acc, s) => acc + (s.stats?.total || 0), 0);
  const totalUnreviewed = suites.reduce((acc, s) => acc + (s.stats?.unreviewed || 0), 0);
  const totalUntested = suites.reduce((acc, s) => acc + (s.stats?.untested || 0), 0);
  const totalPassed = suites.reduce((acc, s) => acc + (s.stats?.passed || 0), 0);
  const totalFailed = suites.reduce((acc, s) => acc + (s.stats?.failed || 0), 0);
  const totalBlocked = suites.reduce((acc, s) => acc + (s.stats?.blocked || 0), 0);
  const totalRetest = suites.reduce((acc, s) => acc + (s.stats?.retest || 0), 0);
  const overallPassRate = totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 md:p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Test Management
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Quản lý & Sinh Test Case Thông minh
          </h1>
          <p className="text-slate-300 text-sm md:text-base">
            Tự động bóc tách tài liệu đặc tả (PDF/DOCX), sinh kịch bản kiểm thử đa nền tảng (App & CMS), quản lý kết quả thực thi và xuất báo cáo Excel chuẩn.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {canGenerate && (
            <Link
              to="/generate"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Sinh Test Case Mới
            </Link>
          )}
          {canImport && (
            <Link
              to="/import"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Nhập từ Excel
            </Link>
          )}
          <button
            onClick={refreshAll}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading || loadingUserStats ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng số Case
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalCases}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalSuites} Test Suite</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chưa kiểm duyệt
            </p>
            <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1">
              {totalUnreviewed}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Chờ Lead duyệt</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Chưa Test
            </p>
            <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">
              {totalUntested}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Sẵn sàng test</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Đạt (Passed)
            </p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {totalPassed}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Tỷ lệ: {overallPassRate}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Thất bại (Failed)
            </p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {totalFailed}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Cần fix lỗi</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Test lại / Chặn
            </p>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {totalRetest + totalBlocked}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalRetest} retest, {totalBlocked} block</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Failed cases warning banner if there are failed cases */}
      {totalFailed > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Có {totalFailed} kịch bản kiểm thử bị Thất bại (FAILED)
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Vui lòng kiểm tra các case lỗi trong chi tiết từng bộ Test Suite để theo dõi nguyên nhân và tạo ticket sửa lỗi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Test Execution Statistics Section (Admin & Tester) */}
      {canViewStats && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mt-0.5">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Thống kê kết quả kiểm thử theo tài khoản
                </h2>
                {canViewAllStats ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Shield className="w-3 h-3" />
                    Chế độ toàn đội
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <UserCheck className="w-3 h-3" />
                    Thống kê cá nhân
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {canViewAllStats
                  ? 'Theo dõi chi tiết số lượng Test Case chưa test, Passed, Failed của từng tài khoản Admin và Tester'
                  : 'Theo dõi chi tiết số lượng Test Case chưa test, Passed, Failed của tài khoản của bạn'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={fetchUserStats}
              disabled={loadingUserStats}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Làm mới thống kê người dùng"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUserStats ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Filters bar if multiple users viewable */}
        {canViewAllStats && userStats.length > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
              {(['ALL', 'ADMIN', 'TESTER'] as const).map((role) => {
                const labels: Record<string, string> = { ALL: 'Tất cả', ADMIN: 'Quản trị viên', TESTER: 'Kiểm thử viên' };
                const count = role === 'ALL' ? userStats.length : userStats.filter((u) => u.role === role).length;
                const isActive = roleFilter === role;
                return (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {labels[role]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* User Stats Content */}
        {loadingUserStats ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Đang tải thống kê tài khoản...</span>
          </div>
        ) : userStats.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            Chưa có dữ liệu thống kê kiểm thử cho người dùng.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Thành viên (User)</th>
                  <th className="px-5 py-3.5">Vai trò</th>
                  <th className="px-5 py-3.5">Chưa test / Tổng Test Case</th>
                  <th className="px-5 py-3.5 text-center">Passed</th>
                  <th className="px-5 py-3.5 text-center">Failed</th>
                  <th className="px-5 py-3.5 text-center">Tỷ lệ Đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {userStats
                  .filter((u) => {
                    const q = userSearch.toLowerCase().trim();
                    const matchesSearch =
                      !q ||
                      u.fullName.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q);
                    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
                    return matchesSearch && matchesRole;
                  })
                  .map((stat) => {
                    const isSelf = stat.userId === currentUser?.id;
                    return (
                      <tr
                        key={stat.userId}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelf ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        {/* User Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                                stat.role === 'ADMIN'
                                  ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                                  : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                              }`}
                            >
                              {(stat.fullName || stat.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {stat.fullName || '(Chưa đặt tên)'}
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-300">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                {stat.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              stat.role === 'ADMIN'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {stat.role === 'ADMIN' ? 'Quản trị viên' : 'Kiểm thử viên'}
                          </span>
                        </td>

                        {/* Chưa test / Tổng số test case */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5 max-w-xs">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Chưa test: <span className="font-bold text-amber-600 dark:text-amber-400">{stat.untested}</span> / Tổng: {stat.totalTestCases}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Đã test {stat.testedCount} ({stat.completionRate}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${stat.totalTestCases > 0 ? (stat.passed / stat.totalTestCases) * 100 : 0}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Passed: ${stat.passed}`}
                              />
                              <div
                                style={{ width: `${stat.totalTestCases > 0 ? (stat.failed / stat.totalTestCases) * 100 : 0}%` }}
                                className="bg-rose-500 h-full"
                                title={`Failed: ${stat.failed}`}
                              />
                              <div
                                style={{ width: `${stat.totalTestCases > 0 ? ((stat.retest || 0) / stat.totalTestCases) * 100 : 0}%` }}
                                className="bg-purple-500 h-full"
                                title={`Retest: ${stat.retest || 0}`}
                              />
                              <div
                                style={{ width: `${stat.totalTestCases > 0 ? (stat.blocked / stat.totalTestCases) * 100 : 0}%` }}
                                className="bg-amber-500 h-full"
                                title={`Blocked: ${stat.blocked}`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Passed */}
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {stat.passed}
                          </span>
                        </td>

                        {/* Failed */}
                        <td className="px-5 py-4 text-center">
                          {stat.failed > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/60">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              {stat.failed}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium text-xs">
                              0
                            </span>
                          )}
                        </td>

                        {/* Pass Rate */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {stat.passRate}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {stat.testedCount > 0 ? `${stat.passed}/${stat.testedCount} đã test` : 'Chưa test'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Test Suites List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Danh sách các bộ Test Suite ({suites.length})
          </h2>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-12 border border-slate-200 dark:border-slate-800 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-slate-500">Đang tải dữ liệu từ PostgreSQL...</p>
          </div>
        ) : suites.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chưa có bộ Test Suite nào
              </h3>
              <p className="text-sm text-slate-500">
                {canGenerate
                  ? 'Hãy tải lên tài liệu yêu cầu (PDF/TXT) để AI tự động phân tích và sinh ra bộ Test Case đầu tiên.'
                  : 'Hiện tại chưa có bộ Test Suite nào trong hệ thống.'}
              </p>
            </div>
            {canGenerate && (
              <Link
                to="/generate"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Tải tài liệu & Sinh Test Case
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suites.map((suite) => {
              const stats = suite.stats || { total: 0, passed: 0, failed: 0, blocked: 0, untested: 0, passRate: 0 };
              return (
                <div
                  key={suite.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold">
                        {suite.moduleName || 'Tổng hợp'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(suite.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {canReadSuite ? (
                      <Link to={`/suites/${suite.id}`}>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1">
                          {suite.name}
                        </h3>
                      </Link>
                    ) : (
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                        {suite.name}
                      </h3>
                    )}

                    {suite.summary && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {suite.summary}
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-600 dark:text-slate-400">
                          Tiến độ: {stats.passed}/{stats.total} cases
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {stats.passRate}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${(stats.passed / (stats.total || 1)) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Passed: ${stats.passed}`}
                        />
                        <div
                          style={{ width: `${(stats.failed / (stats.total || 1)) * 100}%` }}
                          className="bg-rose-500 h-full"
                          title={`Failed: ${stats.failed}`}
                        />
                        <div
                          style={{ width: `${(stats.blocked / (stats.total || 1)) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Blocked: ${stats.blocked}`}
                        />
                      </div>
                    </div>

                    {/* Stat Badges */}
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                        ✓ {stats.passed} Pass
                      </span>
                      {stats.failed > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200 animate-pulse">
                          ⚠️ {stats.failed} Fail
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {stats.untested} Chưa test
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {canExport ? (
                      <a
                        href={exportApi.getExcelDownloadUrl(suite.id)}
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                        title="Tải file Excel"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Xuất Excel
                      </a>
                    ) : (
                      <span />
                    )}
                    {canReadSuite && (
                      <Link
                        to={`/suites/${suite.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group-hover:translate-x-0.5 transition-all"
                      >
                        Xem chi tiết & Test
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
