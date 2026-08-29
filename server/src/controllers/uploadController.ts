import { Response } from 'express';
import path from 'path';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { getStorageConfig, createStorageProvider } from '../services/storageService';
import { canViewAllExecutionHistory } from '../services/permissionService';
import { ThumbnailService } from '../services/thumbnailService';
import { slugify } from '../utils/slug';

const ALLOWED_MIME_TYPES = [
  // Image formats
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  // Video formats
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',   // .mov
  'video/x-msvideo',   // .avi
  'video/x-matroska',  // .mkv
];

export class UploadController {
  /**
   * POST /api/uploads/executions/:executionId/images
   * Upload one or more images for a test execution
   */
  static async uploadImages(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 file ảnh/video để upload' });
      }

      // Verify execution exists
      const execution = await prisma.testExecution.findUnique({
        where: { id: executionId },
        include: { images: true, testCase: true },
      });

      if (!execution) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }

      // Load storage config for limits
      const storageConfig = await getStorageConfig();
      const maxFiles = storageConfig.maxFilesPerExecution;
      const maxSizeBytes = storageConfig.maxFileSizeMB * 1024 * 1024;

      // Check total files limit
      const existingCount = execution.images.length;
      if (existingCount + files.length > maxFiles) {
        return res.status(400).json({
          message: `Vượt quá giới hạn file. Hiện tại: ${existingCount}/${maxFiles}. Bạn chỉ có thể upload thêm ${maxFiles - existingCount} file.`,
        });
      }

      // Validate each file
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return res.status(400).json({
            message: `File "${file.originalname}" không phải định dạng hợp lệ. Chỉ chấp nhận: Ảnh (JPEG, PNG, GIF, WebP, BMP, SVG) hoặc Video (MP4, WebM, OGG, MOV, AVI, MKV)`,
          });
        }
        if (file.size > maxSizeBytes) {
          return res.status(400).json({
            message: `File "${file.originalname}" vượt quá kích thước tối đa (${storageConfig.maxFileSizeMB}MB)`,
          });
        }
      }

      // Upload files via storage provider
      const provider = createStorageProvider(storageConfig);
      const funcFolder = slugify(execution.testCase?.module || 'general');
      const uploadedImages = [];

      for (const file of files) {
        const result = await provider.upload(file.buffer, file.originalname, executionId, funcFolder);

        let thumbnailPath: string | null = null;
        const isVideo = ThumbnailService.isVideo(file.mimetype, file.originalname);

        if (isVideo) {
          try {
            const thumbBuffer = await ThumbnailService.generateThumbnailFromBuffer(file.buffer, file.originalname);
            if (thumbBuffer) {
              const ext = path.extname(file.originalname);
              const baseName = path.basename(file.originalname, ext);
              const thumbFilename = `${baseName}_thumb.jpg`;
               const thumbResult = await provider.upload(thumbBuffer, thumbFilename, executionId, funcFolder);
              thumbnailPath = thumbResult.storagePath;
            }
          } catch (thumbErr: any) {
            console.warn(`[UploadController] Failed to generate thumbnail for ${file.originalname}:`, thumbErr.message);
          }
        }

        const image = await prisma.testExecutionImage.create({
          data: {
            executionId,
            filename: file.originalname,
            storagePath: result.storagePath,
            storageType: storageConfig.provider,
            mimeType: file.mimetype,
            fileSize: file.size,
            publicUrl: result.publicUrl || null,
            thumbnailPath,
          },
        });

        uploadedImages.push(image);
      }

      return res.status(201).json({
        message: `Upload ${uploadedImages.length} file thành công`,
        images: uploadedImages,
        currentCount: existingCount + uploadedImages.length,
        maxFiles,
      });
    } catch (error: any) {
      console.error('Upload images error:', error);
      return res.status(500).json({
        message: 'Lỗi khi upload ảnh',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/uploads/images/:imageId
   * Delete a single image
   */
  static async deleteImage(req: AuthRequest, res: Response) {
    try {
      const { imageId } = req.params;

      const image = await prisma.testExecutionImage.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        return res.status(404).json({ message: 'Không tìm thấy ảnh' });
      }

      // Delete from storage
      const storageConfig = await getStorageConfig();
      const provider = createStorageProvider(storageConfig);

      try {
        await provider.delete(image.storagePath);
        if (image.thumbnailPath) {
          await provider.delete(image.thumbnailPath);
        }
      } catch (err: any) {
        console.warn(`Warning: Could not delete file from storage (${image.storagePath}):`, err.message);
      }

      // Delete from DB
      await prisma.testExecutionImage.delete({
        where: { id: imageId },
      });

      return res.json({ message: 'Đã xóa ảnh thành công' });
    } catch (error: any) {
      console.error('Delete image error:', error);
      return res.status(500).json({
        message: 'Lỗi khi xóa ảnh',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/uploads/images/:imageId/view
   * View/download an image
   */
  static async getImage(req: AuthRequest, res: Response) {
    try {
      const { imageId } = req.params;

      const image = await prisma.testExecutionImage.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        return res.status(404).json({ message: 'Không tìm thấy ảnh' });
      }

      // Stream the file directly through the configured storage provider
      const storageConfig = await getStorageConfig();
      const provider = createStorageProvider(storageConfig);
      const result = await provider.getFileStream(image.storagePath);

      if (!result) {
        // Fallback to publicUrl redirect only if stream is not available
        if (image.publicUrl && !image.publicUrl.includes('drive.google.com')) {
          return res.redirect(image.publicUrl);
        }
        return res.status(404).json({ message: 'File ảnh không tồn tại trên storage' });
      }

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(image.filename)}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      result.stream.pipe(res);
    } catch (error: any) {
      console.error('Get image error:', error);
      return res.status(500).json({
        message: 'Lỗi khi tải ảnh',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/uploads/images/:imageId/thumbnail
   * View thumbnail of a video or fallback to image
   */
  static async getThumbnail(req: AuthRequest, res: Response) {
    try {
      const { imageId } = req.params;

      const image = await prisma.testExecutionImage.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        return res.status(404).json({ message: 'Không tìm thấy ảnh' });
      }

      const storageConfig = await getStorageConfig();
      const provider = createStorageProvider(storageConfig);

      // If video and has thumbnailPath, stream thumbnail
      if (image.thumbnailPath) {
        const result = await provider.getFileStream(image.thumbnailPath);
        if (result) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', `inline; filename="thumb_${encodeURIComponent(image.filename)}.jpg"`);
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return result.stream.pipe(res);
        }
      }

      // Fallback: If image (not video), stream original image
      const isVideo = ThumbnailService.isVideo(image.mimeType, image.filename);
      if (!isVideo) {
        const result = await provider.getFileStream(image.storagePath);
        if (result) {
          res.setHeader('Content-Type', result.mimeType);
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(image.filename)}"`);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return result.stream.pipe(res);
        }
      }

      // If video without thumbnailPath, generate thumbnail on-the-fly and cache to storage
      if (isVideo) {
        try {
          const videoStreamResult = await provider.getFileStream(image.storagePath);
          if (videoStreamResult) {
            const chunks: Buffer[] = [];
            for await (const chunk of videoStreamResult.stream) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const videoBuffer = Buffer.concat(chunks);
            const thumbBuffer = await ThumbnailService.generateThumbnailFromBuffer(videoBuffer, image.filename);
            if (thumbBuffer) {
              const ext = path.extname(image.filename);
              const baseName = path.basename(image.filename, ext);
              const thumbFilename = `${baseName}_thumb.jpg`;
              const exec = await prisma.testExecution.findUnique({
                where: { id: image.executionId },
                include: { testCase: true },
              });
              const thumbFolder = slugify(exec?.testCase?.module || 'general');
              const thumbResult = await provider.upload(thumbBuffer, thumbFilename, image.executionId, thumbFolder);

              // Update DB record asynchronously so subsequent requests hit thumbnailPath
              await prisma.testExecutionImage.update({
                where: { id: image.id },
                data: { thumbnailPath: thumbResult.storagePath },
              }).catch((e) => console.warn('Could not update thumbnailPath in DB:', e));

              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Content-Disposition', `inline; filename="thumb_${encodeURIComponent(image.filename)}.jpg"`);
              res.setHeader('Cache-Control', 'public, max-age=604800');
              return res.send(thumbBuffer);
            }
          }
        } catch (onTheFlyErr: any) {
          console.warn(`[getThumbnail] On-the-fly thumbnail generation failed for ${image.filename}:`, onTheFlyErr.message);
        }
      }

      // Fallback if thumbnail generation failed: stream original file
      const result = await provider.getFileStream(image.storagePath);
      if (result) {
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(image.filename)}"`);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return result.stream.pipe(res);
      }

      return res.status(404).json({ message: 'Không tìm thấy file' });
    } catch (error: any) {
      console.error('Get thumbnail error:', error);
      return res.status(500).json({
        message: 'Lỗi khi tải thumbnail',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/uploads/executions/:executionId/images
   * Get all images for an execution
   */
  static async getExecutionImages(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;

      const images = await prisma.testExecutionImage.findMany({
        where: { executionId },
        orderBy: { uploadedAt: 'asc' },
        include: {
          execution: {
            select: {
              id: true,
              executedAt: true,
              status: true,
              server: true,
              os: true,
              notes: true,
              actualResult: true,
              executedBy: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      });

      const storageConfig = await getStorageConfig();

      return res.json({
        images,
        maxFiles: storageConfig.maxFilesPerExecution,
        maxFileSizeMB: storageConfig.maxFileSizeMB,
      });
    } catch (error: any) {
      console.error('Get execution images error:', error);
      return res.status(500).json({
        message: 'Lỗi khi tải danh sách ảnh',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/uploads/testcases/:testCaseId/images
   * Get all images for a testcase (across all executions) with execution context
   */
  static async getTestCaseImages(req: AuthRequest, res: Response) {
    try {
      const { testCaseId } = req.params;
      const currentUserId = req.user?.id;
      const currentUserRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(currentUserId, currentUserRole);

      const execWhere: any = { testCaseId };
      if (!canViewAll && currentUserId) {
        execWhere.executedById = currentUserId;
      }

      const executions = await prisma.testExecution.findMany({
        where: execWhere,
        select: { id: true },
      });

      const executionIds = executions.map((e) => e.id);

      const images = await prisma.testExecutionImage.findMany({
        where: { executionId: { in: executionIds } },
        orderBy: { uploadedAt: 'desc' },
        include: {
          execution: {
            select: {
              id: true,
              executedAt: true,
              status: true,
              server: true,
              os: true,
              notes: true,
              actualResult: true,
              executedBy: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      });

      const storageConfig = await getStorageConfig();

      return res.json({
        images,
        maxFiles: storageConfig.maxFilesPerExecution,
        maxFileSizeMB: storageConfig.maxFileSizeMB,
      });
    } catch (error: any) {
      console.error('Get testcase images error:', error);
      return res.status(500).json({
        message: 'Lỗi khi tải danh sách ảnh của testcase',
        error: error.message,
      });
    }
  }
}
