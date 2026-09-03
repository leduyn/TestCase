import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, X, Trash2, Eye, AlertCircle, Loader2, Play, Film, Clock } from 'lucide-react';
import type { TestExecutionImage } from '../types';
import { uploadApi } from '../services/api';
import { ImageLightbox } from './ImageLightbox';

interface ImageUploaderProps {
  executionId?: string;
  images: TestExecutionImage[];
  onImagesChange?: (images: TestExecutionImage[]) => void;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  onUploadCustom?: (files: File[]) => Promise<TestExecutionImage[] | undefined>;
  maxFiles?: number;
  maxFileSizeMB?: number;
  disabled?: boolean;
}

interface PendingPreview {
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  executionId,
  images = [],
  onImagesChange,
  pendingFiles = [],
  onPendingFilesChange,
  onUploadCustom,
  maxFiles = 10,
  maxFileSizeMB = 10,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tạo URL preview tạm thời cho các file pending
  const pendingPreviews = useMemo<PendingPreview[]>(() => {
    if (!pendingFiles || pendingFiles.length === 0) return [];
    return pendingFiles.map((file) => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(file.name);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo,
      };
    });
  }, [pendingFiles]);

  // Dọn dẹp object URLs khi component unmount hoặc pendingPreviews thay đổi
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [pendingPreviews]);

  const totalCount = images.length + pendingFiles.length;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    // Nếu không có cả executionId, không có onPendingFilesChange, và không có onUploadCustom
    if (!executionId && !onPendingFilesChange && !onUploadCustom) {
      setError('Vui lòng lưu kết quả kiểm thử trước khi tải ảnh minh chứng');
      return;
    }

    const validFiles: File[] = [];
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    ];

    // Check count limit
    if (totalCount + files.length > maxFiles) {
      setError(`Chỉ được tải tối đa ${maxFiles} file. Hiện có ${totalCount} file, bạn chọn ${files.length} file.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        setError(`File "${file.name}" không đúng định dạng. Hỗ trợ: Ảnh (JPEG, PNG, GIF, WebP) hoặc Video (MP4, WebM, MOV, AVI, MKV).`);
        return;
      }
      if (file.size > maxSizeBytes) {
        setError(`File "${file.name}" vượt quá dung lượng tối đa ${maxFileSizeMB}MB.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Ưu tiên chế độ LƯU TẠM (Pending Mode)
    if (onPendingFilesChange) {
      onPendingFilesChange([...pendingFiles, ...validFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Chế độ upload trực tiếp
    setUploading(true);
    try {
      if (onUploadCustom) {
        const uploaded = await onUploadCustom(validFiles);
        if (uploaded && uploaded.length > 0 && onImagesChange) {
          onImagesChange([...images, ...uploaded]);
        }
      } else if (executionId && onImagesChange) {
        const res = await uploadApi.uploadImages(executionId, validFiles);
        if (res.data.images) {
          onImagesChange([...images, ...res.data.images]);
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Lỗi khi upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteExisting = (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onImagesChange) {
      onImagesChange(images.filter((img) => img.id !== imageId));
    }
  };

  const handleDeletePending = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPendingFilesChange) {
      onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Film className="w-4 h-4 text-blue-600" />
          <span>Ảnh / Video minh chứng lỗi (Evidence)</span>
        </label>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          {totalCount} / {maxFiles} file (tối đa {maxFileSizeMB}MB/file)
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 hover:bg-rose-200 dark:hover:bg-rose-900 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Drop Zone */}
      {totalCount < maxFiles && !disabled && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
          {uploading ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tải file lên kho lưu trữ...</span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Kéo thả ảnh/video vào đây hoặc <span className="text-blue-600 hover:underline">chọn từ máy tính</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hỗ trợ PNG, JPG, GIF, WebP, MP4, WebM, MOV (Tối đa {maxFileSizeMB}MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Image Gallery Grid */}
      {(images.length > 0 || pendingPreviews.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
          {/* 1. Các file đã lưu trên server */}
          {images.map((img, idx) => {
            const isVideo = img.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(img.filename);
            const thumbUrl = isVideo ? uploadApi.getThumbnailUrl(img.id) : uploadApi.getImageUrl(img.id);
            const isDeleting = deletingId === img.id;

            return (
              <div
                key={img.id}
                onClick={() => openLightbox(idx)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {isVideo ? (
                  <>
                    <img
                      src={thumbUrl}
                      alt={img.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center shadow-lg ring-2 ring-white/40 group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={thumbUrl}
                    alt={img.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                )}

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    {!disabled && onImagesChange && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteExisting(img.id, e)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow transition-all hover:scale-105"
                        title="Xóa file này"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="text-white space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-blue-300 shrink-0" />
                      <p className="text-[11px] font-medium truncate drop-shadow">{img.filename}</p>
                    </div>
                    <p className="text-[10px] text-slate-300 drop-shadow">
                      {formatFileSize(img.fileSize)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 2. Các file đang chờ lưu (Pending) */}
          {pendingPreviews.map((p, pIdx) => {
            return (
              <div
                key={`pending-${pIdx}-${p.file.name}`}
                className="group relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
              >
                {/* Badge Chờ lưu */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold shadow">
                  <Clock className="w-3 h-3" />
                  <span>Chờ lưu</span>
                </div>

                {p.isVideo ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-900/10 dark:bg-slate-900/40">
                    <Film className="w-8 h-8 text-amber-600 dark:text-amber-400 mb-1" />
                    <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center truncate max-w-full">
                      {p.file.name}
                    </p>
                  </div>
                ) : (
                  <img
                    src={p.previewUrl}
                    alt={p.file.name}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleDeletePending(pIdx, e)}
                      className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow transition-all hover:scale-105"
                      title="Hủy file này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-white space-y-0.5">
                    <p className="text-[11px] font-medium truncate drop-shadow">{p.file.name}</p>
                    <p className="text-[10px] text-amber-300 drop-shadow">
                      {formatFileSize(p.file.size)} (Chưa tải lên)
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox for Fullscreen Viewer */}
      <ImageLightbox
        images={images}
        initialIndex={selectedImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
