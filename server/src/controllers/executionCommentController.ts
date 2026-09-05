import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

export class ExecutionCommentController {
  /**
   * GET /api/executions/:executionId/comments
   * Lấy danh sách bình luận của lượt thực thi kiểm thử
   */
  static async getComments(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const execution = await prisma.testExecution.findUnique({
        where: { id: executionId },
        select: { id: true, createdById: true, executedById: true },
      });

      if (!execution) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }

      // Kiểm tra quyền: ADMIN, MANAGER, người tạo, người thực thi, hoặc người theo dõi
      const canViewAll = userRole === 'ADMIN' || userRole === 'MANAGER';
      if (!canViewAll && userId) {
        const isCreator = execution.createdById === userId;
        const isExecutor = execution.executedById === userId;
        const isWatcher = await prisma.testExecutionWatcher.findFirst({
          where: { executionId, userId },
        });

        if (!isCreator && !isExecutor && !isWatcher) {
          return res.status(403).json({ message: 'Bạn không có quyền xem bình luận của lượt thực thi này' });
        }
      }

      const comments = await prisma.testExecutionComment.findMany({
        where: { executionId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true, department: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return res.json({ comments });
    } catch (error: any) {
      console.error('Error fetching execution comments:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách bình luận', error: error.message });
    }
  }

  /**
   * POST /api/executions/:executionId/comments
   * Thêm bình luận cho lượt thực thi kiểm thử
   */
  static async addComment(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const { content, attachments } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      }

      const execution = await prisma.testExecution.findUnique({
        where: { id: executionId },
        select: { id: true, createdById: true, executedById: true },
      });

      if (!execution) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }

      // Kiểm tra quyền: ADMIN, MANAGER, người tạo, người thực thi, hoặc người theo dõi
      const canManage = userRole === 'ADMIN' || userRole === 'MANAGER';
      const isCreator = execution.createdById === userId;
      const isExecutor = execution.executedById === userId;
      const isWatcher = await prisma.testExecutionWatcher.findFirst({
        where: { executionId, userId },
      });

      if (!canManage && !isCreator && !isExecutor && !isWatcher) {
        return res.status(403).json({
          message: 'Bạn phải là người thực thi, người tạo, người theo dõi hoặc quản trị viên để bình luận',
        });
      }

      const comment = await prisma.testExecutionComment.create({
        data: {
          executionId,
          userId,
          content: content.trim(),
          attachments: attachments && Array.isArray(attachments) ? attachments : [],
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true, department: true },
          },
        },
      });

      return res.status(201).json({ message: 'Thêm bình luận thành công', comment });
    } catch (error: any) {
      console.error('Error adding execution comment:', error);
      return res.status(500).json({ message: 'Lỗi gửi bình luận', error: error.message });
    }
  }

  /**
   * DELETE /api/executions/:executionId/comments/:commentId
   * Xóa bình luận
   */
  static async deleteComment(req: AuthRequest, res: Response) {
    try {
      const { executionId, commentId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const comment = await prisma.testExecutionComment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.executionId !== executionId) {
        return res.status(404).json({ message: 'Không tìm thấy bình luận' });
      }

      const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER';
      const isAuthor = comment.userId === userId;

      if (!isAuthor && !isAdminOrManager) {
        return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
      }

      await prisma.testExecutionComment.delete({
        where: { id: commentId },
      });

      return res.json({ message: 'Xóa bình luận thành công' });
    } catch (error: any) {
      console.error('Error deleting execution comment:', error);
      return res.status(500).json({ message: 'Lỗi xóa bình luận', error: error.message });
    }
  }
}
export default ExecutionCommentController;
