import prisma from '../config/database';
import { TaskStatus } from '@prisma/client';

export class WorkflowReportService {
  /**
   * Thống kê nhiệm vụ theo trạng thái
   */
  static async getTasksByStatus() {
    const counts = await prisma.task.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const now = new Date();
    const overdueCount = await prisma.task.count({
      where: {
        status: TaskStatus.IN_PROGRESS,
        deadline: { lt: now },
      },
    });

    const statusMap: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      OVERDUE: overdueCount,
      CANCELLED: 0,
    };

    counts.forEach((item) => {
      statusMap[item.status] = item._count.id;
    });

    const total = Object.values(statusMap).reduce((acc, curr) => acc + curr, 0);

    return {
      total,
      byStatus: statusMap,
    };
  }

  /**
   * Thống kê nhiệm vụ theo quy trình
   */
  static async getTasksByProcess() {
    const processes = await prisma.process.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        manager: {
          select: { id: true, fullName: true, email: true },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            deadline: true,
          },
        },
      },
    });

    const now = new Date();

    return processes.map((proc) => {
      const totalTasks = proc.tasks.length;
      const completed = proc.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const inProgress = proc.tasks.filter(
        (t) => t.status === TaskStatus.IN_PROGRESS && t.deadline >= now
      ).length;
      const overdue = proc.tasks.filter(
        (t) => t.status === TaskStatus.OVERDUE || (t.status === TaskStatus.IN_PROGRESS && t.deadline < now)
      ).length;
      const cancelled = proc.tasks.filter((t) => t.status === TaskStatus.CANCELLED).length;

      return {
        processId: proc.id,
        processName: proc.name,
        manager: proc.manager,
        totalTasks,
        completed,
        inProgress,
        overdue,
        cancelled,
        completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
      };
    });
  }

  /**
   * Thống kê nhiệm vụ theo người thực thi
   */
  static async getTasksByExecutor() {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    const allTasks = await prisma.task.findMany({
      select: {
        id: true,
        status: true,
        executorIds: true,
        deadline: true,
      },
    });

    const now = new Date();

    return users
      .map((user) => {
        const assignedTasks = allTasks.filter((t) => {
          const executors = (t.executorIds as string[]) || [];
          return executors.includes(user.id);
        });

        const total = assignedTasks.length;
        const completed = assignedTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
        const inProgress = assignedTasks.filter(
          (t) => t.status === TaskStatus.IN_PROGRESS && t.deadline >= now
        ).length;
        const overdue = assignedTasks.filter(
          (t) => t.status === TaskStatus.OVERDUE || (t.status === TaskStatus.IN_PROGRESS && t.deadline < now)
        ).length;

        return {
          user,
          totalAssigned: total,
          completed,
          inProgress,
          overdue,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      })
      .filter((u) => u.totalAssigned > 0);
  }

  /**
   * Danh sách nhiệm vụ quá hạn
   */
  static async getOverdueTasks() {
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { status: TaskStatus.OVERDUE },
          {
            status: TaskStatus.IN_PROGRESS,
            deadline: { lt: now },
          },
        ],
      },
      orderBy: { deadline: 'asc' },
      include: {
        process: {
          select: { id: true, name: true },
        },
        currentStep: {
          select: { id: true, name: true, order: true },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return tasks.map((task) => {
      const diffMs = now.getTime() - new Date(task.deadline).getTime();
      const overdueHours = Math.floor(diffMs / (1000 * 60 * 60));

      return {
        ...task,
        overdueHours,
      };
    });
  }
}
