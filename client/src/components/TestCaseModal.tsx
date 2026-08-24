import React, { useState, useEffect } from 'react';
import { X, Save, Plus, AlertCircle, Sparkles, Copy } from 'lucide-react';
import type { TestCase } from '../types';
import { testCaseApi } from '../services/api';

interface TestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  testSuiteId: string;
  defaultModule?: string;
  testCaseToEdit?: TestCase | null;
  isDuplicate?: boolean;
  onSuccess: (savedTestCase: TestCase, isEdit: boolean) => void;
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({
  isOpen,
  onClose,
  testSuiteId,
  defaultModule = '',
  testCaseToEdit,
  isDuplicate = false,
  onSuccess,
}) => {
  const isEdit = Boolean(testCaseToEdit) && !isDuplicate;

  const [testCaseCode, setTestCaseCode] = useState('');
  const [module, setModule] = useState(defaultModule);
  const [platform, setPlatform] = useState('App');
  const [title, setTitle] = useState('');
  const [testType, setTestType] = useState('Luồng chuẩn');
  const [priority, setPriority] = useState('Cao');
  const [preconditions, setPreconditions] = useState('');
  const [steps, setSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (testCaseToEdit) {
        setTestCaseCode(isDuplicate ? '' : (testCaseToEdit.testCaseCode || ''));
        setModule(testCaseToEdit.module || defaultModule);
        setPlatform(testCaseToEdit.platform || 'App');
        setTitle(isDuplicate ? `${testCaseToEdit.title} (Bản sao)` : (testCaseToEdit.title || ''));
        setTestType(testCaseToEdit.testType || 'Luồng chuẩn');
        setPriority(testCaseToEdit.priority || 'Cao');
        setPreconditions(testCaseToEdit.preconditions || '');
        setSteps(testCaseToEdit.steps || '');
        setExpectedResult(testCaseToEdit.expectedResult || '');
      } else {
        setTestCaseCode('');
        setModule(defaultModule);
        setPlatform('App');
        setTitle('');
        setTestType('Luồng chuẩn');
        setPriority('Cao');
        setPreconditions('');
        setSteps('');
        setExpectedResult('');
      }
    }
  }, [isOpen, testCaseToEdit, defaultModule, isDuplicate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề kịch bản');
      return;
    }
    if (!module.trim()) {
      setError('Vui lòng nhập Module / Chức năng');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEdit && testCaseToEdit) {
        const res = await testCaseApi.updateTestCase(testCaseToEdit.id, {
          testCaseCode: testCaseCode.trim() || testCaseToEdit.testCaseCode,
          module: module.trim(),
          platform,
          title: title.trim(),
          testType,
          priority,
          preconditions: preconditions.trim(),
          steps: steps.trim(),
          expectedResult: expectedResult.trim(),
        });
        onSuccess(res.data.testCase, true);
      } else {
        const res = await testCaseApi.createTestCase({
          testSuiteId,
          testCaseCode: testCaseCode.trim() || undefined,
          module: module.trim(),
          platform,
          title: title.trim(),
          testType,
          priority,
          preconditions: preconditions.trim(),
          steps: steps.trim(),
          expectedResult: expectedResult.trim(),
        });
        onSuccess(res.data.testCase, false);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi lưu Test Case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-sm ${
              isDuplicate ? 'bg-indigo-600' : isEdit ? 'bg-blue-600' : 'bg-emerald-600'
            }`}>
              {isDuplicate ? <Copy className="w-4 h-4" /> : isEdit ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isDuplicate ? 'Nhân bản Test Case' : isEdit ? 'Chỉnh sửa Test Case' : 'Tạo thêm Test Case mới'}
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">
                {isDuplicate
                  ? `Nhân bản từ: ${testCaseToEdit?.testCaseCode} - ${testCaseToEdit?.title}`
                  : isEdit
                  ? `Mã: ${testCaseToEdit?.testCaseCode}`
                  : 'Bổ sung kịch bản kiểm thử vào bộ Test Suite hiện tại'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                {error}
              </div>
            )}

            {/* Row 1: Mã TC & Module */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mã Test Case
                </label>
                <input
                  type="text"
                  value={testCaseCode}
                  onChange={(e) => setTestCaseCode(e.target.value)}
                  placeholder="VD: TC001 (tự động nếu để trống)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Module / Chức năng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  placeholder="VD: Đăng ký TK, Quản lý Đơn hàng..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Tiêu đề */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tiêu đề kịch bản <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Đăng ký thành công với đầy đủ thông tin hợp lệ"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            {/* Row 3: Platform, Test Type, Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nền tảng (Platform)
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="App">App</option>
                  <option value="CMS">CMS</option>
                  <option value="Web">Web</option>
                  <option value="API">API</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Loại kiểm thử
                </label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Luồng chuẩn">Luồng chuẩn (Positive)</option>
                  <option value="Ngoại lệ">Ngoại lệ (Negative)</option>
                  <option value="Giá trị biên">Giá trị biên (Boundary)</option>
                  <option value="Bảo mật">Bảo mật (Security)</option>
                  <option value="Hiệu năng">Hiệu năng (Performance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mức ưu tiên
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Cao">Ưu tiên Cao</option>
                  <option value="Trung bình">Ưu tiên Trung bình</option>
                  <option value="Thấp">Ưu tiên Thấp</option>
                </select>
              </div>
            </div>

            {/* Row 4: Tiền điều kiện */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tiền điều kiện (Preconditions)
              </label>
              <textarea
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="VD: Người dùng đã tải và mở app ở màn hình Đăng ký..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Row 5: Các bước thực hiện */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Các bước thực hiện (Steps)
              </label>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder={"1. Nhập Họ và tên: Nguyen Van A\n2. Nhập SĐT: 0901234567\n3. Nhấn nút Tiếp tục..."}
                rows={4}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Row 6: Kết quả mong đợi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kết quả mong đợi (Expected Result)
              </label>
              <textarea
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder={"- Đăng ký thành công\n- TK xuất hiện trên CMS với trạng thái Chờ duyệt..."}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-emerald-900 dark:text-emerald-300 leading-relaxed font-medium"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-lg shadow-md transition-all disabled:opacity-60 ${
                isDuplicate
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isDuplicate ? <Copy className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {loading ? 'Đang lưu...' : isDuplicate ? 'Tạo bản sao' : isEdit ? 'Lưu thay đổi' : 'Tạo Test Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
