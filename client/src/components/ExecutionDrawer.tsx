import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Server,
  Monitor,
  Save,
  Sparkles,
  Tag,
  Edit3,
  Image as ImageIcon,
  User,
  Eye,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type { TestCase, ExecutionStatus, TestExecutionImage } from '../types';
import { executionApi, environmentApi, uploadApi } from '../services/api';
import { PlatformBadge, PriorityBadge, TestTypeBadge, StatusBadge } from './Badge';
import { RichTextEditor } from './RichTextEditor';
import { ImageUploader } from './ImageUploader';
import { ImageLightbox } from './ImageLightbox';

interface ExecutionDrawerProps {
  testCase: TestCase | null;
  isOpen: boolean;
  initialEditing?: boolean;
  onClose: () => void;
  onSaved: (updatedTestCase: TestCase) => void;
  onEditTestCase?: (testCase: TestCase) => void;
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
  initialEditing = false,
  onClose,
  onSaved,
  onEditTestCase,
}) => {
  if (!isOpen || !testCase) return null;

  const currentExec = testCase.latestExecution;

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [availableServers, setAvailableServers] = useState<string[]>(DEFAULT_SERVERS);
  const [availableOsList, setAvailableOsList] = useState<string[]>(DEFAULT_OS_LIST);

  // Form states
  const [server, setServer] = useState(currentExec?.server || 'STAGING');
  const [os, setOs] = useState(currentExec?.os || 'Windows 11');
  const [status, setStatus] = useState<ExecutionStatus>(currentExec?.status || 'UNTESTED');
  const [actualResult, setActualResult] = useState(currentExec?.actualResult || '');
  const [evaluation, setEvaluation] = useState(currentExec?.evaluation || '');
  const [notes, setNotes] = useState(currentExec?.notes || '');
  const [images, setImages] = useState<TestExecutionImage[]>(currentExec?.images || []);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | undefined>(currentExec?.id);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Lightbox for View Mode
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  const resetFormFromTestCase = () => {
    if (testCase) {
      const exec = testCase.latestExecution;
      setServer(exec?.server || 'STAGING');
      setOs(exec?.os || 'Windows 11');
      setStatus(exec?.status || 'UNTESTED');
      setActualResult(exec?.actualResult || '');
      setEvaluation(exec?.evaluation || '');
      setNotes(exec?.notes || '');
      setImages(exec?.images || []);
      setCurrentExecutionId(exec?.id);
      setSaveSuccess(false);

      // Fetch all images belonging to this test case across executions
      uploadApi
        .getTestCaseImages(testCase.id)
        .then((res) => {
          if (res.data.images && res.data.images.length > 0) {
            setImages(res.data.images);
          } else if (exec?.images) {
            setImages(exec.images);
          }
        })
        .catch(() => {
          if (exec?.images) {
            setImages(exec.images);
          }
        });
    }
  };

  useEffect(() => {
    setIsEditing(initialEditing);
    resetFormFromTestCase();
  }, [testCase, initialEditing, isOpen]);

  // Handle uploading images with auto-creation of execution if not created yet
  const handleCustomUpload = async (files: File[]) => {
    let execId = currentExecutionId;
    if (!execId && testCase) {
      const res = await executionApi.executeTestCase(testCase.id, {
        server,
        os,
        status,
        actualResult,
        evaluation,
        notes,
      });
      execId = res.data.execution.id;
      setCurrentExecutionId(execId);
      const updated: TestCase = {
        ...testCase,
        latestExecution: {
          ...res.data.execution,
          images: res.data.execution.images || [],
        },
      };
      onSaved(updated);
    }

    if (execId) {
      const res = await uploadApi.uploadImages(execId, files);
      return res.data.images;
    }
    return [];
  };

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
        latestExecution: {
          ...res.data.execution,
          images: res.data.execution.images || images,
        },
      };

      setCurrentExecutionId(res.data.execution.id);
      setSaveSuccess(true);
      onSaved(updated);
      setIsEditing(false); // Switch back to read-only view
    } catch (err: any) {
      alert(`Lỗi khi lưu kết quả: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    resetFormFromTestCase();
    setIsEditing(false);
  };

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setLightboxOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-2.5 py-1 bg-blue-600 text-white font-mono text-sm font-bold rounded-lg shadow-sm shrink-0">
              {testCase.testCaseCode}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                {testCase.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{testCase.module}</span>
                <span>•</span>
                <PlatformBadge platform={testCase.platform} />
                <span>•</span>
                <PriorityBadge priority={testCase.priority} />
                <span>•</span>
                <TestTypeBadge type={testCase.testType} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEditTestCase && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTestCase(testCase);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                title="Chỉnh sửa đặc tả kịch bản kiểm thử (Tiêu đề, các bước, kết quả mong đợi)"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Sửa đặc tả TC</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Specification Details & Uploaded Images List */}
            <div className="space-y-5 lg:pr-3">
              {/* Specification Details Box */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  Chi tiết đặc tả kiểm thử
                </h3>

                <div className="flex items-center justify-between">
                  <PlatformBadge platform={testCase.platform} />
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={testCase.priority} />
                    <TestTypeBadge type={testCase.testType} />
                  </div>
                </div>

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

              {/* Evidence Images Section */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                {isEditing ? (
                  // In Edit Mode: Show Uploader with Drop Zone & Delete buttons
                  <ImageUploader
                    executionId={currentExecutionId}
                    images={images}
                    onUploadCustom={handleCustomUpload}
                    onImagesChange={(newImages) => {
                      setImages(newImages);
                      if (testCase.latestExecution) {
                        const updated: TestCase = {
                          ...testCase,
                          latestExecution: {
                            ...testCase.latestExecution,
                            images: newImages,
                          },
                        };
                        onSaved(updated);
                      }
                    }}
                  />
                ) : (
                  // In View Mode: Show Read-only Images Gallery with Lightbox
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <span>Danh sách hình ảnh minh chứng đã đưa lên ({images.length})</span>
                      </label>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {images.length} ảnh
                      </span>
                    </div>

                    {images.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        {images.map((img, idx) => {
                          const url = uploadApi.getImageUrl(img.id);
                          return (
                            <div
                              key={img.id}
                              onClick={() => openLightbox(idx)}
                              className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-500"
                            >
                              <img
                                src={url}
                                alt={img.filename}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />

                              {/* Overlay info on hover */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                <div className="flex justify-end">
                                  <div className="p-1 rounded bg-black/50 text-white">
                                    <Eye className="w-3.5 h-3.5" />
                                  </div>
                                </div>

                                <div className="text-white space-y-0.5">
                                  <p className="text-[11px] font-medium truncate drop-shadow">{img.filename}</p>
                                  <p className="text-[10px] text-slate-300 drop-shadow">
                                    {formatFileSize(img.fileSize)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/20">
                        <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-500">Chưa có hình ảnh minh chứng nào được tải lên cho kịch bản này.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Nhấn <strong>"Điều chỉnh kết quả"</strong> để tải ảnh lên.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Test Execution Result (View Mode vs Edit Mode) */}
            <div className="space-y-4 lg:pl-3">
              {isEditing ? (
                // ==================== EDIT MODE FORM ====================
                <form
                  onSubmit={handleSave}
                  className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/60">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Điều chỉnh kết quả kiểm thử
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
                      availableImages={images}
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

                  {/* Form actions: Cancel & Save */}
                  <div className="pt-4 border-t border-blue-200/60 dark:border-blue-800/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Hủy chỉnh sửa
                    </button>

                    <div className="flex items-center gap-2">
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
              ) : (
                // ==================== VIEW ONLY MODE ====================
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-5 shadow-sm">
                  {/* Top Bar: Title & Edit Action Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Kết quả thực thi kiểm thử
                      </h3>
                      {currentExec?.executedBy && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Thực hiện bởi: <strong>{currentExec.executedBy.fullName || currentExec.executedBy.email}</strong></span>
                          {currentExec.executedAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(currentExec.executedAt).toLocaleString('vi-VN')}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 hover:scale-105 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Điều chỉnh kết quả</span>
                    </button>
                  </div>

                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Trạng thái đánh giá:</span>
                    <StatusBadge status={status} size="md" />
                  </div>

                  {/* Environment Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                        <Server className="w-3.5 h-3.5 text-blue-600" />
                        Môi trường (Server)
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {server || '—'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                        <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                        Hệ điều hành (OS)
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {os || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Actual Result Content */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Kết quả thực tế (Actual Result):
                    </span>
                    {actualResult ? (
                      <div
                        className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 rich-text-content overflow-auto max-h-60"
                        dangerouslySetInnerHTML={{ __html: actualResult }}
                      />
                    ) : (
                      <div className="p-4 text-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic">
                        Chưa ghi nhận kết quả thực tế. Nhấn <strong>"Điều chỉnh kết quả"</strong> để cập nhật.
                      </div>
                    )}
                  </div>

                  {/* Notes / Bug Link */}
                  {notes && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Ghi chú / Link Bug / Nguyên nhân lỗi:
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-line">
                        {notes}
                      </p>
                    </div>
                  )}

                  {/* Footer actions in View mode */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    {saveSuccess ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4" />
                        Đã cập nhật kết quả thành công!
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Chế độ xem thông tin kịch bản</span>
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
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Điều chỉnh kết quả</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for View Mode */}
      <ImageLightbox
        images={images}
        initialIndex={selectedImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
