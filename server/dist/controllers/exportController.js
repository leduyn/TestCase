"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportController = void 0;
const database_1 = __importDefault(require("../config/database"));
const excelExporter_1 = require("../services/excelExporter");
class ExportController {
    static async exportSuiteExcel(req, res) {
        try {
            const { suiteId } = req.params;
            const suite = await database_1.default.testSuite.findUnique({
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
            const testCaseItems = [];
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
            const buffer = await excelExporter_1.ExcelExporter.generateExcelBuffer({
                title: suite.name,
                moduleName: suite.moduleName,
                summary: suite.summary,
                assumptions: suite.assumptions,
                testCases: testCaseItems,
            });
            const safeFilename = encodeURIComponent(`TestCase_${suite.name.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.xlsx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
            return res.send(buffer);
        }
        catch (error) {
            console.error('Export Excel error:', error);
            return res.status(500).json({ message: 'Lỗi khi xuất file Excel', error: error.message });
        }
    }
}
exports.ExportController = ExportController;
