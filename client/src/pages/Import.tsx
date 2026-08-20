import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  UploadCloud,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Table2,
  MapPin,
  Loader2,
  FileJson,
  Clipboard,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { testCaseApi } from '../services/api';
import type { TestSuite, GenerationResult } from '../types';

interface ImportField {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

const FIELDS: ImportField[] = [
  { key: 'testCaseCode', label: 'Mã TC', required: false, hint: 'Tự sinh nếu để trống' },
  { key: 'module', label: 'Module / Chức năng', required: true },
  { key: 'platform', label: 'Nền tảng', required: false, hint: 'App / CMS / Web' },
  { key: 'title', label: 'Tiêu đề', required: true },
  { key: 'testType', label: 'Loại kiểm thử', required: false, hint: 'Luồng chuẩn / Ngoại lệ / Giá trị biên' },
  { key: 'preconditions', label: 'Điều kiện tiên quyết', required: false },
  { key: 'steps', label: 'Các bước', required: false },
  { key: 'expectedResult', label: 'Kết quả mong đợi', required: false },
  { key: 'priority', label: 'Độ ưu tiên', required: false, hint: 'Cao / Trung bình / Thấp' },
];

interface PreviewData {
  sheetName: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

interface ImportResult {
  testSuite: TestSuite;
  importedCount: number;
  skippedCount: number;
  skipped: Array<{ row: number; reason: string }>;
}

export const Import: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [importMode, setImportMode] = useState<'excel' | 'json'>('excel');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonPreview, setJsonPreview] = useState<{ valid: boolean; parsed?: GenerationResult; error?: string } | null>(null);

  const [target, setTarget] = useState<'new' | 'existing'>('new');
  const [suiteName, setSuiteName] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [summary, setSummary] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [existingSuiteId, setExistingSuiteId] = useState('');
  const [suites, setSuites] = useState<TestSuite[]>([]);

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const loadSuites = async () => {
      try {
        const res = await testCaseApi.getSuites();
        setSuites(res.data.suites || []);
      } catch {
        /* ignore - import may work without listing */
      }
    };
    loadSuites();
  }, []);

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setError('Chỉ hỗ trợ file Excel (.xlsx / .xls)');
      return;
    }
    setError(null);
    setFile(f);
    setPreview(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Vui lòng chọn file Excel');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await testCaseApi.importPreview(formData);
      setPreview(res.data);
      setMapping(res.data.suggestedMapping || {});
      setStep(2);
    } catch (err: any) {
      const detail = err.response?.data?.error;
      setError(detail ? `Lỗi đọc file: ${detail}` : (err.response?.data?.message || err.message || 'Lỗi đọc file Excel'));
    } finally {
      setLoading(false);
    }
  };

  const validateJson = () => {
    if (!jsonInput.trim()) {
      setJsonPreview({ valid: false, error: 'Vui lòng dán nội dung JSON' });
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput) as GenerationResult;
      
      // Basic validation
      if (!parsed.moduleName || typeof parsed.moduleName !== 'string') {
        setJsonPreview({ valid: false, error: 'Thiếu trường bắt buộc: moduleName (string)' });
        return;
      }
      if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) {
        setJsonPreview({ valid: false, error: 'Thiếu trường bắt buộc: testCases (mảng không rỗng)' });
        return;
      }
      
      // Check each test case has required fields
      const missingFields = parsed.testCases
        .map((tc, i) => {
          const errors: string[] = [];
          if (!tc.title?.trim()) errors.push('title');
          if (!tc.module?.trim()) errors.push('module');
          return errors.length > 0 ? `Dòng ${i + 1}: thiếu ${errors.join(', ')}` : null;
        })
        .filter(Boolean);
      
      if (missingFields.length > 0) {
        setJsonPreview({ 
          valid: false, 
          error: 'Các Test Case thiếu trường bắt buộc:\n' + missingFields.slice(0, 5).join('\n') + (missingFields.length > 5 ? '\n...' : '') 
        });
        return;
      }
      
      setJsonPreview({ valid: true, parsed });
    } catch (e: any) {
      setJsonPreview({ valid: false, error: `JSON không hợp lệ: ${e.message}` });
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJsonInput(text);
      setJsonPreview(null);
    } catch {
      setError('Không thể truy cập clipboard. Hãy dán thủ công (Ctrl+V).');
    }
  };

  const handleImportJson = async () => {
    if (!jsonPreview?.valid || !jsonPreview.parsed) return;
    if (target === 'existing' && !existingSuiteId) {
      setError('Vui lòng chọn bộ Test Suite để thêm dữ liệu');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await testCaseApi.importJson(jsonPreview.parsed);
      setResult({
        testSuite: res.data.testSuite,
        importedCount: res.data.importedCount,
        skippedCount: res.data.skippedCount,
        skipped: res.data.skipped || [],
      });
      setStep(3);
    } catch (err: any) {
      const detail = err.response?.data?.error;
      const base = err.response?.data?.message || err.message || 'Lỗi nhập Test Case từ JSON';
      setError(detail ? `${base}\n→ Chi tiết: ${detail}` : base);
    } finally {
      setLoading(false);
    }
  };

  const setFieldMapping = (key: string, header: string) => {
    setMapping((prev) => ({ ...prev, [key]: header }));
  };

  const missingRequired = FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  );

  const handleImport = async () => {
    if (!file) return;
    if (missingRequired.length > 0) {
      setError(`Thiếu ánh xạ cho trường bắt buộc: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }
    if (target === 'existing' && !existingSuiteId) {
      setError('Vui lòng chọn bộ Test Suite để thêm dữ liệu');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('target', target);
      if (target === 'new') {
        if (suiteName) formData.append('suiteName', suiteName);
        if (moduleName) formData.append('moduleName', moduleName);
        if (summary) formData.append('summary', summary);
        if (assumptions) formData.append('assumptions', assumptions);
      } else {
        formData.append('suiteId', existingSuiteId);
      }

      const res = await testCaseApi.importTestCases(formData);
      setResult({
        testSuite: res.data.testSuite,
        importedCount: res.data.importedCount,
        skippedCount: res.data.skippedCount,
        skipped: res.data.skipped || [],
      });
      setStep(3);
    } catch (err: any) {
      const detail = err.response?.data?.error;
      const base = err.response?.data?.message || err.message || 'Lỗi nhập Test Case';
      setError(detail ? `${base}\n→ Chi tiết: ${detail}` : base);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = useCallback(() => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setError(null);
    setTarget('new');
    setSuiteName('');
    setModuleName('');
    setSummary('');
    setAssumptions('');
    setExistingSuiteId('');
    setImportMode('excel');
    setJsonInput('');
    setJsonPreview(null);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          {importMode === 'excel' ? <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> : <FileJson className="w-4 h-4 text-emerald-600" />}
          Nhập Test Case từ {importMode === 'excel' ? 'Excel' : 'JSON (AI)'}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          {importMode === 'excel' ? 'Nhập danh sách Test Case & Ánh xạ cột' : 'Nhập Test Case từ JSON trả về bởi AI'}
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl mx-auto">
          {importMode === 'excel' 
            ? 'Tải lên file Excel, ánh xạ các cột sang trường dữ liệu và nhập vào bộ Test Suite mới hoặc hiện có.'
            : 'Dán JSON schema GenerationResult từ AI, hệ thống sẽ tự tạo Test Suite và Test Case.'}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {[
          { n: 1, label: 'Tải file & Chọn đích' },
          { n: 2, label: 'Ánh xạ cột' },
          { n: 3, label: 'Hoàn tất' },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s.n
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.n ? <CheckCircle2 className="w-5 h-5" /> : s.n}
              </div>
              <span
                className={`text-xs sm:text-sm font-medium hidden sm:block ${
                  step >= s.n ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < 2 && <div className="w-8 sm:w-16 h-0.5 bg-slate-200 dark:bg-slate-700" />}
          </React.Fragment>
        ))}
      </div>

      {/* Mode Selector */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setImportMode('excel'); setStep(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            importMode === 'excel'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-1" /> Excel
        </button>
        <button
          type="button"
          onClick={() => { setImportMode('json'); setStep(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            importMode === 'json'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <FileJson className="w-4 h-4 inline mr-1" /> JSON từ AI
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm whitespace-pre-line">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Đã xảy ra lỗi:</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && importMode === 'excel' && (
        <div className="space-y-6">
          {/* Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <UploadCloud className="w-12 h-12 mx-auto text-emerald-500" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Kéo thả hoặc chọn file Excel (.xlsx / .xls)
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="excel-input"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="excel-input"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Chọn file
            </label>
            {file && (
              <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Đã chọn: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Target */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Chọn nơi lưu dữ liệu
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTarget('new')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === 'new'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                <p className="font-bold text-slate-900 dark:text-white">Tạo bộ mới</p>
                <p className="text-xs text-slate-500 mt-1">Tạo một Test Suite mới từ dữ liệu file.</p>
              </button>
              <button
                type="button"
                onClick={() => setTarget('existing')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === 'existing'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                <p className="font-bold text-slate-900 dark:text-white">Thêm vào bộ có sẵn</p>
                <p className="text-xs text-slate-500 mt-1">Nạp dữ liệu vào một bộ đã tồn tại.</p>
              </button>
            </div>

            {target === 'new' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tên bộ Test Suite <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={suiteName}
                    onChange={(e) => setSuiteName(e.target.value)}
                    placeholder="VD: Test Case Quản lý Khách hàng"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tên module / phân hệ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={moduleName}
                    onChange={(e) => setModuleName(e.target.value)}
                    placeholder="VD: Quản lý Khách hàng"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tóm tắt (tuỳ chọn)
                  </label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Giả định (tuỳ chọn)
                  </label>
                  <textarea
                    value={assumptions}
                    onChange={(e) => setAssumptions(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Chọn bộ Test Suite <span className="text-rose-500">*</span>
                </label>
                <select
                  value={existingSuiteId}
                  onChange={(e) => setExistingSuiteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- Chọn bộ hiện có --</option>
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.moduleName ? `(${s.moduleName})` : ''}
                    </option>
                  ))}
                </select>
                {suites.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Chưa có bộ nào. Hãy chọn "Tạo bộ mới".</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Tiếp tục & Xem trước
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 - JSON MODE */}
      {step === 1 && importMode === 'json' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-600" />
              Dán JSON từ AI
            </h3>
            <p className="text-sm text-slate-500">
              JSON phải tuân theo schema GenerationResult: moduleName, summary?, assumptions?, testCases[]
            </p>
            <textarea
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setJsonPreview(null); }}
              placeholder='{"moduleName": "Quản lý Khách hàng", "summary": "...", "assumptions": "...", "testCases": [...]}'
              rows={12}
              className="w-full font-mono text-sm p-4 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Clipboard className="w-4 h-4" />
                Dán từ Clipboard
              </button>
              <button
                type="button"
                onClick={validateJson}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Validate JSON
              </button>
            </div>
            
            {jsonPreview && jsonPreview.valid && jsonPreview.parsed && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl">
                <p className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  JSON hợp lệ
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div><b>Module:</b> {jsonPreview.parsed.moduleName}</div>
                  <div><b>Test Cases:</b> {jsonPreview.parsed.testCases.length}</div>
                  <div><b>Preview:</b> {jsonPreview.parsed.testCases.slice(0, 3).map(t => t.title).join(', ')}...</div>
                </div>
              </div>
            )}
            
            {jsonPreview && !jsonPreview.valid && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-xl text-rose-700 dark:text-rose-300 whitespace-pre-line">
                <p className="font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  JSON không hợp lệ
                </p>
                <p className="mt-1 text-sm">{jsonPreview.error}</p>
              </div>
            )}
          </div>

          {/* Target */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Chọn nơi lưu dữ liệu
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTarget('new')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === 'new'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                <p className="font-bold text-slate-900 dark:text-white">Tạo bộ mới</p>
                <p className="text-xs text-slate-500 mt-1">Tạo một Test Suite mới từ dữ liệu JSON.</p>
              </button>
              <button
                type="button"
                onClick={() => setTarget('existing')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === 'existing'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                <p className="font-bold text-slate-900 dark:text-white">Thêm vào bộ có sẵn</p>
                <p className="text-xs text-slate-500 mt-1">Nạp dữ liệu vào một bộ đã tồn tại.</p>
              </button>
            </div>

            {target === 'new' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tên bộ Test Suite <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={suiteName}
                    onChange={(e) => setSuiteName(e.target.value)}
                    placeholder="VD: Test Case Quản lý Khách hàng (tự động từ JSON nếu để trống)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tên module / phân hệ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={moduleName}
                    onChange={(e) => setModuleName(e.target.value)}
                    placeholder="Sẽ lấy từ JSON moduleName nếu để trống"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Chọn bộ Test Suite <span className="text-rose-500">*</span>
                </label>
                <select
                  value={existingSuiteId}
                  onChange={(e) => setExistingSuiteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- Chọn bộ hiện có --</option>
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.moduleName ? `(${s.moduleName})` : ''}
                    </option>
                  ))}
                </select>
                {suites.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Chưa có bộ nào. Hãy chọn "Tạo bộ mới".</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImportJson}
              disabled={!jsonPreview?.valid || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Tạo Test Suite từ JSON
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && preview && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-1">
              <Table2 className="w-4 h-4 text-emerald-600" />
              Sheet: <span className="font-semibold text-slate-900 dark:text-white">{preview.sheetName}</span>
              <span className="text-slate-400">· {preview.headers.length} cột</span>
            </div>
            <p className="text-xs text-slate-400">
              Hệ thống đã tự động gợi ý ánh xạ dựa trên tiêu đề cột. Bạn có thể điều chỉnh bên dưới.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
            {FIELDS.map((f) => {
              const selectedHeader = mapping[f.key];
              const sampleValues = selectedHeader
                ? preview.sampleRows.map((row) => row[selectedHeader]).filter((v) => v && v.length)
                : [];
              return (
                <div key={f.key} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-center">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      {f.label}
                      {f.required && <span className="text-rose-500 ml-1">*</span>}
                    </p>
                    {f.hint && <p className="text-xs text-slate-400 mt-0.5">{f.hint}</p>}
                  </div>
                  <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={selectedHeader || ''}
                      onChange={(e) => setFieldMapping(f.key, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="">— Không ánh xạ —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {sampleValues.length > 0 && (
                      <div className="text-xs text-slate-400 sm:w-48 truncate" title={sampleValues.join(' | ')}>
                        VD: {sampleValues.slice(0, 2).join(' / ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Cần ánh xạ ít nhất: {missingRequired.map((f) => f.label).join(', ')}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </button>
            <button
              onClick={handleImport}
              disabled={loading || missingRequired.length > 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Bắt đầu nhập
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && result && (
        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
            <h3 className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
              Nhập thành công!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Đã nhập <span className="font-bold text-emerald-700 dark:text-emerald-300">{result.importedCount}</span> Test Case
              {result.skippedCount > 0 && (
                <>
                  {' '}· Bỏ qua <span className="font-bold text-amber-600">{result.skippedCount}</span> dòng
                </>
              )}
            </p>
          </div>

          {result.skippedCount > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Các dòng bị bỏ qua ({result.skippedCount})
              </h4>
              <div className="max-h-48 overflow-auto text-xs">
                <table className="w-full text-left">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-4">Dòng</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1 pr-4 text-slate-700 dark:text-slate-300">{s.row}</td>
                        <td className="text-slate-600 dark:text-slate-400">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(`/suites/${result.testSuite.id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
            >
              Xem bộ Test Suite
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Nhập file khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;
