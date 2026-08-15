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
} from 'lucide-react';
import { testCaseApi } from '../services/api';
import type { TestSuite } from '../types';

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
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Nhập Test Case từ Excel
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Nhập danh sách Test Case & Ánh xạ cột
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl mx-auto">
          Tải lên file Excel, ánh xạ các cột sang trường dữ liệu và nhập vào bộ Test Suite mới hoặc hiện có.
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
      {step === 1 && (
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
