import React, { useState, useEffect, useCallback } from 'react';
import { statusHandlerApi, userApi } from '../services/api';
import { UserPlus, X, RefreshCw, Shield } from 'lucide-react';

const STATUS_LIST: { key: string; label: string }[] = [
  { key: 'UNTESTED', label: 'Chưa thực hiện' },
  { key: 'PASSED', label: 'Đạt (PASSED)' },
  { key: 'FAILED', label: 'Không đạt (FAILED)' },
  { key: 'BLOCKED', label: 'Bị chặn (BLOCKED)' },
  { key: 'RETEST', label: 'Yêu cầu kiểm thử lại (RETEST)' },
];

interface HandlerUser {
  id: string;
  fullName: string;
  email: string;
  status?: string;
}

const StatusHandlerManagement: React.FC = () => {
  const [handlers, setHandlers] = useState<Record<string, HandlerUser[]>>({});
  const [userPool, setUserPool] = useState<HandlerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast((prev) => (prev?.message === message ? null : prev)), 3000);
  };

  const loadHandlers = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        STATUS_LIST.map((s) =>
          statusHandlerApi.getHandlers(s.key).then((r) => ({ key: s.key, users: r.data.users }))
        )
      );
      const map: Record<string, HandlerUser[]> = {};
      results.forEach((r) => (map[r.key] = r.users));
      setHandlers(map);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi tải danh sách phân công', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHandlers();
    userApi
      .getUsers()
      .then((r) => setUserPool(r.data || []))
      .catch(() => setUserPool([]));
  }, [loadHandlers]);

  const handleAssign = async (status: string) => {
    const userId = selected[status];
    if (!userId) return;
    setSaving(true);
    try {
      await statusHandlerApi.assign(status, userId);
      showToast(`Đã phân công xử lý trạng thái ${status}`, 'success');
      setSelected((prev) => ({ ...prev, [status]: '' }));
      await loadHandlers();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi phân công', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (status: string, userId: string) => {
    setSaving(true);
    try {
      await statusHandlerApi.remove(status, userId);
      showToast(`Đã gỡ phân công xử lý trạng thái ${status}`, 'success');
      await loadHandlers();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi gỡ phân công', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Danh sách user ACTIVE chưa được gán cho trạng thái tương ứng
  const getAvailable = (status: string): HandlerUser[] => {
    const assignedIds = new Set((handlers[status] || []).map((u) => u.id));
    return userPool.filter((u) => u.status === 'ACTIVE' && !assignedIds.has(u.id));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Phân công xử lý trạng thái thực thi
        </h3>
        <button
          onClick={loadHandlers}
          disabled={loading}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          title="Tải lại"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Chỉ những người dùng được gán vào một trạng thái mới có thể chuyển kết quả thực thi sang trạng thái đó
        và xuất hiện trong danh sách giao việc. Hệ thống bắt đầu trống – cần phân công thủ công tại đây.
      </p>

      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {STATUS_LIST.map((s) => {
          const assigned = handlers[s.key] || [];
          const available = getAvailable(s.key);
          return (
            <div key={s.key} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="font-semibold text-slate-800">{s.label}</div>

              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {assigned.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Chưa có ai được phân công</span>
                ) : (
                  assigned.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {u.fullName || u.email}
                      <button
                        onClick={() => handleRemove(s.key, u.id)}
                        disabled={saving}
                        className="text-indigo-400 hover:text-rose-600 transition-colors"
                        title="Gỡ phân công"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selected[s.key] || ''}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Chọn người dùng để phân công...</option>
                  {available.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssign(s.key)}
                  disabled={saving || !selected[s.key]}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Thêm
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusHandlerManagement;
