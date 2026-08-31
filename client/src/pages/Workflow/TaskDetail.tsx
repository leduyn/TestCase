import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { taskApi, todoApi, commentApi, workflowUploadApi } from '../../services/workflowApi';
import { userApi } from '../../services/api';
import type { Task, TaskHistory } from '../../types/workflow';
import type { User } from '../../types';
import { StatusBadge } from '../../components/Workflow/StatusBadge';
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
} from 'lucide-react';

export const TaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todos' | 'comments' | 'history'>('todos');

  // Actions state
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [transitionExecutors, setTransitionExecutors] = useState<string[]>([]);
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

  // Snapshot Inspection Modal
  const [selectedSnapshot, setSelectedSnapshot] = useState<TaskHistory | null>(null);

  const fetchTaskDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [taskRes, userRes] = await Promise.all([
        taskApi.getTaskById(id),
        userApi.getUsers(),
      ]);
      setTask(taskRes.data);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
    } catch (err) {
      console.error('Error loading task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  if (loading || !task) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Đang tải thông tin nhiệm vụ...</p>
      </div>
    );
  }

  const steps = task.process?.steps || [];
  const currentStepOrder = task.currentStep?.order || 0;
  const nextStep = steps.find((s) => s.order > currentStepOrder);
  const isOverdue = task.status === 'IN_PROGRESS' && new Date(task.deadline) < new Date();

  // ─── Step Transition Handlers ───────────────────────────────────────────────

  const handleOpenTransitionModal = () => {
    if (nextStep) {
      setTransitionExecutors(nextStep.executorIds || []);
    }
    setIsTransitionModalOpen(true);
  };

  const handleConfirmTransition = async () => {
    try {
      setActionLoading(true);
      await taskApi.transitionStep(task.id, {
        executorIds: transitionExecutors,
      });
      setIsTransitionModalOpen(false);
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi chuyển bước');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hoàn thành nhiệm vụ này?')) return;
    try {
      setActionLoading(true);
      await taskApi.completeTask(task.id);
      fetchTaskDetails();
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
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy nhiệm vụ');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Todo Handlers ─────────────────────────────────────────────────────────

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoDesc.trim()) return;

    try {
      setTodoLoading(true);
      await todoApi.createTodo(task.id, {
        description: newTodoDesc,
        executorId: newTodoExecutor || undefined,
        deadline: newTodoDeadline ? new Date(newTodoDeadline).toISOString() : undefined,
      });
      setNewTodoDesc('');
      setNewTodoExecutor('');
      setNewTodoDeadline('');
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi thêm đầu việc');
    } finally {
      setTodoLoading(false);
    }
  };

  const handleToggleTodo = async (todoId: string) => {
    try {
      await todoApi.toggleTodo(todoId);
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật đầu việc');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await todoApi.deleteTodo(todoId);
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa đầu việc');
    }
  };

  // ─── Comment & Upload Handlers ─────────────────────────────────────────────

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() && selectedFiles.length === 0) return;

    try {
      setCommentLoading(true);
      let uploadedFileInfo: any[] = [];

      if (selectedFiles.length > 0) {
        setUploadingFiles(true);
        const uploadRes = await workflowUploadApi.uploadFiles(selectedFiles);
        uploadedFileInfo = uploadRes.data.files;
        setUploadingFiles(false);
      }

      await commentApi.createComment(task.id, {
        content: commentContent,
        files: uploadedFileInfo,
      });

      setCommentContent('');
      setSelectedFiles([]);
      fetchTaskDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setCommentLoading(false);
      setUploadingFiles(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/workflow" className="hover:text-blue-600">
              Tổng quan
            </Link>
            <span>/</span>
            <Link to="/workflow/tasks" className="hover:text-blue-600">
              Nhiệm vụ
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs">
              {task.name}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {task.name}
            </h1>
            <StatusBadge status={isOverdue ? 'OVERDUE' : task.status} />
          </div>
        </div>

        {/* Action Buttons */}
        {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCancelTask}
              disabled={actionLoading}
              className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors"
            >
              Hủy nhiệm vụ
            </button>
            <button
              onClick={handleCompleteTask}
              disabled={actionLoading}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
            >
              Đánh dấu hoàn thành
            </button>
            <button
              onClick={handleOpenTransitionModal}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 transition-all"
            >
              Chuyển bước <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Visual Stepper / Process Pipeline */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Tiến trình Quy trình: <span className="text-indigo-600 dark:text-indigo-400">{task.process?.name}</span>
          </p>
          <span className="text-xs text-slate-500 font-medium">
            Bước {task.currentStep?.order || 1} / {steps.length}
          </span>
        </div>

        {/* Stepper items */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {steps.map((step) => {
            const isPassed = step.order < currentStepOrder || task.status === 'COMPLETED';
            const isCurrent = step.order === currentStepOrder && task.status !== 'COMPLETED';

            return (
              <div
                key={step.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-500/20'
                    : isPassed
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 animate-pulse">
                      {step.order}
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {step.order}
                    </div>
                  )}
                  <p className="font-semibold text-xs truncate">{step.name}</p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {step.timeLimitHours}h
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Grid: Left 2 Cols (Details & Tabs), Right 1 Col (Metadata Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Content & Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
              Nội dung & Yêu cầu
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {task.content || 'Không có mô tả chi tiết.'}
            </p>
          </div>

          {/* Tabs Nav */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-4 pt-3">
              <button
                onClick={() => setActiveTab('todos')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === 'todos'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Đầu việc con ({task.todos?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Send className="w-4 h-4" />
                Bình luận & Tệp ({task.comments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                Lịch sử Snapshot ({task.histories?.length || 0})
              </button>
            </div>

            <div className="p-6">
              {/* ─── TAB 1: TODOS ─────────────────────────────────────────── */}
              {activeTab === 'todos' && (
                <div className="space-y-6">
                  {/* Todo Add Form */}
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

                  {/* Todo Items List */}
                  <div className="space-y-2">
                    {task.todos?.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-400">
                        Chưa có đầu việc nào. Thêm các việc cần làm để quản lý chi tiết.
                      </p>
                    ) : (
                      task.todos?.map((todo) => (
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
                              className="text-slate-400 hover:text-blue-600 shrink-0"
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
                            <button
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                  {/* Comments Feed */}
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {task.comments?.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-400">
                        Chưa có bình luận nào. Hãy trao đổi công việc bên dưới.
                      </p>
                    ) : (
                      task.comments?.map((c) => (
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
                                  <span className="truncate max-w-xs">{f.filename || f.originalName}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Input Box */}
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
                </div>
              )}

              {/* ─── TAB 3: AUDIT TRAIL & SNAPSHOTS ──────────────────────── */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {task.histories?.map((h) => (
                      <div key={h.id} className="relative group">
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Version {h.version}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {h.changeDescription || h.changeType}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Bởi: {h.changedBy?.fullName || 'Hệ thống'} •{' '}
                              {new Date(h.createdAt).toLocaleString('vi-VN')}
                            </p>
                          </div>

                          <button
                            onClick={() => setSelectedSnapshot(h)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem Snapshot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Meta & Logistics */}
        <div className="space-y-6">
          {/* Status & Deadline Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
              Thông tin thời hạn
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Bắt đầu:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {new Date(task.startedAt).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Hạn chót:</span>
                <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                  {new Date(task.deadline).toLocaleString('vi-VN')}
                </span>
              </div>
              {task.completedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Hoàn thành:</span>
                  <span className="font-medium text-emerald-600">
                    {new Date(task.completedAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
            </div>

            {/* Assigned Team */}
            <div className="space-y-3 pt-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Người thực thi hiện tại:</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.executorIds && (task.executorIds as string[]).length > 0 ? (
                    (task.executorIds as string[]).map((userId) => {
                      const u = users.find((item) => item.id === userId);
                      return (
                        <span
                          key={userId}
                          className="px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800"
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
                  {task.createdBy?.fullName || 'Hệ thống'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      {isTransitionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Xác nhận chuyển sang bước tiếp theo
              </h3>
              <button onClick={() => setIsTransitionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {nextStep ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <p className="font-bold text-sm">
                    Bước tiếp theo: "{nextStep.name}" (Bước {nextStep.order})
                  </p>
                  <p>Thời hạn quy định: {nextStep.timeLimitHours} giờ</p>
                  {nextStep.instructions && <p>Hướng dẫn: {nextStep.instructions}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Chỉ định người thực thi bước tiếp theo:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl">
                    {users.map((u) => {
                      const isSelected = transitionExecutors.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setTransitionExecutors((prev) =>
                              prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                            )
                          }
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {u.fullName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200">
                <p className="font-bold text-sm">Đây là bước cuối cùng của quy trình!</p>
                <p className="mt-1">Khi chuyển bước, nhiệm vụ sẽ được đánh dấu hoàn thành toàn bộ.</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTransitionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmTransition}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Đang chuyển...' : 'Xác nhận chuyển bước'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Details Viewer Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col p-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Chi tiết Snapshot - Version {selectedSnapshot.version}
                </h3>
                <p className="text-xs text-slate-400">
                  Thời điểm lưu: {new Date(selectedSnapshot.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <button onClick={() => setSelectedSnapshot(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Mô tả thay đổi: {selectedSnapshot.changeDescription}
                </p>
                <p className="text-slate-500">Hành động: {selectedSnapshot.changeType}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Dữ liệu snapshot (JSON):
                </p>
                <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto max-h-80">
                  {JSON.stringify(selectedSnapshot.snapshot, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
