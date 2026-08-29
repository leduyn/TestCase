import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Clock, Filter, ArrowLeft } from 'lucide-react';
import { testCaseApi } from '../services/api';
import type { ReviewTestCaseItem, TestCaseReviewStatus } from '../types';

const STATUS_BADGE: Record<TestCaseReviewStatus, { label: string; cls: string }> = {
  UNREVIEWED: {
    label: 'Chưa kiểm duyệt',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  REVIEWED: {
    label: 'Đã kiểm duyệt',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

export const TestCaseManagement: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewTestCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | TestCaseReviewStatus>('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [filterSuite, setFilterSuite] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await testCaseApi.listForReview();
      setItems(res.data.testCases || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi tải danh sách kiểm duyệt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const moduleOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.module).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const suiteOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.suiteName).filter(Boolean))) as string[],
    [items]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.testType).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const priorityOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.priority).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterStatus !== 'ALL' && it.reviewStatus !== filterStatus) return false;
      if (filterModule !== 'ALL' && it.module !== filterModule) return false;
      if (filterSuite !== 'ALL' && it.suiteName !== filterSuite) return false;
      if (filterType !== 'ALL' && it.testType !== filterType) return false;
      if (filterPriority !== 'ALL' && it.priority !== filterPriority) return false;
      return true;
    });
  }, [items, filterStatus, filterModule, filterSuite, filterType, filterPriority]);

  const selectableFiltered = useMemo(
    () => filtered.filter((it) => it.reviewStatus === 'UNREVIEWED'),
    [filtered]
  );
  const allSelectableSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((it) => selectedIds.includes(it.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableFiltered.some((it) => it.id === id)));
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...selectableFiltered.map((it) => it.id)]))
      );
    }
  };
  const selectQuick = () => {
    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...selectableFiltered.map((it) => it.id)]))
    );
  };
  const clearSelection = () => setSelectedIds([]);

  const handleBulkReview = async () => {
    if (selectedIds.length === 0) return;
    setBulkReviewing(true);
    try {
      await testCaseApi.bulkReview(selectedIds);
      setSelectedIds([]);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi kiểm duyệt hàng loạt');
    } finally {
      setBulkReviewing(false);
    }
  };

  const resetFilters = () => {
    setFilterStatus('ALL');
    setFilterModule('ALL');
    setFilterSuite('ALL');
    setFilterType('ALL');
    setFilterPriority('ALL');
  };

  const totalFiltered = filtered.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = pageSize === -1 ? filtered : filtered.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  const counts = useMemo(
    () => ({
      all: items.length,
      unreviewed: items.filter((i) => i.reviewStatus === 'UNREVIEWED').length,
      reviewed: items.filter((i) => i.reviewStatus === 'REVIEWED').length,
    }),
    [items]
  );

  const handleReview = async (id: string) => {
    setReviewingId(id);
    try {
      await testCaseApi.reviewTestCase(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi kiểm duyệt Test Case');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Kiểm duyệt Test Case
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Duyệt các Test Case trước khi đưa vào luân chuyển thực thi
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Tất cả ({counts.all})
        </button>
        <button
          onClick={() => setFilterStatus('UNREVIEWED')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'UNREVIEWED'
              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300'
          }`}
        >
          Chưa kiểm duyệt ({counts.unreviewed})
        </button>
        <button
          onClick={() => setFilterStatus('REVIEWED')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            filterStatus === 'REVIEWED'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          Đã kiểm duyệt ({counts.reviewed})
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Chức năng
          </label>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Tất cả</option>
            {moduleOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Bộ Test Suite
          </label>
          <select
            value={filterSuite}
            onChange={(e) => setFilterSuite(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Tất cả</option>
            {suiteOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Loại test
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Tất cả</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Mức độ ưu tiên
          </label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Tất cả</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={resetFilters}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          Xóa bộ lọc
        </button>

        <button
          onClick={selectQuick}
          disabled={selectableFiltered.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Chọn nhanh ({selectableFiltered.length})
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 text-sm font-semibold text-blue-800 dark:text-blue-200">
            <CheckCircle2 className="w-4 h-4" />
            Đã chọn {selectedIds.length} Test Case
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              Bỏ chọn
            </button>
            <button
              onClick={handleBulkReview}
              disabled={bulkReviewing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {bulkReviewing ? 'Đang kiểm duyệt...' : 'Kiểm duyệt hàng loạt'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableFiltered.length === 0}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left">Mã TC</th>
                <th className="px-4 py-3 text-left">Tiêu đề</th>
                <th className="px-4 py-3 text-left">Chức năng</th>
                <th className="px-4 py-3 text-left">Loại test</th>
                <th className="px-4 py-3 text-left">Bộ Test Suite</th>
                <th className="px-4 py-3 text-left">Ưu tiên</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Người duyệt</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : totalFiltered === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Không có Test Case nào
                  </td>
                </tr>
              ) : (
                paginated.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-3 text-center">
                      {it.reviewStatus === 'UNREVIEWED' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(it.id)}
                          onChange={() => toggleSelect(it.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {it.testCaseCode}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">
                      {it.title}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {it.module}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {it.testType}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {it.suiteName || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {it.priority}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${STATUS_BADGE[it.reviewStatus].cls}`}
                      >
                        {it.reviewStatus === 'REVIEWED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {STATUS_BADGE[it.reviewStatus].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {it.reviewedBy?.fullName || '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {it.reviewStatus === 'UNREVIEWED' ? (
                        <button
                          onClick={() => handleReview(it.id)}
                          disabled={reviewingId === it.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {reviewingId === it.id ? 'Đang duyệt...' : 'Đánh dấu đã kiểm duyệt'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Đã duyệt</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalFiltered > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Hiển thị {startIndex + 1}–{Math.min(startIndex + pageSize, totalFiltered)} / {totalFiltered}
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ml-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {[10, 25, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s} / trang
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
            <span className="px-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Trang {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
