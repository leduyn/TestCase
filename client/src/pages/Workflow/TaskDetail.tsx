import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { taskApi, todoApi, commentApi, workflowUploadApi, taskCustomFieldApi } from '../../services/workflowApi';
import { userApi } from '../../services/api';
import type { Task, TaskHistory, CustomFieldDefinition, Todo, TaskComment } from '../../types/workflow';
import type { User } from '../../types';
import { StatusBadge } from '../../components/Workflow/StatusBadge';
import { DynamicFormRenderer } from '../../components/Workflow/DynamicFormRenderer';
import { WorkflowStepTransitionModal } from '../../components/Workflow/WorkflowStepTransitionModal';
import {
  Clock,
  CheckCircle2,
  ArrowRight,
  Send,
  Paperclip,
  CheckSquare,
  Square,
  Trash2,
  History,
  X,
  Loader2,
  Plus,
  Eye,
  Sliders,
  Save,
  Check,
  RotateCcw,
  Info,
} from 'lucide-react';

export const TaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customFields' | 'todos' | 'comments'>('customFields');

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [savingCustomFields, setSavingCustomFields] = useState(false);
  const [customFieldError, setCustomFieldError] = useState<string | null>(null);
  const [customFieldSuccess, setCustomFieldSuccess] = useState<string | null>(null);

  // Actions state
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Todo Form State
  const [newTodoDesc, setNewTodoDesc] = useState('');
  const [newTodoExecutor, setNewTodoExecutor] = useState('');
  const [newTodoDeadline, setNewTodoDeadline] = useState('');
  const [todoLoading, setTodoLoading] = useState(false);

  // Comment Form State
  const [commentContent, setCommentContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  // Snapshot Inspection State
  const [selectedSnapshot, setSelectedSnapshot] = useState<TaskHistory | null>(null);

  const fetchTaskDetails = async (isBackground = false) => {
    if (!id) return;
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [taskRes, userRes, customFieldsRes] = await Promise.all([
        taskApi.getTaskById(id),
        userApi.getUsers(),
        taskCustomFieldApi.getTaskCustomFields(id).catch(() => ({ data: null })),
      ]);
      setTask(taskRes.data);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);

      if (customFieldsRes.data && customFieldsRes.data.fields) {
        const defs = customFieldsRes.data.fields.map((f: any) => f.definition);
        setCustomFields(defs);
        setCustomFieldValues(customFieldsRes.data.valuesByKey || {});
      }
    } catch (err) {
      console.error('Error loading task details:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const handleCustomFieldValueChange = (fieldKey: string, val: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldKey]: val,
    }));
    setCustomFieldError(null);
    setCustomFieldSuccess(null);
  };

  const handleSaveCustomFields = async () => {
    if (!task) return;
    try {
      setSavingCustomFields(true);
      setCustomFieldError(null);
      setCustomFieldSuccess(null);

      const res = await taskCustomFieldApi.saveTaskCustomFields(task.id, {
        values: customFieldValues,
      });

      if (res.data.values) {
        setCustomFieldValues(res.data.values);
      }
      setCustomFieldSuccess('Đã lưu dữ liệu trường tùy chỉnh thành công!');
      setTimeout(() => setCustomFieldSuccess(null), 4000);

      // Refresh task details in background to sync histories and snapshots
      fetchTaskDetails(true);
    } catch (err: any) {
      console.error('Error saving custom fields:', err);
      setCustomFieldError(err.response?.data?.message || 'Lỗi khi lưu dữ liệu trường tùy chỉnh');
    } finally {
      setSavingCustomFields(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails(false);
  }, [id]);

  // Snapshot Preview Mode Computed Variables
  const isSnapshotMode = !!selectedSnapshot;
  const snapshotData = selectedSnapshot?.snapshot;

  const steps = task?.process?.steps || [];
  const displayName = isSnapshotMode ? (snapshotData?.name || task?.name || '') : (task?.name || '');
  const displayContent = isSnapshotMode ? (snapshotData?.content ?? '') : (task?.content ?? '');
  const displayStatus = isSnapshotMode ? (snapshotData?.status || task?.status || 'PENDING') : (task?.status || 'PENDING');
  const displayDeadline = isSnapshotMode ? (snapshotData?.deadline || task?.deadline || '') : (task?.deadline || '');
  const displayStartedAt = isSnapshotMode ? (snapshotData?.startedAt || task?.startedAt || '') : (task?.startedAt || '');
  const displayCompletedAt = isSnapshotMode ? snapshotData?.completedAt : task?.completedAt;

  const displayCurrentStepId = isSnapshotMode
    ? (snapshotData?.currentStepId || snapshotData?.currentStep?.id)
    : task?.currentStepId;
  const displayCurrentStep = isSnapshotMode
    ? (steps.find((s) => s.id === displayCurrentStepId) || snapshotData?.currentStep || task?.currentStep)
    : task?.currentStep;
  const displayCurrentStepOrder = displayCurrentStep?.order || 0;

  const displayExecutorIds = isSnapshotMode ? (snapshotData?.executorIds || []) : (task?.executorIds || []);
  const displayTodos: Todo[] = isSnapshotMode ? (snapshotData?.todos || []) : (task?.todos || []);
  const displayComments: TaskComment[] = isSnapshotMode ? (snapshotData?.comments || []) : (task?.comments || []);

  const isDisplayOverdue = displayStatus === 'IN_PROGRESS' && displayDeadline && new Date(displayDeadline) < new Date();

  // Compute snapshot custom field values map
  const displayCustomFieldValues = useMemo(() => {
    if (!isSnapshotMode) return customFieldValues;
    if (!selectedSnapshot?.snapshot) return {};
    const snap = selectedSnapshot.snapshot;

    if (Array.isArray(snap.customFieldValues)) {
      const map: Record<string, any> = {};
      for (const item of snap.customFieldValues) {
        const key = item.fieldDefinition?.fieldKey || item.fieldKey;
        if (key) {
          map[key] = item.value;
        }
      }
      if (snap.customFields && typeof snap.customFields === 'object') {
        return { ...snap.customFields, ...map };
      }
      return map;
    }
    if (snap.customFields && typeof snap.customFields === 'object') {
      return snap.customFields;
    }
    return {};
  }, [isSnapshotMode, selectedSnapshot, customFieldValues]);

  if (loading || !task) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Đang tải thông tin nhiệm vụ...</p>
      </div>
    );
  }

  const currentStepOrder = task.currentStep?.order || 0;
  const nextStep = steps.find((s) => s.order > currentStepOrder);

  // ─── Step Transition Handlers ───────────────────────────────────────────────

  const handleOpenTransitionModal = () => {
    setIsTransitionModalOpen(true);
  };

  const handleCompleteTask = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hoàn thành nhiệm vụ này?')) return;
    try {
      setActionLoading(true);
      await taskApi.completeTask(task.id);
      await fetchTaskDetails(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hoàn thành nhiệm vụ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTask = async () => {
    const reason = window.prompt('Nhập lý do hủy nhiệm vụ:');
    if (reason === null) return;
    try {
      setActionLoading(true);
      await taskApi.cancelTask(task.id, reason);
      await fetchTaskDetails(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy nhiệm vụ');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Todo Handlers (Optimistic Updates) ────────────────────────────────────

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoDesc.trim() || !task) return;

    try {
      setTodoLoading(true);
      const res = await todoApi.createTodo(task.id, {
        description: newTodoDesc,
        executorId: newTodoExecutor || undefined,
        deadline: newTodoDeadline ? new Date(newTodoDeadline).toISOString() : undefined,
      });

      const createdTodo = res.data?.todo;
      if (createdTodo) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                todos: [...(prev.todos || []), createdTodo],
              }
            : prev
        );
      }

      setNewTodoDesc('');
      setNewTodoExecutor('');
      setNewTodoDeadline('');
      fetchTaskDetails(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi thêm đầu việc');
    } finally {
      setTodoLoading(false);
    }
  };

  const handleToggleTodo = async (todoId: string) => {
    if (!task || isSnapshotMode) return;
    const prevTodos = task.todos || [];

    // Optimistic UI update
    setTask({
      ...task,
      todos: prevTodos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              isCompleted: !t.isCompleted,
              completedAt: !t.isCompleted ? new Date().toISOString() : null,
            }
          : t
      ),
    });

    try {
      await todoApi.toggleTodo(todoId);
      fetchTaskDetails(true);
    } catch (err: any) {
      // Rollback nếu có lỗi
      setTask({ ...task, todos: prevTodos });
      alert(err.response?.data?.message || 'Lỗi khi cập nhật đầu việc');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!task || isSnapshotMode) return;
    const prevTodos = task.todos || [];

    // Optimistic UI update
    setTask({
      ...task,
      todos: prevTodos.filter((t) => t.id !== todoId),
    });

    try {
      await todoApi.deleteTodo(todoId);
      fetchTaskDetails(true);
    } catch (err: any) {
      // Rollback nếu có lỗi
      setTask({ ...task, todos: prevTodos });
      alert(err.response?.data?.message || 'Lỗi khi xóa đầu việc');
    }
  };

  // ─── Comment & Upload Handlers ─────────────────────────────────────────────

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() && selectedFiles.length === 0) return;
    if (!task || isSnapshotMode) return;

    try {
      setCommentLoading(true);
      let uploadedFileInfo: any[] = [];

      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        const uploadRes = await workflowUploadApi.uploadFiles(selectedFiles);
        uploadedFileInfo = uploadRes.data.files;
        setUploadingFiles(false);
      }

      const res = await commentApi.createComment(task.id, {
        content: commentContent,
        files: uploadedFileInfo,
      });

      if (res.data?.comment) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                comments: [...(prev.comments || []), res.data.comment],
              }
            : prev
        );
      }

      setCommentContent('');
      setSelectedFiles([]);
      fetchTaskDetails(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setCommentLoading(false);
      setUploadingFiles(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb + Title */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link to="/workflow" className="hover:text-blue-600 transition-colors">Tổng quan</Link>
            <span>/</span>
            <Link to="/workflow/tasks" className="hover:text-blue-600 transition-colors">Nhiệm vụ</Link>
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[240px]">{displayName}</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {displayName}
            </h1>
            <StatusBadge status={isDisplayOverdue ? 'OVERDUE' : displayStatus} />
          </div>
        </div>

        {/* Action Buttons */}
        {isSnapshotMode ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5" />
              Đang xem Snapshot v{selectedSnapshot.version} (Chỉ đọc)
            </span>
            <button
              onClick={() => setSelectedSnapshot(null)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Thoát
            </button>
          </div>
        ) : (
          task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleCancelTask}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors"
              >
                Hủy nhiệm vụ
              </button>
              <button
                onClick={handleCompleteTask}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                Đánh dấu hoàn thành
              </button>
              <button
                onClick={handleOpenTransitionModal}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md shadow-blue-500/20 transition-all"
              >
                Chuyển bước <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Snapshot Preview Mode Alert Banner (Giai đoạn 3) ─────────────────── */}
      {isSnapshotMode && selectedSnapshot && (
        <div className="shrink-0 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white px-4 sm:px-6 py-2.5 border-b border-indigo-700/80 shadow-md flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <History className="w-4 h-4 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/40 text-indigo-100 text-xs font-bold border border-indigo-400/30">
                  Phiên bản v{selectedSnapshot.version}
                </span>
                <span className="text-xs font-bold text-white truncate">
                  {selectedSnapshot.changeDescription || 'Xem lại dữ liệu lịch sử'}
                </span>
                <span className="text-[11px] text-indigo-200">
                  • Lưu lúc {new Date(selectedSnapshot.createdAt).toLocaleString('vi-VN')}
                  {selectedSnapshot.changedBy?.fullName ? ` bởi ${selectedSnapshot.changedBy.fullName}` : ''}
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/80 mt-0.5">
                Giao diện đang hiển thị dữ liệu lịch sử tại thời điểm snapshot này được tạo (chế độ chỉ đọc).
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedSnapshot(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs shadow-md transition-all shrink-0 hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Quay lại phiên bản hiện tại</span>
          </button>
        </div>
      )}

      {/* ── Main Scrollable Area ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-5 space-y-5">

          {/* Visual Stepper / Process Pipeline */}
          <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tiến trình: <span className="text-indigo-600 dark:text-indigo-400">{task.process?.name}</span>
              </p>
              <span className="text-xs text-slate-500 font-medium">
                Bước {displayCurrentStep?.order || 1} / {steps.length}
              </span>
            </div>

            {/* Stepper items */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {steps.map((step) => {
                const isPassed = step.order < displayCurrentStepOrder || displayStatus === 'COMPLETED';
                const isCurrent = step.order === displayCurrentStepOrder && displayStatus !== 'COMPLETED';

                return (
                  <div
                    key={step.id}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-500/20'
                        : isPassed
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 animate-pulse">
                          {step.order}
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-500 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {step.order}
                        </div>
                      )}
                      <p className="font-semibold text-xs whitespace-nowrap">{step.name}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {step.timeLimitHours}h
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content Grid: Left 8 Cols + Right 4 Cols */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* ── Left Column (8 cols) ── */}
            <div className="lg:col-span-8 space-y-5">
              {/* Description Card */}
              <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Nội dung & Yêu cầu</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {displayContent || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              {/* Tabs Nav */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-4 pt-3 overflow-x-auto gap-1">
                  <button
                    onClick={() => setActiveTab('customFields')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === 'customFields'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Trường dữ liệu ({customFields.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('todos')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === 'todos'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Đầu việc con ({displayTodos.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === 'comments'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Bình luận & Tệp ({displayComments.length})
                  </button>
                </div>

                <div className="p-5">
                  {/* ─── TAB 0: CUSTOM FIELDS ──────────────────────────────────── */}
                  {activeTab === 'customFields' && (
                    <div className="space-y-6">
                      {isSnapshotMode && (
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-800 dark:text-indigo-200">
                          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>
                            Dữ liệu trường tùy chỉnh đang hiển thị theo snapshot <strong>v{selectedSnapshot.version}</strong> (chế độ chỉ đọc).
                          </span>
                        </div>
                      )}

                      {customFieldError && (
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                          {customFieldError}
                        </div>
                      )}

                      {customFieldSuccess && (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>{customFieldSuccess}</span>
                        </div>
                      )}

                      <DynamicFormRenderer
                        fields={customFields}
                        values={displayCustomFieldValues}
                        onChange={isSnapshotMode ? () => {} : handleCustomFieldValueChange}
                        onBulkChange={isSnapshotMode ? () => {} : (newVals) => setCustomFieldValues(newVals)}
                        readOnly={isSnapshotMode || task.status === 'COMPLETED' || task.status === 'CANCELLED'}
                        users={users}
                        currentStepId={displayCurrentStepId}
                        steps={steps}
                        groupByStep={true}
                      />

                      {!isSnapshotMode && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && customFields.length > 0 && (
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={handleSaveCustomFields}
                            disabled={savingCustomFields}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                          >
                            {savingCustomFields ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang lưu...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span>Lưu thông tin trường dữ liệu</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── TAB 1: TODOS ─────────────────────────────────────────── */}
                  {activeTab === 'todos' && (
                    <div className="space-y-6">
                      {isSnapshotMode ? (
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-800 dark:text-indigo-200">
                          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>
                            Danh sách đầu việc con tại phiên bản snapshot <strong>v{selectedSnapshot.version}</strong> (chỉ đọc).
                          </span>
                        </div>
                      ) : (
                        /* Todo Add Form */
                        <form onSubmit={handleAddTodo} className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <input
                            type="text"
                            value={newTodoDesc}
                            onChange={(e) => setNewTodoDesc(e.target.value)}
                            placeholder="Thêm đầu việc mới cần hoàn thành..."
                            className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={newTodoExecutor}
                                onChange={(e) => setNewTodoExecutor(e.target.value)}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              >
                                <option value="">-- Giao việc cho ai --</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.fullName}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="datetime-local"
                                value={newTodoDeadline}
                                onChange={(e) => setNewTodoDeadline(e.target.value)}
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={todoLoading}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Thêm Todo
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Todo Items List */}
                      <div className="space-y-2">
                        {displayTodos.length === 0 ? (
                          <p className="text-center py-8 text-xs text-slate-400">
                            {isSnapshotMode
                              ? 'Không có đầu việc nào tại thời điểm snapshot này.'
                              : 'Chưa có đầu việc nào. Thêm các việc cần làm để quản lý chi tiết.'}
                          </p>
                        ) : (
                          displayTodos.map((todo) => (
                            <div
                              key={todo.id}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                todo.isCompleted
                                  ? 'bg-slate-50/50 dark:bg-slate-850/30 border-slate-200 dark:border-slate-800/80 opacity-70'
                                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => handleToggleTodo(todo.id)}
                                  disabled={isSnapshotMode}
                                  className={`text-slate-400 shrink-0 ${isSnapshotMode ? 'cursor-default' : 'hover:text-blue-600'}`}
                                >
                                  {todo.isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                  )}
                                </button>
                                <span
                                  className={`text-sm ${
                                    todo.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {todo.description}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs shrink-0">
                                {todo.executor && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {todo.executor.fullName}
                                  </span>
                                )}
                                {todo.deadline && (
                                  <span className="text-slate-400">
                                    {new Date(todo.deadline).toLocaleDateString('vi-VN')}
                                  </span>
                                )}
                                {!isSnapshotMode && (
                                  <button
                                    onClick={() => handleDeleteTodo(todo.id)}
                                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                                    title="Xóa đầu việc"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── TAB 2: COMMENTS ──────────────────────────────────────── */}
                  {activeTab === 'comments' && (
                    <div className="space-y-6">
                      {isSnapshotMode && (
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-800 dark:text-indigo-200">
                          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>
                            Lịch sử trao đổi & tệp đính kèm tại phiên bản snapshot <strong>v{selectedSnapshot.version}</strong> (chỉ đọc).
                          </span>
                        </div>
                      )}

                      {/* Comments Feed */}
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {displayComments.length === 0 ? (
                          <p className="text-center py-8 text-xs text-slate-400">
                            {isSnapshotMode
                              ? 'Không có bình luận nào tại thời điểm snapshot này.'
                              : 'Chưa có bình luận nào. Hãy trao đổi công việc bên dưới.'}
                          </p>
                        ) : (
                          displayComments.map((c) => (
                            <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                                    {c.user?.fullName?.charAt(0) || 'U'}
                                  </div>
                                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                    {c.user?.fullName || 'Người dùng'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(c.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                {c.content}
                              </p>

                              {/* Attached files */}
                              {c.files && c.files.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {c.files.map((f, i) => (
                                    <a
                                      key={i}
                                      href={workflowUploadApi.getFileViewUrl(f.storagePath)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      <span className="truncate max-w-xs">{f.filename || (f as any).originalName}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Comment Input Box (Hidden in snapshot mode) */}
                      {!isSnapshotMode && (
                        <form onSubmit={handleAddComment} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <textarea
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            rows={3}
                            placeholder="Viết bình luận, phản hồi tiến độ..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>Đính kèm tệp ({selectedFiles.length})</span>
                                <input
                                  type="file"
                                  multiple
                                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <button
                              type="submit"
                              disabled={commentLoading || uploadingFiles}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50"
                            >
                              {commentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Gửi bình luận
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right Column (4 cols) ── */}
            <div className="lg:col-span-4 space-y-5">
              {/* Status & Deadline Card */}
              <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Thông tin thời hạn</h3>
                  {isSnapshotMode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400">
                      Bản v{selectedSnapshot.version}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Bắt đầu:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {displayStartedAt ? new Date(displayStartedAt).toLocaleString('vi-VN') : '---'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Hạn chót:</span>
                    <span className={`font-bold ${isDisplayOverdue ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                      {displayDeadline ? new Date(displayDeadline).toLocaleString('vi-VN') : '---'}
                    </span>
                  </div>
                  {displayCompletedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Hoàn thành:</span>
                      <span className="font-medium text-emerald-600">
                        {new Date(displayCompletedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assigned Team */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Người thực thi:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {displayExecutorIds && (displayExecutorIds as string[]).length > 0 ? (
                        (displayExecutorIds as string[]).map((userId) => {
                          const u = users.find((item) => item.id === userId);
                          return (
                            <span
                              key={userId}
                              className="px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800"
                            >
                              {u?.fullName || userId}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400">Chưa gán</span>
                      )}
                    </div>
                  </div>

                  {task.previousExecutor && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Người thực thi trước đó:</p>
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {task.previousExecutor.fullName}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Người tạo:</p>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {isSnapshotMode
                        ? (snapshotData?.createdBy?.fullName || task.createdBy?.fullName || 'Hệ thống')
                        : (task.createdBy?.fullName || 'Hệ thống')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Lịch sử Snapshot Timeline ── */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Lịch sử thay đổi
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold">
                      {task.histories?.length || 0}
                    </span>
                  </div>
                  {isSnapshotMode && (
                    <button
                      onClick={() => setSelectedSnapshot(null)}
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Thoát xem lại
                    </button>
                  )}
                </div>

                {/* Timeline vertical list */}
                <div className="max-h-[460px] overflow-y-auto px-4 py-3">
                  {(!task.histories || task.histories.length === 0) ? (
                    <div className="py-8 text-center">
                      <History className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Chưa có lịch sử thay đổi.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent dark:from-indigo-900/60 dark:via-slate-800 dark:to-transparent" />

                      <div className="space-y-1">
                        {[...(task.histories || [])].reverse().map((h, idx) => {
                          const isActive = selectedSnapshot?.id === h.id;
                          const isLatest = idx === 0;

                          // Màu badge theo loại thay đổi
                          const typeConfig: Record<string, { dot: string; badge: string; label: string }> = {
                            CREATED: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400', label: 'Khởi tạo' },
                            STEP_TRANSITION: { dot: 'bg-blue-500', badge: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400', label: 'Chuyển bước' },
                            CUSTOM_FIELD_UPDATE: { dot: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400', label: 'Cập nhật dữ liệu' },
                            COMPLETED: { dot: 'bg-violet-500', badge: 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400', label: 'Hoàn thành' },
                            CANCELLED: { dot: 'bg-rose-500', badge: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400', label: 'Hủy bỏ' },
                            OVERDUE: { dot: 'bg-orange-500', badge: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400', label: 'Quá hạn' },
                          };
                          const cfg = typeConfig[h.changeType] || { dot: 'bg-slate-400', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', label: h.changeType };

                          return (
                            <div key={h.id} className="relative pl-9 py-2 group">
                              {/* Dot on timeline */}
                              <div className={`absolute left-[9px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all ${cfg.dot} ${isActive ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : ''}`} />

                              {/* Card */}
                              <div className={`rounded-xl border p-2.5 transition-all ${
                                isActive
                                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-sm'
                                  : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    {/* Version + type badges */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLatest ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                        v{h.version}
                                      </span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.badge}`}>
                                        {cfg.label}
                                      </span>
                                      {isLatest && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                          Mới nhất
                                        </span>
                                      )}
                                    </div>

                                    {/* Description */}
                                    {h.changeDescription && (
                                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug line-clamp-2">
                                        {h.changeDescription}
                                      </p>
                                    )}

                                    {/* Meta */}
                                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                      <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white text-[7px] font-bold flex items-center justify-center shrink-0">
                                        {(h.changedBy?.fullName || 'H')[0].toUpperCase()}
                                      </span>
                                      <span className="truncate">{h.changedBy?.fullName || 'Hệ thống'}</span>
                                      <span className="shrink-0">• {new Date(h.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                  </div>

                                  {/* Action button */}
                                  {isActive ? (
                                    <span className="shrink-0 px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold">
                                      Đang xem
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setSelectedSnapshot(h)}
                                      className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                      title="Xem lại phiên bản này"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Step Transition Modal (Giai đoạn 4) */}
      <WorkflowStepTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        task={task}
        targetStep={nextStep || null}
        allSteps={steps}
        pendingCustomFields={customFieldValues}
        onSuccess={() => {
          setIsTransitionModalOpen(false);
          fetchTaskDetails(true);
        }}
      />
    </div>
  );
};
