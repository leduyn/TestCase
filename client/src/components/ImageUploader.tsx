import React, { useState, useRef } from 'react';
import { Upload, X, Trash2, Eye, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import type { TestExecutionImage } from '../types';
import { uploadApi } from '../services/api';
import { ImageLightbox } from './ImageLightbox';

interface ImageUploaderProps {
  executionId?: string;
  images: TestExecutionImage[];
  onImagesChange: (images: TestExecutionImage[]) => void;
  onUploadCustom?: (files: File[]) => Promise<TestExecutionImage[] | undefined>;
  maxFiles?: number;
  maxFileSizeMB?: number;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  executionId,
  images,
  onImagesChange,
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

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    if (!executionId && !onUploadCustom) {
      setError('Vui lòng lưu kết quả kiểm thử trước khi tải ảnh minh chứng');
      return;
    }

    const validFiles: File[] = [];
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

    // Check count limit
    if (images.length + files.length > maxFiles) {
      setError(`Chỉ được tải tối đa ${maxFiles} ảnh. Hiện có ${images.length} ảnh, bạn chọn ${files.length} ảnh.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        setError(`File "${file.name}" không đúng định dạng ảnh (JPEG, PNG, GIF, WebP, BMP, SVG).`);
        return;
      }
      if (file.size > maxSizeBytes) {
        setError(`File "${file.name}" vượt quá dung lượng tối đa ${maxFileSizeMB}MB.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      if (onUploadCustom) {
        const uploaded = await onUploadCustom(validFiles);
        if (uploaded && uploaded.length > 0) {
          onImagesChange([...images, ...uploaded]);
        }
      } else if (executionId) {
        const res = await uploadApi.uploadImages(executionId, validFiles);
        if (res.data.images) {
          onImagesChange([...images, ...res.data.images]);
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Lỗi khi upload ảnh');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;

    setDeletingId(imageId);
    try {
      await uploadApi.deleteImage(imageId);
      onImagesChange(images.filter((img) => img.id !== imageId));
    } catch (err: any) {
      console.error('Delete image error:', err);
      alert(err.response?.data?.message || 'Lỗi khi xóa ảnh');
    } finally {
      setDeletingId(null);
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
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <span>Ảnh chụp màn hình / Minh chứng lỗi (Evidence)</span>
        </label>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          {images.length} / {maxFiles} ảnh (tối đa {maxFileSizeMB}MB/ảnh)
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
      {images.length < maxFiles && !disabled && (
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
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
          {uploading ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tải ảnh lên kho lưu trữ...</span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Kéo thả ảnh vào đây hoặc <span className="text-blue-600 hover:underline">chọn từ máy tính</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hỗ trợ PNG, JPG, GIF, WebP (Tối đa {maxFileSizeMB}MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Image Gallery Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
          {images.map((img, idx) => {
            // Always use server proxy for reliable image loading (Google Drive direct links have CORS issues)
            const url = uploadApi.getImageUrl(img.id);
            const isDeleting = deletingId === img.id;

            return (
              <div
                key={img.id}
                onClick={() => openLightbox(idx)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <img
                  src={url}
                  alt={img.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(img.id, e)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow transition-all hover:scale-105"
                        title="Xóa ảnh này"
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
