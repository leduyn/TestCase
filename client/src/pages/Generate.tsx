import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  Cpu,
  Key,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { testCaseApi, aiApi } from '../services/api';
import type { AIProviderInfo, AIConfig } from '../types';

export const Generate: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [suiteName, setSuiteName] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  // AI Configuration state
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.7-flash');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isConfigCustomModel, setIsConfigCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await aiApi.getProviders();
        setProviders(res.data.providers || []);
      } catch (err) {
        console.warn('Could not load AI providers list', err);
      }
    };

    const loadConfigs = async () => {
      try {
        const res = await aiApi.getConfigs();
        const loaded = res.data.configs || [];
        setConfigs(loaded);
        // Pre-select the active config (or the first one) if available
        const active = loaded.find((c) => c.isActive) || loaded[0];
        if (active) {
          setSelectedConfigId(active.id);
          setSelectedProvider(active.provider);
          setSelectedModel(active.modelName);
          setBaseUrl(active.baseUrl || '');
          setApiKey('');
        }
      } catch {
        // Anonymous or not configured - manual entry remains available
      }
    };

    Promise.all([loadProviders(), loadConfigs()]);
  }, []);

  const providerLabel = (id: string) =>
    providers.find((p) => p.id === id)?.name || id.charAt(0).toUpperCase() + id.slice(1);

  const handleSelectConfig = (id: string | null) => {
    setSelectedConfigId(id);
    if (id) {
      const c = configs.find((x) => x.id === id);
      if (c) {
        setSelectedProvider(c.provider);
        setSelectedModel(c.modelName);
        setBaseUrl(c.baseUrl || '');
        setApiKey('');
      }
    }
  };

  const selectedConfig = configs.find((c) => c.id === selectedConfigId);
  const activeProviderId = selectedConfig ? selectedConfig.provider : selectedProvider;
  const activeProviderObj = providers.find((p) => p.id === activeProviderId);

  // Update selected model when provider changes
  useEffect(() => {
    const p = providers.find((pr) => pr.id === selectedProvider);
    if (p) {
      setSelectedModel(p.defaultModel);
      if (p.defaultBaseUrl) setBaseUrl(p.defaultBaseUrl);
    }
  }, [selectedProvider, providers]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!suiteName) {
        setSuiteName(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      if (!suiteName) {
        setSuiteName(dropped.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === 'upload' && !file) {
      setError('Vui lòng chọn hoặc kéo thả file tài liệu (PDF, TXT, DOCX)');
      return;
    }
    if (activeTab === 'text' && !rawText.trim()) {
      setError('Vui lòng nhập nội dung tài liệu yêu cầu');
      return;
    }

    setLoading(true);
    setProgressStep(1); // Reading document

    try {
      const formData = new FormData();
      if (activeTab === 'upload' && file) {
        formData.append('file', file);
      } else {
        formData.append('rawText', rawText);
      }

      if (suiteName) formData.append('suiteName', suiteName);
      if (customInstruction) formData.append('customInstruction', customInstruction);
      formData.append('provider', selectedProvider);
      formData.append('modelName', selectedModel);
      if (selectedConfigId) {
        formData.append('configId', selectedConfigId);
      } else {
        if (apiKey) formData.append('apiKey', apiKey);
        if (baseUrl) formData.append('baseUrl', baseUrl);
      }

      setTimeout(() => setProgressStep(2), 1200); // AI Thinking
      setTimeout(() => setProgressStep(3), 3500); // Saving & structuring

      const res = await testCaseApi.generate(formData);

      setProgressStep(4); // Done
      setTimeout(() => {
        navigate(`/suites/${res.data.testSuite.id}`);
      }, 800);
    } catch (err: any) {
      console.error('Generate error:', err);
      const detail = err.response?.data?.error;
      const baseMsg = err.response?.data?.message || err.message || 'Lỗi trong quá trình sinh Test Case';
      setError(detail ? `${baseMsg}\n→ Chi tiết: ${detail}` : baseMsg);
      setLoading(false);
      setProgressStep(0);
    }
  };

  const currentProviderObj = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-blue-600" />
          AI Test Generation Studio
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Phân tích Tài liệu & Tự động Sinh Test Case
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Tải lên tài liệu đặc tả nghiệp vụ (BRD/SRS) dạng PDF, TXT hoặc DOCX. AI sẽ phân tích và tạo bộ kịch bản kiểm thử toàn diện kèm phân chia App/CMS.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Đã xảy ra lỗi:</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Overlay with Stepper */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 p-8 rounded-2xl shadow-xl text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              AI đang phân tích tài liệu và tạo bộ Test Case...
            </h3>
            <p className="text-xs text-slate-500">
              Quá trình này có thể mất từ 10 - 30 giây tuỳ thuộc vào độ dài tài liệu.
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-3 text-left">
            <div className={`flex items-center gap-3 text-xs font-semibold ${progressStep >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>1. Đọc và bóc tách nội dung tài liệu</span>
            </div>
            <div className={`flex items-center gap-3 text-xs font-semibold ${progressStep >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>2. AI phân tích luồng nghiệp vụ & sinh kịch bản chuẩn / ngoại lệ / biên</span>
            </div>
            <div className={`flex items-center gap-3 text-xs font-semibold ${progressStep >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>3. Chuẩn hoá cấu trúc và lưu vào PostgreSQL</span>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Document Input */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                1. Tài liệu đầu vào
              </h2>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${activeTab === 'upload'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Upload File (PDF/DOCX/TXT)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${activeTab === 'text'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Dán nội dung Text
                </button>
              </div>
            </div>

            {activeTab === 'upload' ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
              >
                <input
                  type="file"
                  id="doc-upload"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="doc-upload" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-bold text-blue-600">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB • Nhấn để thay đổi file khác
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Kéo thả file tài liệu vào đây, hoặc <span className="text-blue-600 underline">chọn từ máy tính</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Hỗ trợ PDF, DOCX, TXT (Tối đa 25MB)</p>
                    </div>
                  )}
                </label>
              </div>
            ) : (
              <div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán nội dung đặc tả yêu cầu chức năng, luồng nghiệp vụ hoặc mô tả API..."
                  rows={8}
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Suite name input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên bộ Test Suite (Tuỳ chọn)
              </label>
              <input
                type="text"
                value={suiteName}
                onChange={(e) => setSuiteName(e.target.value)}
                placeholder="VD: Phân hệ Khách hàng - App & CMS"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 2: AI Provider & Options */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Cpu className="w-5 h-5 text-indigo-600" />
              2. Cấu hình AI Provider
            </h2>

            {configs.length > 0 ? (
              <div className="space-y-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Sử dụng cấu hình AI đã lưu (không cần nhập lại API Key)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cấu hình đã lưu
                    </label>
                    <select
                      value={selectedConfigId ?? ''}
                      onChange={(e) => handleSelectConfig(e.target.value || null)}
                      className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">— Tùy chỉnh / Nhập thủ công —</option>
                      {configs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {providerLabel(c.provider)}
                          {c.isActive ? ' (mặc định)' : ''} · {c.modelName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedConfigId && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Mô hình AI (Model)
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsConfigCustomModel(!isConfigCustomModel)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {isConfigCustomModel ? '← Chọn từ danh sách' : '+ Nhập model khác'}
                        </button>
                      </div>

                      {isConfigCustomModel ? (
                        <input
                          type="text"
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          placeholder="Nhập mã model bất kỳ..."
                          className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                        />
                      ) : (
                        <select
                          value={selectedModel}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setIsConfigCustomModel(true);
                              setSelectedModel('');
                            } else {
                              setSelectedModel(e.target.value);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          {activeProviderObj?.models?.map((m) => (
                            <option key={m} value={m}>
                              {m} {m === activeProviderObj.defaultModel ? '★ (Khuyên dùng)' : ''}
                            </option>
                          ))}
                          <option value="__custom__">+ Nhập mã model tùy chỉnh khác...</option>
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {selectedConfigId && (
                  <p className="text-xs text-slate-500">
                    Đang dùng API Key đã lưu từ cấu hình{' '}
                    <b className="text-slate-700 dark:text-slate-200">{providerLabel(activeProviderId)}</b> ({activeProviderObj?.models?.length || 0} mô hình sẵn sàng).
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Chưa có cấu hình AI nào được lưu.{' '}
                <Link to="/settings" className="text-blue-600 hover:underline">
                  Thêm tại Cài đặt
                </Link>{' '}
                hoặc nhập thủ công bên dưới.
              </div>
            )}

            {!selectedConfigId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nhà cung cấp AI (Provider)
                    </label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="gemini">Google Gemini (Khuyên dùng)</option>
                      <option value="openrouter">OpenRouter (Multi-model & Free models)</option>
                      <option value="groq">Groq AI (Ultra-fast Inference)</option>
                      <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                      <option value="deepseek">DeepSeek AI</option>
                      <option value="custom">Custom / Local (Ollama, vLLM)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mô hình AI (Model)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomModel(!isCustomModel)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {isCustomModel ? '← Chọn từ danh sách' : '+ Nhập model khác'}
                      </button>
                    </div>

                    {isCustomModel ? (
                      <input
                        type="text"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        placeholder="Nhập mã model bất kỳ..."
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    ) : (
                      <select
                        value={selectedModel}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomModel(true);
                            setSelectedModel('');
                          } else {
                            setSelectedModel(e.target.value);
                          }
                        }}
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {currentProviderObj?.models?.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === currentProviderObj.defaultModel ? '★ (Khuyên dùng)' : ''}
                          </option>
                        ))}
                        <option value="__custom__">+ Nhập mã model tùy chỉnh khác...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-blue-600" />
                    API Key (Để trống nếu đã cấu hình trong .env hoặc Cài đặt)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... hoặc sk-..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                {selectedProvider === 'custom' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Base URL API
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1 hoặc https://..."
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Custom Instruction */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Yêu cầu bổ sung cho AI (Prompt Customization)
              </label>
              <input
                type="text"
                value={customInstruction || `Bạn là một Senior QA Engineer. Nhiệm vụ của bạn là phân tích tài liệu được cung cấp và tạo bộ Test Case đầy đủ (Happy Path, Negative, Boundary Cases).Phân tích cực kỳ chi tiết từng màn hình và chức năng. Yêu cầu sinh tối thiểu 40-50 Test Case bao phủ toàn diện:
1. Luồng chuẩn cho từng vai trò người dùng (Happy path).
2. Kiểm tra tất cả các lỗi Validation (bỏ trống, sai định dạng, vượt quá độ dài, SQL injection/ký tự đặc biệt).
3. Kiểm tra các giá trị biên (Boundary cases) cho mọi trường số/ngày tháng/ký tự.
4. Tách biệt rõ ràng các kịch bản kiểm thử trên App và CMS.`}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="VD: Tách rõ kịch bản App và CMS; Bổ sung nhiều case kiểm tra giá trị biên cho số điện thoại..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-5 h-5" />
              Bắt đầu Phân tích & Sinh Test Case
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
