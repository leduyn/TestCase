import path from 'path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getStorageConfig, createStorageProvider } from '../services/storageService';

export class WorkflowUploadController {
  /**
   * Upload một hoặc nhiều file cho Workflow (Tasks, Todos, Comments)
   */
  static async uploadFiles(req: AuthRequest, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 file để upload' });
      }

      const storageConfig = await getStorageConfig();
      const maxSizeBytes = (storageConfig.maxFileSizeMB || 20) * 1024 * 1024;
      const provider = createStorageProvider(storageConfig);

      const results = [];

      for (const file of files) {
        if (file.size > maxSizeBytes) {
          return res.status(400).json({
            message: `File "${file.originalname}" vượt quá dung lượng tối đa (${storageConfig.maxFileSizeMB}MB)`,
          });
        }

        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const uploadResult = await provider.upload(
          file.buffer,
          originalName,
          'workflow-uploads',
          'workflow'
        );

        results.push({
          originalName,
          filename: originalName,
          storagePath: uploadResult.storagePath,
          storageType: storageConfig.provider,
          publicUrl: uploadResult.publicUrl || null,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        message: 'Upload file thành công',
        files: results,
      });
    } catch (error: any) {
      console.error('Error uploading workflow files:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi upload file' });
    }
  }

  /**
   * Xem / tải file workflow theo storagePath
   */
  static async viewFile(req: AuthRequest, res: Response) {
    try {
      const { storagePath } = req.query;

      if (!storagePath || typeof storagePath !== 'string') {
        return res.status(400).json({ message: 'Thiếu đường dẫn storagePath' });
      }

      const storageConfig = await getStorageConfig();
      const provider = createStorageProvider(storageConfig);

      const cleanPath = storagePath.replace(/^(\/|\\)?uploads(\/|\\)/i, '').replace(/^(\/|\\)+/, '');
      let fileResult = await provider.getFileStream(cleanPath);
      if (!fileResult && cleanPath !== storagePath) {
        fileResult = await provider.getFileStream(storagePath);
      }

      if (!fileResult) {
        return res.status(404).json({ message: 'Không tìm thấy file' });
      }

      const filename = (req.query.filename as string) || path.basename(cleanPath);
      const isDownload = req.query.download === 'true';
      const disposition = isDownload ? 'attachment' : 'inline';

      res.setHeader('Content-Type', fileResult.mimeType);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fileResult.stream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming workflow file:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi tải file' });
    }
  }
}
