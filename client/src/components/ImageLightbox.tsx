import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';
import type { TestExecutionImage } from '../types';
import { uploadApi } from '../services/api';

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
  // Always use server proxy for reliable image loading (Google Drive direct links have CORS issues)
  const imageUrl = uploadApi.getImageUrl(currentImage.id);

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
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/40 text-white border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white truncate max-w-md">
              {currentImage.filename}
            </h3>
            <p className="text-xs text-white/60">
              {formatFileSize(currentImage.fileSize)} • {currentIndex + 1} / {images.length} • {currentImage.storageType.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-white/70 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <a
            href={imageUrl}
            download={currentImage.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Tải ảnh gốc"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition-colors ml-2"
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
              className="absolute left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all shadow-lg hover:scale-105 border border-white/10"
              title="Ảnh trước (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all shadow-lg hover:scale-105 border border-white/10"
              title="Ảnh sau (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Displayed Image */}
        <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
          <img
            src={imageUrl}
            alt={currentImage.filename}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl origin-center"
          />
        </div>
      </div>

      {/* Bottom Thumbnail Strip (if multiple images) */}
      {images.length > 1 && (
        <div className="px-6 py-3 bg-black/50 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto shrink-0">
          {images.map((img, idx) => {
            // Always use server proxy for reliable image loading
            const thumbUrl = uploadApi.getImageUrl(img.id);
            return (
              <button
                key={img.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                }}
                className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  idx === currentIndex
                    ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/50'
                    : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/40'
                }`}
              >
                <img
                  src={thumbUrl}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
