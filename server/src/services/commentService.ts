import prisma from '../config/database';

export interface CreateCommentDto {
  content: string;
  files?: any[];
}

export class CommentService {
  /**
   * Thêm bình luận cho nhiệm vụ
   */
  static async createComment(taskId: string, data: CreateCommentDto, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    return await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: data.content,
        files: data.files || [],
        createdById: userId,
        updatedById: userId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Lấy danh sách bình luận của nhiệm vụ
   */
  static async getCommentsByTaskId(taskId: string) {
    return await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Cập nhật nội dung bình luận
   */
  static async updateComment(
    commentId: string,
    data: { content?: string; files?: any[] },
    userId: string
  ) {
    const existing = await prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      throw new Error('Không tìm thấy bình luận');
    }

    if (existing.userId !== userId) {
      throw new Error('Bạn không có quyền sửa bình luận này');
    }

    return await prisma.taskComment.update({
      where: { id: commentId },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.files && { files: data.files }),
        updatedById: userId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });
  }

  /**
   * Xóa bình luận
   */
  static async deleteComment(commentId: string, userId: string, userRole?: string) {
    const existing = await prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      throw new Error('Không tìm thấy bình luận');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new Error('Bạn không có quyền xóa bình luận này');
    }

    return await prisma.taskComment.delete({
      where: { id: commentId },
    });
  }
}
