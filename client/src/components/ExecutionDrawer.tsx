import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronRight,
  ChevronLeft,
  Layers,
  Play,
  Share2,
  Link2,
  Check,
} from 'lucide-react';
import type {
  TestCase,
  ExecutionStatus,
  TestExecutionImage,
  TestExecution,
  TestExecutionHistory,
  TestExecutionWatcher,
} from '../types';
import { executionApi, environmentApi, uploadApi, statusHandlerApi } from '../services/api';
import { PlatformBadge, PriorityBadge, TestTypeBadge, StatusBadge } from './Badge';
import { ResultEditor, type ResultEditorHandle } from './ResultEditor';
import { ImageUploader } from './ImageUploader';
import { ImageLightbox } from './ImageLightbox';
import { TestCaseEvidenceModal } from './TestCaseEvidenceModal';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ExecutionDrawerProps {
  testCase: TestCase | null;
  isOpen: boolean;
  fullPage?: boolean;
  initialEditing?: boolean;
  initialExecution?: TestExecution | null;
  isNewExecution?: boolean;
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

const EXECUTION_STATUS_LIST: {
  value: ExecutionStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: string;
  idle: string;
}[] = [
  { value: 'UNTESTED', label: 'CHƯA TEST', Icon: Clock, active: 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-400 ring-offset-1', idle: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  { value: 'RETEST', label: 'TEST LẠI', Icon: RotateCcw, active: 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400 ring-offset-1', idle: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  { value: 'PASSED', label: 'PASSED', Icon: CheckCircle2, active: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400 ring-offset-1', idle: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'FAILED', label: 'FAILED', Icon: AlertTriangle, active: 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20 ring-2 ring-rose-400 ring-offset-1 animate-pulse', idle: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  { value: 'BLOCKED', label: 'BLOCKED', Icon: AlertCircle, active: 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20 ring-2 ring-amber-400 ring-offset-1', idle: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
];

export const ExecutionDrawer: React.FC<ExecutionDrawerProps> = ({
  testCase,
  isOpen,
  fullPage = false,
  initialEditing = false,
  initialExecution = null,
  isNewExecution = false,
  onClose,
  onSaved,
  onEditTestCase,
}) => {
  if (!isOpen || !testCase) return null;

  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const link = `${window.location.origin}/testcases/${testCase.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [availableServers, setAvailableServers] = useState<string[]>(DEFAULT_SERVERS);
  const [availableOsList, setAvailableOsList] = useState<string[]>(DEFAULT_OS_LIST);

  // All execution history
  const [allExecutions, setAllExecutions] = useState<TestExecution[]>(testCase.executions || []);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | undefined>();
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  // Danh sách user để chọn người theo dõi + lịch sử thay đổi (snapshots)
  const [watcherUsers, setWatcherUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [snapshots, setSnapshots] = useState<TestExecutionHistory[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TestExecutionHistory | null>(null);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [watcherBusy, setWatcherBusy] = useState(false);

  // Form states
  const [server, setServer] = useState('STAGING');
  const [os, setOs] = useState('Windows 11');
  const [status, setStatus] = useState<ExecutionStatus>('UNTESTED');
  const [actualResult, setActualResult] = useState('');
  const resultEditorRef = useRef<ResultEditorHandle>(null);
  const [evaluation, setEvaluation] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<TestExecutionImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Next-step handler (overwrites executedById). Only users with execution:set-<status> are eligible.
  const [eligibleHandlers, setEligibleHandlers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [nextHandlerId, setNextHandlerId] = useState<string>('');
  const [loadingHandlers, setLoadingHandlers] = useState(false);

  // Confirmation modal shown on Save (assign executor + confirm status transition)
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Lightbox for View Mode
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxPool, setLightboxPool] = useState<TestExecutionImage[]>([]);

  // Evidence Gallery Modal & View Mode
  const [isEvidenceGalleryOpen, setIsEvidenceGalleryOpen] = useState(false);
  const [evidenceViewMode, setEvidenceViewMode] = useState<'MILESTONE' | 'USER_ALL'>('MILESTONE');

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

  // (Không còn chặn chọn trạng thái trên Frontend — Backend sẽ kiểm tra quyền khi lưu)

  // Khi ở chế độ chỉnh sửa và trạng thái thay đổi, tải danh sách người xử lý hợp lệ
  // (chỉ những người được gán xử lý trạng thái tương ứng) cho bước tiếp theo.
  useEffect(() => {
    if (!isEditing || !status) {
      setEligibleHandlers([]);
      return;
    }
    let cancelled = false;
    setLoadingHandlers(true);
    statusHandlerApi
      .getHandlers(status)
      .then((res) => {
        if (!cancelled) setEligibleHandlers(res.data.users || []);
      })
      .catch(() => {
        if (!cancelled) setEligibleHandlers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHandlers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, isEditing]);
  const loadExecutionData = (exec: TestExecution | null) => {
    if (exec) {
      setServer(exec.server || 'STAGING');
      setOs(exec.os || 'Windows 11');
      setStatus(exec.status || 'UNTESTED');
      setActualResult(exec.actualResult || '');
      setEvaluation(exec.evaluation || '');
      setNotes(exec.notes || '');
      setImages(exec.images || []);
      setPendingFiles([]);
      setCurrentExecutionId(exec.id);
      setSelectedExecutionId(exec.id);
      setNextHandlerId(exec.executedById || currentUser?.id || '');
    } else {
      setServer('STAGING');
      setOs('Windows 11');
      setStatus('PASSED');
      setActualResult('');
      setEvaluation('');
      setNotes('');
      setImages([]);
      setPendingFiles([]);
      setCurrentExecutionId(undefined);
      setSelectedExecutionId(undefined);
      setNextHandlerId(currentUser?.id || '');
    }
    setSelectedSnapshot(null);
    setValidationError(null);
    setSaveSuccess(false);
  };

  // Helper to get user key from execution (lấy theo người tạo - createdBy)
  const getUserKey = (exec: TestExecution): string => {
    return exec.createdById || exec.createdBy?.email || exec.createdBy?.fullName || 'ANONYMOUS';
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
        : (e.createdBy?.fullName || e.createdBy?.email || 'Người dùng');
      const email = e.createdBy?.email || '';

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
      if (isNewExecution) {
        if (currentUser?.id) {
          setSelectedUserId(currentUser.id);
        }
        loadExecutionData(null);
        setIsEditing(true);
      } else if (initialExecution) {
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
          setIsEditing(false);
        } else if (testCase.latestExecution) {
          loadExecutionData(testCase.latestExecution);
          setIsEditing(false);
        } else {
          loadExecutionData(null);
          if (initialEditing) {
            setIsEditing(true);
          }
        }
      }
    };

    initData();
  }, [isOpen, testCase?.id, initialEditing, initialExecution, isNewExecution]);

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
    setSelectedSnapshot(null);
    if (currentUser?.id) {
      setSelectedUserId(currentUser.id);
    }
    loadExecutionData(null);
    setIsEditing(true);
  };

  // Helper to check if rich text content is actually empty
  const isRichTextEmpty = (html: string): boolean => {
    if (!html || html.trim() === '') return true;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const textContent = tmp.textContent || tmp.innerText || '';
    return textContent.trim() === '';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate: actualResult must not be empty only when required (PASSED, FAILED, RETEST)
    const isActualResultRequired = status !== 'UNTESTED' && status !== 'BLOCKED';
    const currentActualResult = resultEditorRef.current?.getValue() || '';
    if (isActualResultRequired && isRichTextEmpty(currentActualResult)) {
      setValidationError('Vui lòng nhập nội dung "Kết quả thực tế" trước khi lưu.');
      return;
    }

    // Mở popup xác nhận chuyển trạng thái & giao việc (chọn người thực thi ở đây).
    // Mặc định người thực thi bước tiếp theo: người thực thi trước đây (before_executed_id)
    // hoặc người tạo thực thi (created_by_id), nếu không có thì là người dùng hiện tại.
    setNextHandlerId(previousHandler?.id || currentUser?.id || '');

    setConfirmOpen(true);
  };

  // Thực hiện lưu sau khi đã xác nhận trong popup
  const commitSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    const currentActualResult = resultEditorRef.current?.getValue() || '';
    setActualResult(currentActualResult);

    try {
      let savedExec: TestExecution;

      if (currentExecutionId) {
        // Update existing execution milestone (or finalize newly created milestone from image upload)
        const res = await executionApi.updateExecution(currentExecutionId, {
          server,
          os,
          status,
          actualResult: currentActualResult,
          evaluation,
          notes,
          executedById: nextHandlerId,
          viewerIds: activeExecution?.watchers?.map((w) => w.userId) || [],
        });
        savedExec = {
          ...res.data.execution,
          images: res.data.execution.images || images,
        };
      } else {
        // Create brand new execution milestone
        const res = await executionApi.executeTestCase(testCase.id, {
          server,
          os,
          status,
          actualResult: currentActualResult,
          evaluation,
          notes,
          executedById: nextHandlerId,
          viewerIds: activeExecution?.watchers?.map((w) => w.userId) || [],
        });
        savedExec = {
          ...res.data.execution,
          images: res.data.execution.images || images,
        };
      }

      // Tải lên các file minh chứng đang chờ lưu (pendingFiles) nếu có
      if (pendingFiles.length > 0 && savedExec?.id) {
        try {
          const uploadRes = await uploadApi.uploadImages(savedExec.id, pendingFiles);
          if (uploadRes.data.images && uploadRes.data.images.length > 0) {
            const mergedImages = [...(savedExec.images || []), ...uploadRes.data.images];
            savedExec = {
              ...savedExec,
              images: mergedImages,
            };
            setImages(mergedImages);
          }
        } catch (uploadErr: any) {
          console.error('Lỗi khi tải ảnh đính kèm:', uploadErr);
          alert(`Đã lưu kết quả nhưng gặp lỗi khi tải file đính kèm: ${uploadErr.response?.data?.message || uploadErr.message}`);
        }
        setPendingFiles([]);
      }

      let updatedExecs: TestExecution[];
      if (allExecutions.some((ex) => ex.id === savedExec.id)) {
        updatedExecs = allExecutions.map((ex) => (ex.id === savedExec.id ? savedExec : ex));
      } else {
        updatedExecs = [savedExec, ...allExecutions];
      }
      updatedExecs.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

      setAllExecutions(updatedExecs);
      setCurrentExecutionId(savedExec.id);
      setSelectedExecutionId(savedExec.id);
      setSaveSuccess(true);

      // Làm mới lịch sử thay đổi (snapshots) của execution vừa lưu
      try {
        const snapRes = await executionApi.getSnapshots(savedExec.id);
        setSnapshots(snapRes.data.snapshots || []);
      } catch {
        /* ignore */
      }

      const updated: TestCase = {
        ...testCase,
        executions: updatedExecs,
        latestExecution: updatedExecs[0] || savedExec,
      };

      onSaved(updated);
      setConfirmOpen(false);
      setIsEditing(false);
      if (!fullPage) onClose(); // Close drawer and return to test case list (stay on page in full-page mode)
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

  const activeExecution = useMemo(() => {
    if (!selectedExecutionId) return null;
    return allExecutions.find((e) => e.id === selectedExecutionId) || null;
  }, [allExecutions, selectedExecutionId]);

  // Tải danh sách user để chọn người theo dõi khi mở drawer
  useEffect(() => {
    if (!isOpen) return;
    executionApi
      .getWatcherUsers()
      .then((r) => setWatcherUsers(r.data.users || []))
      .catch(() => setWatcherUsers([]));
  }, [isOpen]);

  // Tải lịch sử thay đổi (snapshots) của execution đang chọn
  useEffect(() => {
    const id = activeExecution?.id;
    setSelectedSnapshot(null);
    if (!id) {
      setSnapshots([]);
      return;
    }
    setSnapshotsLoading(true);
    executionApi
      .getSnapshots(id)
      .then((r) => setSnapshots(r.data.snapshots || []))
      .catch(() => setSnapshots([]))
      .finally(() => setSnapshotsLoading(false));
  }, [activeExecution?.id]);

  // Kiểm tra quyền quản lý người theo dõi (creator / executor / admin)
  const canManageWatchers = useMemo(() => {
    if (currentUser?.role === 'ADMIN') return true;
    const id = currentUser?.id;
    if (!id || !activeExecution) return false;
    return activeExecution.createdById === id || activeExecution.executedById === id;
  }, [activeExecution, currentUser]);

  const handleToggleWatcher = async (userId: string, add: boolean) => {
    if (!activeExecution || watcherBusy) return;
    const current = activeExecution.watchers?.map((w) => w.userId) || [];
    const next = add ? [...new Set([...current, userId])] : current.filter((u) => u !== userId);
    setWatcherBusy(true);
    try {
      const res = await executionApi.setWatchers(activeExecution.id, next);
      setAllExecutions((prev) =>
        prev.map((e) =>
          e.id === activeExecution.id
            ? { ...e, watchers: res.data.watchers as TestExecutionWatcher[] }
            : e
        )
      );
    } catch (err) {
      console.error('Lỗi cập nhật người theo dõi', err);
    } finally {
      setWatcherBusy(false);
    }
  };

  // Người xử lý bước trước (để "giao lại"): ưu tiên beforeExecutedId của execution hiện tại,
  // nếu không có thì lấy execution liền trước theo thời gian, hoặc execution mới nhất khi tạo mới.
  const previousHandler = useMemo<{ id?: string; name?: string } | null>(() => {
    if (activeExecution?.beforeExecutedId) {
      return {
        id: activeExecution.beforeExecutedId,
        name: activeExecution.beforeExecutedBy?.fullName || activeExecution.beforeExecutedBy?.email,
      };
    }
    // Nếu chưa có người thực thi trước, lấy người tạo thực thi làm người thực thi trước
    if (activeExecution?.createdBy?.id) {
      return {
        id: activeExecution.createdBy.id,
        name: activeExecution.createdBy.fullName || activeExecution.createdBy.email,
      };
    }
    const sorted = [...allExecutions].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
    if (activeExecution) {
      const idx = sorted.findIndex((e) => e.id === activeExecution.id);
      if (idx >= 0 && idx + 1 < sorted.length) {
        const prev = sorted[idx + 1];
        if (prev.executedById) {
          return { id: prev.executedById, name: prev.executedBy?.fullName || prev.executedBy?.email };
        }
      }
      return null;
    }
    // Tạo mới: người xử lý bước trước là execution mới nhất hiện có
    const latest = sorted[0];
    if (latest?.executedById) {
      return { id: latest.executedById, name: latest.executedBy?.fullName || latest.executedBy?.email };
    }
    return null;
  }, [activeExecution, allExecutions]);

  // Danh sách tùy chọn cho selector: người hợp lệ + người xử lý trước + người tạo thực thi.
  // Người xử lý trước và người tạo luôn được đưa vào danh sách (dù đã có quyền) để dễ nhận biết.
  const handlerOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    eligibleHandlers.forEach((u) => {
      if (u.id) map.set(u.id, { id: u.id, name: u.fullName || u.email, email: u.email });
    });
    // Người thực thi trước (ghi đè tên để làm nổi bật)
    if (previousHandler?.id) {
      map.set(previousHandler.id, {
        id: previousHandler.id,
        name: `${previousHandler.name || 'Người xử lý trước'} (Người thực thi trước)`,
        email: '',
      });
    }
    // Người tạo thực thi (created_by_id) - luôn đưa vào nếu khác với người thực thi trước
    const creator = activeExecution?.createdBy;
    if (creator?.id && creator.id !== previousHandler?.id) {
      map.set(creator.id, {
        id: creator.id,
        name: `${creator.fullName || creator.email} (Người tạo thực thi)`,
        email: creator.email || '',
      });
    }
    // Đảm bảo người đang được chọn mặc định (người thực thi hiện tại khi sửa) luôn có trong danh sách
    if (
      nextHandlerId &&
      !map.has(nextHandlerId) &&
      activeExecution?.executedById === nextHandlerId &&
      activeExecution?.executedBy
    ) {
      map.set(nextHandlerId, {
        id: nextHandlerId,
        name: activeExecution.executedBy.fullName || activeExecution.executedBy.email,
        email: activeExecution.executedBy.email || '',
      });
    }
    return Array.from(map.values());
  }, [eligibleHandlers, previousHandler, nextHandlerId, activeExecution]);

  // Total images across all executions of this testcase
  const totalTestCaseImages = useMemo(() => {
    return allExecutions.reduce((acc, e) => acc + (e.images?.length || 0), 0);
  }, [allExecutions]);

  // Current milestone images enriched with active execution context
  const currentMilestoneImagesEnriched = useMemo<TestExecutionImage[]>(() => {
    return images.map((img) => ({
      ...img,
      execution: activeExecution
        ? {
            id: activeExecution.id,
            executedAt: activeExecution.executedAt,
            status: activeExecution.status,
            server: activeExecution.server,
            os: activeExecution.os,
            notes: activeExecution.notes,
            actualResult: activeExecution.actualResult,
            executedBy: activeExecution.executedBy,
          }
        : undefined,
    }));
  }, [images, activeExecution]);

  // All images by the selected user across their milestones
  const userAllImagesEnriched = useMemo<TestExecutionImage[]>(() => {
    const list: TestExecutionImage[] = [];
    userExecutions.forEach((exec) => {
      (exec.images || []).forEach((img) => {
        list.push({
          ...img,
          execution: {
            id: exec.id,
            executedAt: exec.executedAt,
            status: exec.status,
            server: exec.server,
            os: exec.os,
            notes: exec.notes,
            actualResult: exec.actualResult,
            executedBy: exec.executedBy,
          },
        });
      });
    });
    return list;
  }, [userExecutions]);

  const openLightboxWithPool = (pool: TestExecutionImage[], index: number) => {
    setLightboxPool(pool);
    setSelectedImageIndex(index);
    setLightboxOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if current user owns this execution
  const isOwnExecution = useMemo(() => {
    if (!activeExecution || !activeExecution.executedById) return true;
    return activeExecution.executedById === currentUser?.id;
  }, [activeExecution, currentUser]);

  // Admin hoặc người thực thi ở trạng thái hiện tại mới được ghi nhận / điều chỉnh kết quả
  const isAdmin = currentUser?.role === 'ADMIN';
  const canEditCurrentExecution = isAdmin || isOwnExecution;

  const selectedUserObj = userOptions.find((u) => u.id === selectedUserId);

  return (
    <div className={fullPage ? 'relative flex-1 min-h-0 w-full' : 'fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end'}>
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
            {totalTestCaseImages > 0 && (
              <button
                type="button"
                onClick={() => setIsEvidenceGalleryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors shadow-sm"
                title="Mở kho ảnh minh chứng tổng thể theo người dùng và mốc thời gian"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Kho ảnh ({totalTestCaseImages})</span>
              </button>
            )}
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
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
              title="Sao chép link xem chi tiết Test Case"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{copied ? 'Đã sao chép!' : 'Chia sẻ'}</span>
            </button>
            {!fullPage && (
              <button
                type="button"
                onClick={() => {
                  navigate(`/testcases/${testCase.id}`);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                title="Mở trang chi tiết đầy đủ"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Trang đầy đủ</span>
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
          <div className={`${historyCollapsed ? 'w-12' : 'w-full lg:w-72 xl:w-80'} border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col shrink-0 overflow-hidden transition-all duration-200`}>
            {historyCollapsed ? (
              <button
                type="button"
                onClick={() => setHistoryCollapsed(false)}
                className="flex-1 flex items-center justify-center py-4 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Mở rộng lịch sử thực thi"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
            <>
            {/* Timeline Header & User Selector */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-800/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  Lịch sử thực thi
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    {snapshots.length} thay đổi
                  </span>
                  <button
                    type="button"
                    onClick={() => setHistoryCollapsed(true)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Thu gọn lịch sử thực thi"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
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

              {/* Người theo dõi */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-slate-400" />
                    Người theo dõi ({activeExecution?.watchers?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(activeExecution?.watchers && activeExecution.watchers.length > 0) ? (
                    activeExecution.watchers.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] border border-sky-200 dark:border-sky-800"
                      >
                        {w.user.fullName || w.user.email}
                        {canManageWatchers && (
                          <button
                            type="button"
                            onClick={() => handleToggleWatcher(w.userId, false)}
                            disabled={watcherBusy}
                            title="Bỏ theo dõi"
                            className="hover:text-rose-600 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400">Chưa có ai theo dõi</span>
                  )}
                </div>
                {canManageWatchers && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleToggleWatcher(e.target.value, true);
                    }}
                    disabled={watcherBusy}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">+ Thêm người theo dõi...</option>
                    {watcherUsers
                      .filter((u) => !(activeExecution?.watchers || []).some((w) => w.userId === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || u.email}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* Timeline Milestones List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-1 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Lịch sử thay đổi
                </span>
                {selectedSnapshot && (
                  <button
                    type="button"
                    onClick={() => setSelectedSnapshot(null)}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    title="Trở về dữ liệu lần chạy hiện tại"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Bản hiện tại
                  </button>
                )}
              </div>

              {snapshotsLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Đang tải lịch sử thay đổi...</div>
              ) : snapshots.length > 0 ? (
                <div className="relative pl-3 space-y-3 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {snapshots.map((snap, idx) => {
                    const isLatest = idx === snapshots.length - 1;
                    const isSelected = selectedSnapshot?.id === snap.id;

                    let statusDotColor = 'bg-slate-400 ring-slate-200';
                    if (snap.status === 'PASSED') statusDotColor = 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-950';
                    else if (snap.status === 'FAILED') statusDotColor = 'bg-rose-500 ring-rose-200 dark:ring-rose-950';
                    else if (snap.status === 'BLOCKED') statusDotColor = 'bg-amber-500 ring-amber-200 dark:ring-amber-950';
                    else if (snap.status === 'RETEST') statusDotColor = 'bg-purple-500 ring-purple-200 dark:ring-purple-950';
                    else if (snap.status === 'UNTESTED') statusDotColor = 'bg-sky-500 ring-sky-200 dark:ring-sky-950';

                    return (
                      <div key={snap.id} className="relative pl-5">
                        <div className={`absolute left-0 top-3 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-4 transition-transform ${statusDotColor} ${isSelected ? 'scale-125 ring-blue-400 ring-offset-1' : ''}`} />
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSnapshot(null);
                            } else {
                              setIsEditing(false);
                              setSelectedSnapshot(snap);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/30 shadow-md'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {snap.updatedAt
                                ? new Date(snap.updatedAt).toLocaleString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                                : '—'}
                            </span>
                            <StatusBadge status={snap.status} size="sm" />
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">
                                Đang xem
                              </span>
                            )}
                            {isLatest && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                                Mới nhất
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                              {snap.server || 'Server'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate max-w-[100px]">
                              {snap.os || 'OS'}
                            </span>
                          </div>

                          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            Người thực thi: {snap.executedBy?.fullName || snap.executedBy?.email || '—'}
                          </div>
                          {snap.beforeExecutedBy && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <RotateCcw className="w-3 h-3 text-amber-500" />
                              Tiếp nhận từ: {snap.beforeExecutedBy.fullName || snap.beforeExecutedBy.email}
                            </div>
                          )}

                          {/* Preview snippet of actualResult / notes if present */}
                          {(snap.actualResult || snap.notes) && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10.5px] text-slate-600 dark:text-slate-400 line-clamp-2">
                              {snap.notes ? snap.notes : snap.actualResult?.replace(/<[^>]*>?/gm, '')}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center rounded-xl bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 space-y-1">
                  <p>Chưa có lịch sử thay đổi.</p>
                  <p className="text-[11px] text-blue-600">Thực thi hoặc đổi trạng thái để ghi nhận lịch sử.</p>
                </div>
              )}
            </div>
            </>
            )}
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
                    {testCase.expectedResult ? (
                      <div
                        className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 rich-text-content overflow-auto max-h-60"
                        dangerouslySetInnerHTML={{ __html: testCase.expectedResult }}
                      />
                    ) : (
                      <p className="text-xs text-slate-400 italic bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        Chưa có kết quả mong đợi.
                      </p>
                    )}
                  </div>
                </div>

                {/* Evidence Images Section */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  {isEditing ? (
                    // In Edit Mode: Show Uploader with Drop Zone & Delete buttons
                    <ImageUploader
                      executionId={currentExecutionId}
                      images={images}
                      pendingFiles={pendingFiles}
                      onPendingFilesChange={setPendingFiles}
                      onImagesChange={(newImages) => {
                        setImages(newImages);
                        if (currentExecutionId) {
                          setAllExecutions((prev) =>
                            prev.map((ex) =>
                              ex.id === currentExecutionId ? { ...ex, images: newImages } : ex
                            )
                          );
                        }
                        if (testCase.latestExecution && testCase.latestExecution.id === currentExecutionId) {
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
                    // In View Mode: Show Read-only Images Gallery with Multi-mode tabs
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {/* Tab Switcher: Current Milestone vs All for this User */}
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-xl text-xs">
                          <button
                            type="button"
                            onClick={() => setEvidenceViewMode('MILESTONE')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                              evidenceViewMode === 'MILESTONE'
                                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Mốc này ({currentMilestoneImagesEnriched.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setEvidenceViewMode('USER_ALL')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                              evidenceViewMode === 'USER_ALL'
                                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Tất cả của {selectedUserObj?.name.split(' ')[0] || 'Tester'} ({userAllImagesEnriched.length})
                          </button>
                        </div>

                        {totalTestCaseImages > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsEvidenceGalleryOpen(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline px-1.5 py-0.5 rounded"
                            title="Xem toàn bộ ảnh phân theo người dùng và mốc thời gian"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Kho ảnh ({totalTestCaseImages})</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Displayed Images based on tab */}
                      {evidenceViewMode === 'MILESTONE' ? (
                        currentMilestoneImagesEnriched.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                            {currentMilestoneImagesEnriched.map((img, idx) => {
                              const isVideo = img.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(img.filename);
                              const thumbUrl = isVideo ? uploadApi.getThumbnailUrl(img.id) : uploadApi.getImageUrl(img.id);
                              return (
                                <div
                                  key={img.id}
                                  onClick={() => openLightboxWithPool(currentMilestoneImagesEnriched, idx)}
                                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-500"
                                >
                                  <img
                                    src={thumbUrl}
                                    alt={img.filename}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />

                                  {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/30 transition-colors">
                                      <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center shadow-lg ring-2 ring-white/40 group-hover:scale-110 transition-transform">
                                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                      </div>
                                    </div>
                                  )}

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
                          <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/20 space-y-1">
                            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Chưa có hình ảnh minh chứng nào cho mốc chạy này.</p>
                            {canEditCurrentExecution && (
                              <p className="text-[11px] text-blue-600 mt-1 font-medium">
                                Nhấn <strong>"Điều chỉnh kết quả"</strong> để tải ảnh lên.
                              </p>
                            )}
                          </div>
                        )
                      ) : (
                        // USER_ALL mode
                        userAllImagesEnriched.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                            {userAllImagesEnriched.map((img, idx) => {
                              const isVideo = img.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(img.filename);
                              const thumbUrl = isVideo ? uploadApi.getThumbnailUrl(img.id) : uploadApi.getImageUrl(img.id);
                              const milestoneDate = img.execution?.executedAt
                                ? new Date(img.execution.executedAt).toLocaleDateString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '';
                              return (
                                <div
                                  key={img.id}
                                  onClick={() => openLightboxWithPool(userAllImagesEnriched, idx)}
                                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-500"
                                >
                                  <img
                                    src={thumbUrl}
                                    alt={img.filename}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />

                                  {isVideo && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/30 transition-colors">
                                      <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center shadow-lg ring-2 ring-white/40 group-hover:scale-110 transition-transform">
                                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                      </div>
                                    </div>
                                  )}

                                  {/* Milestone Time Badge on Top */}
                                  {milestoneDate && (
                                    <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm shadow">
                                      {milestoneDate}
                                    </div>
                                  )}

                                  {/* Status indicator */}
                                  {img.execution?.status && (
                                    <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-1 ring-black shadow">
                                      <span
                                        className={`block w-full h-full rounded-full ${
                                          img.execution.status === 'PASSED'
                                            ? 'bg-emerald-500'
                                            : img.execution.status === 'FAILED'
                                            ? 'bg-rose-500'
                                            : img.execution.status === 'BLOCKED'
                                            ? 'bg-amber-500'
                                            : img.execution.status === 'RETEST'
                                            ? 'bg-purple-500'
                                            : img.execution.status === 'UNTESTED'
                                            ? 'bg-sky-500'
                                            : 'bg-slate-400'
                                        }`}
                                      />
                                    </div>
                                  )}

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
                          <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/20 space-y-1">
                            <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">
                              Người dùng này chưa có ảnh minh chứng nào trong các lần kiểm thử.
                            </p>
                          </div>
                        )
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                        {EXECUTION_STATUS_LIST.map(({ value, label, Icon, active, idle }) => {
                          const isSelected = status === value;
                          const disabled = false; // Frontend không chặn chọn trạng thái — Backend kiểm tra quyền khi lưu
                          return (
                            <button
                              key={value}
                              type="button"
                              disabled={disabled}
                              onClick={() => setStatus(value)}
                              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${isSelected ? active : idle} ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                            >
                              <Icon className="w-4 h-4 mb-1" />
                              {label}
                            </button>
                          );
                        })}
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
                        <span className="flex items-center gap-1">
                          <span>Kết quả thực tế (Actual Result)</span>
                          {status !== 'UNTESTED' && status !== 'BLOCKED' ? (
                            <span className="text-rose-500 font-bold">*</span>
                          ) : (
                            <span className="text-slate-400 font-normal text-[11px]">(Không bắt buộc)</span>
                          )}
                        </span>
                        <span className="text-[11px] text-blue-600 font-normal">Trình soạn thảo phong phú (Rich Text)</span>
                      </label>
                      <ResultEditor
                        key={currentExecutionId || 'new'}
                        ref={resultEditorRef}
                        initialValue={actualResult}
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
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Chi tiết kết quả kiểm thử
                          </h3>
                          {selectedSnapshot && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                              Bản lịch sử
                            </span>
                          )}
                        </div>
                        {selectedSnapshot ? (
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>
                              Thực hiện bởi: <strong>{selectedSnapshot.executedBy?.fullName || selectedSnapshot.executedBy?.email || 'Hệ thống'}</strong>
                            </span>
                            <span>•</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {new Date(selectedSnapshot.updatedAt || selectedSnapshot.executedAt).toLocaleString('vi-VN')}
                            </span>
                            {selectedSnapshot.beforeExecutedBy && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Tiếp nhận từ: {selectedSnapshot.beforeExecutedBy.fullName || selectedSnapshot.beforeExecutedBy.email}
                                </span>
                              </>
                            )}
                          </p>
                        ) : activeExecution?.executedBy ? (
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

                      {selectedSnapshot ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshot(null)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Quay lại bản hiện tại</span>
                        </button>
                      ) : canEditCurrentExecution ? (
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

                    {/* Notice banner for historical snapshot or other user's execution */}
                    {selectedSnapshot ? (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <History className="w-4 h-4 text-blue-300 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              Đang xem lịch sử giai đoạn lúc {new Date(selectedSnapshot.updatedAt || selectedSnapshot.executedAt).toLocaleString('vi-VN')}
                            </p>
                            <p className="text-[11px] text-blue-200/90 mt-0.5">
                              Người thực thi: <strong>{selectedSnapshot.executedBy?.fullName || selectedSnapshot.executedBy?.email || 'Hệ thống'}</strong>
                              {selectedSnapshot.beforeExecutedBy && ` • Tiếp nhận từ: ${selectedSnapshot.beforeExecutedBy.fullName || selectedSnapshot.beforeExecutedBy.email}`}
                              {' • '}Chế độ xem lại lịch sử (Chỉ đọc)
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshot(null)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold shadow transition-all shrink-0 ml-2"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Quay lại</span>
                        </button>
                      </div>
                    ) : !canEditCurrentExecution && activeExecution && (
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
                      <StatusBadge status={selectedSnapshot ? selectedSnapshot.status : status} size="md" />
                    </div>

                    {/* Environment Details */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                          <Server className="w-3.5 h-3.5 text-blue-600" />
                          Môi trường (Server)
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {(selectedSnapshot ? selectedSnapshot.server : server) || '—'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                          <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                          Hệ điều hành (OS)
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {(selectedSnapshot ? selectedSnapshot.os : os) || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Actual Result Content */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Kết quả thực tế (Actual Result):
                      </span>
                      {(selectedSnapshot ? selectedSnapshot.actualResult : actualResult) ? (
                        <div
                          className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 rich-text-content overflow-auto max-h-60"
                          dangerouslySetInnerHTML={{ __html: selectedSnapshot ? (selectedSnapshot.actualResult || '') : actualResult }}
                        />
                      ) : (
                        <div className="p-4 text-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic">
                          {selectedSnapshot ? 'Không có ghi nhận kết quả thực tế ở giai đoạn này.' : (
                            <>Chưa ghi nhận kết quả thực tế. Nhấn <strong>"Điều chỉnh kết quả"</strong> để cập nhật.</>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Evaluation Content */}
                    {(selectedSnapshot ? selectedSnapshot.evaluation : evaluation) && (
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Đánh giá (Evaluation):
                        </span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-line">
                          {selectedSnapshot ? selectedSnapshot.evaluation : evaluation}
                        </p>
                      </div>
                    )}

                    {/* Notes / Bug Link */}
                    {(selectedSnapshot ? selectedSnapshot.notes : notes) && (
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Ghi chú / Link Bug / Nguyên nhân lỗi:
                        </span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-line">
                          {selectedSnapshot ? selectedSnapshot.notes : notes}
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
                          {selectedSnapshot
                            ? `Đang xem giai đoạn lúc ${new Date(selectedSnapshot.updatedAt || selectedSnapshot.executedAt).toLocaleString('vi-VN')}`
                            : selectedExecutionId
                            ? 'Đang xem thông tin lần chạy hiện tại'
                            : 'Chế độ xem thông tin kịch bản'}
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
                        {selectedSnapshot ? (
                          <button
                            type="button"
                            onClick={() => setSelectedSnapshot(null)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-500/20 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Quay lại bản hiện tại</span>
                          </button>
                        ) : canEditCurrentExecution ? (
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
                            <span>Ghi nhận kết quả của bạn</span>
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
        images={lightboxPool.length > 0 ? lightboxPool : currentMilestoneImagesEnriched}
        initialIndex={selectedImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Full Test Case Evidence Gallery Modal */}
      <TestCaseEvidenceModal
        testCase={{
          ...testCase,
          executions: allExecutions,
        }}
        isOpen={isEvidenceGalleryOpen}
        initialUserId={selectedUserId}
        onClose={() => setIsEvidenceGalleryOpen(false)}
        onSelectExecution={(exec) => {
          loadExecutionData(exec);
          setIsEditing(false);
        }}
      />

      {/* Confirm status transition & assign next-step executor */}
      {confirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={() => !saving && setConfirmOpen(false)}
          >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Xác nhận chuyển trạng thái &amp; giao việc
              </h3>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Transition summary */}
              <div className="flex items-center justify-center gap-3">
                {currentExecutionId && activeExecution?.status ? (
                  <StatusBadge status={activeExecution.status} size="md" />
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                    Mới
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-slate-400" />
                <StatusBadge status={status} size="md" />
              </div>

              {/* Executor assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Người thực thi bước tiếp theo
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={nextHandlerId}
                    onChange={(e) => setNextHandlerId(e.target.value)}
                    disabled={loadingHandlers}
                    className="flex-1 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                  >
                    {handlerOptions.length === 0 && (
                      <option value="">
                        {loadingHandlers ? 'Đang tải...' : 'Không có người hợp lệ (mặc định: bạn)'}
                      </option>
                    )}
                    {handlerOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                        {opt.email ? ` (${opt.email})` : ''}
                      </option>
                    ))}
                  </select>
                  {previousHandler?.id && previousHandler.id !== nextHandlerId && (
                    <button
                      type="button"
                      onClick={() => setNextHandlerId(previousHandler.id!)}
                      className="shrink-0 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                      title="Giao lại cho người xử lý ở bước trước"
                    >
                      Giao lại cho người trước
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Chỉ những người có quyền xử lý trạng thái <strong>{status}</strong> mới được chọn. Nếu không chọn, mặc định là bạn.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={commitSave}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                Xác nhận &amp; Lưu
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
};
