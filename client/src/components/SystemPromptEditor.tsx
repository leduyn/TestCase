import React from 'react';
import { FileText, Edit3, Loader2 } from 'lucide-react';
import { aiApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

export const SystemPromptEditor: React.FC = () => {
  const { hasPermission } = usePermissions();
  
  const canManagePrompt = hasPermission('settings:prompt:write');
  const canReadPrompt = hasPermission('settings:prompt:read');

  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [editingPrompt, setEditingPrompt] = React.useState(false);
  const [savingPrompt, setSavingPrompt] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    aiApi.getSystemPrompt()
      .then(res => setSystemPrompt(res.data.prompt))
      .catch(err => console.warn('Error loading system prompt:', err));
  }, []);

  // Don't render anything if no permission
  if (!canReadPrompt && !canManagePrompt) return null;

  const handleSavePrompt = async () => {
    if (!systemPrompt.trim() || systemPrompt.trim().length < 100) {
      setError('Prompt quá ngắn (tối thiểu 100 ký tự)');
      return;
    }
    setError(null);
    setSavingPrompt(true);
    try {
      await aiApi.updateSystemPrompt(systemPrompt.trim());
      setEditingPrompt(false);
      setSavedSuccess('Đã cập nhật System Prompt thành công!');
      setTimeout(() => setSavedSuccess(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi cập nhật System Prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <FileText className="w-5 h-5 text-purple-600" />
        System Prompt AI (Dùng cho sinh Test Case)
      </h2>
      <p className="text-xs text-slate-500">
        Prompt hệ thống được gửi kèm mỗi request đến AI. Tùy chỉnh để thay đổi hành vi sinh Test Case.
      </p>

      {savedSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {savedSuccess}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-semibold">
          <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          {error}
        </div>
      )}

      {!editingPrompt ? (
        <div className="space-y-3">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 max-h-96 overflow-auto">
            <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{systemPrompt || 'Đang tải...'}</pre>
          </div>
          {canManagePrompt && (
            <button
              type="button"
              onClick={() => setEditingPrompt(true)}
              className="text-sm text-purple-600 hover:underline flex items-center gap-1"
            >
              <Edit3 className="w-4 h-4" /> Chỉnh sửa System Prompt
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={25}
            className="w-full font-mono text-xs p-4 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-purple-500"
            spellCheck={false}
            placeholder="Nhập System Prompt mới..."
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingPrompt(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            {canManagePrompt && (
              <button
                type="button"
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {savingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu System Prompt'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemPromptEditor;