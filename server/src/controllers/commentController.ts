import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CommentService } from '../services/commentService';

export class CommentController {
  static async createComment(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const userId = req.user!.id;
      const { content, files } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
      }

      const comment = await CommentService.createComment(
        taskId,
        { content, files },
        userId
      );

      return res.status(201).json({
        message: 'Thêm bình luận thành công',
        comment,
      });
    } catch (error: any) {
      console.error('Error creating comment:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi thêm bình luận' });
    }
  }

  static async getCommentsByTaskId(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const comments = await CommentService.getCommentsByTaskId(taskId);
      return res.json(comments);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách bình luận' });
    }
  }

  static async updateComment(req: AuthRequest, res: Response) {
    try {
      const { commentId } = req.params;
      const userId = req.user!.id;
      const { content, files } = req.body;

      const comment = await CommentService.updateComment(
        commentId,
        { content, files },
        userId
      );

      return res.json({
        message: 'Cập nhật bình luận thành công',
        comment,
      });
    } catch (error: any) {
      console.error('Error updating comment:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi cập nhật bình luận' });
    }
  }

  static async deleteComment(req: AuthRequest, res: Response) {
    try {
      const { commentId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      await CommentService.deleteComment(commentId, userId, userRole);

      return res.json({ message: 'Xóa bình luận thành công' });
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xóa bình luận' });
    }
  }
}
