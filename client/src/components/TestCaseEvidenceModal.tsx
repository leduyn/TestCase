import React, { useState, useMemo } from 'react';
import {
  X,
  Image as ImageIcon,
  Clock,
  User,
  Layers,
  ChevronRight,
  Eye,
  Play,
  Film,
} from 'lucide-react';
import type { TestCase, TestExecution, TestExecutionImage, ExecutionStatus } from '../types';
import { uploadApi } from '../services/api';
import { PlatformBadge, PriorityBadge, StatusBadge } from './Badge';
import { ImageLightbox } from './ImageLightbox';

interface TestCaseEvidenceModalProps {
  testCase: TestCase | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectExecution?: (execution: TestExecution) => void;
  initialUserId?: string;
}

interface TesterGroup {
  id: string;
  name: string;
  email: string;
  totalImages: number;
  totalMilestones: number;
  latestStatus?: ExecutionStatus;
  executionsWithImages: TestExecution[];
}

export const TestCaseEvidenceModal: React.FC<TestCaseEvidenceModalProps> = ({
  testCase,
  isOpen,
  onClose,
  onSelectExecution,
  initialUserId,
}) => {
  if (!isOpen || !testCase) return null;

  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || 'ALL');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<TestExecutionImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Group all executions that have images by user
  const { testerGroups, allImagesCount, allMilestonesCount, allFlatImages } = useMemo(() => {
    const allExecs: TestExecution[] = testCase.executions || [];
    const map = new Map<string, TesterGroup>();
    let totalImages = 0;
    let totalMilestones = 0;
    const flatImagesList: TestExecutionImage[] = [];

    allExecs.forEach((exec) => {
      const execImages = exec.images || [];
      if (execImages.length === 0) return;

      totalMilestones++;
      totalImages += execImages.length;

      // Attach execution context to images if missing
      const enrichedImages: TestExecutionImage[] = execImages.map((img) => ({
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
      }));

      flatImagesList.push(...enrichedImages);

      const uKey = exec.executedById || exec.executedBy?.email || exec.executedBy?.fullName || 'ANONYMOUS';
      const uName = exec.executedBy?.fullName || exec.executedBy?.email || 'Người dùng';
      const uEmail = exec.executedBy?.email || '';

      if (!map.has(uKey)) {
        map.set(uKey, {
          id: uKey,
          name: uName,
          email: uEmail,
          totalImages: 0,
          totalMilestones: 0,
          latestStatus: exec.status,
          executionsWithImages: [],
        });
      }

      const grp = map.get(uKey)!;
      grp.totalImages += execImages.length;
      grp.totalMilestones += 1;
      grp.executionsWithImages.push({
        ...exec,
        images: enrichedImages,
      });
    });

    return {
      testerGroups: Array.from(map.values()),
      allImagesCount: totalImages,
      allMilestonesCount: totalMilestones,
      allFlatImages: flatImagesList,
    };
  }, [testCase]);

  // Determine which executions to display based on selected tab
  const displayedExecutions = useMemo(() => {
    if (selectedUserId === 'ALL') {
      const all: TestExecution[] = [];
      testerGroups.forEach((g) => {
        all.push(...g.executionsWithImages);
      });
      // Sort by executedAt desc
      return all.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    }
    const grp = testerGroups.find((g) => g.id === selectedUserId);
    return grp ? grp.executionsWithImages : [];
  }, [testerGroups, selectedUserId]);

  const handleOpenLightbox = (image: TestExecutionImage, poolImages: TestExecutionImage[]) => {
    const idx = poolImages.findIndex((img) => img.id === image.id);
    setLightboxImages(poolImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {testCase.testCaseCode}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Minh chứng: {testCase.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{testCase.module}</span>
                <span>•</span>
                <PlatformBadge platform={testCase.platform} />
                <span>•</span>
                <PriorityBadge priority={testCase.priority} />
                <span>•</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Tổng {allImagesCount} file trong {allMilestonesCount} mốc kiểm thử ({testerGroups.length} Tester)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 ml-2"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tester Tabs (Gom nhóm theo Từng Người Dùng) */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <User className="w-3.5 h-3.5 text-blue-600" />
            Tester:
          </span>

          <button
            type="button"
            onClick={() => setSelectedUserId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              selectedUserId === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất cả người dùng</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              selectedUserId === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {allImagesCount}
            </span>
          </button>

          {testerGroups.map((grp) => {
            const isSelected = selectedUserId === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => setSelectedUserId(grp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-400/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center justify-center">
                  {grp.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate max-w-[130px]">{grp.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {grp.totalImages} ảnh
                </span>
                {grp.latestStatus && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      grp.latestStatus === 'PASSED'
                        ? 'bg-emerald-500'
                        : grp.latestStatus === 'FAILED'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body: Timeline of Milestones with Evidence Images */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          {displayedExecutions.length > 0 ? (
            displayedExecutions.map((exec) => {
              const execImages = exec.images || [];
              const tester = exec.executedBy?.fullName || exec.executedBy?.email || 'Người dùng';
              const milestoneTime = exec.executedAt
                ? new Date(exec.executedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '—';

              return (
                <div
                  key={exec.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4 hover:border-blue-300 dark:hover:border-blue-700/80 transition-all"
                >
                  {/* Milestone Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 gap-2.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/70 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Mốc: {milestoneTime}</span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tester: <strong>{tester}</strong></span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        {exec.server && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                            {exec.server}
                          </span>
                        )}
                        {exec.os && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                            {exec.os}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={exec.status} size="sm" />
                      {onSelectExecution && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectExecution(exec);
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                          title="Mở mốc này trong Drawer chi tiết"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes / Actual Result Preview if available */}
                  {(exec.actualResult || exec.notes) && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      {exec.actualResult && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Kết quả thực tế: </span>
                          <span
                            className="rich-text-content"
                            dangerouslySetInnerHTML={{
                              __html: exec.actualResult.replace(/<img[^>]*>/gi, ''),
                            }}
                          />
                        </div>
                      )}
                      {exec.notes && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú: </span>
                          <span>{exec.notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grid of Evidence Images */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span className="flex items-center gap-1">
                        <Film className="w-3.5 h-3.5 text-blue-600" />
                        Minh chứng ({execImages.length} file)
                      </span>
                      <span className="text-[11px] font-normal text-slate-400">
                        Nhấp vào ảnh để xem phóng to
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {execImages.map((img) => {
                        const isImgVideo = img.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|mkv)$/i.test(img.filename);
                        const displayUrl = isImgVideo ? uploadApi.getThumbnailUrl(img.id) : uploadApi.getImageUrl(img.id);
                        return (
                          <div
                            key={img.id}
                            onClick={() => handleOpenLightbox(img, allFlatImages)}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-500 hover:scale-[1.02]"
                          >
                            <img
                              src={displayUrl}
                              alt={img.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {isImgVideo && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/30 transition-colors">
                                <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center shadow-lg ring-2 ring-white/40 group-hover:scale-110 transition-transform">
                                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                </div>
                              </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                              <div className="flex justify-end">
                                <div className="p-1 rounded-md bg-black/60 text-white">
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
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
              <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Chưa có minh chứng nào
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {selectedUserId === 'ALL'
                  ? 'Kịch bản kiểm thử này chưa được tải lên minh chứng nào trong các lần chạy.'
                  : 'Người kiểm thử này chưa tải lên minh chứng nào.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            <span>Đang hiển thị <strong>{displayedExecutions.length}</strong> mốc có minh chứng</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Enhanced Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
