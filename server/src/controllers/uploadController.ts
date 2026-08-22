import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { getStorageConfig, createStorageProvider } from '../services/storageService';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
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
        return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 ảnh để upload' });
      }

      // Verify execution exists
      const execution = await prisma.testExecution.findUnique({
        where: { id: executionId },
        include: { images: true },
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
          message: `Vượt quá giới hạn ảnh. Hiện tại: ${existingCount}/${maxFiles}. Bạn chỉ có thể upload thêm ${maxFiles - existingCount} ảnh.`,
        });
      }

      // Validate each file
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return res.status(400).json({
            message: `File "${file.originalname}" không phải định dạng ảnh hợp lệ. Chỉ chấp nhận: JPEG, PNG, GIF, WebP, BMP, SVG`,
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
      const uploadedImages = [];

      for (const file of files) {
        const result = await provider.upload(file.buffer, file.originalname, executionId);

        const image = await prisma.testExecutionImage.create({
          data: {
            executionId,
            filename: file.originalname,
            storagePath: result.storagePath,
            storageType: storageConfig.provider,
            mimeType: file.mimetype,
            fileSize: file.size,
            publicUrl: result.publicUrl || null,
          },
        });

        uploadedImages.push(image);
      }

      return res.status(201).json({
        message: `Upload ${uploadedImages.length} ảnh thành công`,
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
   * GET /api/uploads/executions/:executionId/images
   * Get all images for an execution
   */
  static async getExecutionImages(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;

      const images = await prisma.testExecutionImage.findMany({
        where: { executionId },
        orderBy: { uploadedAt: 'asc' },
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
   * Get all images for a testcase (across all executions)
   */
  static async getTestCaseImages(req: AuthRequest, res: Response) {
    try {
      const { testCaseId } = req.params;

      const executions = await prisma.testExecution.findMany({
        where: { testCaseId },
        select: { id: true },
      });

      const executionIds = executions.map((e) => e.id);

      const images = await prisma.testExecutionImage.findMany({
        where: { executionId: { in: executionIds } },
        orderBy: { uploadedAt: 'desc' },
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
