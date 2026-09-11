import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Play,
  RotateCcw,
  Eye,
  Search,
  Check,
  Layers,
  Info,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { executionApi } from '../services/api';

const DEFAULT_WATCHERS_STORAGE_KEY = 'default_testcase_watchers';

interface UserCandidate {
  id: string;
  fullName: string;
  email: string;
}

interface ReceiveTestCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedWatcherIds: string[], targetModule?: string) => Promise<void>;
  suiteName: string;
  moduleName?: string;
  testCaseCount: number;
  isNewRound?: boolean;
  submitting?: boolean;
  availableModules?: { name: string; count: number }[];
}

export const ReceiveTestCasesModal: React.FC<ReceiveTestCasesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  suiteName,
  moduleName,
  testCaseCount,
  isNewRound = false,
  submitting = false,
  availableModules,
}) => {
  const [candidates, setCandidates] = useState<UserCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedWatcherIds, setSelectedWatcherIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>(moduleName || '');

  useEffect(() => {
    setSelectedModule(moduleName || '');
  }, [moduleName, isOpen]);

  // Tải danh sách user và nạp watchers đã lưu trong localStorage
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingCandidates(true);

    // Lấy default watchers từ localStorage
    try {
      const saved = localStorage.getItem(DEFAULT_WATCHERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedWatcherIds(parsed);
        }
      }
    } catch {
      /* ignore error */
    }

    executionApi
      .getWatcherUsers()
      .then((res) => {
        if (isMounted) {
          setCandidates(res.data.users || []);
        }
      })
      .catch((err) => {
        console.warn('Lỗi tải danh sách người dùng để theo dõi:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCandidates(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  const toggleWatcher = (userId: string) => {
    setSelectedWatcherIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
    const allFilteredIds = filteredCandidates.map((c) => c.id);
    setSelectedWatcherIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const deselectAll = () => {
    const filteredIdSet = new Set(filteredCandidates.map((c) => c.id));
    setSelectedWatcherIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
  };

  const effectiveCount = useMemo(() => {
    if (selectedModule && availableModules) {
      const found = availableModules.find((m) => m.name === selectedModule);
      if (found) return found.count;
    }
    return testCaseCount;
  }, [selectedModule, availableModules, testCaseCount]);

  const handleConfirm = async () => {
    // Lưu watchers đã chọn vào localStorage cho các lần nhận tiếp theo
    try {
      localStorage.setItem(DEFAULT_WATCHERS_STORAGE_KEY, JSON.stringify(selectedWatcherIds));
    } catch {
      /* ignore */
    }

    await onConfirm(selectedWatcherIds, selectedModule || undefined);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md ${isNewRound
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-500/20'
                  : 'bg-gradient-to-tr from-blue-600 to-sky-600 shadow-blue-500/20'
                }`}
            >
              {isNewRound ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isNewRound ? 'Nhận lượt kiểm thử mới' : 'Nhận & Bắt đầu kiểm thử'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isNewRound
                  ? 'Tạo một chu kỳ kiểm thử mới (thêm số lần test)'
                  : 'Cấp phát bộ test case để bắt đầu thực hiện'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Thông tin phạm vi test case */}
          <div className="rounded-xl p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Bộ Test Suite
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{suiteName}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shrink-0 shadow-sm">
                {effectiveCount} Test Case
              </span>
            </div>

            {availableModules && availableModules.length > 0 ? (
              <div className="pt-2 border-t border-blue-200/50 dark:border-blue-900/40 space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Phạm vi áp dụng:
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toàn bộ Suite ({testCaseCount} Test Case)</option>
                  {availableModules.map((m) => (
                    <option key={m.name} value={m.name}>
                      Chức năng: {m.name} ({m.count} Test Case)
                    </option>
                  ))}
                </select>
              </div>
            ) : moduleName ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-blue-200/50 dark:border-blue-900/40">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Chức năng / Module:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{moduleName}</span>
              </div>
            ) : null}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                {isNewRound
                  ? 'Một bộ kết quả mới (trạng thái Chưa test) sẽ được tạo cho bạn. Lịch sử các lượt test trước vẫn được lưu giữ nguyên vẹn.'
                  : 'Các test case sẽ được tạo vào danh sách thực thi cá nhân của bạn với trạng thái Chưa test.'}
              </span>
            </p>
          </div>

          {/* Chọn người theo dõi (Watchers) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Người theo dõi mặc định ({selectedWatcherIds.length})
                </label>
                <p className="text-[11px] text-slate-400">
                  Người được chọn sẽ nhận thông báo khi bạn cập nhật kết quả kiểm thử.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm người dùng */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm người dùng theo tên hoặc email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>

            {/* Danh sách người dùng để chọn */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 bg-slate-50/40 dark:bg-slate-800/30">
              {loadingCandidates ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Đang tải danh sách người dùng...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  {searchQuery ? 'Không tìm thấy người dùng phù hợp' : 'Không có người dùng nào'}
                </div>
              ) : (
                filteredCandidates.map((user) => {
                  const isChecked = selectedWatcherIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleWatcher(user.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${isChecked
                          ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${isChecked
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                          {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {user.fullName || user.email}
                          </p>
                          {user.fullName && (
                            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                          )}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                          }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-400 italic">
              * Danh sách này sẽ được ghi nhớ tự động cho các lần nhận tiếp theo của bạn.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isNewRound
                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
              }`}
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isNewRound ? (
              <RotateCcw className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isNewRound ? 'Xác nhận tạo lượt mới' : 'Xác nhận & Bắt đầu'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
