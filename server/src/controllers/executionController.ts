import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { TestExecutionStatus } from '@prisma/client';
import { canViewAllExecutionHistory } from '../services/permissionService';
import { isStatusHandler } from '../services/statusHandlerService';

const STATUS_PERMISSION_PREFIX = 'execution:set-';

async function canSetStatus(
  userId: string | undefined,
  targetStatus: string,
  opts?: { currentStatus?: string | null; currentExecutorId?: string | null }
): Promise<boolean> {
  // 1. Người được gán xử lý trạng thái đích luôn có quyền chuyển sang trạng thái đó
  if (await isStatusHandler(userId, targetStatus)) return true;
  // 2. Người đang xử lý trạng thái hiện tại được quyền chuyển sang trạng thái khác
  if (opts?.currentStatus && (await isStatusHandler(userId, opts.currentStatus))) return true;
  // 3. Người thực thi hiện tại của execution được quyền chuyển tiếp
  if (opts?.currentExecutorId && opts.currentExecutorId === userId) return true;
  return false;
}

export class ExecutionController {
  // Xác thực người dùng được giao xử lý bước tiếp theo có được gán xử lý trạng thái tương ứng
  static async validateHandlerPermission(
    handlerId: string | null | undefined,
    status: string
  ): Promise<{ ok: boolean; message?: string; permission?: string }> {
    if (!handlerId) return { ok: true };
    const handler = await prisma.user.findUnique({ where: { id: handlerId } });
    if (!handler) {
      return { ok: false, message: 'Người xử lý được chọn không tồn tại' };
    }
    if (!(await isStatusHandler(handler.id, status))) {
      return {
        ok: false,
        message: `Người được chọn không thuộc danh sách xử lý trạng thái ${status}`,
        permission: `${STATUS_PERMISSION_PREFIX}${status}`,
      };
    }
    return { ok: true };
  }

  static async executeTestCase(req: AuthRequest, res: Response) {
    try {
      const { testCaseId } = req.params;
      const { server, os, status, actualResult, evaluation, notes, executedById, viewerIds, imageIds } = req.body;

      if (!testCaseId) {
        return res.status(400).json({ message: 'Thiếu testCaseId' });
      }

      // Validate status
      const validStatuses: TestExecutionStatus[] = ['UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST'];
      const executionStatus: TestExecutionStatus = validStatuses.includes(status) ? status : 'UNTESTED';

      // Người xử lý bước tiếp theo (ghi đè executedById), mặc định là người đang lưu
      const targetHandlerId = executedById || req.user?.id || null;

      // Dedup: mỗi (testCaseId, createdById) chỉ có 1 execution.
      // Nếu đã tồn tại execution của user hiện tại -> cập nhật, không tạo mới.
      const ownExecution = await prisma.testExecution.findFirst({
        where: { testCaseId, createdById: req.user?.id || undefined },
      });

      let beforeExecutedId = ownExecution?.beforeExecutedId || null;
      if (!beforeExecutedId) {
        // backfill từ execution gần nhất của user khác (handoff)
        const prevExec = await prisma.testExecution.findFirst({
          where: { testCaseId, NOT: { createdById: req.user?.id || undefined } },
          orderBy: { executedAt: 'desc' },
        });
        beforeExecutedId = prevExec?.executedById || null;
      }

      // Permission check: được chuyển sang trạng thái đích nếu là người xử lý
      // trạng thái đích, người xử lý trạng thái hiện tại, hoặc người thực thi hiện tại.
      if (
        !(await canSetStatus(req.user?.id, executionStatus, {
          currentStatus: ownExecution?.status,
          currentExecutorId: ownExecution?.executedById,
        }))
      ) {
        return res.status(403).json({
          message: `Bạn không có quyền chuyển trạng thái kết quả sang ${executionStatus}`,
          permission: `${STATUS_PERMISSION_PREFIX}${executionStatus}`,
        });
      }

      // Chỉ xác thực khi giao cho người khác (không phải người đang lưu,
      // và không phải người thực thi bước trước - đã từng xử lý rồi, cho phép giao lại)
      const isPreviousHandler = !!beforeExecutedId && targetHandlerId === beforeExecutedId;
      if (targetHandlerId !== req.user?.id && !isPreviousHandler) {
        const check = await ExecutionController.validateHandlerPermission(targetHandlerId, executionStatus);
        if (!check.ok) {
          return res.status(403).json({
            message: check.message,
            permission: `${STATUS_PERMISSION_PREFIX}${executionStatus}`,
          });
        }
      }

      const executionData = {
        testCaseId,
        executedById: targetHandlerId,
        beforeExecutedId,
        createdById: req.user?.id || null,
        server: server || null,
        os: os || null,
        status: executionStatus,
        actualResult: actualResult || null,
        evaluation: evaluation || null,
        notes: notes || null,
      };

      let execution;
      if (ownExecution) {
        execution = await prisma.testExecution.update({
          where: { id: ownExecution.id },
          data: executionData,
        });
      } else {
        execution = await prisma.testExecution.create({ data: executionData });
      }

      // Ghi snapshot lịch sử
      await ExecutionController.snapshotExecution(execution.id, Array.isArray(imageIds) ? imageIds : undefined);

      // Cập nhật danh sách người theo dõi (nếu được truyền)
      if (Array.isArray(viewerIds)) {
        await ExecutionController.replaceWatchers(execution.id, viewerIds as string[]);
      }

      const result = await prisma.testExecution.findUnique({
        where: { id: execution.id },
        include: {
          executedBy: { select: { id: true, fullName: true, email: true } },
          beforeExecutedBy: { select: { id: true, fullName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          watchers: { include: { user: { select: { id: true, fullName: true, email: true } } } },
          images: { orderBy: { uploadedAt: 'asc' } },
        },
      });

      return res.json({
        message: ownExecution ? 'Cập nhật kết quả kiểm thử thành công' : 'Lưu kết quả kiểm thử thành công',
        execution: result,
      });
    } catch (error: any) {
      console.error('Execute test case error:', error);
      return res.status(500).json({ message: 'Lỗi khi lưu kết quả kiểm thử', error: error.message });
    }
  }

  // Tạo bản snapshot sao chép trạng thái hiện tại của execution vào bảng lịch sử
  static async snapshotExecution(executionId: string, customImageIds?: string[]) {
    const exec = await prisma.testExecution.findUnique({ where: { id: executionId } });
    if (!exec) return;

    // Lấy danh sách hình ảnh hiện tại hoặc danh sách imageIds được chỉ định để đóng băng vào snapshot
    let currentImages: any[] = [];
    if (Array.isArray(customImageIds)) {
      currentImages = await prisma.testExecutionImage.findMany({
        where: { id: { in: customImageIds } },
        orderBy: { uploadedAt: 'asc' },
      });
    } else {
      currentImages = await prisma.testExecutionImage.findMany({
        where: { executionId },
        orderBy: { uploadedAt: 'asc' },
      });
    }

    // Tìm snapshot gần nhất của execution này
    const lastSnapshot = await prisma.testExecutionHistory.findFirst({
      where: { executionId },
      orderBy: { updatedAt: 'desc' },
    });

    // Nếu snapshot gần nhất có cùng trạng thái và cùng người thực thi,
    // cập nhật snapshot đó thay vì tạo thêm 1 bản ghi trùng lặp
    if (
      lastSnapshot &&
      lastSnapshot.status === exec.status &&
      lastSnapshot.executedById === exec.executedById
    ) {
      await prisma.testExecutionHistory.update({
        where: { id: lastSnapshot.id },
        data: {
          server: exec.server,
          os: exec.os,
          actualResult: exec.actualResult,
          evaluation: exec.evaluation,
          notes: exec.notes,
          images: currentImages as any,
          updatedAt: exec.updatedAt,
        },
      });
      return;
    }

    await prisma.testExecutionHistory.create({
      data: {
        executionId: exec.id,
        testCaseId: exec.testCaseId,
        executedById: exec.executedById,
        beforeExecutedId: exec.beforeExecutedId,
        createdById: exec.createdById,
        server: exec.server,
        os: exec.os,
        status: exec.status,
        actualResult: exec.actualResult,
        evaluation: exec.evaluation,
        notes: exec.notes,
        images: currentImages as any,
        executedAt: exec.executedAt,
        updatedAt: exec.updatedAt,
      },
    });
  }

  // Thay thế toàn bộ danh sách người theo dõi của một execution
  static async replaceWatchers(executionId: string, userIds: string[]) {
    await prisma.testExecutionWatcher.deleteMany({ where: { executionId } });
    if (userIds.length > 0) {
      await prisma.testExecutionWatcher.createMany({
        data: userIds.map((userId) => ({ executionId, userId })),
      });
    }
  }

  static async updateExecution(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const { server, os, status, actualResult, evaluation, notes, executedById, viewerIds, imageIds } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const existing = await prisma.testExecution.findUnique({
        where: { id: executionId },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }

      const validStatuses: TestExecutionStatus[] = ['UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST'];
      const executionStatus: TestExecutionStatus = validStatuses.includes(status) ? status : existing.status;

      // Permission check: được chuyển sang trạng thái đích nếu là người xử lý
      // trạng thái đích, người xử lý trạng thái hiện tại, hoặc người thực thi hiện tại.
      if (
        !(await canSetStatus(userId, executionStatus, {
          currentStatus: existing.status,
          currentExecutorId: existing.executedById,
        }))
      ) {
        return res.status(403).json({
          message: `Bạn không có quyền chuyển trạng thái kết quả sang ${executionStatus}`,
          permission: `${STATUS_PERMISSION_PREFIX}${executionStatus}`,
        });
      }

      // Permission check: may edit if owner, ADMIN, current executor, or responsible for the current status
      const canTouch =
        !existing.executedById ||
        existing.executedById === userId ||
        userRole === 'ADMIN' ||
        (await canSetStatus(userId, existing.status, {
          currentStatus: existing.status,
          currentExecutorId: existing.executedById,
        }));
      if (!canTouch) {
        return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa kết quả này' });
      }

      // Người xử lý bước tiếp theo (ghi đè executedById khi được truyền vào)
      let targetHandlerId = existing.executedById;
      if (executedById && executedById !== existing.executedById) {
        // Cho phép giao lại cho người thực thi bước trước (đã từng xử lý) dù không có quyền set-<status>
        const isPreviousHandler = !!existing.beforeExecutedId && executedById === existing.beforeExecutedId;
        if (!isPreviousHandler) {
          const check = await ExecutionController.validateHandlerPermission(executedById, executionStatus);
          if (!check.ok) {
            return res.status(403).json({
              message: check.message,
              permission: check.permission,
            });
          }
        }
        targetHandlerId = executedById;
      }

      // before_executed_id: giữ nguyên, chỉ backfill khi đang null (bước trước gần nhất)
      let beforeExecutedId = existing.beforeExecutedId;
      if (!beforeExecutedId && targetHandlerId) {
        const prevExec = await prisma.testExecution.findFirst({
          where: { testCaseId: existing.testCaseId, executedAt: { lt: existing.executedAt } },
          orderBy: { executedAt: 'desc' },
        });
        beforeExecutedId = prevExec?.executedById || null;
      }

      const updated = await prisma.testExecution.update({
        where: { id: executionId },
        data: {
          executedById: targetHandlerId,
          beforeExecutedId: beforeExecutedId || null,
          server: server !== undefined ? server : existing.server,
          os: os !== undefined ? os : existing.os,
          status: executionStatus,
          actualResult: actualResult !== undefined ? actualResult : existing.actualResult,
          evaluation: evaluation !== undefined ? evaluation : existing.evaluation,
          notes: notes !== undefined ? notes : existing.notes,
          updatedAt: new Date(),
        },
      });

      // Ghi snapshot lịch sử và cập nhật người theo dõi
      await ExecutionController.snapshotExecution(executionId, Array.isArray(imageIds) ? imageIds : undefined);
      if (Array.isArray(viewerIds)) {
        await ExecutionController.replaceWatchers(executionId, viewerIds as string[]);
      }

      const result = await prisma.testExecution.findUnique({
        where: { id: executionId },
        include: {
          executedBy: { select: { id: true, fullName: true, email: true } },
          beforeExecutedBy: { select: { id: true, fullName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          watchers: { include: { user: { select: { id: true, fullName: true, email: true } } } },
          images: { orderBy: { uploadedAt: 'asc' } },
        },
      });

      return res.json({
        message: 'Cập nhật kết quả kiểm thử thành công',
        execution: result,
      });
    } catch (error: any) {
      console.error('Update execution error:', error);
      return res.status(500).json({ message: 'Lỗi khi cập nhật kết quả kiểm thử', error: error.message });
    }
  }

  static async getHistory(req: AuthRequest, res: Response) {
    try {
      const { testCaseId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if user can view all execution history
      const canViewAll = await canViewAllExecutionHistory(userId, userRole);

      const whereClause: any = { testCaseId };

      // If user cannot view all, filter to only their own executions hoặc được theo dõi
      if (!canViewAll && userId) {
        whereClause.OR = [
          { executedById: userId },
          { createdById: userId },
          { watchers: { some: { userId } } },
        ];
      }

      const history = await prisma.testExecution.findMany({
        where: whereClause,
        orderBy: { executedAt: 'desc' },
        include: {
          executedBy: {
            select: { fullName: true, email: true },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
          beforeExecutedBy: {
            select: { id: true, fullName: true, email: true },
          },
          watchers: {
            include: { user: { select: { id: true, fullName: true, email: true } } },
          },
          images: {
            orderBy: { uploadedAt: 'asc' },
          },
        },
      });

      return res.json({ history });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải lịch sử thực thi', error: error.message });
    }
  }

  // Chỉ creator, executor hoặc ADMIN mới được quản lý người theo dõi
  static canManageWatchers(
    execution: { createdById?: string | null; executedById?: string | null } | null,
    userId: string | undefined,
    role: string | undefined
  ): boolean {
    if (!execution || !userId) return false;
    if (role === 'ADMIN') return true;
    return execution.createdById === userId || execution.executedById === userId;
  }

  // Lấy danh sách user để chọn người theo dõi (chỉ cần đăng nhập)
  static async getWatcherCandidates(req: AuthRequest, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      });
      return res.json({ users });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải danh sách người dùng', error: error.message });
    }
  }

  // Lấy lịch sử thay đổi (snapshot) của một execution
  static async getSnapshots(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const canViewAll = await canViewAllExecutionHistory(userId, userRole);

      const execution = await prisma.testExecution.findUnique({ where: { id: executionId } });
      if (!execution) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }
      if (
        !canViewAll &&
        userId &&
        execution.createdById !== userId &&
        execution.executedById !== userId &&
        !(await prisma.testExecutionWatcher.findFirst({ where: { executionId, userId } }))
      ) {
        return res.status(403).json({ message: 'Bạn không có quyền xem lịch sử này' });
      }

      let snapshots = await prisma.testExecutionHistory.findMany({
        where: { executionId },
        orderBy: { updatedAt: 'asc' },
        include: {
          executedBy: { select: { id: true, fullName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          beforeExecutedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Nếu chưa có snapshot nào (ví dụ execution được tạo khi nhận test case trước đây), tự động ghi nhận snapshot khởi tạo
      if (snapshots.length === 0) {
        await ExecutionController.snapshotExecution(execution.id);
        snapshots = await prisma.testExecutionHistory.findMany({
          where: { executionId },
          orderBy: { updatedAt: 'asc' },
          include: {
            executedBy: { select: { id: true, fullName: true, email: true } },
            createdBy: { select: { id: true, fullName: true, email: true } },
            beforeExecutedBy: { select: { id: true, fullName: true, email: true } },
          },
        });
      }

      return res.json({ snapshots });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi tải lịch sử thay đổi', error: error.message });
    }
  }

  // Cập nhật danh sách người theo dõi của một execution
  static async setWatchers(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const { userIds } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const execution = await prisma.testExecution.findUnique({ where: { id: executionId } });
      if (!execution) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }
      const isManager = ExecutionController.canManageWatchers(execution, userId, userRole);
      const ids = Array.isArray(userIds) ? (userIds as string[]) : [];

      if (!isManager) {
        // Nếu không phải creator/executor/admin, chỉ cho phép user tự thêm/bỏ chính mình (self-watch)
        const currentWatchers = await prisma.testExecutionWatcher.findMany({
          where: { executionId },
          select: { userId: true },
        });
        const currentIds = currentWatchers.map((w) => w.userId);

        const added = ids.filter((id) => !currentIds.includes(id));
        const removed = currentIds.filter((id) => !ids.includes(id));

        const isSelfToggle =
          userId &&
          ((added.length === 1 && added[0] === userId && removed.length === 0) ||
            (removed.length === 1 && removed[0] === userId && added.length === 0) ||
            (added.length === 0 && removed.length === 0));

        if (!isSelfToggle) {
          return res.status(403).json({ message: 'Bạn không có quyền quản lý người theo dõi khác' });
        }
      }
      await ExecutionController.replaceWatchers(executionId, ids);

      const watchers = await prisma.testExecutionWatcher.findMany({
        where: { executionId },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });

      return res.json({ message: 'Cập nhật người theo dõi thành công', watchers });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi cập nhật người theo dõi', error: error.message });
    }
  }
}
