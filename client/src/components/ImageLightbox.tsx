import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  User,
  Clock,
  Server,
  Monitor,
  FileText,
  Film,
  Play,
} from 'lucide-react';
import type { TestExecutionImage } from '../types';
import { uploadApi } from '../services/api';
import { StatusBadge } from './Badge';

interface ImageLightboxProps {
  images: TestExecutionImage[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];
  const imageUrl = uploadApi.getImageUrl(currentImage.id);
  const exec = currentImage.execution;
  const isVideo = currentImage.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(currentImage.filename);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setZoom(1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setZoom(1);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const testerName =
    exec?.executedBy?.fullName ||
    exec?.executedBy?.email ||
    'Tester (Ẩn danh)';

  const milestoneTime = exec?.executedAt
    ? new Date(exec.executedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : currentImage.uploadedAt
    ? new Date(currentImage.uploadedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Header with Comprehensive Metadata */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-3.5 bg-black/60 text-white border-b border-white/15 shrink-0 gap-3">
        {/* Left: Image file info & Tester context */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center shrink-0">
            {isVideo ? <Film className="w-5 h-5 text-blue-400" /> : <ImageIcon className="w-5 h-5 text-blue-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white truncate max-w-xs md:max-w-md" title={currentImage.filename}>
                {currentImage.filename}
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono">
                {currentIndex + 1} / {images.length}
              </span>
              {exec?.status && <StatusBadge status={exec.status} size="sm" />}
            </div>

            {/* Context row: Tester, Timestamp, Environment */}
            <div className="flex items-center gap-2.5 text-xs text-white/70 mt-1 flex-wrap font-sans">
              <span className="flex items-center gap-1 text-blue-300 font-medium">
                <User className="w-3 h-3 text-blue-400" />
                <span>{testerName}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{milestoneTime}</span>
              </span>
              {exec?.server && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono">
                    <Server className="w-2.5 h-2.5 text-slate-300" />
                    {exec.server}
                  </span>
                </>
              )}
              {exec?.os && (
                <>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[11px]">
                    <Monitor className="w-2.5 h-2.5 text-slate-300" />
                    {exec.os}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="text-[11px] text-white/50">
                {formatFileSize(currentImage.fileSize)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 rounded-md hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-white/80 px-1.5 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-1.5 rounded-md hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {!isVideo && <div className="w-px h-5 bg-white/20 mx-0.5" />}

          <a
            href={imageUrl}
            download={currentImage.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
            title="Tải ảnh gốc về máy"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải về</span>
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition-colors ml-1"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image View */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden select-none">
        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 z-10 p-3 rounded-full bg-black/70 hover:bg-blue-600 text-white transition-all shadow-xl hover:scale-105 border border-white/15"
              title="Ảnh trước (Phím ←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 p-3 rounded-full bg-black/70 hover:bg-blue-600 text-white transition-all shadow-xl hover:scale-105 border border-white/15"
              title="Ảnh sau (Phím →)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Displayed Image or Video */}
        <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
          {isVideo ? (
            <video
              key={currentImage.id}
              src={imageUrl}
              controls
              autoPlay
              className="max-h-[75vh] max-w-[88vw] object-contain rounded-lg shadow-2xl origin-center border border-white/10"
            />
          ) : (
            <img
              src={imageUrl}
              alt={currentImage.filename}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[75vh] max-w-[88vw] object-contain rounded-lg shadow-2xl origin-center border border-white/10"
            />
          )}
        </div>
      </div>

      {/* Optional Note / Actual Result Bar if execution has notes */}
      {exec?.notes && (
        <div className="px-6 py-2 bg-black/70 border-t border-white/10 text-xs text-slate-300 flex items-center justify-center gap-2">
          <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-white">Ghi chú lượt test:</span>
          <span className="truncate max-w-xl">{exec.notes}</span>
        </div>
      )}

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div className="px-6 py-3 bg-black/60 border-t border-white/15 flex items-center justify-center gap-2.5 overflow-x-auto shrink-0">
          {images.map((img, idx) => {
            const isVideo = img.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(img.filename);
            const thumbUrl = isVideo ? uploadApi.getThumbnailUrl(img.id) : uploadApi.getImageUrl(img.id);
            const isSelected = idx === currentIndex;
            const imgTester = img.execution?.executedBy?.fullName || img.execution?.executedBy?.email;
            return (
              <button
                key={img.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                }}
                className={`group relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  isSelected
                    ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/40 ring-2 ring-blue-400/60'
                    : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/50'
                }`}
                title={`${img.filename}${imgTester ? ` (${imgTester})` : ''}`}
              >
                <img
                  src={thumbUrl}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isVideo && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                    <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow" />
                  </div>
                )}
                {img.execution?.status && (
                  <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-black shadow">
                    <span
                      className={`block w-full h-full rounded-full ${
                        img.execution.status === 'PASSED'
                          ? 'bg-emerald-500'
                          : img.execution.status === 'FAILED'
                          ? 'bg-rose-500'
                          : img.execution.status === 'BLOCKED'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
