import prisma from '../config/database';

export interface CreateProcessStepDto {
  name: string;
  executorIds?: string[];
  timeLimitHours?: number;
  order?: number;
  instructions?: string;
}

export interface CreateProcessDto {
  name: string;
  description?: string;
  managerId: string;
  watcherIds?: string[];
  steps?: CreateProcessStepDto[];
}

export interface UpdateProcessDto {
  name?: string;
  description?: string;
  managerId?: string;
  watcherIds?: string[];
}

export class ProcessService {
  /**
   * Tạo quy trình mới cùng các bước (nếu có)
   */
  static async createProcess(data: CreateProcessDto, userId: string) {
    const { name, description, managerId, watcherIds = [], steps = [] } = data;

    return await prisma.$transaction(async (tx) => {
      const process = await tx.process.create({
        data: {
          name,
          description,
          managerId,
          watcherIds: watcherIds || [],
          createdById: userId,
          updatedById: userId,
        },
      });

      if (steps && steps.length > 0) {
        const stepCreateData = steps.map((step, idx) => ({
          processId: process.id,
          name: step.name,
          executorIds: step.executorIds || [],
          timeLimitHours: step.timeLimitHours ?? 24,
          order: step.order ?? idx + 1,
          instructions: step.instructions || null,
          createdById: userId,
          updatedById: userId,
        }));

        await tx.processStep.createMany({
          data: stepCreateData,
        });
      }

      return tx.process.findUnique({
        where: { id: process.id },
        include: {
          manager: {
            select: { id: true, fullName: true, email: true, role: true },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { tasks: true, steps: true },
          },
        },
      });
    });
  }

  /**
   * Danh sách quy trình (tìm kiếm, lọc, phân trang, loại bỏ soft delete)
   */
  static async getProcesses(params: {
    search?: string;
    managerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.max(Number(params.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.managerId) {
      where.managerId = params.managerId;
    }

    const [total, items] = await Promise.all([
      prisma.process.count({ where }),
      prisma.process.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: {
            select: { id: true, fullName: true, email: true, role: true },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
          steps: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { tasks: true, steps: true },
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
   * Chi tiết quy trình
   */
  static async getProcessById(id: string) {
    const process = await prisma.process.findFirst({
      where: { id, deletedAt: null },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        updatedBy: {
          select: { id: true, fullName: true, email: true },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
        tasks: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            deadline: true,
            createdAt: true,
          },
        },
        _count: {
          select: { tasks: true, steps: true },
        },
      },
    });

    return process;
  }

  /**
   * Cập nhật quy trình
   */
  static async updateProcess(id: string, data: UpdateProcessDto, userId: string) {
    const existing = await prisma.process.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new Error('Không tìm thấy quy trình');
    }

    return await prisma.process.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.managerId && { managerId: data.managerId }),
        ...(data.watcherIds && { watcherIds: data.watcherIds }),
        updatedById: userId,
      },
      include: {
        manager: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Xóa mềm quy trình (Soft delete)
   */
  static async deleteProcess(id: string, userId: string) {
    const existing = await prisma.process.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new Error('Không tìm thấy quy trình');
    }

    return await prisma.process.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: userId,
      },
    });
  }

  /**
   * Thêm step vào quy trình
   */
  static async addStep(processId: string, data: CreateProcessStepDto, userId: string) {
    const process = await prisma.process.findFirst({
      where: { id: processId, deletedAt: null },
      include: { steps: { orderBy: { order: 'desc' }, take: 1 } },
    });

    if (!process) {
      throw new Error('Không tìm thấy quy trình');
    }

    const nextOrder = data.order ?? (process.steps[0] ? process.steps[0].order + 1 : 1);

    return await prisma.processStep.create({
      data: {
        processId,
        name: data.name,
        executorIds: data.executorIds || [],
        timeLimitHours: data.timeLimitHours ?? 24,
        order: nextOrder,
        instructions: data.instructions || null,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  /**
   * Cập nhật step
   */
  static async updateStep(
    stepId: string,
    data: Partial<CreateProcessStepDto>,
    userId: string
  ) {
    const step = await prisma.processStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      throw new Error('Không tìm thấy bước trong quy trình');
    }

    return await prisma.processStep.update({
      where: { id: stepId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.executorIds && { executorIds: data.executorIds }),
        ...(data.timeLimitHours !== undefined && { timeLimitHours: data.timeLimitHours }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.instructions !== undefined && { instructions: data.instructions }),
        updatedById: userId,
      },
    });
  }

  /**
   * Xóa step
   */
  static async deleteStep(stepId: string) {
    const step = await prisma.processStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      throw new Error('Không tìm thấy bước trong quy trình');
    }

    return await prisma.processStep.delete({
      where: { id: stepId },
    });
  }
}
