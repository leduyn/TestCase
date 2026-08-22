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
      const validStatuses: TestExecutionStatus[] = ['PASSED', 'FAILED', 'BLOCKED', 'UNTESTED'];
      const executionStatus: TestExecutionStatus = validStatuses.includes(status) ? status : 'UNTESTED';

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
