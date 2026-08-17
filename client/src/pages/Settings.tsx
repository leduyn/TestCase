import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Key,
  CheckCircle2,
  Save,
  ShieldCheck,
  AlertCircle,
  Database,
  RefreshCw,
  ExternalLink,
  Server,
  Monitor,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { aiApi, setupApi, environmentApi } from '../services/api';
import type { AIProviderInfo, AIConfig } from '../types';

const DEFAULT_SERVERS = ['DEV', 'STAGING', 'UAT', 'PRODUCTION'];
const DEFAULT_OS_LIST = [
  'Windows 11',
  'Windows 10',
  'macOS Sonoma',
  'macOS Sequoia',
  'Android 14',
  'Android 15',
  'iOS 17.5',
  'iOS 18',
  'Ubuntu 22.04',
];

export const Settings: React.FC = () => {
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [configs, setConfigs] = useState<AIConfig[]>([]);

  const [provider, setProvider] = useState('gemini');
  const [modelName, setModelName] = useState('gemini-3.7-flash');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Environment Settings (Server & OS)
  const [servers, setServers] = useState<string[]>(DEFAULT_SERVERS);
  const [osList, setOsList] = useState<string[]>(DEFAULT_OS_LIST);
  const [newServer, setNewServer] = useState('');
  const [newOs, setNewOs] = useState('');
  const [savingEnv, setSavingEnv] = useState(false);
  const [savedEnvSuccess, setSavedEnvSuccess] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  // DB Status
  const [dbStatus, setDbStatus] = useState<{ status: string; message: string } | null>(null);
  const [loadingDbStatus, setLoadingDbStatus] = useState(false);

  const loadData = async () => {
    try {
      const [provRes, confRes, envRes] = await Promise.all([
        aiApi.getProviders(),
        aiApi.getConfigs(),
        environmentApi.getEnvironments(),
      ]);
      setProviders(provRes.data.providers || []);
      setConfigs(confRes.data.configs || []);
      if (envRes.data.servers && envRes.data.servers.length > 0) {
        setServers(envRes.data.servers);
      }
      if (envRes.data.osList && envRes.data.osList.length > 0) {
        setOsList(envRes.data.osList);
      }
    } catch (err) {
      console.warn('Error loading settings:', err);
    }
  };

  const checkDb = async () => {
    setLoadingDbStatus(true);
    try {
      const res = await setupApi.getStatus();
      setDbStatus(res.data);
    } catch (err: any) {
      setDbStatus(err.response?.data || { status: 'UNKNOWN', message: err.message });
    } finally {
      setLoadingDbStatus(false);
    }
  };

  useEffect(() => {
    loadData();
    checkDb();
  }, []);

  useEffect(() => {
    const current = providers.find((p) => p.id === provider);
    if (current) {
      setModelName(current.defaultModel);
      if (current.defaultBaseUrl) setBaseUrl(current.defaultBaseUrl);
    }
  }, [provider, providers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSavedSuccess(false);

    try {
      await aiApi.saveConfig({
        provider,
        apiKey,
        modelName,
        baseUrl: baseUrl || undefined,
        isActive,
      });

      setSavedSuccess(true);
      setApiKey('');
      await loadData();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Add Server
  const handleAddServer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = newServer.trim().toUpperCase();
    if (!val) return;
    if (!servers.includes(val)) {
      setServers([...servers, val]);
    }
    setNewServer('');
  };

  const handleRemoveServer = (serverToRemove: string) => {
    setServers(servers.filter((s) => s !== serverToRemove));
  };

  // Add OS
  const handleAddOs = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = newOs.trim();
    if (!val) return;
    if (!osList.includes(val)) {
      setOsList([...osList, val]);
    }
    setNewOs('');
  };

  const handleRemoveOs = (osToRemove: string) => {
    setOsList(osList.filter((o) => o !== osToRemove));
  };

  // Restore Default Environments
  const handleRestoreDefaultEnv = () => {
    setServers(DEFAULT_SERVERS);
    setOsList(DEFAULT_OS_LIST);
  };

  // Save Environment Settings
  const handleSaveEnvironments = async () => {
    setEnvError(null);
    setSavingEnv(true);
    setSavedEnvSuccess(false);

    try {
      await environmentApi.saveEnvironments({ servers, osList });
      setSavedEnvSuccess(true);
      setTimeout(() => setSavedEnvSuccess(false), 3000);
    } catch (err: any) {
      setEnvError(err.response?.data?.message || err.message || 'Lỗi lưu danh sách Server & OS');
    } finally {
      setSavingEnv(false);
    }
  };

  const currentProviderObj = providers.find((p) => p.id === provider);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          Cài đặt Hệ thống, Môi trường & AI
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Quản lý danh sách Server & Hệ điều hành kiểm thử, cấu hình kết nối PostgreSQL và API Key AI Engine.
        </p>
      </div>

      {/* Cài đặt Danh sách Server & Hệ điều hành */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Lựa chọn Selectbox: Server & Hệ điều hành (OS)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Các mục tại đây sẽ xuất hiện trong menu chọn Server và OS khi thực thi Test Case và bộ lọc.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestoreDefaultEnv}
            className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 self-start sm:self-auto"
            title="Khôi phục danh sách gợi ý ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>
        </div>

        {savedEnvSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Đã lưu danh sách Server và Hệ điều hành thành công!
          </div>
        )}

        {envError && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {envError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cài đặt Servers */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-600" />
              Danh sách Server ({servers.length})
            </label>

            {/* Input thêm Server mới */}
            <form onSubmit={handleAddServer} className="flex gap-2">
              <input
                type="text"
                value={newServer}
                onChange={(e) => setNewServer(e.target.value)}
                placeholder="VD: STAGING, UAT, PROD..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </form>

            {/* Tags Server */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 min-h-[110px] flex flex-wrap gap-2 content-start">
              {servers.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Chưa có Server nào. Hãy nhập để thêm.</span>
              ) : (
                servers.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemoveServer(s)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      title={`Xóa ${s}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Cài đặt OS */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-indigo-600" />
              Danh sách Hệ điều hành (OS) ({osList.length})
            </label>

            {/* Input thêm OS mới */}
            <form onSubmit={handleAddOs} className="flex gap-2">
              <input
                type="text"
                value={newOs}
                onChange={(e) => setNewOs(e.target.value)}
                placeholder="VD: Windows 11, iOS 18..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </form>

            {/* Tags OS */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 min-h-[110px] flex flex-wrap gap-2 content-start">
              {osList.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Chưa có OS nào. Hãy nhập để thêm.</span>
              ) : (
                osList.map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm"
                  >
                    {o}
                    <button
                      type="button"
                      onClick={() => handleRemoveOs(o)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      title={`Xóa ${o}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveEnvironments}
            disabled={savingEnv}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingEnv ? 'Đang lưu danh sách...' : 'Lưu cài đặt Server & OS'}
          </button>
        </div>
      </div>

      {/* Quản lý Cơ sở Dữ liệu */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Cơ sở Dữ liệu PostgreSQL
          </h2>
          <button
            onClick={checkDb}
            disabled={loadingDbStatus}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDbStatus ? 'animate-spin' : ''}`} />
            Kiểm tra kết nối
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  dbStatus?.status === 'READY' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {dbStatus?.status === 'READY' ? 'Đã kết nối PostgreSQL' : 'Cần kiểm tra kết nối'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {dbStatus?.message || 'Đang lấy trạng thái...'}
            </p>
          </div>

          <Link
            to="/setup"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Cấu hình / Tạo mới Database
          </Link>
        </div>
      </div>


      {/* Form Cấu hình AI mới */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Key className="w-5 h-5 text-blue-600" />
          Thêm hoặc Cập nhật Cấu hình AI
        </h2>

        {savedSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Đã lưu cấu hình AI thành công vào cơ sở dữ liệu!
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhà cung cấp (Provider)
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openrouter">OpenRouter (Multi-model & Free models)</option>
                <option value="groq">Groq AI (Ultra-fast Inference)</option>
                <option value="openai">OpenAI GPT</option>
                <option value="deepseek">DeepSeek AI</option>
                <option value="custom">Custom / OpenAI-Compatible (Ollama, vLLM)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mô hình (Model)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomModel(!isCustomModel)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isCustomModel ? '← Chọn từ danh sách có sẵn' : '+ Nhập tên model khác'}
                </button>
              </div>

              {isCustomModel ? (
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Nhập mã model bất kỳ (VD: gpt-4o, openrouter/free...)"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              ) : (
                <select
                  value={modelName}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomModel(true);
                      setModelName('');
                    } else {
                      setModelName(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {currentProviderObj?.models?.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === currentProviderObj.defaultModel ? '★ (Khuyên dùng)' : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Nhập mã model tùy chỉnh khác...</option>
                </select>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {currentProviderObj?.models?.length || 0} mô hình sẵn sàng cho nhà cung cấp này.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              API Key <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Nhập API Key của nhà cung cấp..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">
              API Key được lưu trữ mã hoá an toàn trong PostgreSQL và chỉ dùng cho tài khoản của bạn.
            </p>
          </div>

          {provider === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="is-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Đặt làm Provider mặc định khi sinh Test Case
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      </div>

      {/* Danh sách cấu hình đã lưu */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Các cấu hình AI đã lưu ({configs.length})
        </h2>

        {configs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            Chưa có cấu hình AI nào được lưu. Hệ thống sẽ sử dụng API Key mặc định trong file .env nếu có.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {configs.map((conf) => (
              <div key={conf.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                    {conf.provider.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                        {conf.provider}
                      </span>
                      {conf.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                          Đang kích hoạt
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Model: {conf.modelName} {conf.baseUrl ? `• ${conf.baseUrl}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(conf.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
