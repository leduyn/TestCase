import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { TestExecutionStatus } from '@prisma/client';
import { canViewAllExecutionHistory } from '../services/permissionService';

export class ExecutionController {
  static async executeTestCase(req: AuthRequest, res: Response) {
    try {
      const { testCaseId } = req.params;
      const { server, os, status, actualResult, evaluation, notes } = req.body;

      if (!testCaseId) {
        return res.status(400).json({ message: 'Thiếu testCaseId' });
      }

      // Validate status
      const validStatuses: TestExecutionStatus[] = ['UNREVIEWED', 'UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST'];
      const executionStatus: TestExecutionStatus = validStatuses.includes(status) ? status : 'UNREVIEWED';

      const execution = await prisma.testExecution.create({
        data: {
          testCaseId,
          executedById: req.user?.id || null,
          server: server || null,
          os: os || null,
          status: executionStatus,
          actualResult: actualResult || null,
          evaluation: evaluation || null,
          notes: notes || null,
        },
        include: {
          executedBy: {
            select: { fullName: true, email: true },
          },
          images: {
            orderBy: { uploadedAt: 'asc' },
          },
        },
      });

      return res.json({
        message: 'Lưu kết quả kiểm thử thành công',
        execution,
      });
    } catch (error: any) {
      console.error('Execute test case error:', error);
      return res.status(500).json({ message: 'Lỗi khi lưu kết quả kiểm thử', error: error.message });
    }
  }

  static async updateExecution(req: AuthRequest, res: Response) {
    try {
      const { executionId } = req.params;
      const { server, os, status, actualResult, evaluation, notes } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const existing = await prisma.testExecution.findUnique({
        where: { id: executionId },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Không tìm thấy kết quả thực thi' });
      }

      // Permissions check: only owner or ADMIN can edit this execution
      if (existing.executedById && existing.executedById !== userId && userRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa kết quả của người khác' });
      }

      const validStatuses: TestExecutionStatus[] = ['UNREVIEWED', 'UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST'];
      const executionStatus: TestExecutionStatus = validStatuses.includes(status) ? status : existing.status;

      const updated = await prisma.testExecution.update({
        where: { id: executionId },
        data: {
          server: server !== undefined ? server : existing.server,
          os: os !== undefined ? os : existing.os,
          status: executionStatus,
          actualResult: actualResult !== undefined ? actualResult : existing.actualResult,
          evaluation: evaluation !== undefined ? evaluation : existing.evaluation,
          notes: notes !== undefined ? notes : existing.notes,
          updatedAt: new Date(),
        },
        include: {
          executedBy: {
            select: { id: true, fullName: true, email: true },
          },
          images: {
            orderBy: { uploadedAt: 'asc' },
          },
        },
      });

      return res.json({
        message: 'Cập nhật kết quả kiểm thử thành công',
        execution: updated,
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
      
      // If user cannot view all, filter to only their own executions
      if (!canViewAll && userId) {
        whereClause.executedById = userId;
      }

      const history = await prisma.testExecution.findMany({
        where: whereClause,
        orderBy: { executedAt: 'desc' },
        include: {
          executedBy: {
            select: { fullName: true, email: true },
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
}
