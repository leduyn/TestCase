import prisma from '../config/database';

export interface CreateTodoDto {
  description: string;
  executorId?: string;
  deadline?: Date | string;
  watcherIds?: string[];
  files?: any[];
}

export interface UpdateTodoDto {
  description?: string;
  executorId?: string;
  deadline?: Date | string;
  watcherIds?: string[];
  files?: any[];
  isCompleted?: boolean;
}

export class TodoService {
  /**
   * Thêm Todo cho một nhiệm vụ
   */
  static async createTodo(taskId: string, data: CreateTodoDto, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    return await prisma.todo.create({
      data: {
        taskId,
        description: data.description,
        executorId: data.executorId || null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        watcherIds: data.watcherIds || [],
        files: data.files || [],
        isCompleted: false,
        createdById: userId,
        updatedById: userId,
      },
      include: {
        executor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Danh sách Todos của nhiệm vụ
   */
  static async getTodosByTaskId(taskId: string) {
    return await prisma.todo.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        executor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Cập nhật Todo
   */
  static async updateTodo(todoId: string, data: UpdateTodoDto, userId: string) {
    const existing = await prisma.todo.findUnique({
      where: { id: todoId },
    });

    if (!existing) {
      throw new Error('Không tìm thấy đầu việc (Todo)');
    }

    const isCompleted =
      data.isCompleted !== undefined ? data.isCompleted : existing.isCompleted;
    const completedAt =
      data.isCompleted !== undefined
        ? data.isCompleted
          ? new Date()
          : null
        : existing.completedAt;

    return await prisma.todo.update({
      where: { id: todoId },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.executorId !== undefined && { executorId: data.executorId }),
        ...(data.deadline !== undefined && {
          deadline: data.deadline ? new Date(data.deadline) : null,
        }),
        ...(data.watcherIds && { watcherIds: data.watcherIds }),
        ...(data.files && { files: data.files }),
        isCompleted,
        completedAt,
        updatedById: userId,
      },
      include: {
        executor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Xóa Todo
   */
  static async deleteTodo(todoId: string) {
    const existing = await prisma.todo.findUnique({
      where: { id: todoId },
    });

    if (!existing) {
      throw new Error('Không tìm thấy đầu việc (Todo)');
    }

    return await prisma.todo.delete({
      where: { id: todoId },
    });
  }

  /**
   * Đánh dấu hoàn thành / chưa hoàn thành (Toggle)
   */
  static async toggleTodo(todoId: string, userId: string) {
    const existing = await prisma.todo.findUnique({
      where: { id: todoId },
    });

    if (!existing) {
      throw new Error('Không tìm thấy đầu việc (Todo)');
    }

    const newCompleted = !existing.isCompleted;

    return await prisma.todo.update({
      where: { id: todoId },
      data: {
        isCompleted: newCompleted,
        completedAt: newCompleted ? new Date() : null,
        updatedById: userId,
      },
      include: {
        executor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }
}
