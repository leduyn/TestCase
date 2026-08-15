import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { ExcelImporter, MappedTestCase } from '../services/excelImporter';

export class ImportController {
  static async preview(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Vui lòng tải lên file Excel (.xlsx / .xls)' });
      }

      const result = await ExcelImporter.preview(file.buffer);
      return res.json(result);
    } catch (error: any) {
      console.error('Import preview error:', error);
      return res.status(500).json({
        message: 'Lỗi đọc file Excel',
        error: error.message,
      });
    }
  }

  static async import(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Vui lòng tải lên file Excel (.xlsx / .xls)' });
      }

      const { mapping, target, suiteId, suiteName, moduleName, summary, assumptions } = req.body;

      let parsedMapping: Record<string, string>;
      try {
        parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping || {};
      } catch {
        return res.status(400).json({ message: 'Mapping không hợp lệ (phải là JSON)' });
      }

      if (!parsedMapping || Object.keys(parsedMapping).length === 0) {
        return res.status(400).json({ message: 'Vui lòng thiết lập ánh xạ cột trước khi nhập' });
      }

      const parseResult = await ExcelImporter.parse(file.buffer, parsedMapping);
      const { rows, skipped } = parseResult;

      if (rows.length === 0) {
        return res.status(400).json({
          message: 'Không có dòng nào hợp lệ để nhập. Vui lòng kiểm tra ánh xạ cột.',
          skipped,
        });
      }

      // Resolve user (guest fallback like generate)
      let userId = req.user?.id;
      if (!userId) {
        let defaultUser = await prisma.user.findFirst({ where: { email: 'guest@system.local' } });
        if (!defaultUser) {
          defaultUser = await prisma.user.create({
            data: {
              email: 'guest@system.local',
              passwordHash: 'guest_hash',
              fullName: 'Guest User',
              role: 'TESTER',
            },
          });
        }
        userId = defaultUser.id;
      }

      // Resolve target suite
      let suite;
      if (target === 'existing' && suiteId) {
        suite = await prisma.testSuite.findUnique({ where: { id: suiteId } });
        if (!suite) {
          return res.status(404).json({ message: 'Không tìm thấy bộ Test Suite để thêm dữ liệu' });
        }
      } else {
        const name = (suiteName || 'Bộ Test Case nhập từ Excel').trim();
        const mod = (moduleName || 'Tổng hợp').trim();
        // Create a Document record for referential consistency
        const doc = await prisma.document.create({
          data: {
            userId,
            filename: file.originalname,
            fileType: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileSize: file.size,
            rawContent: JSON.stringify({ mapping: parsedMapping, source: 'excel-import' }),
          },
        });
        suite = await prisma.testSuite.create({
          data: {
            documentId: doc.id,
            name,
            moduleName: mod,
            summary: summary || null,
            assumptions: assumptions || null,
          },
        });
      }

      // Create test cases + initial executions
      const created = await Promise.all(
        rows.map(async (tc: MappedTestCase, idx: number) => {
          const code = tc.testCaseCode || `TC_${String(idx + 1).padStart(3, '0')}`;
          const testCase = await prisma.testCase.create({
            data: {
              testSuiteId: suite.id,
              testCaseCode: code,
              module: tc.module,
              platform: tc.platform,
              title: tc.title,
              testType: tc.testType,
              preconditions: tc.preconditions,
              steps: tc.steps,
              expectedResult: tc.expectedResult,
              priority: tc.priority,
              orderIndex: idx + 1,
            },
          });

          const execution = await prisma.testExecution.create({
            data: {
              testCaseId: testCase.id,
              executedById: userId,
              status: 'UNTESTED',
            },
          });

          return { ...testCase, latestExecution: execution };
        })
      );

      return res.status(201).json({
        message: 'Nhập Test Case từ Excel thành công',
        testSuite: {
          id: suite.id,
          name: suite.name,
          moduleName: suite.moduleName,
          summary: suite.summary,
          assumptions: suite.assumptions,
          createdAt: suite.createdAt,
        },
        importedCount: created.length,
        skippedCount: skipped.length,
        skipped,
        testCases: created,
      });
    } catch (error: any) {
      console.error('Import test cases error:', error);
      return res.status(500).json({
        message: 'Lỗi trong quá trình nhập Test Case từ Excel',
        error: error.message,
      });
    }
  }
}
