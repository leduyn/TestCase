import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Key,
  CheckCircle2,
  Save,
  ShieldCheck,
  AlertCircle,
  Database,
  ExternalLink,
  Server,
  Monitor,
  Plus,
  Trash2,
  RotateCcw,
  Edit3,
  X,
  Loader2,
} from 'lucide-react';
import { aiApi, setupApi, environmentApi } from '../services/api';
import { AIConfigRow } from '../components/AIConfigRow';
import { PermissionManagement } from '../components/PermissionManagement';
import { SystemPromptEditor } from '../components/SystemPromptEditor';
import type { AIProviderInfo, AIConfig } from '../types';
import { usePermissions } from '../hooks/usePermissions';

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
  const { hasPermission } = usePermissions();
  
  const canManageAI = hasPermission('settings:ai:write');
  const canReadAI = hasPermission('settings:ai:read');
  const canManageEnv = hasPermission('settings:env:write');
  const canReadEnv = hasPermission('settings:env:read');
  const canManagePermissions = hasPermission('users:update'); // Admin only

  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [configs, setConfigs] = useState<AIConfig[]>([]);

  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [provider, setProvider] = useState('gemini');
  const [modelName, setModelName] = useState('gemini-3.7-flash');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

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
    try {
      const res = await setupApi.getStatus();
      setDbStatus(res.data);
    } catch (err: any) {
      setDbStatus(err.response?.data || { status: 'UNKNOWN', message: err.message });
    }
  };

  useEffect(() => {
    loadData();
    checkDb();
  }, []);

  useEffect(() => {
    // Chỉ tự đổi model khi không phải đang edit hoặc người dùng tự đổi provider
    if (!editingConfigId) {
      const current = providers.find((p) => p.id === provider);
      if (current) {
        setModelName(current.defaultModel);
        if (current.defaultBaseUrl) setBaseUrl(current.defaultBaseUrl);
      }
    }
  }, [provider, providers, editingConfigId]);

  const handleStartEdit = (conf: AIConfig) => {
    setEditingConfigId(conf.id);
    setProvider(conf.provider);
    setModelName(conf.modelName);
    setBaseUrl(conf.baseUrl || '');
    setIsActive(conf.isActive);
    setApiKey(''); // Để trống, nếu không nhập gì thì backend giữ nguyên key cũ
    setError(null);
    setSavedSuccess(null);

    // Kiểm tra xem modelName có trong danh sách mặc định không
    const pObj = providers.find((p) => p.id === conf.provider);
    if (pObj && !pObj.models.includes(conf.modelName)) {
      setIsCustomModel(true);
    } else {
      setIsCustomModel(false);
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelEdit = () => {
    setEditingConfigId(null);
    setProvider('gemini');
    setModelName('gemini-3.7-flash');
    setIsCustomModel(false);
    setApiKey('');
    setBaseUrl('');
    setIsActive(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSavedSuccess(null);

    try {
      if (editingConfigId) {
        // Cập nhật cấu hình hiện có
        await aiApi.updateConfig(editingConfigId, {
          provider,
          apiKey: apiKey.trim() || undefined,
          modelName,
          baseUrl: baseUrl.trim() || undefined,
          isActive,
        });
        setSavedSuccess('Đã cập nhật cấu hình AI thành công!');
        setEditingConfigId(null);
      } else {
        // Tạo mới cấu hình
        if (!apiKey.trim()) {
          throw new Error('Vui lòng nhập API Key khi tạo cấu hình mới.');
        }
        await aiApi.saveConfig({
          provider,
          apiKey: apiKey.trim(),
          modelName,
          baseUrl: baseUrl.trim() || undefined,
          isActive,
        });
        setSavedSuccess('Đã lưu cấu hình AI mới vào cơ sở dữ liệu!');
      }

      setApiKey('');
      await loadData();
      setTimeout(() => setSavedSuccess(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (conf: AIConfig) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cấu hình AI "${conf.provider.toUpperCase()} - ${conf.modelName}" không?`)) {
      return;
    }

    setActionLoadingId(conf.id);
    setError(null);

    try {
      await aiApi.deleteConfig(conf.id);
      if (editingConfigId === conf.id) {
        handleCancelEdit();
      }
      setSavedSuccess(`Đã xóa cấu hình "${conf.provider.toUpperCase()}" thành công!`);
      await loadData();
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi xóa cấu hình');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleActive = async (conf: AIConfig) => {
    setActionLoadingId(conf.id);
    setError(null);

    try {
      const res = await aiApi.toggleActive(conf.id);
      setSavedSuccess(res.data.message || 'Cập nhật trạng thái thành công');
      await loadData();
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi cập nhật trạng thái');
    } finally {
      setActionLoadingId(null);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
      {(canReadEnv || canManageEnv) && (
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
              {canManageEnv && (
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
              )}

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
                      {canManageEnv && (
                        <button
                          type="button"
                          onClick={() => handleRemoveServer(s)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                          title={`Xóa ${s}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
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
              {canManageEnv && (
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
              )}

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
                      {canManageEnv && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOs(o)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                          title={`Xóa ${o}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {canManageEnv && (
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveEnvironments}
                disabled={savingEnv}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                {savingEnv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingEnv ? 'Đang lưu...' : 'Lưu danh sách Server & OS'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cấu hình Database */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              Cấu hình Database PostgreSQL
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm tra trạng thái kết nối hoặc chuyển đến trang Setup để cấu hình lại.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-950/40">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
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

      {/* Form Cấu hình AI */}
      {(canReadAI || canManageAI) && (
        <div ref={formRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 scroll-mt-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              {editingConfigId ? 'Chỉnh sửa Cấu hình AI' : 'Thêm hoặc Cập nhật Cấu hình AI'}
            </h2>
            {editingConfigId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Hủy chỉnh sửa
              </button>
            )}
          </div>

          {editingConfigId && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3.5 rounded-xl flex items-start gap-2.5 text-blue-800 dark:text-blue-200 text-xs">
              <Edit3 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Đang ở chế độ Chỉnh sửa cấu hình</p>
                <p className="mt-0.5 text-blue-600 dark:text-blue-300">
                  Để trống ô API Key nếu bạn muốn giữ nguyên mã API Key đã lưu trước đó.
                </p>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {savedSuccess}
            </div>
          )}

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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
                    placeholder="Nhập tên model..."
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
                    <option value="__custom__">+ Nhập tên model tùy chỉnh khác...</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingConfigId ? 'Để trống để giữ nguyên key cũ' : 'Nhập API Key...'}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base URL (tùy chọn)
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is-active" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Đặt làm Provider mặc định khi sinh Test Case
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {editingConfigId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy bỏ
                </button>
              )}
              {canManageAI && (
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Đang lưu...' : editingConfigId ? 'Cập nhật cấu hình' : 'Lưu cấu hình'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Danh sách cấu hình đã lưu */}
      {canReadAI && (
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
                <AIConfigRow
                  key={conf.id}
                  conf={conf}
                  canManageAI={canManageAI}
                  isLoading={actionLoadingId === conf.id}
                  isBeingEdited={editingConfigId === conf.id}
                  onToggleActive={handleToggleActive}
                  onStartEdit={handleStartEdit}
                  onDelete={handleDeleteConfig}
                />
              ))}
            </div>
)}

        </div>
      )}

      {/* System Prompt AI */}
      <SystemPromptEditor />

      {/* Permission Management */}
      <PermissionManagement canManagePermissions={canManagePermissions} />
    </div>
  );
};
export default Settings;