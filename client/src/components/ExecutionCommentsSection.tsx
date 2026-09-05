import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Trash2,
  FileText,
  Loader2,
  RefreshCw,
  Eye,
  X,
  FileCode,
  Archive,
  Image as ImageIcon,
  UserCheck,
  AlertCircle,
  Download,
} from 'lucide-react';
import type {
  TestExecution,
  TestExecutionComment,
  ExecutionCommentAttachment,
} from '../types';
import { executionCommentApi, executionUploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { emitExecutionCommentUpdated, onExecutionCommentUpdated } from '../utils/executionEvents';

interface ExecutionCommentsSectionProps {
  executionId: string;
  testExecution?: TestExecution | null;
  comments?: TestExecutionComment[];
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
  onFollowRequest?: () => void;
  canComment?: boolean;
  className?: string;
}

export const ExecutionCommentsSection: React.FC<ExecutionCommentsSectionProps> = ({
  executionId,
  testExecution,
  comments: externalComments,
  onCommentAdded,
  onCommentDeleted,
  onFollowRequest,
  canComment: overrideCanComment,
  className = '',
}) => {
  const { user } = useAuth();

  // Internal state when comments are not provided externally
  const [internalComments, setInternalComments] = useState<TestExecutionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Comment input state
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ExecutionCommentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Preview modal for images
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    downloadUrl?: string;
    name: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);

  const comments = externalComments !== undefined ? externalComments : internalComments;

  const handleScroll = () => {
    if (streamContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = streamContainerRef.current;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    }
  };

  // Fetch comments (hỗ trợ isSilent để tự làm mới ngầm không giật màn hình)
  const fetchComments = useCallback(
    async (isRefresh = false, isSilent = false) => {
      if (!executionId) return;
      if (!isSilent) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await executionCommentApi.getComments(executionId);
        const incoming = res.data.comments || [];
        setInternalComments(incoming);
      } catch (err: any) {
        if (!isSilent) {
          console.error('Error fetching execution comments:', err);
          // 403 means user is not watcher/executor/creator/admin
          if (err.response?.status === 403) {
            setErrorMessage('Bạn không có quyền xem hoặc bình luận trên lượt thực thi này.');
          } else {
            setErrorMessage(err.response?.data?.message || 'Không thể tải danh sách bình luận');
          }
        }
      } finally {
        if (!isSilent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [executionId]
  );

  useEffect(() => {
    if (externalComments === undefined && executionId) {
      fetchComments();
    }
  }, [executionId, externalComments, fetchComments]);

  // Lắng nghe sự kiện đồng bộ bình luận (cùng tab & khác tab)
  useEffect(() => {
    if (!executionId) return;
    const unsubscribe = onExecutionCommentUpdated((updatedId) => {
      if (!updatedId || updatedId === executionId) {
        fetchComments(false, true);
      }
    });
    return () => unsubscribe();
  }, [executionId, fetchComments]);

  // Polling tự động làm mới ngầm định kỳ (mỗi 4 giây khi tab visible) & khi focus / visibilitychange
  useEffect(() => {
    if (!executionId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchComments(false, true);
      }
    }, 4000);

    const handleFocus = () => {
      fetchComments(false, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchComments(false, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executionId, fetchComments]);

  // Tự động cuộn xuống dưới cùng khi có bình luận mới nếu người dùng đang ở gần đáy
  const prevCommentsLengthRef = useRef<number>(comments.length);
  useEffect(() => {
    if (comments.length > prevCommentsLengthRef.current) {
      if (isNearBottomRef.current) {
        setTimeout(() => {
          commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
    prevCommentsLengthRef.current = comments.length;
  }, [comments.length]);

  // Determine if the current user can comment
  const canUserComment = (() => {
    if (overrideCanComment !== undefined) return overrideCanComment;
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'MANAGER') return true;
    if (!testExecution) return true; // Fallback to allow attempt
    const isCreator = testExecution.createdById === user.id;
    const isExecutor = testExecution.executedById === user.id;
    const isWatcher = testExecution.watchers?.some((w) => w.userId === user.id);
    return isCreator || isExecutor || isWatcher;
  })();

  // Handle file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const res = await executionUploadApi.uploadFiles(files);
      const uploaded: ExecutionCommentAttachment[] = res.data.files.map((f) => {
        const originalName = f.originalName || f.filename || 'Tập tin đính kèm';
        const viewUrl = f.storagePath
          ? executionUploadApi.getFileViewUrl(f.storagePath, originalName)
          : (f.publicUrl || '');
        return {
          name: originalName,
          url: viewUrl,
          storagePath: f.storagePath,
          size: f.size,
          mimeType: f.mimeType,
        };
      });

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      console.error('Upload comment attachment error:', err);
      alert(err.response?.data?.message || 'Lỗi khi tải tệp đính kèm');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit comment
  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting || !executionId) return;

    setSubmitting(true);
    try {
      await executionCommentApi.addComment(executionId, {
        content: content.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setContent('');
      setAttachments([]);

      // Luôn làm mới bình luận nội bộ ngay lập tức
      await fetchComments(true);

      // Bắn sự kiện đồng bộ toàn hệ thống để các tab khác và component cha cùng cập nhật
      emitExecutionCommentUpdated(executionId);

      if (onCommentAdded) {
        onCommentAdded();
      }

      // Auto scroll to bottom
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Error adding execution comment:', err);
      alert(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Ctrl+Enter shortcut
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddComment();
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      await executionCommentApi.deleteComment(executionId, commentId);

      // Luôn làm mới bình luận nội bộ ngay lập tức
      await fetchComments(true);

      // Bắn sự kiện đồng bộ toàn hệ thống để các tab khác và component cha cùng cập nhật
      emitExecutionCommentUpdated(executionId);

      if (onCommentDeleted) {
        onCommentDeleted();
      }
    } catch (err: any) {
      console.error('Error deleting comment:', err);
      alert(err.response?.data?.message || 'Lỗi khi xóa bình luận');
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Format timestamp helper
  const formatCommentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${time} hôm nay`;

    return `${time}, ${date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;
  };

  // Helper to format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to get view/download url for an attachment
  const resolveAttachmentUrl = useCallback(
    (att: ExecutionCommentAttachment, isDownload = false) => {
      let storagePath = att.storagePath;
      if (!storagePath && att.url) {
        if (att.url.includes('/upload/view?')) {
          try {
            const urlObj = new URL(att.url, window.location.origin);
            const sp = urlObj.searchParams.get('storagePath');
            if (sp) storagePath = sp;
          } catch {
            // ignore
          }
        } else if (att.url.startsWith('/uploads/') || att.url.startsWith('uploads/')) {
          storagePath = att.url.replace(/^(\/)?uploads\//, '');
        }
      }

      if (storagePath) {
        return executionUploadApi.getFileViewUrl(storagePath, att.name, isDownload);
      }

      if (att.url) {
        return att.url;
      }

      return '#';
    },
    []
  );

  // Helper to check if attachment is image
  const isImageAttachment = (att: ExecutionCommentAttachment) => {
    if (att.mimeType && att.mimeType.startsWith('image/')) return true;
    const name = (att.name || '').toLowerCase();
    const url = (att.url || '').toLowerCase();
    return (
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.gif') ||
      name.endsWith('.webp') ||
      name.endsWith('.svg') ||
      name.endsWith('.bmp') ||
      name.endsWith('.ico') ||
      url.includes('.png') ||
      url.includes('.jpg') ||
      url.includes('.jpeg') ||
      url.includes('.gif') ||
      url.includes('.webp') ||
      url.includes('.svg')
    );
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              Trao đổi & Bình luận
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {comments.length}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Trao đổi giữa Tester, Người tạo, Người theo dõi và Quản trị viên
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchComments(true)}
          disabled={refreshing}
          title="Làm mới danh sách bình luận"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {onFollowRequest && !canUserComment && (
            <button
              type="button"
              onClick={onFollowRequest}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 text-xs transition"
            >
              Theo dõi lượt này
            </button>
          )}
        </div>
      )}

      {/* Comments Stream */}
      <div
        ref={streamContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-5 space-y-4 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
      >
        {loading && comments.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Đang tải cuộc trao đổi...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5 text-slate-400">
              <MessageSquare className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Chưa có bình luận nào cho lượt kiểm thử này
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mt-1">
              Bạn có thể bắt đầu cuộc trao đổi, gửi thắc mắc hoặc bổ sung thông tin giải thích kết quả kiểm thử tại đây.
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = user?.id === comment.userId;
            const canDelete =
              isMe || user?.role === 'ADMIN' || user?.role === 'MANAGER';
            const userInitial =
              comment.user?.fullName?.trim()?.charAt(0).toUpperCase() || 'U';

            return (
              <div
                key={comment.id}
                className={`group flex gap-3 text-xs ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  title={`${comment.user?.fullName || 'Người dùng'} (${comment.user?.role || 'TESTER'})`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm text-white ${
                    isMe
                      ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 ring-2 ring-indigo-200 dark:ring-indigo-900/60'
                      : 'bg-gradient-to-tr from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 ring-2 ring-slate-200 dark:ring-slate-700'
                  }`}
                >
                  {userInitial}
                </div>

                {/* Message Content Container */}
                <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Meta (Name, Role, Timestamp, Delete action) */}
                  <div
                    className={`flex items-center gap-1.5 text-[11px] ${
                      isMe ? 'justify-end text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {isMe ? 'Tôi' : comment.user?.fullName || 'Người dùng'}
                    </span>
                    {comment.user?.role && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                          comment.user.role === 'ADMIN'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : comment.user.role === 'MANAGER'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {comment.user.role}
                      </span>
                    )}
                    <span>•</span>
                    <span title={new Date(comment.createdAt).toLocaleString('vi-VN')}>
                      {formatCommentDate(comment.createdAt)}
                    </span>

                    {/* Delete action button */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingCommentId === comment.id}
                        title="Xóa bình luận"
                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        {deletingCommentId === comment.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    <p className="whitespace-pre-line select-text font-normal">{comment.content}</p>

                    {/* Attachments Section */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="pt-2.5 mt-2 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-2">
                        {comment.attachments.map((att, aIdx) => {
                          const isImg = isImageAttachment(att);
                          const fileViewUrl = resolveAttachmentUrl(att);
                          const fileDownloadUrl = resolveAttachmentUrl(att, true);

                          return (
                            <div key={aIdx} className="group/att relative">
                              {isImg ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: fileViewUrl,
                                      downloadUrl: fileDownloadUrl,
                                      name: att.name,
                                    })
                                  }
                                  className={`flex items-center gap-1.5 p-1 rounded-lg border text-[11px] transition ${
                                    isMe
                                      ? 'bg-indigo-700/80 border-indigo-500/80 text-white hover:bg-indigo-700'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                                  }`}
                                >
                                  <div className="w-7 h-7 rounded overflow-hidden bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                                    <img
                                      src={fileViewUrl}
                                      alt={att.name}
                                      className="w-full h-full object-cover rounded"
                                      onError={(e) => {
                                        // Fallback on image load error
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                        if (e.currentTarget.parentElement) {
                                          e.currentTarget.parentElement.innerHTML =
                                            '<span class="text-[9px] font-bold opacity-60">IMG</span>';
                                        }
                                      }}
                                    />
                                  </div>
                                  <span className="truncate max-w-[130px] font-medium">{att.name}</span>
                                  <Eye className="w-3 h-3 opacity-70" />
                                </button>
                              ) : (
                                <a
                                  href={fileDownloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={att.name}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
                                    isMe
                                      ? 'bg-indigo-700/80 border-indigo-500/80 text-indigo-50 hover:bg-indigo-700'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                                  }`}
                                >
                                  {att.name.endsWith('.zip') || att.name.endsWith('.rar') || att.name.endsWith('.7z') ? (
                                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                                  ) : att.name.endsWith('.json') || att.name.endsWith('.log') ? (
                                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                  )}
                                  <span className="truncate max-w-[140px]">{att.name}</span>
                                  {att.size && (
                                    <span className="text-[10px] opacity-70">
                                      ({formatFileSize(att.size)})
                                    </span>
                                  )}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment Input Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
        {!canUserComment ? (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Bạn cần là <strong>Người thực thi</strong>, <strong>Người tạo</strong> hoặc <strong>Người theo dõi</strong> để gửi bình luận.
              </span>
            </div>
            {onFollowRequest && (
              <button
                type="button"
                onClick={onFollowRequest}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Theo dõi ngay
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleAddComment} className="space-y-2.5">
            {/* Selected attachments list */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                {attachments.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-600 shadow-xs"
                  >
                    {isImageAttachment(file) ? (
                      <ImageIcon className="w-3 h-3 text-indigo-500" />
                    ) : (
                      <FileText className="w-3 h-3 text-slate-500" />
                    )}
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    {file.size && (
                      <span className="text-[10px] text-slate-400">
                        {formatFileSize(file.size)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition"
                      title="Gỡ tệp này"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập nội dung trao đổi, góp ý hoặc giải thích kết quả kiểm thử... (Ctrl + Enter để gửi)"
                rows={2}
                disabled={submitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading || submitting}
                  className="hidden"
                  id="execution-comment-file-input"
                />
                <label
                  htmlFor="execution-comment-file-input"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    uploading
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Đang tải tệp...</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đính kèm tệp / ảnh</span>
                    </>
                  )}
                </label>

                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Tối đa 10 tệp (ảnh, log, tài liệu)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting || !content.trim() || uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi bình luận</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-white text-xs">
              <span className="font-semibold truncate max-w-md">{previewImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.downloadUrl || previewImage.url}
                  download={previewImage.name}
                  className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition inline-flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải về
                </a>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition"
                >
                  Mở tab mới
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="p-2 flex items-center justify-center overflow-auto bg-black/40">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionCommentsSection;
