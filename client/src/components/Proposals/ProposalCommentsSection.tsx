import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react';
import type { ProposalComment, ProposalAttachment } from '../../types/proposal';
import { proposalApi, proposalUploadApi } from '../../services/proposalApi';
import { useAuth } from '../../context/AuthContext';

interface ProposalCommentsSectionProps {
  proposalId: string;
  comments: ProposalComment[];
  onCommentAdded: () => void;
}

export const ProposalCommentsSection: React.FC<ProposalCommentsSectionProps> = ({
  proposalId,
  comments,
  onCommentAdded,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const res = await proposalUploadApi.uploadFiles(files);
      const uploaded = res.data.files.map((f) => ({
        name: f.originalName || f.name || 'File đính kèm',
        url: f.publicUrl || f.url || '',
        storagePath: f.storagePath,
        size: f.size,
      }));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      console.error('Upload comment attachment error:', err);
      alert(err.response?.data?.message || 'Lỗi khi tải file đính kèm');
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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await proposalApi.addComment(proposalId, {
        content: content.trim(),
        attachments,
      });
      setContent('');
      setAttachments([]);
      onCommentAdded();
    } catch (err: any) {
      console.error('Error adding proposal comment:', err);
      alert(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          Trao đổi & Bình luận ({comments.length})
        </h4>
        <span className="text-xs text-slate-400">Trao đổi giữa người tạo, cấp duyệt và người theo dõi</span>
      </div>

      {/* Comments Stream */}
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Chưa có bình luận nào. Hãy bắt đầu cuộc trao đổi nếu cần thêm thông tin làm rõ đề xuất.
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = user?.id === comment.userId;
            return (
              <div
                key={comment.id}
                className={`flex gap-3 text-xs ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                  {comment.user?.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[75%] rounded-2xl p-3.5 space-y-1.5 ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 text-[10px] ${
                      isMe ? 'text-indigo-200 justify-end' : 'text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">{comment.user?.fullName || 'Người dùng'}</span>
                    <span>•</span>
                    <span>{new Date(comment.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <p className="whitespace-pre-line text-xs leading-relaxed">{comment.content}</p>

                  {/* Attachments */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {comment.attachments.map((att, aIdx) => (
                        <a
                          key={aIdx}
                          href={att.url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                            isMe
                              ? 'bg-indigo-700 text-indigo-100 hover:bg-indigo-800'
                              : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 hover:underline'
                          }`}
                        >
                          <Paperclip className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{att.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập nội dung trao đổi hoặc thắc mắc..."
          rows={2}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* Selected Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-1">
            {attachments.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(idx)}
                  className="hover:text-rose-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <label className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            {uploading ? 'Đang tải tệp...' : 'Đính kèm tệp'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !content.trim() || uploading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-40 transition-all"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Gửi bình luận
          </button>
        </div>
      </form>
    </div>
  );
};
export default ProposalCommentsSection;
