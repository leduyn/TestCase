import prisma from '../config/database';
import { TaskStatus, TaskHistoryChangeType } from '@prisma/client';

export interface CreateTaskDto {
  processId: string;
  name: string;
  content?: string;
  customFields?: any;
  executorIds?: string[];
  watcherIds?: string[];
  deadline?: Date | string;
  fileUploads?: any[];
}

export interface UpdateTaskDto {
  name?: string;
  content?: string;
  customFields?: any;
  executorIds?: string[];
  watcherIds?: string[];
  deadline?: Date | string;
  fileUploads?: any[];
  status?: TaskStatus;
  changeDescription?: string;
}

export class TaskService {
  /**
   * Tạo snapshot cho Task (bao gồm task, todos, comments tại thời điểm snapshot)
   */
  private static async createSnapshot(tx: any, taskId: string) {
    const fullTask = await tx.task.findUnique({
      where: { id: taskId },
      include: {
        process: {
          select: { id: true, name: true },
        },
        currentStep: true,
        todos: true,
        comments: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    return fullTask ? JSON.parse(JSON.stringify(fullTask)) : {};
  }

  /**
   * Khởi tạo nhiệm vụ mới từ quy trình
   */
  static async createTask(data: CreateTaskDto, userId: string) {
    const {
      processId,
      name,
      content,
      customFields,
      executorIds,
      watcherIds = [],
      deadline: customDeadline,
      fileUploads = [],
    } = data;

    const process = await prisma.process.findFirst({
      where: { id: processId, deletedAt: null },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    if (!process) {
      throw new Error('Không tìm thấy quy trình');
    }

    if (!process.steps || process.steps.length === 0) {
      throw new Error('Quy trình chưa có bước thực thi nào');
    }

    const firstStep = process.steps[0];
    const initialExecutorIds =
      executorIds && executorIds.length > 0
        ? executorIds
        : (firstStep.executorIds as string[]) || [];

    const effectiveDeadline = customDeadline
      ? new Date(customDeadline)
      : new Date(Date.now() + (firstStep.timeLimitHours || 24) * 3600 * 1000);

    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          processId,
          name,
          content: content || null,
          customFields: customFields || null,
          currentStepId: firstStep.id,
          executorIds: initialExecutorIds,
          watcherIds: watcherIds || [],
          startedAt: new Date(),
          deadline: effectiveDeadline,
          status: TaskStatus.IN_PROGRESS,
          fileUploads: fileUploads || [],
          createdById: userId,
          updatedById: userId,
        },
        include: {
          process: true,
          currentStep: true,
        },
      });

      // Tạo Snapshot version 1
      const snapshot = await this.createSnapshot(tx, task.id);

      await tx.taskHistory.create({
        data: {
          taskId: task.id,
          version: 1,
          changedById: userId,
          changeType: TaskHistoryChangeType.CREATED,
          changeDescription: `Khởi tạo nhiệm vụ tại bước "${firstStep.name}"`,
          snapshot,
          createdById: userId,
        },
      });

      return task;
    });
  }

  /**
   * Danh sách nhiệm vụ với bộ lọc, tìm kiếm và phân trang
   */
  static async getTasks(params: {
    search?: string;
    processId?: string;
    status?: TaskStatus;
    executorId?: string;
    createdById?: string;
    overdue?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.max(Number(params.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.processId) {
      where.processId = params.processId;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.createdById) {
      where.createdById = params.createdById;
    }

    if (params.overdue) {
      where.status = TaskStatus.IN_PROGRESS;
      where.deadline = { lt: new Date() };
    }

    const [total, items] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          process: {
            select: { id: true, name: true, managerId: true },
          },
          currentStep: {
            select: { id: true, name: true, order: true, timeLimitHours: true },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
          previousExecutor: {
            select: { id: true, fullName: true, email: true },
          },
          _count: {
            select: { todos: true, comments: true, histories: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Chi tiết nhiệm vụ
   */
  static async getTaskById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        process: {
          include: {
            manager: {
              select: { id: true, fullName: true, email: true },
            },
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
        currentStep: true,
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        previousExecutor: {
          select: { id: true, fullName: true, email: true },
        },
        todos: {
          orderBy: { createdAt: 'asc' },
          include: {
            executor: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
        histories: {
          orderBy: { version: 'desc' },
          include: {
            changedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    return task;
  }

  /**
   * Cập nhật thông tin nhiệm vụ
   */
  static async updateTask(id: string, data: UpdateTaskDto, userId: string) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        histories: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!existing) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    const latestVersion = existing.histories[0]?.version || 1;
    const nextVersion = latestVersion + 1;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.customFields !== undefined && { customFields: data.customFields }),
          ...(data.executorIds && { executorIds: data.executorIds }),
          ...(data.watcherIds && { watcherIds: data.watcherIds }),
          ...(data.deadline && { deadline: new Date(data.deadline) }),
          ...(data.fileUploads && { fileUploads: data.fileUploads }),
          ...(data.status && { status: data.status }),
          updatedById: userId,
        },
        include: {
          process: true,
          currentStep: true,
        },
      });

      const snapshot = await this.createSnapshot(tx, id);

      await tx.taskHistory.create({
        data: {
          taskId: id,
          version: nextVersion,
          changedById: userId,
          changeType: TaskHistoryChangeType.UPDATED,
          changeDescription: data.changeDescription || 'Cập nhật thông tin nhiệm vụ',
          snapshot,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  /**
   * Chuyển bước (Transition to next step)
   */
  static async transitionStep(id: string, userId: string, customExecutors?: string[]) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        process: {
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        },
        currentStep: true,
        histories: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new Error('Nhiệm vụ đã kết thúc, không thể chuyển bước');
    }

    const steps = task.process.steps;
    const currentOrder = task.currentStep ? task.currentStep.order : 0;
    const nextStep = steps.find((s) => s.order > currentOrder);

    const latestVersion = task.histories[0]?.version || 1;
    const nextVersion = latestVersion + 1;

    return await prisma.$transaction(async (tx) => {
      // Nếu không còn bước nào tiếp theo -> Hoàn thành nhiệm vụ
      if (!nextStep) {
        const completedTask = await tx.task.update({
          where: { id },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
            updatedById: userId,
          },
          include: {
            process: true,
            currentStep: true,
          },
        });

        const snapshot = await this.createSnapshot(tx, id);

        await tx.taskHistory.create({
          data: {
            taskId: id,
            version: nextVersion,
            changedById: userId,
            changeType: TaskHistoryChangeType.COMPLETED,
            changeDescription: 'Hoàn thành nhiệm vụ (đã qua tất cả các bước)',
            snapshot,
            createdById: userId,
          },
        });

        return completedTask;
      }

      // Có bước tiếp theo -> Cập nhật sang bước mới
      const previousExecutorId = (task.executorIds as string[])?.[0] || userId;
      const nextExecutors =
        customExecutors && customExecutors.length > 0
          ? customExecutors
          : (nextStep.executorIds as string[]) || [];

      const newDeadline = new Date(
        Date.now() + (nextStep.timeLimitHours || 24) * 3600 * 1000
      );

      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          currentStepId: nextStep.id,
          executorIds: nextExecutors,
          previousExecutorId,
          deadline: newDeadline,
          startedAt: new Date(),
          status: TaskStatus.IN_PROGRESS,
          updatedById: userId,
        },
        include: {
          process: true,
          currentStep: true,
        },
      });

      const snapshot = await this.createSnapshot(tx, id);

      await tx.taskHistory.create({
        data: {
          taskId: id,
          version: nextVersion,
          changedById: userId,
          changeType: TaskHistoryChangeType.STEP_CHANGED,
          changeDescription: `Chuyển bước sang: "${nextStep.name}" (Bước ${nextStep.order})`,
          snapshot,
          createdById: userId,
        },
      });

      return updatedTask;
    });
  }

  /**
   * Đánh dấu hoàn thành trực tiếp
   */
  static async completeTask(id: string, userId: string, description?: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        histories: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    const latestVersion = task.histories[0]?.version || 1;
    const nextVersion = latestVersion + 1;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          updatedById: userId,
        },
      });

      const snapshot = await this.createSnapshot(tx, id);

      await tx.taskHistory.create({
        data: {
          taskId: id,
          version: nextVersion,
          changedById: userId,
          changeType: TaskHistoryChangeType.COMPLETED,
          changeDescription: description || 'Đánh dấu hoàn thành nhiệm vụ',
          snapshot,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  /**
   * Hủy bỏ nhiệm vụ
   */
  static async cancelTask(id: string, userId: string, reason?: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        histories: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!task) {
      throw new Error('Không tìm thấy nhiệm vụ');
    }

    const latestVersion = task.histories[0]?.version || 1;
    const nextVersion = latestVersion + 1;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.CANCELLED,
          updatedById: userId,
        },
      });

      const snapshot = await this.createSnapshot(tx, id);

      await tx.taskHistory.create({
        data: {
          taskId: id,
          version: nextVersion,
          changedById: userId,
          changeType: TaskHistoryChangeType.CANCELLED,
          changeDescription: reason || 'Đã hủy nhiệm vụ',
          snapshot,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  /**
   * Lấy danh sách lịch sử của nhiệm vụ
   */
  static async getTaskHistories(taskId: string) {
    return await prisma.taskHistory.findMany({
      where: { taskId },
      orderBy: { version: 'desc' },
      include: {
        changedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Lấy chi tiết snapshot tại một version
   */
  static async getTaskHistorySnapshot(taskId: string, version: number) {
    const history = await prisma.taskHistory.findFirst({
      where: { taskId, version },
      include: {
        changedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!history) {
      throw new Error(`Không tìm thấy lịch sử phiên bản ${version}`);
    }

    return history;
  }
}
