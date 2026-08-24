import React, { useState, useEffect, useMemo } from 'react';
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
  History,
  PlusCircle,
  Users,
  Calendar,
} from 'lucide-react';
import type { TestCase, ExecutionStatus, TestExecutionImage, TestExecution } from '../types';
import { executionApi, environmentApi, uploadApi } from '../services/api';
import { PlatformBadge, PriorityBadge, TestTypeBadge, StatusBadge } from './Badge';
import { RichTextEditor } from './RichTextEditor';
import { ImageUploader } from './ImageUploader';
import { ImageLightbox } from './ImageLightbox';
import { useAuth } from '../context/AuthContext';

interface ExecutionDrawerProps {
  testCase: TestCase | null;
  isOpen: boolean;
  initialEditing?: boolean;
  initialExecution?: TestExecution | null;
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

interface UserOption {
  id: string;
  name: string;
  email: string;
  count: number;
  latestStatus?: ExecutionStatus;
}

export const ExecutionDrawer: React.FC<ExecutionDrawerProps> = ({
  testCase,
  isOpen,
  initialEditing = false,
  initialExecution = null,
  onClose,
  onSaved,
  onEditTestCase,
}) => {
  if (!isOpen || !testCase) return null;

  const { user: currentUser } = useAuth();

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [availableServers, setAvailableServers] = useState<string[]>(DEFAULT_SERVERS);
  const [availableOsList, setAvailableOsList] = useState<string[]>(DEFAULT_OS_LIST);

  // All execution history
  const [allExecutions, setAllExecutions] = useState<TestExecution[]>(testCase.executions || []);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | undefined>();

  // Form states
  const [server, setServer] = useState('STAGING');
  const [os, setOs] = useState('Windows 11');
  const [status, setStatus] = useState<ExecutionStatus>('UNTESTED');
  const [actualResult, setActualResult] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<TestExecutionImage[]>([]);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Lightbox for View Mode
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Load environments
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

  // Helper to load specific execution data into form / view
  const loadExecutionData = (exec: TestExecution | null) => {
    if (exec) {
      setServer(exec.server || 'STAGING');
      setOs(exec.os || 'Windows 11');
      setStatus(exec.status || 'UNTESTED');
      setActualResult(exec.actualResult || '');
      setEvaluation(exec.evaluation || '');
      setNotes(exec.notes || '');
      setImages(exec.images || []);
      setCurrentExecutionId(exec.id);
      setSelectedExecutionId(exec.id);
    } else {
      setServer('STAGING');
      setOs('Windows 11');
      setStatus('PASSED');
      setActualResult('');
      setEvaluation('');
      setNotes('');
      setImages([]);
      setCurrentExecutionId(undefined);
      setSelectedExecutionId(undefined);
    }
    setValidationError(null);
    setSaveSuccess(false);
  };

  // Helper to get user key from execution
  const getUserKey = (exec: TestExecution): string => {
    return exec.executedById || exec.executedBy?.email || exec.executedBy?.fullName || 'ANONYMOUS';
  };

  // Compute distinct users who tested this testcase
  const userOptions: UserOption[] = useMemo(() => {
    const map = new Map<string, UserOption>();

    // Add current logged-in user first if available
    if (currentUser?.id) {
      map.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.fullName || currentUser.email || 'Tôi (Bạn)',
        email: currentUser.email || '',
        count: 0,
      });
    }

    // Populate from all executions
    allExecutions.forEach((e) => {
      const uKey = getUserKey(e);
      const isCurrent = currentUser?.id && (uKey === currentUser.id);
      const name = isCurrent
        ? `${currentUser?.fullName || currentUser?.email || 'Tôi'} (Bạn)`
        : (e.executedBy?.fullName || e.executedBy?.email || 'Người dùng');
      const email = e.executedBy?.email || '';

      if (!map.has(uKey)) {
        map.set(uKey, {
          id: uKey,
          name,
          email,
          count: 0,
          latestStatus: e.status,
        });
      }
      const existing = map.get(uKey)!;
      existing.count++;
      if (!existing.latestStatus) {
        existing.latestStatus = e.status;
      }
    });

    return Array.from(map.values());
  }, [allExecutions, currentUser]);

  // Load and refresh execution history when drawer opens
  useEffect(() => {
    if (!isOpen || !testCase) return;

    setIsEditing(initialEditing);

    const initData = async () => {
      let execs = testCase.executions || [];
      try {
        const res = await executionApi.getHistory(testCase.id);
        if (res.data.history && res.data.history.length > 0) {
          execs = res.data.history;
        }
      } catch (err) {
        console.warn('Could not fetch fresh execution history:', err);
      }
      setAllExecutions(execs);

      // Determine initial user & execution to display
      if (initialExecution) {
        const uKey = getUserKey(initialExecution);
        setSelectedUserId(uKey);
        loadExecutionData(initialExecution);
        const isOwner = !initialExecution.executedById || initialExecution.executedById === currentUser?.id;
        if (initialEditing && isOwner) {
          setIsEditing(true);
        } else {
          setIsEditing(false);
        }
      } else {
        // Default to logged-in user or first tester
        const currentUserId = currentUser?.id;
        const hasCurrentUserExec = currentUserId && execs.some((e) => getUserKey(e) === currentUserId);

        let targetUser = currentUserId || '';
        if (!hasCurrentUserExec && execs.length > 0) {
          targetUser = getUserKey(execs[0]);
        } else if (!targetUser && execs.length > 0) {
          targetUser = getUserKey(execs[0]);
        }

        setSelectedUserId(targetUser);

        const userExecs = execs.filter((e) => getUserKey(e) === targetUser);
        if (userExecs.length > 0) {
          loadExecutionData(userExecs[0]);
        } else if (testCase.latestExecution) {
          loadExecutionData(testCase.latestExecution);
        } else {
          loadExecutionData(null);
          if (initialEditing) {
            setIsEditing(true);
          }
        }
      }
    };

    initData();
  }, [isOpen, testCase?.id, initialEditing, initialExecution]);

  // Executions of the currently selected user
  const userExecutions = useMemo(() => {
    if (!selectedUserId) return [];
    return allExecutions.filter((e) => getUserKey(e) === selectedUserId);
  }, [allExecutions, selectedUserId]);

  // Handle switching user from the dropdown/tabs
  const handleSelectUser = (newUserId: string) => {
    setSelectedUserId(newUserId);
    const execs = allExecutions.filter((e) => getUserKey(e) === newUserId);
    if (execs.length > 0) {
      loadExecutionData(execs[0]);
      setIsEditing(false);
    } else {
      // User has no executions yet -> prepare a new execution for this user
      loadExecutionData(null);
      if (currentUser?.id === newUserId) {
        setIsEditing(true);
      }
    }
  };

  // Start new execution flow
  const handleStartNewExecution = () => {
    if (currentUser?.id) {
      setSelectedUserId(currentUser.id);
    }
    loadExecutionData(null);
    setIsEditing(true);
  };

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
      setSelectedExecutionId(execId);

      const newExec = res.data.execution;
      const updatedExecs = [newExec, ...allExecutions.filter((e) => e.id !== newExec.id)];
      setAllExecutions(updatedExecs);

      const updated: TestCase = {
        ...testCase,
        executions: updatedExecs,
        latestExecution: {
          ...newExec,
          images: newExec.images || [],
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

  // Helper to check if rich text content is actually empty
  const isRichTextEmpty = (html: string): boolean => {
    if (!html || html.trim() === '') return true;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const textContent = tmp.textContent || tmp.innerText || '';
    return textContent.trim() === '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate: actualResult must not be empty
    if (isRichTextEmpty(actualResult)) {
      setValidationError('Vui lòng nhập nội dung "Kết quả thực tế" trước khi lưu.');
      return;
    }

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

      const savedExec = {
        ...res.data.execution,
        images: res.data.execution.images || images,
      };

      const updatedExecs = [savedExec, ...allExecutions.filter((ex) => ex.id !== savedExec.id)];
      setAllExecutions(updatedExecs);
      setCurrentExecutionId(savedExec.id);
      setSelectedExecutionId(savedExec.id);
      setSaveSuccess(true);

      const updated: TestCase = {
        ...testCase,
        executions: updatedExecs,
        latestExecution: savedExec,
      };

      onSaved(updated);
      setIsEditing(false);
      onClose(); // Close drawer and return to test case list
    } catch (err: any) {
      alert(`Lỗi khi lưu kết quả: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (selectedExecutionId) {
      const found = allExecutions.find((e) => e.id === selectedExecutionId);
      if (found) {
        loadExecutionData(found);
      }
    } else if (userExecutions.length > 0) {
      loadExecutionData(userExecutions[0]);
    }
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

  const activeExecution = useMemo(() => {
    if (!selectedExecutionId) return null;
    return allExecutions.find((e) => e.id === selectedExecutionId) || null;
  }, [allExecutions, selectedExecutionId]);

  // Check if current user owns this execution
  const isOwnExecution = useMemo(() => {
    if (!activeExecution || !activeExecution.executedById) return true;
    return activeExecution.executedById === currentUser?.id;
  }, [activeExecution, currentUser]);

  const canEditCurrentExecution = isOwnExecution;

  const selectedUserObj = userOptions.find((u) => u.id === selectedUserId);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
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

        {/* Drawer Body: 3-Panel Layout (Left: History Timeline by User | Middle: Specification & Evidence | Right: Execution View/Form) */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* ==================== PANEL 1: HISTORY TIMELINE (LEFT) ==================== */}
          <div className="w-full lg:w-72 xl:w-80 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col shrink-0 overflow-hidden">
            {/* Timeline Header & User Selector */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  Lịch sử thực thi
                </span>
                <span className="text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {userExecutions.length} lần chạy
                </span>
              </div>

              {/* User Selection Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  Người kiểm thử (Tester):
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => handleSelectUser(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {userOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} ({opt.count} lượt)
                    </option>
                  ))}
                  {userOptions.length === 0 && (
                    <option value="">Chưa có người dùng</option>
                  )}
                </select>
              </div>

              {/* Action: Create New Execution Button */}
              <button
                type="button"
                onClick={handleStartNewExecution}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-500/20 hover:shadow-md transition-all"
                title="Ghi nhận lượt kiểm thử mới"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ghi nhận kết quả mới</span>
              </button>
            </div>

            {/* Timeline Milestones List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-1 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Mốc thời gian ({selectedUserObj?.name || 'User'})
              </div>

              {userExecutions.length > 0 ? (
                <div className="relative pl-3 space-y-3 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {userExecutions.map((exec, idx) => {
                    const isSelected = selectedExecutionId === exec.id && !isEditing;
                    const isLatest = idx === 0;

                    let statusDotColor = 'bg-slate-400 ring-slate-200';
                    if (exec.status === 'PASSED') statusDotColor = 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-950';
                    else if (exec.status === 'FAILED') statusDotColor = 'bg-rose-500 ring-rose-200 dark:ring-rose-950';
                    else if (exec.status === 'BLOCKED') statusDotColor = 'bg-amber-500 ring-amber-200 dark:ring-amber-950';

                    return (
                      <div key={exec.id} className="relative pl-5">
                        {/* Timeline Node Dot */}
                        <div
                          className={`absolute left-0 top-3 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-4 transition-all ${statusDotColor} ${isSelected ? 'scale-125 ring-blue-400 shadow-sm' : ''
                            }`}
                        />

                        {/* Timeline Card Button */}
                        <button
                          type="button"
                          onClick={() => {
                            loadExecutionData(exec);
                            setIsEditing(false);
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all relative ${isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-400'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {exec.executedAt
                                ? new Date(exec.executedAt).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                                : '—'}
                            </span>
                            <StatusBadge status={exec.status} size="sm" />
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {isLatest && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                                Mới nhất
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                              {exec.server || 'Server'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[100px]">
                              {exec.os || 'OS'}
                            </span>
                            {exec.images && exec.images.length > 0 && (
                              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold ml-auto">
                                <ImageIcon className="w-3 h-3" />
                                {exec.images.length}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center rounded-xl bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 space-y-1">
                  <p>Chưa có lượt chạy nào của người dùng này.</p>
                  <p className="text-[11px] text-blue-600">Nhấn <strong>"Ghi nhận kết quả mới"</strong> để thực thi.</p>
                </div>
              )}
            </div>
          </div>

          {/* ==================== MAIN CONTENT: SPECIFICATION & EXECUTION DETAILS ==================== */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Left/Middle Column: Specification Details & Evidence Images */}
              <div className="space-y-5">
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
                          <span>Ảnh minh chứng tại mốc này ({images.length})</span>
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
                          <p className="text-xs text-slate-500">Chưa có hình ảnh minh chứng nào cho lượt test này.</p>
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
              <div className="space-y-4">
                {isEditing ? (
                  // ==================== EDIT MODE FORM ====================
                  <form
                    onSubmit={handleSave}
                    className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/60">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        {selectedExecutionId ? 'Điều chỉnh kết quả kiểm thử' : 'Ghi nhận kết quả kiểm thử mới'}
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
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${status === 'PASSED'
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
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${status === 'FAILED'
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
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${status === 'BLOCKED'
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
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${status === 'UNTESTED'
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
                        onChange={(val) => {
                          setActualResult(val);
                          if (validationError) setValidationError(null);
                        }}
                        placeholder="Mô tả những gì hệ thống thực tế hiển thị hoặc phản hồi khi bạn thực hiện test..."
                        minHeight="140px"
                        isFailed={status === 'FAILED'}
                        availableImages={images}
                      />
                      {validationError && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{validationError}</span>
                        </div>
                      )}
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
                        Hủy
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
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Chi tiết kết quả kiểm thử
                        </h3>
                        {activeExecution?.executedBy ? (
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>
                              Thực hiện bởi: <strong>{activeExecution.executedBy.fullName || activeExecution.executedBy.email}</strong>
                            </span>
                            {activeExecution.executedAt && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  {new Date(activeExecution.executedAt).toLocaleString('vi-VN')}
                                </span>
                              </>
                            )}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {selectedExecutionId ? 'Lần chạy được chọn từ timeline' : 'Chưa có lượt thực thi nào'}
                          </p>
                        )}
                      </div>

                      {canEditCurrentExecution ? (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 hover:scale-105 transition-all shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Điều chỉnh kết quả</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartNewExecution}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 hover:scale-105 transition-all shrink-0"
                          title="Ghi nhận kết quả kiểm thử mới của riêng bạn"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Ghi nhận kết quả của bạn</span>
                        </button>
                      )}
                    </div>

                    {/* Notice if viewing other user's execution */}
                    {!canEditCurrentExecution && activeExecution && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          Bạn đang xem kết quả của <strong>{activeExecution.executedBy?.fullName || activeExecution.executedBy?.email || 'người khác'}</strong>. Bạn không thể chỉnh sửa kết quả của người khác. Nhấn <strong>"Ghi nhận kết quả của bạn"</strong> để lưu kết quả mới.
                        </span>
                      </div>
                    )}

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
                        <span className="text-xs text-slate-400">
                          {selectedExecutionId ? 'Đang xem thông tin lịch sử' : 'Chế độ xem thông tin kịch bản'}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          Đóng
                        </button>
                        {canEditCurrentExecution ? (
                          <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Điều chỉnh kết quả</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStartNewExecution}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 transition-all"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Ghi nhận kết quả mới</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
