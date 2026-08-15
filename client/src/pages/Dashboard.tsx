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
} from 'lucide-react';
import { testCaseApi, exportApi } from '../services/api';
import type { TestSuite } from '../types';

export const Dashboard: React.FC = () => {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchSuites();
  }, []);

  // Aggregated stats
  const totalSuites = suites.length;
  const totalCases = suites.reduce((acc, s) => acc + (s.stats?.total || 0), 0);
  const totalPassed = suites.reduce((acc, s) => acc + (s.stats?.passed || 0), 0);
  const totalFailed = suites.reduce((acc, s) => acc + (s.stats?.failed || 0), 0);
  const totalUntested = suites.reduce((acc, s) => acc + (s.stats?.untested || 0), 0);
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
          <Link
            to="/generate"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Sinh Test Case Mới
          </Link>
          <Link
            to="/import"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Nhập từ Excel
          </Link>
          <button
            onClick={fetchSuites}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng số Test Case
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCases}</p>
            <p className="text-xs text-slate-500 mt-1">{totalSuites} bộ Test Suite</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Đạt (Passed)
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {totalPassed}
            </p>
            <p className="text-xs text-slate-500 mt-1">Tỷ lệ: {overallPassRate}%</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Thất bại (Failed)
            </p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {totalFailed}
            </p>
            <p className="text-xs text-slate-500 mt-1">Cần xem xét & fix lỗi</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chưa Test (Untested)
            </p>
            <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
              {totalUntested}
            </p>
            <p className="text-xs text-slate-500 mt-1">Đang chờ thực thi</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
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
                Hãy tải lên tài liệu yêu cầu (PDF/TXT) để AI tự động phân tích và sinh ra bộ Test Case đầu tiên.
              </p>
            </div>
            <Link
              to="/generate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Tải tài liệu & Sinh Test Case
            </Link>
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

                    <Link to={`/suites/${suite.id}`}>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1">
                        {suite.name}
                      </h3>
                    </Link>

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
                    <a
                      href={exportApi.getExcelDownloadUrl(suite.id)}
                      download
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                      title="Tải file Excel"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Xuất Excel
                    </a>
                    <Link
                      to={`/suites/${suite.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group-hover:translate-x-0.5 transition-all"
                    >
                      Xem chi tiết & Test
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
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
