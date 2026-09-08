import React, { useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { ProposalAttachment } from '../../types/proposal';
import { proposalUploadApi } from '../../services/proposalApi';

interface ApprovalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalTitle: string;
  actionType: 'APPROVED' | 'REJECTED';
  onConfirm: (comment: string, attachments?: ProposalAttachment[]) => Promise<void>;
}

export const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  isOpen,
  onClose,
  proposalTitle,
  actionType,
  onConfirm,
}) => {
  const isApprove = actionType === 'APPROVED';
  const [comment, setComment] = useState('');
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
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
      console.error('File upload error:', err);
      alert(err.response?.data?.message || 'Lỗi khi upload tệp đính kèm');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isApprove && !comment.trim()) {
      setError('Vui lòng nhập lý do từ chối đề xuất này');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirm(comment.trim(), attachments);
      onClose();
    } catch (err: any) {
      console.error('Error submitting approval decision:', err);
      setError(err.response?.data?.message || err.message || 'Lỗi khi xử lý quyết định');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
                isApprove
                  ? 'bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-rose-500 shadow-rose-500/20'
              }`}
            >
              {isApprove ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isApprove ? 'Xác nhận Phê duyệt đề xuất' : 'Từ chối đề xuất'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {proposalTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {isApprove ? 'Ý kiến / Lời nhắn (Tùy chọn)' : 'Lý do từ chối (Bắt buộc)'}{' '}
              {!isApprove && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError(null);
              }}
              placeholder={
                isApprove
                  ? 'Nhập ý kiến chấp thuận hoặc lời dặn dò kèm theo...'
                  : 'Nêu rõ lý do không chấp thuận để người tạo đề xuất nắm được thông tin...'
              }
              rows={4}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none transition-all ${
                !isApprove && !comment.trim() && error
                  ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
              }`}
            />
          </div>

          {/* Attachments Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tệp đính kèm phản hồi ({attachments.length})
              </label>
              <label className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                <UploadCloud className="w-3.5 h-3.5" />
                {uploadingFiles ? 'Đang tải...' : 'Thêm tệp'}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploadingFiles}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingFiles}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 ${
                isApprove
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
              }`}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isApprove ? 'Chấp thuận đề xuất' : 'Xác nhận Từ chối'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ApprovalActionModal;
