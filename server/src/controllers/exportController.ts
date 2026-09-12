import { Response } from 'express';
import prisma from '../config/database';
import { ExcelExporter, ExportTestCaseItem } from '../services/excelExporter';
import { AuthRequest } from '../middleware/auth';
import { canViewAllExecutionHistory } from '../services/permissionService';

export class ExportController {
  static async exportSuiteExcel(req: AuthRequest, res: Response) {
    try {
      const { suiteId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const canViewAll = await canViewAllExecutionHistory(userId, userRole);

       const suite = await prisma.testSuite.findUnique({
        where: { id: suiteId },
        include: {
          testCases: {
            orderBy: { orderIndex: 'asc' },
            select: {
              testCaseCode: true,
              module: true,
              platform: true,
              title: true,
              testType: true,
              preconditions: true,
              steps: true,
              expectedResult: true,
              priority: true,
              executions: {
                orderBy: { executedAt: 'desc' },
                take: 5000,
                select: {
                  server: true,
                  os: true,
                  actualResult: true,
                  status: true,
                  notes: true,
                  createdById: true,
                  executedById: true,
                  executedBy: { select: { id: true, fullName: true } },
                },
              },
            },
          },
        },
      });

      if (!suite) {
        return res.status(404).json({ message: 'Không tìm thấy bộ Test Suite' });
      }

       const testCaseItems: ExportTestCaseItem[] = [];
       suite.testCases.forEach((tc) => {
        const executions = (!canViewAll && userId)
          ? tc.executions.filter((e: any) => e.createdById === userId || e.executedById === userId)
          : tc.executions;
        executions.forEach((exec: any) => {
          testCaseItems.push({
            testCaseCode: tc.testCaseCode,
            module: tc.module,
            platform: tc.platform,
            title: tc.title,
            testType: tc.testType,
            preconditions: tc.preconditions,
            steps: tc.steps,
            expectedResult: tc.expectedResult,
            priority: tc.priority,
            server: exec.server || '',
            os: exec.os || '',
            actualResult: exec.actualResult || '',
            status: exec.status || 'UNTESTED',
            notes: exec.notes || '',
            executedById: exec.executedBy?.id ?? null,
            executedByName: exec.executedBy?.fullName ?? null,

        });
        });
      });

      const buffer = await ExcelExporter.generateExcelBuffer({
        title: suite.name,
        moduleName: suite.moduleName,
        summary: suite.summary,
        assumptions: suite.assumptions,
        testCases: testCaseItems,
      });

      const safeFilename = encodeURIComponent(
        `TestCase_${suite.name.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.xlsx`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
      );
      res.setHeader('Content-Length', String(buffer.length));

      const CHUNK_SIZE = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, buffer.length);
        if (!res.write(buffer.subarray(offset, end))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      return res.end();
    } catch (error: any) {
      console.error('Export Excel error:', error);
      return res.status(500).json({ message: 'Lỗi khi xuất file Excel', error: error.message });
    }
  }

  static async exportSuiteResultsExcel(req: AuthRequest, res: Response) {
    try {
      const { suiteId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if user can view all execution history
      const canViewAll = await canViewAllExecutionHistory(userId, userRole);

      const suite = await prisma.testSuite.findUnique({
        where: { id: suiteId },
        include: {
          testCases: {
            orderBy: { orderIndex: 'asc' },
            select: {
              testCaseCode: true,
              module: true,
              platform: true,
              title: true,
              testType: true,
              preconditions: true,
              steps: true,
              expectedResult: true,
              priority: true,
              executions: {
                orderBy: { executedAt: 'desc' },
                take: 5000,
                select: {
                  executedAt: true,
                  actualResult: true,
                  status: true,
                  createdById: true,
                  executedById: true,
                  executedBy: { select: { id: true, fullName: true } },
                },
              },
            },
          },
        },
      });

      if (!suite) {
        return res.status(404).json({ message: 'Không tìm thấy bộ Test Suite' });
      }

      // Collect all unique users who have executions (after permission filtering)
      const userMap = new Map<string, string>(); // userId -> fullName
      
      suite.testCases.forEach((tc) => {
        let executions = tc.executions;
        if (!canViewAll && userId) {
          executions = tc.executions.filter((e) => e.createdById === userId || e.executedById === userId);
        }

        executions.forEach((exec) => {
          if (exec.executedById && exec.executedBy?.fullName) {
            userMap.set(exec.executedById, exec.executedBy.fullName);
          }
        });
      });

      const executingUsers = Array.from(userMap.entries()).map(([id, fullName]) => ({ id, fullName }));

      // Build consolidated test case data
      const testCaseItems = suite.testCases.map((tc) => {
        let executions = tc.executions;
        if (!canViewAll && userId) {
          executions = tc.executions.filter((e) => e.createdById === userId || e.executedById === userId);
        }

        // Get latest execution per user for this test case
        const userLatestExecutions = new Map<string, typeof executions[0]>();
        executions.forEach((exec) => {
          if (exec.executedById) {
            const existing = userLatestExecutions.get(exec.executedById);
            if (!existing || new Date(exec.executedAt) > new Date(existing.executedAt)) {
              userLatestExecutions.set(exec.executedById, exec);
            }
          }
        });

        // Build user results map
        const userResults = new Map<string, { summary: string; status: string }>();
        executingUsers.forEach((user) => {
          const exec = userLatestExecutions.get(user.id);
          if (exec) {
            const summary = exec.actualResult 
              ? exec.actualResult.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().substring(0, 255)
              : '';
            const status = exec.status || 'UNTESTED';
            userResults.set(user.id, { summary, status });
          } else {
            userResults.set(user.id, { summary: '', status: 'UNTESTED' });
          }
        });

        return {
          testCaseCode: tc.testCaseCode,
          module: tc.module,
          platform: tc.platform,
          title: tc.title,
          testType: tc.testType,
          preconditions: tc.preconditions,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          priority: tc.priority,
          userResults,
        };
      });

      const buffer = await ExcelExporter.generateConsolidatedResultsExcelBuffer({
        title: suite.name,
        moduleName: suite.moduleName,
        summary: suite.summary,
        assumptions: suite.assumptions,
        testCases: testCaseItems,
        executingUsers,
      });

      const safeFilename = encodeURIComponent(
        `TestCase_Results_${suite.name.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.xlsx`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
      );
      res.setHeader('Content-Length', String(buffer.length));

      const CHUNK_SIZE = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, buffer.length);
        if (!res.write(buffer.subarray(offset, end))) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
      return res.end();
    } catch (error: any) {
      console.error('Export Results Excel error:', error);
      return res.status(500).json({ message: 'Lỗi khi xuất file kết quả test', error: error.message });
    }
  }
}
