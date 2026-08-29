import React, { useMemo, useState, useEffect } from 'react';
import { X, ArrowRight, Server, Monitor, User, CheckCircle2, Eye } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { STATUS_INFO } from './TestCaseKanbanBoard';
import { executionApi } from '../../services/api';
import type { ExecutionStatus, TestCase, TestExecution } from '../../types';

interface DropConfirmModalProps {
  confirm: {
    testCase: TestCase;
    fromStatus: ExecutionStatus;
    targetStatus: ExecutionStatus;
  };
  prevExecution?: TestExecution | null;
  eligibleHandlers: { id: string; fullName: string; email: string }[];
  loadingHandlers: boolean;
  currentUser?: { id: string; fullName?: string; email?: string } | null;
  server: string;
  onServerChange: (v: string) => void;
  os: string;
  onOsChange: (v: string) => void;
  handlerId: string;
  onHandlerChange: (v: string) => void;
  availableServers: string[];
  availableOsList: string[];
  submitting: boolean;
  onConfirm: (values: {
    actualResult: string;
    handlerId: string;
    server: string;
    os: string;
    viewerIds: string[];
  }) => void;
  onCancel: () => void;
}

export const DropConfirmModal: React.FC<DropConfirmModalProps> = ({
  confirm,
  prevExecution,
  eligibleHandlers,
  loadingHandlers,
  currentUser,
  server,
  onServerChange,
  os,
  onOsChange,
  handlerId,
  onHandlerChange,
  availableServers,
  availableOsList,
  submitting,
  onConfirm,
  onCancel,
}) => {
  // Danh sách người theo dõi (watchers)
  const [allUsers, setAllUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>(
    prevExecution?.watchers?.map((w) => w.userId) || []
  );

  useEffect(() => {
    executionApi
      .getWatcherUsers()
      .then((r) => setAllUsers(r.data.users || []))
      .catch(() => setAllUsers([]));
  }, []);
  // Kết quả thực tế nằm ở state nội bộ của modal này,
  // gõ phím KHÔNG làm re-render component cha (board Kanban).
  const [actualResult, setActualResult] = useState('');

  const dropHandlerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    eligibleHandlers.forEach((u) => {
      if (u.id) map.set(u.id, { id: u.id, name: u.fullName || u.email, email: u.email });
    });
    // Người thực thi trước đây: ưu tiên before_executed_id, nếu chưa có thì lấy người tạo thực thi.
    // Luôn đưa vào danh sách (ghi đè tên để làm nổi bật) dù người này đã có quyền hay chưa.
    const beforeHandler = prevExecution?.beforeExecutedBy || prevExecution?.createdBy;
    if (beforeHandler?.id) {
      map.set(beforeHandler.id, {
        id: beforeHandler.id,
        name: `${beforeHandler.fullName || beforeHandler.email} (Người thực thi trước đây)`,
        email: beforeHandler.email || '',
      });
    }
    // Người tạo thực thi (execution creator) - luôn đưa vào danh sách nếu khác với người trước
    const creator = prevExecution?.createdBy;
    if (creator?.id && creator.id !== beforeHandler?.id) {
      map.set(creator.id, {
        id: creator.id,
        name: `${creator.fullName || creator.email} (Người tạo thực thi)`,
        email: creator.email || '',
      });
    }
    // Người dùng hiện tại (phòng khi chưa có trong danh sách)
    if (currentUser?.id && !map.has(currentUser.id)) {
      map.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.fullName || currentUser.email || '',
        email: currentUser.email || '',
      });
    }
    return Array.from(map.values());
  }, [eligibleHandlers, prevExecution, currentUser]);

  const previousHandlerId =
    prevExecution?.beforeExecutedBy?.id || prevExecution?.createdBy?.id || null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Xác nhận chuyển trạng thái</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-4">
          {/* TC info */}
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Kịch bản kiểm thử:</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">
                {confirm.testCase.testCaseCode}
              </span>
              {confirm.testCase.title}
            </p>
          </div>

          {/* Status transition visualization */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${STATUS_INFO[confirm.fromStatus].bgColor} ${STATUS_INFO[confirm.fromStatus].color} ${STATUS_INFO[confirm.fromStatus].borderColor}`}
            >
              {STATUS_INFO[confirm.fromStatus].label}
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ring-2 ring-offset-1 ${STATUS_INFO[confirm.targetStatus].bgColor} ${STATUS_INFO[confirm.targetStatus].color} ${STATUS_INFO[confirm.targetStatus].borderColor}`}
            >
              {STATUS_INFO[confirm.targetStatus].label}
            </div>
          </div>

          {/* Server / Environment & OS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Môi trường
              </label>
              <select
                value={server}
                onChange={(e) => onServerChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              >
                {server && !availableServers.includes(server) && <option value={server}>{server}</option>}
                {availableServers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Hệ điều hành
              </label>
              <select
                value={os}
                onChange={(e) => onOsChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              >
                {os && !availableOsList.includes(os) && <option value={os}>{os}</option>}
                {availableOsList.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actual Result - Rich Text Editor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>Kết quả thực tế</span>
                {confirm.targetStatus !== 'UNTESTED' && confirm.targetStatus !== 'BLOCKED' ? (
                  <span className="text-rose-500 font-bold">*</span>
                ) : (
                  <span className="text-slate-400 font-normal text-[11px]">(Không bắt buộc)</span>
                )}
              </span>
            </label>
            <RichTextEditor
              value={actualResult}
              onChange={setActualResult}
              placeholder="Nhập kết quả thực tế khi kiểm thử kịch bản này..."
              minHeight="140px"
              isFailed={confirm.targetStatus === 'FAILED'}
            />
          </div>

          {/* Người thực thi bước tiếp theo (ghi đè executedById) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Người thực thi bước tiếp theo
            </label>
            <div className="flex items-center gap-2">
              <select
                value={handlerId}
                onChange={(e) => onHandlerChange(e.target.value)}
                disabled={loadingHandlers}
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              >
                {dropHandlerOptions.length === 0 && (
                  <option value="">
                    {loadingHandlers ? 'Đang tải...' : 'Không có người hợp lệ (mặc định: bạn)'}
                  </option>
                )}
                {dropHandlerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                    {opt.email ? ` (${opt.email})` : ''}
                  </option>
                ))}
              </select>
              {previousHandlerId && previousHandlerId !== handlerId && (
                <button
                  type="button"
                  onClick={() => onHandlerChange(previousHandlerId)}
                  className="shrink-0 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                  title="Giao lại cho người xử lý ở bước trước"
                >
                  Giao lại cho người trước
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Chỉ những người có quyền xử lý trạng thái{' '}
              <strong>{STATUS_INFO[confirm.targetStatus].label}</strong> mới được chọn. Nếu không chọn, mặc định là
              bạn.
            </p>
          </div>

          {/* Người theo dõi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Người theo dõi
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {allUsers.length === 0 && (
                <span className="text-[11px] text-slate-400">Đang tải danh sách người dùng...</span>
              )}
              {allUsers.map((u) => {
                const checked = watcherIds.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() =>
                      setWatcherIds((prev) =>
                        checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      )
                    }
                    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                      checked
                        ? 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-sky-400'
                    }`}
                  >
                    {u.fullName || u.email}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Chọn những người được phép xem execution này (tạo / thực thi / theo dõi).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ actualResult, handlerId, server, os, viewerIds: watcherIds })}
            disabled={
              submitting ||
              (confirm.targetStatus !== 'UNTESTED' &&
                confirm.targetStatus !== 'BLOCKED' &&
                !actualResult.trim())
            }
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Xác nhận chuyển trạng thái</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
