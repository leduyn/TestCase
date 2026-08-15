import { Request, Response } from 'express';
import prisma from '../config/database';
import { ExcelExporter, ExportTestCaseItem } from '../services/excelExporter';

export class ExportController {
  static async exportSuiteExcel(req: Request, res: Response) {
    try {
      const { suiteId } = req.params;

       const suite = await prisma.testSuite.findUnique({
         where: { id: suiteId },
         include: {
           testCases: {
             orderBy: { orderIndex: 'asc' },
             include: {
               executions: {
                 orderBy: { executedAt: 'desc' },
                 include: {
                   executedBy: {
                     select: { id: true, fullName: true },
                   },
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
         tc.executions.forEach((exec) => {
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

      return res.send(buffer);
    } catch (error: any) {
      console.error('Export Excel error:', error);
      return res.status(500).json({ message: 'Lỗi khi xuất file Excel', error: error.message });
    }
  }
}
