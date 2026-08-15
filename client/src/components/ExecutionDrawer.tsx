import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Clock, Server, Monitor, Save, Sparkles, Tag } from 'lucide-react';
import type { TestCase, ExecutionStatus } from '../types';
import { executionApi, environmentApi } from '../services/api';
import { PlatformBadge, PriorityBadge, TestTypeBadge, StatusBadge } from './Badge';
import { RichTextEditor } from './RichTextEditor';

interface ExecutionDrawerProps {
  testCase: TestCase | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedTestCase: TestCase) => void;
}

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

export const ExecutionDrawer: React.FC<ExecutionDrawerProps> = ({
  testCase,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !testCase) return null;

  const currentExec = testCase.latestExecution;

  const [availableServers, setAvailableServers] = useState<string[]>(DEFAULT_SERVERS);
  const [availableOsList, setAvailableOsList] = useState<string[]>(DEFAULT_OS_LIST);

  const [server, setServer] = useState(currentExec?.server || 'STAGING');
  const [os, setOs] = useState(currentExec?.os || 'Windows 11');
  const [status, setStatus] = useState<ExecutionStatus>(currentExec?.status || 'UNTESTED');
  const [actualResult, setActualResult] = useState(currentExec?.actualResult || '');
  const [evaluation, setEvaluation] = useState(currentExec?.evaluation || '');
  const [notes, setNotes] = useState(currentExec?.notes || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        const res = await environmentApi.getEnvironments();
        if (res.data.servers && res.data.servers.length > 0) {
          setAvailableServers(res.data.servers);
        }
        if (res.data.osList && res.data.osList.length > 0) {
          setAvailableOsList(res.data.osList);
        }
      } catch (err) {
        console.warn('Could not load environment settings, using defaults:', err);
      }
    };
    loadEnvironments();
  }, []);

  useEffect(() => {
    if (testCase) {
      const exec = testCase.latestExecution;
      setServer(exec?.server || 'STAGING');
      setOs(exec?.os || 'Windows 11');
      setStatus(exec?.status || 'UNTESTED');
      setActualResult(exec?.actualResult || '');
      setEvaluation(exec?.evaluation || '');
      setNotes(exec?.notes || '');
      setSaveSuccess(false);
    }
  }, [testCase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await executionApi.executeTestCase(testCase.id, {
        server,
        os,
        status,
        actualResult,
        evaluation,
        notes,
      });

      const updated: TestCase = {
        ...testCase,
        latestExecution: res.data.execution,
      };

      setSaveSuccess(true);
      onSaved(updated);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (err: any) {
      alert(`Lỗi khi lưu kết quả: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-blue-600 text-white font-mono text-sm font-bold rounded-lg shadow-sm">
              {testCase.testCaseCode}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                {testCase.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{testCase.module}</span>
                <span>•</span>
                <PlatformBadge platform={testCase.platform} />
                <span>•</span>
                <PriorityBadge priority={testCase.priority} />
                <span>•</span>
                <TestTypeBadge type={testCase.testType} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Form wrapped around Body & Sticky Footer */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Specification Details */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Chi tiết đặc tả kiểm thử
              </h3>

              {testCase.preconditions && (
                <div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Tiền điều kiện (Preconditions):
                  </span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-line">
                    {testCase.preconditions}
                  </p>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Các bước thực hiện (Steps):
                </span>
                <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-line font-sans">
                  {testCase.steps}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Kết quả mong đợi (Expected Result):
                </span>
                <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 whitespace-pre-line font-medium">
                  {testCase.expectedResult}
                </div>
              </div>
            </div>

            {/* Section 2: Execution & Results Form */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Ghi nhận kết quả thực thi
                </h3>
                <StatusBadge status={status} size="md" />
              </div>

              {/* Status Selection Buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Đánh giá trạng thái (Status) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('PASSED')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      status === 'PASSED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400 ring-offset-2'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mb-1" />
                    PASSED
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('FAILED')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      status === 'FAILED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20 ring-2 ring-rose-400 ring-offset-2 animate-pulse'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mb-1" />
                    FAILED
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('BLOCKED')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      status === 'BLOCKED'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20 ring-2 ring-amber-400 ring-offset-2'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 mb-1" />
                    BLOCKED
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('UNTESTED')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      status === 'UNTESTED'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-md'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 mb-1" />
                    CHƯA TEST
                  </button>
                </div>
              </div>

              {/* Server & OS Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    Server / Môi trường
                  </label>
                  <select
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {/* If current server is not in availableServers, show it */}
                    {server && !availableServers.includes(server) && (
                      <option value={server}>{server}</option>
                    )}
                    {availableServers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                    Hệ điều hành (OS)
                  </label>
                  <select
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {/* If current os is not in availableOsList, show it */}
                    {os && !availableOsList.includes(os) && (
                      <option value={os}>{os}</option>
                    )}
                    {availableOsList.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actual Result Input with Rich Text Editor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Kết quả thực tế (Actual Result)</span>
                  <span className="text-[11px] text-blue-600 font-normal">Trình soạn thảo phong phú (Rich Text)</span>
                </label>
                <RichTextEditor
                  value={actualResult}
                  onChange={setActualResult}
                  placeholder="Mô tả những gì hệ thống thực tế hiển thị hoặc phản hồi khi bạn thực hiện test..."
                  minHeight="140px"
                  isFailed={status === 'FAILED'}
                />
              </div>

              {/* Notes / Jira Ticket */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú / Link Bug / Nguyên nhân lỗi
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú thêm, mã lỗi HTTP, link ticket Jira..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer action */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
            {saveSuccess ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Đã lưu kết quả thành công vào DB!
              </div>
            ) : (
              <span className="text-xs text-slate-400">Nhấn để cập nhật kết quả</span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu kết quả'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
